# Task 6 Report: UI — "Desglose por proyecto" section

## What I implemented

1. Created `frontend/src/components/ProjectBreakdownPanel.vue` exactly per the brief: a
   `<script setup>` computed `proyectos` that maps `store.proyectoNombres` to per-project
   `{ nombre, costosFijos, riesgoMonto, vpn, vpnConBeneficios }` by calling `aggregateCosts`
   on `store.perProjectResults[nombre]` with `{ baseCapex: store.baseCapex, kWp: store.kWp,
   projectCount: Math.max(store.proyectoNombres.length, 1) }`, plus the template/style
   exactly as given (cards grid, TIR/Payback note pulled once from `store.financialResults`).

2. Modified `frontend/src/views/EvaluadorView.vue`:
   - Removed `import { evaluateCriteria } from '@/engine/evaluatorEngine'`.
   - Added `import ProjectBreakdownPanel from '@/components/ProjectBreakdownPanel.vue'`.
   - Replaced `const results = computed(() => evaluateCriteria(store.criterionValues, { baseCapex: store.baseCapex, kWp: store.kWp }))`
     with `const results = computed(() => store.aggregated.breakdown)`.
   - Mounted `<ProjectBreakdownPanel />` right after the closing `</section>` of "Factores de
     riesgo" and before the closing `</div>` of `.criteria-content`.

## Verification approach and outcome

- **Anchor check**: read the actual current `EvaluadorView.vue` before editing — it matched
  the brief's "Find" blocks character-for-character (imports, `results` computed, and the
  template region around "Factores de riesgo"). No divergence, no escalation needed.

- **Data-shape trace**: read `evaluatorStore.ts` and `evaluatorEngine.ts` to confirm
  `store.aggregated` is `AggregatedResult` from `aggregateCosts(scopedEvaluation.value.general,
  context.value)`, whose `.breakdown` field is literally the `results: CriterionResult[]`
  argument passed in (i.e. the same array shape `evaluateCriteria` used to return). This
  confirms `fijoResults`/`probabilidadResults` (which just `.filter()` by `category`) keep
  working unchanged against the new source — no shape break. Also confirmed
  `store.perProjectResults`, `store.perProjectFinancials`, `store.proyectoNombres`,
  `store.financialResults`, and `aggregateCosts` all exist with the exact fields/signature
  the new component calls (`totalSobrecostoFijo`, `totalRetraso`, `totalRiesgoCosto`, `vpn`,
  `vpnConBeneficios`, `tir`, `paybackAnios`).

- **Type-check**: `npx vue-tsc -b` from `frontend/` -> exactly 1 error, in `vite.config.ts`
  (`'test' does not exist in type 'UserConfigExport'`), unrelated to this task. No errors in
  `ProjectBreakdownPanel.vue` or `EvaluadorView.vue`. (The brief said "2 pre-existing errors"
  but flagged the real baseline was likely just this 1 — confirmed: only 1.)

- **Full test suite**: `npx vitest run` -> 1 file failed (`authStore.test.ts`, 2 tests:
  `isAuthenticated` expected `false` got `true` in both "inicia sin usuario autenticado" and
  "logout limpia el store y localStorage"), 83 passed. Confirmed **pre-existing and unrelated**
  by stashing my `EvaluadorView.vue` change and re-running just that test file — identical
  failure with my change absent. `authStore.ts` itself has zero diff vs. HEAD in this session,
  so this is a baseline issue outside Task 6's scope, not a regression I introduced.

- **Manual/live verification**: started the backend (`python backend/run.py`) and called
  `curl http://127.0.0.1:5000/api/terrain/COLSANT5` — got a real 200 response with a
  `proyectos` array of 2 entries (`COLSANT5P1_GIRON_SUR`, `COLSANT5P2_GIRON_SUR`), each
  carrying `distancia_red`, `distancia_via`, `aprovechamiento_forestal`, `numero_arboles`,
  `tipo_estructura` — matching `PROYECTO_SCOPE_DB_FIELDS` in the store exactly. Top-level
  `produccion_especifica` and `arriendo_anual` are both present and non-null, so
  `store.financialResults` and `store.perProjectFinancials` will both be non-null for this
  terrain — meaning the panel's TIR/Payback note and VPN/VPN-con-beneficios rows will all
  render for a real search of `COLSANT5`. Stopped the backend afterward.
  `curl -o /dev/null -w "%{http_code}" http://localhost:5173` -> `200`, confirming the Vite
  dev server is up and serving the SPA shell.
  **I have no browser-automation tool available in this environment**, so I could not visually
  confirm the rendered "Desglose por proyecto" cards, their layout, or that the sum of both
  projects' "Costos fijos" is within rounding of the sidebar's general total. **Human
  visual verification in a browser at http://localhost:5173 (search `COLSANT5`) is still
  needed** to close that last gap.

## Files changed

- `frontend/src/components/ProjectBreakdownPanel.vue` (new)
- `frontend/src/views/EvaluadorView.vue` (modified: import swap, `results` computed swap,
  panel mounted after "Factores de riesgo")

## Self-review findings

- `ProjectBreakdownPanel.vue` matches the brief's code exactly (computed logic for
  `costosFijos`/`riesgoMonto`/`vpn`/`vpnConBeneficios`, template, and styles) — no deviation.
- `EvaluadorView.vue` no longer imports or calls `evaluateCriteria` anywhere — verified via
  the final file read; only `store.aggregated.breakdown` remains as the source for `results`.
- `fijoResults`/`probabilidadResults` still operate correctly against the new `results.value`
  shape (`CriterionResult[]`, same as before) — traced via `aggregateCosts`'s `breakdown:
  results` passthrough in `evaluatorEngine.ts`.
- `<ProjectBreakdownPanel />` is mounted in the correct place: immediately after the
  "Factores de riesgo" `<section>`'s closing tag, still inside `.criteria-content`, before
  `</div></main>`.
- Git diff only touched the 2 intended files; commit `f164d16` contains exactly those 2
  files (142 insertions, 5 deletions, 1 new file) — no accidental changes to other project
  files.

## Concerns

- The pre-existing `authStore.test.ts` failures (2 tests) are a real, unrelated bug in the
  repo's auth store / test isolation (confirmed pre-existing, not caused by this task) —
  flagging it since it's outside this task's scope to fix but is a live regression risk if
  left unaddressed.
- No browser was available to visually confirm the rendered UI (card layout, "igual para
  todos los proyectos" note placement, rounding-consistency between the panel's per-project
  Costos-fijos sum and the sidebar's general total) — code trace is solid but human/browser
  verification of the actual pixels is still outstanding, as flagged in the task's own
  caveat.
