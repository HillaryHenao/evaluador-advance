# CAPEX/kWp/kVA/arriendo son por proyecto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the CAPEX/kWp/kVA/arriendo model: these are per-project quantities (each project builds its own full installation), not terrain-wide values to divide by N. The terrain-wide total should multiply by N; each project's own view uses the full value, undivided. Also fixes `arriendo_anual`, which today suffers the same "single arbitrary project" bug already fixed for other terrain-wide fields.

**Architecture:** Backend adds `arriendo_anual` per project to `proyectos[]`, and changes the terrain-wide `arriendo_anual` from "pick one arbitrary project's rent" to "sum across all active projects" (same aggregation pattern already used for `cluster`). Frontend flips the scaling direction in `evaluatorStore.ts`: the general context multiplies `baseCapex`/`kWp`/`kVA` by `projectCount` (was: used as-is or divided); `perProjectFinancials` stops dividing anything and instead gives each project its own full capex (`baseCapex` + that project's own sobrecostos, both undivided) and its own `arriendo_anual`. No criterion formula (`frontend/src/criteria/*.ts`) reads `baseCapex`/`kWp` — confirmed by search — so this change is contained to the financial layer.

**Tech Stack:** Flask/psycopg2 (backend), Vue 3 + TypeScript + Pinia (frontend), pytest, Vitest.

## Global Constraints

- No criterion's `computeCost` formula (in `frontend/src/criteria/*.ts`) reads `context.baseCapex` or `context.kWp` — verified by search. This plan's changes are confined to `terrain_service.py` (backend), `evaluatorStore.ts` and `ProjectBreakdownPanel.vue` (frontend financial/CAPEX layer), plus their tests.
- `SUM(...)` over zero matching rows returns `NULL` in PostgreSQL — this is the correct "no data" signal for `arriendo_anual`, same as today's behavior when a project has no termsheet. No extra Python null-handling needed for the terrain-wide sum.
- This repo has no automated component tests for `.vue` files — `ProjectBreakdownPanel.vue`'s change is verified by type-check + code trace + manual browser check, not a test suite.
- Backend test command: `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -v` (expect all pass except `test_terrain_requires_auth` — pre-existing local-env artifact).
- Frontend test command: `cd frontend && npx vitest run` and `npx vue-tsc -b` (expect exactly 1 pre-existing unrelated error: `vite.config.ts(13,3)`).
- Already-accepted, unchanged behavior (do not re-litigate or attempt to fix in this plan): the sum of per-project VPNs will still not exactly equal the general VPN, because `financialEngine.ts` has 3 whole-installation fixed costs (servicios públicos, mantenimiento de tracker, reemplazo de inversores) that get paid once per independent per-project run instead of once for the combined terrain — this was already true before this plan and stays true after.

---

### Task 1: Backend — `arriendo_anual` per project, terrain-wide sum instead of arbitrary pick

**Files:**
- Modify: `backend/app/services/terrain_service.py`
- Modify: `backend/tests/test_terrain_service.py`

**Interfaces:**
- Produces (used by Task 2): `proyectos[]` entries gain `arriendo_anual: float | None`. Top-level `TerrainData.arriendo_anual` changes from "one arbitrary active project's rent" to "sum of all active projects' rent" — same field name and type (`float | None`), only the underlying query changes.

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_terrain_service.py`, replacing the existing `test_get_proyectos_activos_devuelve_datos_por_proyecto` test (it needs `arriendo_anual` added to both the mock rows and the expected output — every other assertion in it stays the same):

Find:

```python
def test_get_proyectos_activos_devuelve_datos_por_proyecto():
    # COLSANT5: P1 en visita con 2 árboles, P2 exonerado con 0 árboles — cada uno con su
    # propio dato, sin funnel a un valor compartido del terreno.
    rows = [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR',
            'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_raw': '1P TRACKER', 'numero_arboles_raw': '2',
            'aprov_value': 'Visita', 'aprov_status': 'pending',
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR',
            'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_raw': 'MESA FIJA', 'numero_arboles_raw': '0',
            'aprov_value': None, 'aprov_status': 'exonerated',
        },
    ]
    with patch.object(terrain_service, '_connect', return_value=_mock_conn(rows)):
        proyectos = terrain_service._get_proyectos_activos(287)

    assert proyectos == [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR', 'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_estructura': 'tracker', 'numero_arboles': 2, 'aprovechamiento_forestal': 'visita',
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR', 'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_estructura': 'mesa_fija', 'numero_arboles': 0, 'aprovechamiento_forestal': None,
        },
    ]
```

Replace with:

```python
def test_get_proyectos_activos_devuelve_datos_por_proyecto():
    # COLSANT5: P1 en visita con 2 árboles, P2 exonerado con 0 árboles — cada uno con su
    # propio dato, sin funnel a un valor compartido del terreno. Cada uno también trae su
    # propio arriendo_anual (independiente, no se divide ni se comparte entre proyectos).
    rows = [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR',
            'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_raw': '1P TRACKER', 'numero_arboles_raw': '2',
            'aprov_value': 'Visita', 'aprov_status': 'pending',
            'arriendo_anual': 12_000_000.0,
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR',
            'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_raw': 'MESA FIJA', 'numero_arboles_raw': '0',
            'aprov_value': None, 'aprov_status': 'exonerated',
            'arriendo_anual': 8_000_000.0,
        },
    ]
    with patch.object(terrain_service, '_connect', return_value=_mock_conn(rows)):
        proyectos = terrain_service._get_proyectos_activos(287)

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

The other existing test in this file, `test_get_proyectos_activos_arboles_cero_cuando_forestal_resuelto_sin_dato`, does NOT need `arriendo_anual` added to its mock rows or assertions — it only asserts specific keys (`numero_arboles`, `aprovechamiento_forestal`), not full-dict equality, so it is unaffected by the new field and needs no change.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v -k devuelve_datos_por_proyecto`

Expected: FAIL with `KeyError: 'arriendo_anual'` (the mock row doesn't have that key yet read by the real function — actually it will fail because `_get_proyectos_activos` doesn't return `arriendo_anual` in its dict yet, so the assertion `proyectos == [...]` fails on a dict-shape mismatch, not a KeyError from the mock's own dict access. Either way, it must fail before Step 3).

- [ ] **Step 3: Add `arriendo_anual` to `_get_proyectos_activos`**

Find (in `backend/app/services/terrain_service.py`, inside `_get_proyectos_activos`'s SQL query):

```python
                       (
                           SELECT vf.status FROM validation_field vf
                           WHERE vf.project_id = p.id
                             AND vf.name = 'Licencia de aprovechamiento forestal'
                           ORDER BY vf.id DESC LIMIT 1
                       )                                           AS aprov_status
                   FROM minifarm_project p
```

Replace with:

```python
                       (
                           SELECT vf.status FROM validation_field vf
                           WHERE vf.project_id = p.id
                             AND vf.name = 'Licencia de aprovechamiento forestal'
                           ORDER BY vf.id DESC LIMIT 1
                       )                                           AS aprov_status,
                       (
                           SELECT ts.rent_annual_cost_cop FROM termsheet_termsheet ts
                           WHERE ts.id = p.termsheet_id
                       )                                           AS arriendo_anual
                   FROM minifarm_project p
```

Find (the dict construction at the end of the function's loop):

```python
        proyectos.append({
            'nombre': r['nombre'],
            'distancia_via': r['distancia_via'],
            'distancia_red': r['distancia_red'],
            'tipo_estructura': tipo_estructura,
            'numero_arboles': numero_arboles,
            'aprovechamiento_forestal': _resolve_aprovechamiento_nivel(aprov_raw),
        })
```

Replace with:

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

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v`

Expected: PASS — all tests in this file.

- [ ] **Step 5: Change the terrain-wide `arriendo_anual` from "one arbitrary project" to "sum of active projects"**

This has no dedicated unit test (the function it lives in, `get_terrain_data`, is only covered by `test_terrain.py`'s route-level tests, which mock `get_terrain_data` entirely and don't exercise the real SQL) — the correctness of this SQL change is verified in Step 7 (full suite regression check) and Step 8 (live smoke test against the real database), consistent with how `cluster`'s existing aggregation subquery is handled in this same file.

Find (in `get_terrain_data`'s main SELECT):

```python
                    (
                        SELECT ts.rent_annual_cost_cop
                        FROM termsheet_termsheet ts
                        WHERE ts.id = p.termsheet_id
                    )                                           AS arriendo_anual
```

Replace with:

```python
                    (
                        SELECT SUM(ts.rent_annual_cost_cop)
                        FROM minifarm_project mp3
                        JOIN termsheet_termsheet ts ON ts.id = mp3.termsheet_id
                        WHERE mp3.terrain_id = t.id
                          AND mp3.stage NOT IN ('dead', 'paused', 'uci')
                    )                                           AS arriendo_anual
```

- [ ] **Step 6: Update `backend/tests/test_terrain.py`'s route-level mock (no code change needed, verify only)**

`test_terrain.py`'s `test_terrain_returns_data` mocks `get_terrain_data` entirely (it never calls the real SQL), so its `mock_data['proyectos'][0]` dict is unaffected by the backend changes above and does not need `arriendo_anual` added — but re-read the test now to confirm it still passes unchanged (it should; this step is a verification checkpoint, not a code change).

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain.py -v`

Expected: PASS (except `test_terrain_requires_auth`, the pre-existing local-env artifact).

- [ ] **Step 7: Run the full backend suite**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/ -v`

Expected: all pass except `test_terrain_requires_auth` (pre-existing local-env artifact, see Global Constraints).

- [ ] **Step 8: Smoke-test against the live dev backend**

If the backend dev server is running (`http://127.0.0.1:5000`), restart it (Flask debug mode auto-reloads on file save) and run:

```bash
curl -s http://127.0.0.1:5000/api/terrain/COLBOYT147
```

Expected: JSON response where each entry in `proyectos[]` now has an `arriendo_anual` key, and the top-level `arriendo_anual` equals the sum of both projects' individual `arriendo_anual` values (allowing for `null` if a project has no termsheet rent — `NULL` values are skipped by SQL `SUM`, only affecting the total if ALL active projects have no rent, in which case the top-level value is `null`).

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/terrain_service.py backend/tests/test_terrain_service.py
git commit -m "fix: sum arriendo_anual across active projects instead of picking one arbitrary project"
```

---

### Task 2: Frontend — CAPEX/kWp/kVA/arriendo scale by N (general) instead of dividing (per-project)

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/stores/evaluatorStore.ts`
- Modify: `frontend/src/stores/__tests__/evaluatorStore.test.ts`
- Modify: `frontend/src/components/ProjectBreakdownPanel.vue`

**Interfaces:**
- Consumes: `ProyectoData` (Task 1's backend shape, now including `arriendo_anual: number | null`).
- Produces: nothing consumed by other tasks — this is the last task of this plan.

- [ ] **Step 1: Add `arriendo_anual` to `ProyectoData`**

Find (in `frontend/src/types/index.ts`):

```ts
export interface ProyectoData {
  nombre: string
  distancia_via: number | null
  distancia_red: number | null
  aprovechamiento_forestal: string | null
  numero_arboles: number | null
  tipo_estructura: string | null
}
```

Replace with:

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

- [ ] **Step 2: Write the failing test for `perProjectFinancials`' new behavior**

Find (in `frontend/src/stores/__tests__/evaluatorStore.test.ts`, top of file):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEvaluatorStore } from '../evaluatorStore'
import * as terrainService from '@/services/terrainService'
import type { TerrainData } from '@/types'
```

Replace with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEvaluatorStore } from '../evaluatorStore'
import * as terrainService from '@/services/terrainService'
import { calcularFinanzas } from '@/engine/financialEngine'
import type { TerrainData } from '@/types'
```

Find `mockTerrain`'s `proyectos` array:

```ts
  proyectos: [
    { nombre: 'Test Proyecto', distancia_via: 120, distancia_red: 350, aprovechamiento_forestal: null, numero_arboles: 5, tipo_estructura: 'Tracker' },
  ],
```

Replace with:

```ts
  proyectos: [
    { nombre: 'Test Proyecto', distancia_via: 120, distancia_red: 350, aprovechamiento_forestal: null, numero_arboles: 5, tipo_estructura: 'Tracker', arriendo_anual: 26275000 },
  ],
```

Find the `proyectos` array inside the `'perProjectValues y perProjectResults'` describe block's first test (`'se autopobla desde terrainData.proyectos al buscar terreno'`):

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: 'visita', numero_arboles: 2, tipo_estructura: 'tracker' },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija' },
      ],
```

Replace with:

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: 'visita', numero_arboles: 2, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
```

Find the `proyectos` array inside the `'perProjectResults refleja la división terreno_dividido entre proyectos'` test:

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'tracker' },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija' },
      ],
```

Replace with:

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
```

Find the entire `describe('perProjectFinancials', ...)` block:

```ts
describe('perProjectFinancials', () => {
  it('divide capex, kWp, kVA y arriendo entre N proyectos para el VPN', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'tracker' },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija' },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    expect(store.perProjectFinancials).not.toBeNull()
    const p1 = store.perProjectFinancials!['P1'].vpn
    const p2 = store.perProjectFinancials!['P2'].vpn
    // Ambos proyectos reciben la misma división (N=2) con datos simétricos, así que
    // deben coincidir exactamente entre sí.
    expect(p1).toBe(p2)
    // No se espera igualdad exacta con financialResults.vpn / 2: calcularFinanzas() incluye
    // costos absolutos que NO escalan con capex/kWp/kVA (servicios públicos, mantenimiento
    // de tracker, reemplazo de inversores — ver financialEngine.ts). Al dividir un terreno
    // en N proyectos esos costos fijos se pagan N veces en vez de dividirse entre N, así que
    // el VPN por proyecto queda por debajo de (vpn total / N), no exactamente en la mitad.
    // Se verifica un rango razonable en lugar de una igualdad exacta.
    const mitad = store.financialResults!.vpn / 2
    expect(p1).toBeGreaterThan(mitad * 0.5)
    expect(p1).toBeLessThan(mitad)
  })
})
```

Replace with:

```ts
describe('perProjectFinancials', () => {
  it('cada proyecto usa su propio capex/kWp/kVA/arriendo COMPLETOS, sin dividir entre N', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000,
      // Sin datos de scope 'proyecto' (todo null) para que el subtotal de sobrecostos
      // fijos de cada proyecto sea 0 y el capex de cada uno sea exactamente store.baseCapex
      // — así el test puede verificar el valor exacto sin recalcular fórmulas de criterios.
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
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

    expect(store.perProjectFinancials!['P1'].vpn).toBeCloseTo(esperadoP1.vpn, 6)
    expect(store.perProjectFinancials!['P2'].vpn).toBeCloseTo(esperadoP2.vpn, 6)
    // P1 y P2 tienen arriendo distinto (12M vs 8M) y NADA se divide entre ellos — por eso
    // sus VPN deben diferir. Bajo el modelo anterior (dividir por N) ambos habrían recibido
    // el mismo arriendo compartido y habrían dado resultados idénticos; este test falla si
    // alguien reintroduce esa división.
    expect(store.perProjectFinancials!['P1'].vpn).not.toBe(store.perProjectFinancials!['P2'].vpn)
  })

  it('general (financialResults) multiplica kWp y kVA por N, no los deja sin escalar', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    const esperado = calcularFinanzas({
      capex: store.aggregated.capexTotal,
      kWp: store.kWp * 2,
      kVA: store.kVA * 2,
      produccionEspecifica: 4.5,
      arriendoAnual: 20_000_000,
    })

    expect(store.financialResults!.vpn).toBeCloseTo(esperado.vpn, 6)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/stores/__tests__/evaluatorStore.test.ts`

Expected: FAIL — TypeScript will also flag the missing `arriendo_anual` on the not-yet-updated `ProyectoData` usages in this same file if Step 1 wasn't applied to `types/index.ts` yet (it was, in Step 1 above, so this should be a clean type-check with only assertion failures): the two new `perProjectFinancials` assertions fail because the store still divides everything by `n`, and `financialResults` still uses unscaled `kWp.value`/`kVA.value`.

- [ ] **Step 4: Update `evaluatorStore.ts`'s `context` computed**

Find:

```ts
  const context = computed(() => ({ baseCapex: baseCapex.value, kWp: kWp.value, projectCount: projectCount.value }))
```

Replace with:

```ts
  // baseCapex y kWp son magnitudes POR PROYECTO (cada proyecto construye su propia
  // instalación completa) — el contexto general las multiplica por N en vez de usarlas
  // tal cual, para que aggregateCosts sume correctamente el capex de los N proyectos.
  const context = computed(() => ({
    baseCapex: baseCapex.value * projectCount.value,
    kWp: kWp.value * projectCount.value,
    projectCount: projectCount.value,
  }))
```

- [ ] **Step 5: Update `financialResults` to scale `kWp`/`kVA` by N**

Find:

```ts
  const financialResults = computed<FinancialResults | null>(() => {
    const produccionEspecifica = terrainData.value?.produccion_especifica
    const arriendoAnual = arriendoManual.value ?? terrainData.value?.arriendo_anual
    if (!produccionEspecifica || !arriendoAnual) return null
    return calcularFinanzas({
      capex: aggregated.value.capexTotal,
      kWp: kWp.value,
      kVA: kVA.value,
      produccionEspecifica,
      arriendoAnual,
    })
  })
```

Replace with:

```ts
  const financialResults = computed<FinancialResults | null>(() => {
    const produccionEspecifica = terrainData.value?.produccion_especifica
    const arriendoAnual = arriendoManual.value ?? terrainData.value?.arriendo_anual
    if (!produccionEspecifica || !arriendoAnual) return null
    return calcularFinanzas({
      capex: aggregated.value.capexTotal,
      kWp: kWp.value * projectCount.value,
      kVA: kVA.value * projectCount.value,
      produccionEspecifica,
      arriendoAnual,
    })
  })
```

- [ ] **Step 6: Rewrite `perProjectFinancials` — no more division**

Find:

```ts
  const perProjectFinancials = computed<Record<string, { vpn: number; vpnConBeneficios: number }> | null>(() => {
    const produccionEspecifica = terrainData.value?.produccion_especifica
    const arriendoAnual = arriendoManual.value ?? terrainData.value?.arriendo_anual
    if (!produccionEspecifica || !arriendoAnual) return null
    const n = projectCount.value
    // Divide el CAPEX GENERAL ya agregado (no reconstruir desde perProjectResults —
    // eso ya divide los criterios terreno_dividido dentro de evaluateScoped; volver
    // a dividir aquí dividiría dos veces esa porción, y baseCapex quedaría sin dividir).
    const capexPorProyecto = aggregated.value.capexTotal / n

    const resultado: Record<string, { vpn: number; vpnConBeneficios: number }> = {}
    for (const nombre of proyectoNombres.value) {
      const finanzas = calcularFinanzas({
        capex: capexPorProyecto,
        kWp: kWp.value / n,
        kVA: kVA.value / n,
        produccionEspecifica,
        arriendoAnual: arriendoAnual / n,
      })
      resultado[nombre] = { vpn: finanzas.vpn, vpnConBeneficios: finanzas.vpnConBeneficios }
    }
    return resultado
  })
```

Replace with:

```ts
  const perProjectFinancials = computed<Record<string, { vpn: number; vpnConBeneficios: number }> | null>(() => {
    const produccionEspecifica = terrainData.value?.produccion_especifica
    if (!produccionEspecifica) return null

    const resultado: Record<string, { vpn: number; vpnConBeneficios: number }> = {}
    for (const proyecto of terrainData.value?.proyectos ?? []) {
      const arriendoProyecto = proyecto.arriendo_anual
      if (!arriendoProyecto) continue

      // baseCapex/kWp/kVA son magnitudes POR PROYECTO — cada proyecto usa el valor
      // completo, sin dividir. Solo se le suma el subtotal de sobrecostos fijos propio
      // de ESE proyecto (perProjectResults ya trae los criterios terreno_dividido
      // divididos entre N y los de scope proyecto con el valor propio — ver
      // evaluateScoped en evaluatorEngine.ts).
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

- [ ] **Step 7: Run tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/stores/__tests__/evaluatorStore.test.ts`

Expected: PASS — all tests, including the 2 new/rewritten `perProjectFinancials` tests.

- [ ] **Step 8: Fix `ProjectBreakdownPanel.vue`'s `capexBase` — stop dividing**

Find:

```ts
    const capexBase = store.baseCapex / n
```

Replace with:

```ts
    const capexBase = store.baseCapex
```

(`n` is still used elsewhere in this same computed for `aggregateCosts`'s `projectCount: n` — do not remove the `const n = Math.max(store.proyectoNombres.length, 1)` line above it.)

- [ ] **Step 9: Run the full frontend suite and type-check**

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass.

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly 1 error — `vite.config.ts(13,3)` (pre-existing, unrelated).

- [ ] **Step 10: Verify against the running dev server**

This repo has no automated `.vue` component tests. Verify by code trace against real data, and by browser if available:

1. Ensure the backend dev server is running (`http://127.0.0.1:5000`, restarted after Task 1's changes) and the frontend dev server is running (`http://localhost:5173`).
2. `curl -s http://127.0.0.1:5000/api/terrain/COLBOYT147` — confirm `proyectos[]` entries now include `arriendo_anual`.
3. If you have a live browser available: search `COLBOYT147` (2 projects). Confirm:
   - "CAPEX Total del terreno" is now roughly double a single project's CAPEX base (not the same as it, and not a fraction of it).
   - Each project card's "CAPEX base" shows the full `store.baseCapex` value (e.g. 4.000M for the current default), the SAME value in every project's card — not divided by the number of projects.
4. If no browser-driving tool is available, state plainly in your report that this step needs human verification — do not guess at the visual outcome.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/stores/evaluatorStore.ts frontend/src/stores/__tests__/evaluatorStore.test.ts frontend/src/components/ProjectBreakdownPanel.vue
git commit -m "fix: baseCapex/kWp/kVA are per-project quantities — scale general by N, stop dividing per-project view"
```

---
