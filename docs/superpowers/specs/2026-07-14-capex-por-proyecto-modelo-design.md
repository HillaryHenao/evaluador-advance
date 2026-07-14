# CAPEX/kWp/kVA/arriendo son por proyecto, no del terreno — Diseño

## Contexto y objetivo

Al implementar el CAPEX por proyecto (`docs/superpowers/specs/2026-07-14-capex-por-proyecto-design.md`), el usuario notó un número real incorrecto: con un terreno de 2 proyectos, la app mostraba "CAPEX Total del terreno: 4.000M" y "CAPEX base [por proyecto]: 2.000M" — pero el modelo de negocio real es el inverso: **CAPEX base (4.000M) es lo que cuesta construir UN proyecto típico** (~1.32 MWp). Si el terreno tiene 2 proyectos, cada uno construye su propia instalación completa — el terreno necesita **2 × 4.000M = 8.000M**, no 4.000M repartido en dos mitades.

Esto viene de un supuesto heredado de antes de que existiera el desglose por proyecto: `baseCapex`/`kWp`/`kVA` se diseñaron originalmente (`docs/superpowers/specs/2026-07-03-motor-financiero-design.md`) para UN terreno-como-una-sola-unidad. Cuando se agregó la vista por proyecto (`docs/superpowers/specs/2026-07-11-desglose-por-proyecto-design.md`), se asumió — incorrectamente — que estos valores eran del terreno completo y debían **dividirse** entre N para obtener la vista por proyecto. Confirmado con el usuario: es al revés.

**Validado con el usuario:**
- `baseCapex` (hoy constante fija, default 4.000M): es por proyecto. General del terreno = `baseCapex × N`. Cada proyecto usa el valor completo, sin dividir.
- `kWp` ("Potencia instalada DC", hoy constante fija, default 1320): mismo criterio — por proyecto, general = `kWp × N`.
- `kVA` ("Potencia instalada AC", input editable, default 1000): mismo criterio — por proyecto, general = `kVA × N`.
- `arriendoAnual`: cada proyecto tiene su propio contrato de arriendo — hay que **sumarlos** para el general (no eran divisibles ni tampoco un solo valor compartido). El backend hoy comete el mismo error de "un solo proyecto arbitrario" que ya se corrigió para otros campos (`ocupacion_cauce`, `servidumbre`, `coexistencias`, `nivel_tension`) — nunca se corrigió para `arriendo_anual`.

Ningún criterio de `frontend/src/criteria/*.ts` lee `context.baseCapex` ni `context.kWp` en su fórmula de costo (verificado por búsqueda en el código) — el radio de impacto de este cambio es acotado: solo el motor financiero (`financialEngine.ts`, consumido vía `evaluatorStore.ts`) y el cálculo de `capexTotal` en `aggregateCosts` (`evaluatorEngine.ts`) usan estos valores.

## Backend (`terrain_service.py`)

### `_get_proyectos_activos`: agregar `arriendo_anual` por proyecto

Nueva columna en el SELECT (mismo patrón que ya usa la subconsulta de nivel superior, pero ahora por cada fila de proyecto):

```sql
(
    SELECT ts.rent_annual_cost_cop FROM termsheet_termsheet ts
    WHERE ts.id = p.termsheet_id
)                                           AS arriendo_anual
```

Se agrega `'arriendo_anual': r['arriendo_anual']` al dict retornado por cada proyecto.

### `get_terrain_data`: `arriendo_anual` de nivel superior pasa de "un proyecto arbitrario" a "suma de proyectos activos"

Reemplaza la subconsulta actual (que depende del `p` elegido arbitrariamente por `ORDER BY p.id DESC LIMIT 1`):

```sql
(
    SELECT ts.rent_annual_cost_cop
    FROM termsheet_termsheet ts
    WHERE ts.id = p.termsheet_id
)                                           AS arriendo_anual
```

Por (mismo patrón de agregación que ya usa `cluster` — subconsulta correlacionada sobre todos los proyectos activos del terreno, no sobre el `p` elegido):

```sql
(
    SELECT SUM(ts.rent_annual_cost_cop)
    FROM minifarm_project mp3
    JOIN termsheet_termsheet ts ON ts.id = mp3.termsheet_id
    WHERE mp3.terrain_id = t.id
      AND mp3.stage NOT IN ('dead', 'paused', 'uci')
)                                           AS arriendo_anual
```

`SUM` sobre cero filas devuelve `NULL` en PostgreSQL — mismo comportamiento de "sin dato" que hoy cuando el proyecto no tiene termsheet, no requiere manejo especial adicional en Python.

## Frontend — tipos (`types/index.ts`)

`ProyectoData` gana `arriendo_anual: number | null`.

## Frontend — store (`evaluatorStore.ts`)

### `context` (general): multiplicar por N

```ts
const context = computed(() => ({
  baseCapex: baseCapex.value * projectCount.value,
  kWp: kWp.value * projectCount.value,
  projectCount: projectCount.value,
}))
```

Esto hace que `store.aggregated.capexTotal` (`context.baseCapex + totalSobrecostoFijo`, sin cambios en `aggregateCosts` mismo) refleje correctamente `N × capex-por-proyecto + sobrecostos ya sumados del terreno`.

### `financialResults` (general): `kWp`/`kVA` también multiplicados por N

Encontrar:

```ts
return calcularFinanzas({
  capex: aggregated.value.capexTotal,
  kWp: kWp.value,
  kVA: kVA.value,
  produccionEspecifica,
  arriendoAnual,
})
```

Reemplazar por:

```ts
return calcularFinanzas({
  capex: aggregated.value.capexTotal,
  kWp: kWp.value * projectCount.value,
  kVA: kVA.value * projectCount.value,
  produccionEspecifica,
  arriendoAnual,
})
```

`arriendoAnual` no cambia aquí — ya viene correctamente sumado desde `terrainData.value.arriendo_anual` gracias al fix de backend.

### `perProjectFinancials`: reescritura completa — ya no se divide nada

Cada proyecto usa: su propio `baseCapex` (completo, sin dividir) + su propio subtotal de sobrecostos fijos (ya lo calcula `aggregateCosts(perProjectResults[nombre], ...)`), su propio `kWp`/`kVA` (completos), y su propio `arriendo_anual` (de `terrainData.value.proyectos`, NUEVO campo, no el general dividido).

```ts
const perProjectFinancials = computed<Record<string, { vpn: number; vpnConBeneficios: number }> | null>(() => {
  const produccionEspecifica = terrainData.value?.produccion_especifica
  if (!produccionEspecifica) return null

  const resultado: Record<string, { vpn: number; vpnConBeneficios: number }> = {}
  for (const proyecto of terrainData.value?.proyectos ?? []) {
    const arriendoProyecto = proyecto.arriendo_anual
    if (!arriendoProyecto) continue

    const results = perProjectResults.value[proyecto.nombre] ?? []
    const capexProyecto = baseCapex.value + aggregateCosts(results, {
      baseCapex: baseCapex.value, kWp: kWp.value, projectCount: 1,
    }).totalSobrecostoFijo

    const finanzas = calcularFinanzas({
      capex: capexProyecto,
      kWp: kWp.value,
      kVA: kVA.value,
      produccionEspecifica,
      arriendoAnual: arriendoProyecto,
    })
    resultado[proyecto.nombre] = { vpn: finanzas.vpn, vpnConBeneficios: finanzas.vpnConBeneficios }
  }
  return Object.keys(resultado).length > 0 ? resultado : null
})
```

Un proyecto sin `arriendo_anual` propio (termsheet incompleto) se omite del resultado en vez de usar un valor incorrecto — igual que hoy `financialResults` general devuelve `null` completo si falta el dato, pero aquí es por-proyecto: los demás proyectos con dato completo sí calculan su VPN.

**Nota (comportamiento ya conocido y aceptado, no cambia con este fix):** `financialEngine.ts` tiene 3 costos fijos que no escalan con capex/kWp/kVA (servicios públicos, mantenimiento de tracker, reemplazo de inversores — ver decisión ya documentada en `.superpowers/sdd/progress.md`). Calcular el VPN de cada proyecto de forma independiente sigue pagando esos costos fijos una vez por proyecto, así que la suma de los VPN por proyecto seguirá sin ser exactamente igual al VPN general — eso ya estaba aceptado antes de este cambio y sigue igual ahora, no es una regresión nueva.

## `ProjectBreakdownPanel.vue`: revertir la división de `capexBase`

El cambio anterior (spec `2026-07-14-capex-por-proyecto-design.md`) introdujo `capexBase = store.baseCapex / n`. Con el modelo corregido, cada proyecto usa el capex base **completo**, sin dividir:

```ts
const capexBase = store.baseCapex
```

(reemplaza `const capexBase = store.baseCapex / n`). `capexTotal = capexBase + costosFijos` no cambia de fórmula, solo cambia lo que vale `capexBase`.

## Fuera de alcance

- No se agrega UI para editar `baseCapex`/`kWp` por proyecto individualmente — siguen siendo un único valor global aplicado a todos los proyectos por igual (mismo alcance que hoy: un solo input de `kVA`, sin campo para `baseCapex`/`kWp`).
- No se resuelve la discrepancia ya conocida y aceptada entre la suma de VPN por proyecto y el VPN general (costos fijos no escalables del motor financiero) — se mantiene igual que la decisión ya tomada anteriormente.
- No cambia la lógica de `evaluateScoped` ni la clasificación de scope de los 18 criterios — ningún criterio usa `context.baseCapex`/`context.kWp`, así que no hay impacto ahí.
