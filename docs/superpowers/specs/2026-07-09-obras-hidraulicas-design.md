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

Objetivo: reemplazar el placeholder por un cálculo real. Un mismo terreno puede requerir varios tipos de obra combinados a la vez (ej. 40m de canal + 1 box culvert), así que el usuario necesita marcar cuáles tipos aplican e ingresar su cantidad para cada uno.

## Decisiones (validadas con el usuario)

- **Los 4 tipos se combinan** — no son mutuamente excluyentes. El criterio permite marcar varios a la vez y su costo se suma.
- **Ingreso manual siempre** (`dataSource: 'manual'`) — no hay dato equivalente en la BD de originabot para ninguno de los 4 tipos.
- **UI: un checklist agrupado dentro de una sola tarjeta** "Obras hidráulicas" (no 4 tarjetas separadas ni un select cualitativo). Se agrupan visualmente en dos secciones:
  - **Costo por metro lineal**: Canal en concreto, Cuneta típica de vía — al marcar el checkbox se habilita un campo de metros.
  - **Costo fijo por cruce**: Box culvert, Alcantarilla — al marcar el checkbox se habilita un campo de cantidad de cruces (un terreno puede tener más de un cruce del mismo tipo, ej. 2 alcantarillas = 2 × $50.000.000).
- Si un ítem no está marcado, su cantidad (si tiene alguna cargada) se ignora en el cálculo.
- **Categoría `fijo`** para el criterio completo — es un costo de obra civil conocido, no un factor de riesgo probabilístico.

## Modelo de datos

Este criterio es una excepción puntual al patrón general "un criterio = un valor escalar" que usan los demás 21 criterios — la misma clase de excepción que ya existe en `CriterionCard.vue` para mostrar detalle de `coexistencias`/`servidumbre`/`aprovechamiento_forestal` (ahí es solo display; acá es también input). Se justifica porque el usuario necesita marcar varios ítems independientes con cantidad propia dentro de un mismo criterio, algo que no cubre ninguno de los `inputType` existentes (`number`, `toggle`, `select`).

**`frontend/src/types/index.ts`** — nuevos tipos y ampliación de `CriterionValue`:

```ts
export interface ObraHidraulicaItem {
  activo: boolean
  cantidad: number | null
}

export interface ObrasHidraulicasValue {
  canal_concreto: ObraHidraulicaItem
  cuneta_via: ObraHidraulicaItem
  box_culvert: ObraHidraulicaItem
  alcantarilla_cruce: ObraHidraulicaItem
}

export type CriterionValue = number | boolean | string | null | ObrasHidraulicasValue
```

`CriterionModule.inputType` gana un nuevo valor: `'checklist'` (además de `'number' | 'toggle' | 'select'`).

`CriterionModule` gana un campo opcional, usado únicamente por criterios con `inputType: 'checklist'`:

```ts
export interface ChecklistItemDef {
  key: string          // debe existir como propiedad en ObrasHidraulicasValue
  label: string
  unit: string
  group: 'metro' | 'fijo'
  groupLabel: string   // 'Costo por metro lineal' | 'Costo fijo por cruce'
  tarifa: number
}

export interface CriterionModule {
  // ...campos existentes sin cambios...
  checklistItems?: ChecklistItemDef[]
}
```

## Módulo `frontend/src/criteria/obras_hidraulicas.ts` (se reescribe completo)

```ts
const ITEMS: ChecklistItemDef[] = [
  { key: 'canal_concreto', label: 'Canal en concreto (2m x 0.5m)', unit: 'm', group: 'metro', groupLabel: 'Costo por metro lineal', tarifa: 1_300_000 },
  { key: 'cuneta_via', label: 'Cuneta típica de vía', unit: 'm', group: 'metro', groupLabel: 'Costo por metro lineal', tarifa: 300_000 },
  { key: 'box_culvert', label: 'Box culvert (3m x 3m)', unit: 'cruces', group: 'fijo', groupLabel: 'Costo fijo por cruce', tarifa: 170_000_000 },
  { key: 'alcantarilla_cruce', label: 'Alcantarilla (Ø0.9m)', unit: 'cruces', group: 'fijo', groupLabel: 'Costo fijo por cruce', tarifa: 50_000_000 },
]

const obrasHidraulicas: CriterionModule = {
  id: 'obras_hidraulicas',
  label: 'Obras hidráulicas',
  inputType: 'checklist',
  dataSource: 'manual',
  formulaDefined: true,
  category: 'fijo',
  checklistItems: ITEMS,
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (!value || typeof value !== 'object') return 0
    const v = value as ObrasHidraulicasValue
    return ITEMS.reduce((total, item) => {
      const entry = v[item.key as keyof ObrasHidraulicasValue]
      if (!entry?.activo || typeof entry.cantidad !== 'number') return total
      return total + entry.cantidad * item.tarifa
    }, 0)
  },
}

export default obrasHidraulicas
```

## UI — `frontend/src/components/CriterionCard.vue`

Nueva rama de template para `module?.inputType === 'checklist'`, agrupando `module.checklistItems` por `group` (dos secciones: "Costo por metro lineal" y "Costo fijo por cruce"). Por cada ítem:

- Checkbox — estado `value?.[item.key]?.activo` (con `value` por defecto objeto vacío si `result.value === null`).
- Si está marcado: campo numérico para `cantidad`, con `item.unit` como sufijo.
- Al cambiar cualquiera de los dos, se reconstruye el objeto `ObrasHidraulicasValue` completo (clonando el valor actual y actualizando solo el ítem tocado) y se llama `store.setCriterionValue('obras_hidraulicas', updated)`.

El resto de la tarjeta (badges, sección de sobrecosto total vía `result.sobrecosto`) no cambia — ya es genérico y funciona igual para cualquier criterio con `category !== 'probabilidad'`.

## Integración

- `frontend/src/views/EvaluadorView.vue`: sin cambios — `'obras_hidraulicas'` ya está en `FIJO_ORDER`.
- `frontend/src/stores/evaluatorStore.ts`: sin cambios — `setCriterionValue(id, value)` ya es genérico sobre `CriterionValue`.
- `frontend/src/engine/evaluatorEngine.ts`: sin cambios — `aggregateCosts` ya suma cualquier criterio `category: 'fijo'` sin importar la forma de su `value`.

## Testing

`frontend/src/criteria/__tests__/criteria.test.ts` — nuevo `describe('obras_hidraulicas')`:

- Objeto con `canal_concreto: { activo: true, cantidad: 40 }` y el resto `{ activo: false, cantidad: null }` → `52_000_000`.
- Combinación de dos ítems activos (ej. canal + box_culvert) → suma de ambos.
- Ítem con `cantidad` cargada pero `activo: false` → se ignora (no suma).
- `value === null` → retorna 0.
- `formulaDefined` es `true` y `category` es `fijo`.

## Fuera de alcance

- No se modelan tamaños/variantes adicionales de obra (ej. box culvert de otras dimensiones) — si aparecen en el futuro, se agregan como ítems adicionales al array `ITEMS`.
- No se toca el motor financiero (`financialEngine.ts`) — este criterio ya alimenta el CAPEX vía `aggregated.capexTotal`, que el motor financiero ya consume.
- No se persiste el checklist en la BD — es siempre manual y se resetea al buscar un nuevo terreno, igual que los demás criterios manuales.
