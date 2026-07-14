# Task 5 Report: UI — CriterionCard.vue per-project rows for scope `proyecto`

## What was implemented

All 6 steps from the brief plus one necessary deviation:

1. **Removed** the `aprovechamientoDetalle` computed (referenced deleted `TerrainData.aprovechamiento_forestal_detalle`) and its corresponding `<!-- Aprovechamiento forestal: detalle por proyecto -->` template block.
2. **Fixed `accentColor`**: added a branch for `module.value?.scope === 'proyecto'` that checks `store.perProjectResults` across all projects instead of `props.result.value !== null` (which is always `null` for these 6 criteria per `evaluateScoped`'s design).
3. **Added computeds/handler**: `isProyectoScope`, `proyectoRows` (per-project `{ nombre, value, sobrecosto }` derived from `store.perProjectResults`), `proyectoTotal` (sum of sobrecostos), and `handlePilotesToggle` (calls `store.setPilotesForProyecto`).
4. **Added two new template branches**: one rendering a value+sobrecosto row per project (used by distancia_via, distancia_red, aprovechamiento_forestal, numero_arboles, tipo_estructura) plus a "Total" row, and one rendering a checkbox per project specifically for `pilotes`.
5. **Hid the generic bottom `card-cost` row** for scope-`proyecto` criteria by adding `&& !isProyectoScope` to its `v-if`.
6. **Added CSS** for `.proyecto-rows`/`.proyecto-row`/`.proyecto-row-nombre`/`.proyecto-row-valor`/`.proyecto-row-sobrecosto`/`.proyecto-row--total`, exactly as specified.

### Deviation from the brief (necessary fix, not optional)

The brief's Step 4 places the new `v-else-if="isProyectoScope && ..."` branches **after** the existing `number`/`toggle`/`select`/`checklist` branches in the `v-if`/`v-else-if` chain. I verified against the actual criteria modules (`frontend/src/criteria/distancia_via.ts`, `distancia_red.ts`, `numero_arboles.ts` → `inputType: 'number'`; `pilotes.ts` → `inputType: 'toggle'`; `tipo_estructura.ts`, `aprovechamiento_forestal.ts` → `inputType: 'select'`) that all 6 scope-`proyecto` criteria use `inputType` values that are also matched by the earlier branches. Left as literally specified, those earlier branches would always win, making the new proyecto-scope branches **unreachable** — the generic single-input/single-toggle/single-select UI would keep rendering instead, which is precisely the bug this task exists to fix.

I fixed this by adding `&& !isProyectoScope` to the three existing branch conditions:
- `v-if="module?.inputType === 'number' && !isProyectoScope"`
- `v-else-if="module?.inputType === 'toggle' && !isProyectoScope"`
- `v-else-if="module?.inputType === 'select' && !isProyectoScope"`

(The `checklist` branch needed no change — `obras_hidraulicas` is the only checklist-type criterion and its scope is `terreno_dividido`, not `proyecto`, so no conflict exists there.)

## Verification approach and outcome

**Type-check (Step 7):** `npx vue-tsc -b` — the combined build only surfaces the pre-existing `vite.config.ts` error (Vitest `test` config key not recognized by `UserConfigExport`). Running `npx vue-tsc -b tsconfig.app.json --force` (the project that actually contains `CriterionCard.vue`) in isolation returns **zero errors**. Note: the brief expected "2 pre-existing errors" (also citing an `evaluatorEngine.test.ts` `ts-expect-error`), but no `ts-expect-error` comment exists anywhere in the current codebase (grep came up empty) — that second pre-existing error appears to have already been resolved by an earlier task (3 or 4). This is not a regression from this task; the only requirement that matters — no new `CriterionCard.vue` errors — holds.

**Manual verification (Step 8):**
- Frontend dev server: confirmed reachable at `http://localhost:5173` (HTTP 200).
- Backend dev server: was not running at `127.0.0.1:5000` initially; I started it (`python run.py` from `backend/`, Flask, debug mode) and confirmed `curl http://127.0.0.1:5000/api/terrain/COLSANT5` returns the expected shape:
  - `proyectos: [{ nombre: "COLSANT5P1_GIRON_SUR", numero_arboles: 2, distancia_via: 10.0, distancia_red: 70.0, aprovechamiento_forestal: "visita", tipo_estructura: "tracker" }, { nombre: "COLSANT5P2_GIRON_SUR", numero_arboles: 0, distancia_via: 10.0, distancia_red: 30.0, aprovechamiento_forestal: null, tipo_estructura: "tracker" }]` — matches the brief's expected "P1: 2 árboles, P2: 0 árboles" check exactly.
  - I stopped the backend process again afterward since it wasn't running when I started.
- **No browser-automation tool is available to me** (confirmed — none in my toolset), so I could not visually drive the app or take a screenshot. I instead did a full code trace against the real API response and the store's data flow:
  - `store.proyectoNombres` = `['COLSANT5P1_GIRON_SUR', 'COLSANT5P2_GIRON_SUR']` (from `terrainData.proyectos.map(p => p.nombre)`).
  - `store.perProjectValues` populated per-field-per-project from the 5 DB fields (`fetchTerrain`'s `PROYECTO_SCOPE_DB_FIELDS` loop); `pilotes` is absent from that list (by design — manual boolean, not DB-sourced) so `store.perProjectValues.pilotes?.[nombre]` safely resolves to `undefined` (unchecked) until toggled.
  - `store.perProjectResults` = `evaluateScoped(...).porProyecto`, keyed by project `nombre` → `CriterionResult[]`, matching exactly what `proyectoRows`/`accentColor` index into.
  - Traced `numero_arboles` end-to-end: P1 value=2 → `computeCost` = 2 × 142,500 = 285,000; P2 value=0 → 0. `proyectoRows` would render "COLSANT5P1_GIRON_SUR — 2 árboles — $285.000" and "COLSANT5P2_GIRON_SUR — 0 árboles — —" (`formatCOP` renders 0 as "—"), plus a Total row of $285.000. This matches the brief's expected manual-check outcome.
  - Confirmed a subtlety documented in the plan itself (`docs/superpowers/plans/2026-07-11-desglose-por-proyecto.md`, near the "Stop duplicating criteria evaluation" Task 6 step): `EvaluadorView.vue` still computes its `results` array via the old, non-scope-aware `evaluateCriteria(store.criterionValues, ...)` (fixing that is explicitly Task 6's job, not Task 5's). This means the `result` prop `CriterionCard` receives for the 6 scope-`proyecto` criteria always has `value: null, sobrecosto: 0` — but this is harmless *because* my new `isProyectoScope` branches and `accentColor` fix deliberately bypass `props.result` and read fresh data from `store.perProjectResults` directly. The plan explicitly calls this out as the intended (if "fragile") state for this task, confirming my implementation matches the documented design intent.
  - **Human/browser verification is still needed** to visually confirm rendered layout, spacing, and interactive behavior (checkbox toggling triggering re-computation) in an actual browser — I could not perform this myself.

## Files changed

- `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend\src\components\CriterionCard.vue`

## Self-review findings

- `accentColor` correctly falls back to the original `props.result.value !== null` check for all non-proyecto-scope criteria (the new branch is gated behind `module.value?.scope === 'proyecto'` and returns unconditionally, only for those 6 criteria). Verified: no other criterion has `scope: 'proyecto'` besides the 6 (checked all 17 files in `frontend/src/criteria/`).
- `pilotes` renders checkboxes (one per project name), not the generic value/sobrecosto row — confirmed via the `result.id === 'pilotes'` branch guard, reachable now thanks to the added `!isProyectoScope` guard on the `toggle` branch.
- The other 5 proyecto-scope criteria (distancia_via, distancia_red, aprovechamiento_forestal, numero_arboles, tipo_estructura) render the value+sobrecosto+Total row template — confirmed each of their `inputType`s (`number`, `number`, `select`, `number`, `select`) is now excluded from the generic branches via `!isProyectoScope`, falling through to the new `result.id !== 'pilotes'` branch.
- The bottom `card-cost` generic COP row is hidden only for scope-`proyecto` criteria; the other 12 criteria's `v-if` condition (`result.formulaDefined && result.category !== 'probabilidad'`) is otherwise unchanged, so their existing bottom cost row displays exactly as before.
- No leftover references to `aprovechamiento_forestal_detalle` or any `ProyectoEstadoDetalle` type anywhere in the file (grep confirmed empty).

## Concerns

- **Deviation flagged above**: the brief's literal Step 4 ordering would have silently made the new per-project UI unreachable for all 6 criteria (each of their `inputType`s collides with an earlier generic branch). This was necessary to fix for the feature to function at all; documented in detail above for reviewer awareness.
- Manual browser verification (visual layout, live toggle interaction) was not performed — no browser-automation tool was available to me. Code trace against the live backend response is as far as I could verify independently.
- `EvaluadorView.vue` still uses the old `evaluateCriteria` path for the generic `result` prop (Task 6's responsibility per the plan) — flagged only for continuity; not a defect in this task's scope, and explicitly anticipated by the plan document itself.
