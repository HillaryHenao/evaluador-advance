# Obras hidráulicas — Diseño

## Contexto y objetivo

El evaluador tiene hoy un criterio placeholder `obras_hidraulicas` (`frontend/src/criteria/obras_hidraulicas.ts`): un select cualitativo (Ninguna/Baja/Media/Alta) con `formulaDefined: false` y `computeCost` que siempre retorna 0 — no aporta al CAPEX.

El usuario definió 4 tipos concretos de obra hidráulica con costos reales (mano de obra + materiales incluidos):

| Tipo de obra | Medida | Costo aprox. |
|---|---|---|
| Canal en concreto (2m x 0.5m) | por metro lineal | $1.300.000/m |
| Cuneta típica de vía | por metro lineal | $300.000/m |
| Obra de cruce — Box culvert (3m x 3m) | por cruce (valor específico, no lineal) | $170.000.000 |
| Obra de cruce — Alcantarilla (Ø0.9m) | por cruce (valor específico, no lineal) | $50.000.000 |

Objetivo: reemplazar el placeholder por un cálculo real. Un mismo terreno puede requerir varios tipos de obra combinados a la vez (ej. 40m de canal + 1 box culvert), así que cada tipo debe sumar independientemente al sobrecosto total.

## Decisiones (validadas con el usuario)

- **Los 4 tipos se combinan**, no son mutuamente excluyentes — cada uno es un criterio independiente cuyo sobrecosto se suma al CAPEX total (el motor ya suma todos los criterios `category: 'fijo'`/`'ambas'` vía `aggregateCosts`, sin cambios necesarios ahí).
- **4 tarjetas separadas en la UI**, no una tarjeta compuesta. Esto encaja con la arquitectura existente de "un criterio = un valor escalar + un `computeCost`" sin tocar `CriterionValue`, `evaluatorEngine.ts` ni `CriterionCard.vue`. Sigue el mismo patrón que `corte.ts` (número manual × tarifa fija).
- **Todos son de ingreso manual** (`dataSource: 'manual'`) — no hay dato equivalente en la BD de originabot para ninguno de los 4 tipos, igual que `corte` o `pilotes`.
- **Categoría `fijo`** para los 4 — son costos de obra civil conocidos, no factores de riesgo probabilístico (a diferencia de la sección "Factores de riesgo").

## Módulos nuevos

Se elimina `frontend/src/criteria/obras_hidraulicas.ts` y se agregan 4 archivos nuevos en `frontend/src/criteria/`, cada uno con la forma exacta de `CriterionModule` (ver `frontend/src/types/index.ts`):

| Archivo | id | label | inputType | unit | dataSource | category | tarifa |
|---|---|---|---|---|---|---|---|
| `canal_concreto.ts` | `canal_concreto` | Canal en concreto (2m x 0.5m) | `number` | `m` | `manual` | `fijo` | 1.300.000 COP/m |
| `cuneta_via.ts` | `cuneta_via` | Cuneta típica de vía | `number` | `m` | `manual` | `fijo` | 300.000 COP/m |
| `box_culvert.ts` | `box_culvert` | Obra de cruce — Box culvert 3m x 3m | `number` | `cruces` | `manual` | `fijo` | 170.000.000 COP/cruce |
| `alcantarilla_cruce.ts` | `alcantarilla_cruce` | Obra de cruce — Alcantarilla Ø0.9m | `number` | `cruces` | `manual` | `fijo` | 50.000.000 COP/cruce |

Cada `computeCost` sigue el patrón de `corte.ts`:

```ts
computeCost(value: CriterionValue, _context: EvalContext): number {
  if (value === null || typeof value !== 'number') return 0
  return value * TARIFA
}
```

`formulaDefined: true` en los 4 (deja de mostrarse el badge "Pendiente" que tenía el placeholder).

## Integración

- **`frontend/src/views/EvaluadorView.vue`**: en `FIJO_ORDER`, reemplazar la entrada `'obras_hidraulicas'` por las 4 entradas nuevas, agrupadas en el mismo lugar de la lista:
  ```ts
  const FIJO_ORDER = [
    'distancia_red', 'distancia_via',
    'corte', 'lleno',
    'nivel_tension', 'cluster',
    'canal_concreto', 'cuneta_via', 'box_culvert', 'alcantarilla_cruce',
    'aprovechamiento_forestal',
  ]
  ```
- El sistema de carga de criterios (`loadCriteria()` en `evaluatorEngine.ts`) usa `import.meta.glob('../criteria/*.ts', { eager: true })`, así que los 4 archivos nuevos se descubren automáticamente sin registro manual adicional.
- No hay cambios en `types/index.ts`, `evaluatorEngine.ts` ni `CriterionCard.vue` — la UI genérica de `inputType: 'number'` ya renderiza correctamente estos 4 criterios.

## Testing

En `frontend/src/criteria/__tests__/criteria.test.ts`, agregar un `describe` por criterio nuevo siguiendo el patrón de `corte`/`numero_arboles`:

```ts
describe('canal_concreto', () => {
  it('calcula 1.300.000 COP por metro', () => {
    expect(canalConcreto.computeCost(40, ctx)).toBe(52_000_000)
  })
  it('retorna 0 para valor nulo', () => {
    expect(canalConcreto.computeCost(null, ctx)).toBe(0)
  })
})
// ... análogo para cuneta_via (300.000/m), box_culvert (170.000.000/cruce), alcantarilla_cruce (50.000.000/cruce)
```

## Fuera de alcance

- No se modelan tamaños/variantes adicionales de obra (ej. box culvert de otras dimensiones, canal de otras medidas) — si aparecen en el futuro, se agregan como criterios adicionales siguiendo el mismo patrón.
- No se toca el motor financiero (`financialEngine.ts`) — estos criterios ya alimentan el CAPEX vía `aggregated.capexTotal`, que el motor financiero ya consume.
- No se elimina el badge "Pendiente" de otros criterios — solo afecta a los 4 nuevos, que nacen con `formulaDefined: true`.
