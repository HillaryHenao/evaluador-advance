# Crédito de cluster repartido + detalle de aprovechamiento forestal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two gaps found reviewing `COLBOYT147` in the evaluator: the -15M cluster credit doesn't reach the per-project cost breakdown, and a resolved `aprovechamiento_forestal` state (e.g. "Exonerado") collapses to `null` with no visible trace of the real DB value.

**Architecture:** `cluster.ts` changes `scope` from `'terreno_no_dividido'` to `'terreno_dividido'`, activating the per-project division logic that already exists in `evaluatorEngine.ts` for that scope (no new logic needed there — only removal of the now-dead `'terreno_no_dividido'` branch and type). Backend adds a new `aprovechamiento_forestal_detalle` field to each entry in `proyectos[]`, carrying the raw DB status even when it's resolved (mirrors how `servidumbre_detalle`/`ocupacion_cauce_detalle` already work for terrain-wide criteria); `CriterionCard.vue`'s per-project row rendering falls back to that detail text instead of a bare dash when the criterion's own `value` is `null`.

**Tech Stack:** Flask/psycopg2 (backend), Vue 3 + TypeScript + Pinia (frontend), pytest, Vitest.

## Global Constraints

- `cluster` is the only criterion using scope `'terreno_no_dividido'` today (confirmed by grep across `frontend/src/criteria/*.ts`) — removing that scope value entirely is safe cleanup, not a breaking change for any other criterion.
- Backend test command: `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -v` (expect all pass except `test_terrain_requires_auth` — pre-existing local-env artifact).
- Frontend test command: `cd frontend && npx vitest run` and `npx vue-tsc -b` (expect exactly 1 pre-existing unrelated error: `vite.config.ts(13,3)`).
- This repo has no automated component tests for `.vue` files — `CriterionCard.vue`'s change is verified by type-check + code trace + manual browser check, not a test suite.
- `aprovechamiento_forestal_detalle` follows the exact same test-update pattern already used for `arriendo_anual` in `backend/tests/test_terrain_service.py` (see git history, commit `fc4ac13`) — extend the two existing `_get_proyectos_activos` tests, don't write new ones.
- Coexistencias is confirmed NOT a bug (verified directly against `entities_coexistence` — zero rows for COLBOYT147's projects) and is out of scope for this plan.

---

### Task 1: Backend — `aprovechamiento_forestal_detalle` per project

**Files:**
- Modify: `backend/app/services/terrain_service.py`
- Modify: `backend/tests/test_terrain_service.py`

**Interfaces:**
- Produces (used by Task 2): `proyectos[]` entries gain `aprovechamiento_forestal_detalle: str | None` — the raw forestal-license status text (e.g. `"Exonerado"`, `"Visita"`, `"Solicitud radicada"`), `None` only when there's truly no data.

- [ ] **Step 1: Write the failing tests**

Update `test_get_proyectos_activos_devuelve_datos_por_proyecto` in `backend/tests/test_terrain_service.py`:

Find:
```python
    assert proyectos == [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR', 'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_estructura': 'tracker', 'numero_arboles': 2, 'aprovechamiento_forestal': 'visita',
            'arriendo_anual': 12_000_000.0,
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR', 'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_estructura': 'mesa_fija', 'numero_arboles': 0, 'aprovechamiento_forestal': None,
            'arriendo_anual': 8_000_000.0,
        },
    ]
```

Replace:
```python
    assert proyectos == [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR', 'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_estructura': 'tracker', 'numero_arboles': 2, 'aprovechamiento_forestal': 'visita',
            'aprovechamiento_forestal_detalle': 'Visita',
            'arriendo_anual': 12_000_000.0,
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR', 'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_estructura': 'mesa_fija', 'numero_arboles': 0, 'aprovechamiento_forestal': None,
            'aprovechamiento_forestal_detalle': 'Exonerado',
            'arriendo_anual': 8_000_000.0,
        },
    ]
```

(P2's mock row has `'aprov_value': None, 'aprov_status': 'exonerated'` — the existing fallback in `_get_proyectos_activos` already turns that into the raw string `'Exonerado'` before resolving the nivel; this test just also asserts that raw string now surfaces in the new field instead of being discarded.)

Update `test_get_proyectos_activos_arboles_cero_cuando_forestal_resuelto_sin_dato` in the same file:

Find:
```python
    assert proyectos[0]['numero_arboles'] == 0
    assert proyectos[0]['aprovechamiento_forestal'] is None
    assert proyectos[1]['numero_arboles'] is None
    assert proyectos[1]['aprovechamiento_forestal'] == 'visita'
```

Replace:
```python
    assert proyectos[0]['numero_arboles'] == 0
    assert proyectos[0]['aprovechamiento_forestal'] is None
    assert proyectos[0]['aprovechamiento_forestal_detalle'] == 'Exonerado'
    assert proyectos[1]['numero_arboles'] is None
    assert proyectos[1]['aprovechamiento_forestal'] == 'visita'
    assert proyectos[1]['aprovechamiento_forestal_detalle'] == 'Visita'
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v`

Expected: FAIL on both updated tests — `aprovechamiento_forestal_detalle` isn't a key in the dicts `_get_proyectos_activos` returns yet.

- [ ] **Step 3: Add `aprovechamiento_forestal_detalle` to `_get_proyectos_activos`**

Find (in `backend/app/services/terrain_service.py`, the dict construction at the end of the function's loop):

```python
        proyectos.append({
            'nombre': r['nombre'],
            'distancia_via': r['distancia_via'],
            'distancia_red': r['distancia_red'],
            'tipo_estructura': tipo_estructura,
            'numero_arboles': numero_arboles,
            'aprovechamiento_forestal': _resolve_aprovechamiento_nivel(aprov_raw),
            'arriendo_anual': r['arriendo_anual'],
        })
```

Replace:

```python
        proyectos.append({
            'nombre': r['nombre'],
            'distancia_via': r['distancia_via'],
            'distancia_red': r['distancia_red'],
            'tipo_estructura': tipo_estructura,
            'numero_arboles': numero_arboles,
            'aprovechamiento_forestal': _resolve_aprovechamiento_nivel(aprov_raw),
            'aprovechamiento_forestal_detalle': aprov_raw or None,
            'arriendo_anual': r['arriendo_anual'],
        })
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v`

Expected: PASS — all tests in this file.

- [ ] **Step 5: Run the full backend suite**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/ -v`

Expected: all pass except `test_terrain_requires_auth` (pre-existing local-env artifact).

- [ ] **Step 6: Smoke-test against the live dev backend**

If the backend dev server is running (`http://127.0.0.1:5000`), restart it and run:

```bash
curl -s http://127.0.0.1:5000/api/terrain/COLBOYT147
```

Expected: both entries in `proyectos[]` now show `"aprovechamiento_forestal_detalle": "Exonerado"`.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/terrain_service.py backend/tests/test_terrain_service.py
git commit -m "feat: add aprovechamiento_forestal_detalle to expose resolved forestal license status"
```

---

### Task 2: Frontend — consume `aprovechamiento_forestal_detalle` in `CriterionCard.vue`

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/components/CriterionCard.vue`
- Modify: `frontend/src/stores/__tests__/evaluatorStore.test.ts`

**Interfaces:**
- Consumes: `ProyectoData.aprovechamiento_forestal_detalle` (Task 1's backend field).
- Produces: nothing consumed by later tasks — Task 3 (cluster) is independent of this one.

- [ ] **Step 1: Add the field to `ProyectoData`**

Find (in `frontend/src/types/index.ts`):

```ts
export interface ProyectoData {
  nombre: string
  distancia_via: number | null
  distancia_red: number | null
  aprovechamiento_forestal: string | null
  numero_arboles: number | null
  tipo_estructura: string | null
  arriendo_anual: number | null
}
```

Replace:

```ts
export interface ProyectoData {
  nombre: string
  distancia_via: number | null
  distancia_red: number | null
  aprovechamiento_forestal: string | null
  aprovechamiento_forestal_detalle: string | null
  numero_arboles: number | null
  tipo_estructura: string | null
  arriendo_anual: number | null
}
```

- [ ] **Step 2: Run the type-check to see the new errors**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: new errors in `frontend/src/stores/__tests__/evaluatorStore.test.ts` — 5 object literals typed as `ProyectoData` are now missing the required `aprovechamiento_forestal_detalle` property.

- [ ] **Step 3: Fix the 5 mock `proyectos` arrays in `evaluatorStore.test.ts`**

Find (top-level `mockTerrain`):

```ts
  proyectos: [
    { nombre: 'Test Proyecto', distancia_via: 120, distancia_red: 350, aprovechamiento_forestal: null, numero_arboles: 5, tipo_estructura: 'Tracker', arriendo_anual: 26275000 },
  ],
```

Replace:

```ts
  proyectos: [
    { nombre: 'Test Proyecto', distancia_via: 120, distancia_red: 350, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 5, tipo_estructura: 'Tracker', arriendo_anual: 26275000 },
  ],
```

Find (inside the `'perProjectValues y perProjectResults'` describe block, first test — `'se autopobla desde terrainData.proyectos al buscar terreno'`):

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: 'visita', numero_arboles: 2, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
```

Replace:

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: 'visita', aprovechamiento_forestal_detalle: 'Visita', numero_arboles: 2, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: 'Exonerado', numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
```

Find (inside the `'perProjectResults refleja la división terreno_dividido entre proyectos'` test):

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
```

Replace:

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 0, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
```

The exact same `proyectos` array (with `distancia_via: null` for both projects) appears **twice** in this file — once in each test inside `describe('perProjectFinancials', ...)`. Apply this same find/replace to **both** occurrences:

Find (appears twice):

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
      ],
```

Replace (both occurrences):

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
      ],
```

- [ ] **Step 4: Run the type-check and full test suite**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: back to exactly 1 pre-existing error — `vite.config.ts(13,3)`.

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass (86 tests, unchanged — this step only satisfies types, no assertions changed yet).

- [ ] **Step 5: Update `CriterionCard.vue` to show the detail when the criterion's own value is `null`**

Find (the `proyectoRows` computed):

```ts
const proyectoRows = computed(() => {
  if (!isProyectoScope.value) return []
  const results = store.perProjectResults
  return store.proyectoNombres.map(nombre => {
    const result = results[nombre]?.find(r => r.id === props.result.id)
    return {
      nombre,
      value: result?.value ?? null,
      sobrecosto: result?.sobrecosto ?? 0,
    }
  })
})
```

Replace:

```ts
function detalleParaProyecto(nombre: string): string | null {
  if (props.result.id !== 'aprovechamiento_forestal') return null
  return store.terrainData?.proyectos.find(p => p.nombre === nombre)?.aprovechamiento_forestal_detalle ?? null
}

const proyectoRows = computed(() => {
  if (!isProyectoScope.value) return []
  const results = store.perProjectResults
  return store.proyectoNombres.map(nombre => {
    const result = results[nombre]?.find(r => r.id === props.result.id)
    return {
      nombre,
      value: result?.value ?? null,
      sobrecosto: result?.sobrecosto ?? 0,
      detalle: detalleParaProyecto(nombre),
    }
  })
})
```

Find (in the `<template>`, the proyecto-rows block):

```html
          <div v-for="row in proyectoRows" :key="row.nombre" class="proyecto-row">
            <span class="proyecto-row-nombre">{{ row.nombre }}</span>
            <span class="proyecto-row-valor">{{ row.value ?? '—' }}{{ module?.unit ? ` ${module.unit}` : '' }}</span>
            <span class="proyecto-row-sobrecosto">{{ formatCOP(row.sobrecosto) }}</span>
          </div>
```

Replace:

```html
          <div v-for="row in proyectoRows" :key="row.nombre" class="proyecto-row">
            <span class="proyecto-row-nombre">{{ row.nombre }}</span>
            <span class="proyecto-row-valor">{{ row.value ?? row.detalle ?? '—' }}{{ module?.unit ? ` ${module.unit}` : '' }}</span>
            <span class="proyecto-row-sobrecosto">{{ formatCOP(row.sobrecosto) }}</span>
          </div>
```

(`row.detalle` is `null` for every criterion except `aprovechamiento_forestal` — for those, this is exactly the same as before. `aprovechamiento_forestal` has no `unit` defined in `criteria/aprovechamiento_forestal.ts`, so the unit suffix stays empty either way — this change only affects the value text itself.)

- [ ] **Step 6: Run the type-check and full test suite again**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly 1 pre-existing error — `vite.config.ts(13,3)`.

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass.

- [ ] **Step 7: Verify against the running dev server**

This repo has no automated `.vue` component tests. Verify by code trace against real data (done — traced above), and by browser if available:

1. Ensure the backend dev server is running (restarted after Task 1) and the frontend dev server is running.
2. Search `COLBOYT147` (2 projects, both with `aprovechamiento_forestal_detalle: "Exonerado"` per Task 1's smoke test).
3. Find the "Aprovechamiento forestal" criterion card. Confirm each project row now shows **"Exonerado"** instead of a blank dash, with its cost column still showing `—` (0, unchanged — this only affects visibility, not cost).
4. If no browser-driving tool is available, state plainly in the report that this step needs human verification — do not guess at the visual outcome.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/CriterionCard.vue frontend/src/stores/__tests__/evaluatorStore.test.ts
git commit -m "feat: show resolved aprovechamiento forestal status (e.g. Exonerado) per project"
```

---

### Task 3: Frontend — cluster credit repartido entre proyectos

**Files:**
- Modify: `frontend/src/criteria/cluster.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/engine/evaluatorEngine.ts`
- Modify: `frontend/src/engine/__tests__/evaluatorEngine.test.ts`
- Modify: `frontend/src/stores/__tests__/evaluatorStore.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1/2.
- Produces: nothing consumed by other tasks — this is the last functional task of this plan.

- [ ] **Step 1: Write the failing test for the new repartition behavior**

Find (in `frontend/src/engine/__tests__/evaluatorEngine.test.ts`):

```ts
  it('scope terreno_no_dividido: general sin cambios; no aparece por proyecto', () => {
    const values = { cluster: 2 }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'cluster')?.sobrecosto).toBe(-15_000_000)
    expect(porProyecto['P1'].find(r => r.id === 'cluster')).toBeUndefined()
    expect(porProyecto['P2'].find(r => r.id === 'cluster')).toBeUndefined()
  })
```

Replace:

```ts
  it('cluster (terreno_dividido): general usa el crédito completo; por proyecto lo reparte entre N', () => {
    const values = { cluster: 2 }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'cluster')?.sobrecosto).toBe(-15_000_000)
    expect(porProyecto['P1'].find(r => r.id === 'cluster')?.sobrecosto).toBe(-7_500_000)
    expect(porProyecto['P2'].find(r => r.id === 'cluster')?.sobrecosto).toBe(-7_500_000)
  })
```

Also find (the valid-scopes list, same file):

```ts
    const validScopes = ['proyecto', 'terreno_dividido', 'terreno_multiplicado', 'terreno_no_dividido']
```

Replace:

```ts
    const validScopes = ['proyecto', 'terreno_dividido', 'terreno_multiplicado']
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`

Expected: FAIL — `cluster.ts` still has `scope: 'terreno_no_dividido'`, so `porProyecto['P1'].find(r => r.id === 'cluster')` is still `undefined`, not `-7_500_000`.

- [ ] **Step 3: Change `cluster.ts`'s scope**

Find (in `frontend/src/criteria/cluster.ts`):

```ts
  scope: 'terreno_no_dividido',
```

Replace:

```ts
  scope: 'terreno_dividido',
```

- [ ] **Step 4: Remove the now-dead `'terreno_no_dividido'` scope**

Find (in `frontend/src/types/index.ts`):

```ts
export type CriterionScope = 'proyecto' | 'terreno_dividido' | 'terreno_multiplicado' | 'terreno_no_dividido'
```

Replace:

```ts
export type CriterionScope = 'proyecto' | 'terreno_dividido' | 'terreno_multiplicado'
```

Find (in `frontend/src/engine/evaluatorEngine.ts`, inside `evaluateScoped`):

```ts
    const value = values[criterion.id] ?? null
    const costoBase = criterion.formulaDefined ? criterion.computeCost(value, context) : 0
    const costoGeneral = criterion.scope === 'terreno_multiplicado' ? costoBase * n : costoBase
    general.push({ ...base, value, sobrecosto: costoGeneral })

    if (criterion.scope === 'terreno_no_dividido') continue

    const costoPorProyecto = criterion.scope === 'terreno_multiplicado' ? costoBase : costoBase / n
```

Replace:

```ts
    const value = values[criterion.id] ?? null
    const costoBase = criterion.formulaDefined ? criterion.computeCost(value, context) : 0
    const costoGeneral = criterion.scope === 'terreno_multiplicado' ? costoBase * n : costoBase
    general.push({ ...base, value, sobrecosto: costoGeneral })

    const costoPorProyecto = criterion.scope === 'terreno_multiplicado' ? costoBase : costoBase / n
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`

Expected: PASS — all tests in this file.

- [ ] **Step 6: Fix `evaluatorStore.test.ts`'s `perProjectFinancials` test — cluster credit now reaches per-project capex**

This test's mock has `cluster: 2`, which `fetchTerrain` auto-populates into `criterionValues.cluster` (see `evaluatorStore.ts`'s `dbValues` loop). After Step 3, `cluster` is scope `'terreno_dividido'`, so it now appears in `perProjectResults` for both `P1` and `P2` at `-15_000_000 / 2 = -7_500_000` each — reducing each project's capex by that amount.

Find (in `frontend/src/stores/__tests__/evaluatorStore.test.ts`, inside the first test of `describe('perProjectFinancials', ...)`):

```ts
      // Sin datos de scope 'proyecto' (todo null) para que el subtotal de sobrecostos
      // fijos de cada proyecto sea 0 y el capex de cada uno sea exactamente store.baseCapex
      // — así el test puede verificar el valor exacto sin recalcular fórmulas de criterios.
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    expect(store.perProjectFinancials).not.toBeNull()

    const esperadoP1 = calcularFinanzas({
      capex: store.baseCapex, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 12_000_000,
    })
    const esperadoP2 = calcularFinanzas({
      capex: store.baseCapex, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 8_000_000,
    })
```

Replace:

```ts
      // Sin datos de scope 'proyecto' (todo null). El único costo fijo que sí aplica es el
      // crédito de cluster (scope 'terreno_dividido', cluster=2 → -15M repartido entre los
      // 2 proyectos = -7.5M cada uno) — el capex de cada proyecto es store.baseCapex menos
      // ese crédito, no exactamente store.baseCapex.
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    expect(store.perProjectFinancials).not.toBeNull()

    const esperadoP1 = calcularFinanzas({
      capex: store.baseCapex - 7_500_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 12_000_000,
    })
    const esperadoP2 = calcularFinanzas({
      capex: store.baseCapex - 7_500_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 8_000_000,
    })
```

(The second test in this describe block, `'general (financialResults) multiplica kWp y kVA por N...'`, compares against `store.aggregated.capexTotal` directly rather than a hardcoded expectation — it already accounts for whatever `cluster` contributes on both sides of the comparison, so it needs no change.)

- [ ] **Step 7: Run the full frontend suite and type-check**

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass.

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly 1 error — `vite.config.ts(13,3)` (pre-existing, unrelated).

- [ ] **Step 8: Verify against the running dev server**

1. Ensure both dev servers are running, search `COLBOYT147` (cluster = 2).
2. In "Desglose por proyecto", confirm each project card now shows a **"Cluster: -$7.500.000"** line inside its "Fijos" section, and that the "Fijos" subtotal and "CAPEX total" for each card reflect that credit.
3. Confirm "CAPEX Total del terreno" at the top of the panel is unchanged from before this plan (the general total already included the full -15M once).
4. If no browser-driving tool is available, state plainly in the report that this step needs human verification.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/criteria/cluster.ts frontend/src/types/index.ts frontend/src/engine/evaluatorEngine.ts frontend/src/engine/__tests__/evaluatorEngine.test.ts frontend/src/stores/__tests__/evaluatorStore.test.ts
git commit -m "fix: repartir el crédito de cluster entre proyectos en vez de excluirlo del desglose"
```

---

### Task 4: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full backend suite**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/ -v`

Expected: all pass except `test_terrain_requires_auth` (pre-existing local-env artifact).

- [ ] **Step 2: Run the full frontend suite and type-check**

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass.

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly 1 pre-existing error — `vite.config.ts(13,3)`.

- [ ] **Step 3: Live smoke test on COLBOYT147**

```bash
curl -s http://127.0.0.1:5000/api/terrain/COLBOYT147
```

Expected: both entries in `proyectos[]` show `"aprovechamiento_forestal_detalle": "Exonerado"`, `"cluster": 2` at the top level unchanged.

- [ ] **Step 4: Browser verification (needs human if no browser-driving tool is available)**

On `COLBOYT147`:
1. "Aprovechamiento forestal" criterion card shows "Exonerado" for both projects instead of a blank dash.
2. "Desglose por proyecto" shows a "Cluster: -$7.500.000" line in each project's card, and each card's "CAPEX total" reflects it.
3. "CAPEX Total del terreno" at the top is unchanged from before this plan.

State plainly in the final report if this step could not be completed by an agent and needs human confirmation.
