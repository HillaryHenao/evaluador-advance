# CAPEX por proyecto y eliminación del resumen general — Diseño

## Contexto y objetivo

El cambio anterior (`docs/superpowers/specs/2026-07-14-desglose-itemizado-design.md`) movió el desglose por proyecto arriba e itemizó sus criterios, pero dejó intacto el sidebar general "Resumen de costos" (`SummaryPanel.vue`). Ese sidebar, para los 6 criterios de scope `proyecto`, suma el sobrecosto de todos los proyectos activos en una sola línea (ej. "Distancia a vía: $X" es en realidad la suma de P1 + P2) — comportamiento correcto por diseño (cada proyecto necesita su propio acceso físico), pero confuso ahora que existe una vista por proyecto justo arriba: la misma información aparece dos veces, una combinada y otra desglosada, sin indicar que la del sidebar es una suma.

Objetivo: eliminar el sidebar general "Resumen de costos" y que cada tarjeta de proyecto (panel de arriba) sea autosuficiente — mostrando su propio **CAPEX completo** (no solo el subtotal de sobrecostos que muestra hoy), sin perder las dos cifras agregadas del terreno que sí siguen siendo válidas a nivel terreno completo (CAPEX total y riesgo de retraso en meses).

Verificado en el código: `SummaryPanel.vue` es de solo lectura — no contiene ningún input editable (`store.baseCapex` es una constante interna, sin control de UI en ningún lado del código). Eliminar el componente no quita ninguna capacidad de captura de datos.

## Qué se elimina

- `frontend/src/components/SummaryPanel.vue` — archivo completo.
- Su import y `<SummaryPanel />` en `frontend/src/views/EvaluadorView.vue`.
- `frontend/src/components/FinancialResultsPanel.vue` (el otro sidebar, "Resultados financieros" — TIR/VPN general + inputs de kVA y arriendo manual) **no cambia**.

## Qué se agrega a `ProjectBreakdownPanel.vue`

### 1. Fila superior (una sola vez, junto a TIR/Payback que ya se muestran ahí)

Dos cifras agregadas del terreno completo que se perderían al quitar el sidebar y que **no** tienen sentido re-derivadas sumando las tarjetas de proyecto (ver nota abajo):

- **CAPEX Total del terreno**: `store.aggregated.capexTotal` (cálculo general existente, sin cambios — ya incluye el ajuste de `cluster`).
- **Meses de retraso estimado + costo total de riesgo**: `store.aggregated.totalRetrasoMeses` (meses) y `store.aggregated.totalRetraso + store.aggregated.totalRiesgoCosto` (costo), con la nota "No incluido en el CAPEX" — mismo dato y estilo destacado que ya tenía `SummaryPanel.vue`.

**Por qué no sumar las tarjetas de proyecto para obtener estos totales:** `cluster` (scope `terreno_no_dividido`) es un ajuste que solo existe en el cálculo general — nunca aparece en `store.perProjectResults` de ningún proyecto (por diseño, ver `docs/superpowers/specs/2026-07-11-desglose-por-proyecto-design.md`). Sumar el CAPEX de las N tarjetas de proyecto excluiría ese ajuste y daría un número distinto (y equivocado) al CAPEX real del terreno. Por eso esta fila usa el agregado general ya existente, no una suma nueva.

### 2. Dentro de cada tarjeta de proyecto (después del itemizado de "Fijos" ya existente)

Dos filas nuevas, en una caja destacada (mismo estilo que tenía la caja "CAPEX Total estimado" del sidebar eliminado):

- **CAPEX base**: `store.baseCapex / N` (N = cantidad de proyectos activos, ya calculado hoy en el panel como `Math.max(store.proyectoNombres.length, 1)`).
- **CAPEX total**: `CAPEX base + costosFijos` de ese proyecto (donde `costosFijos` es el subtotal de "Fijos" que ya se calcula y muestra hoy).

Esto convierte el subtotal "Fijos" (ya existente, sin cambios) más este nuevo bloque en un CAPEX genuinamente propio por proyecto, en vez de solo un delta de sobrecostos.

## Layout

`EvaluadorView.vue`: `.evaluador-body` pasa de 3 hijos flex (`main` + `SummaryPanel` + `FinancialResultsPanel`) a 2 (`main` + `FinancialResultsPanel`). El área principal (`main`) gana el ancho que liberó el sidebar eliminado — no requiere ajuste manual de CSS más allá de quitar el componente, ya que `.evaluador-main { flex: 1; }` se expande automáticamente.

## Fuera de alcance

- No se reintroduce ningún input editable (baseCapex, etc.) — no existía antes, no se agrega ahora.
- No cambia `FinancialResultsPanel.vue` ni sus inputs (kVA, arriendo manual).
- No cambia ningún cálculo de `evaluatorEngine.ts` / `evaluatorStore.ts` — todos los números usados (`aggregated.capexTotal`, `aggregated.totalRetrasoMeses`, `aggregated.totalRetraso`, `aggregated.totalRiesgoCosto`, `baseCapex`) ya existen y no se recalculan de forma nueva.
- No se agrega un toggle para colapsar tarjetas (ya descartado en el spec anterior).
