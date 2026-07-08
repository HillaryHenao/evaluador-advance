# Task 6 Report: Wire en `evaluatorStore` (kVA, arriendo/producción reactivos, financialResults)

## What I implemented

- Added `kVA = ref(1000)` and `arriendoManual = ref<number | null>(null)` alongside the existing `kWp` declaration in `evaluatorStore.ts`.
- Added a `financialResults` computed (placed next to the existing `aggregated` computed) that:
  - reads `produccion_especifica` from `terrainData`
  - resolves `arriendoAnual` as `arriendoManual.value ?? terrainData.value?.arriendo_anual` (manual override wins over DB value)
  - returns `null` if either `produccionEspecifica` or `arriendoAnual` is falsy
  - otherwise calls `calcularFinanzas({ capex: aggregated.value.capexTotal, kWp, kVA, produccionEspecifica, arriendoAnual })`
- Updated the store's `return` statement to include `kVA`, `arriendoManual`, and `financialResults` alongside all previously returned members (nothing removed).
- Added imports: `calcularFinanzas` from `@/engine/financialEngine`, and the `FinancialResults` type from `@/types`.
- Added the two tests specified in the brief to `frontend/src/stores/__tests__/evaluatorStore.test.ts` (new `describe('financialResults', ...)` block).

## TDD Evidence

### RED

Command:
```
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run evaluatorStore
```

Output (excerpt):
```
 FAIL  src/stores/__tests__/evaluatorStore.test.ts > financialResults > es null si no hay producción específica ni arriendo cargados
AssertionError: expected undefined to be null

 FAIL  src/stores/__tests__/evaluatorStore.test.ts > financialResults > calcula TIR una vez cargados terrainData y kVA por defecto
TypeError: actual value must be number or bigint, received "undefined"

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
```

Failed for the expected reason: `store.financialResults` was `undefined` (property did not exist yet), not `null`.

### GREEN

Command:
```
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run evaluatorStore
```

Output:
```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Full suite:
```
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run
```
```
 Test Files  6 passed (6)
      Tests  65 passed (65)
```

## Files changed

- `frontend/src/stores/evaluatorStore.ts` — added `kVA`, `arriendoManual` refs, `financialResults` computed, updated imports and `return`.
- `frontend/src/stores/__tests__/evaluatorStore.test.ts` — added `financialResults` describe block with the two tests from the brief.

Commit: `7e2822a` — "feat: wire financial engine into evaluatorStore reactively" (2 files changed, 34 insertions, 3 deletions), on branch `feature/motor-financiero`.

Note: the working tree also had pre-existing unrelated modifications (line-ending/CRLF normalization) to several `.superpowers/sdd/*.md` files and `progress.md`. These were NOT touched or committed by me — I staged only the two files listed above, matching the brief's `git add` instruction.

## Self-review findings

- `kVA` defaults to `1000`: confirmed (line 19).
- `arriendoManual` defaults to `null`: confirmed (line 20).
- `financialResults` returns `null` when `produccion_especifica` or the manual-or-DB arriendo is missing: confirmed (line 34 guard).
- `financialResults` returns a real `FinancialResults` object otherwise: confirmed (calls `calcularFinanzas` with correct field mapping).
- `return` statement includes `kVA`, `arriendoManual`, `financialResults` alongside all previously existing returned members, nothing removed: confirmed (lines 78-81).

## Concerns

- The brief's "Interfaces" section (line 9) names the produced ref as `evaluatorStore.arriendoAnual`, but the Step 4 code (and the task prompt from the orchestrator) both specify `arriendoManual`. I followed the exact code in Step 4 / the prompt (`arriendoManual`), since that's what's consumed by the tests and is explicitly called out as authoritative. Task 7 (UI wiring) should use `arriendoManual`, not `arriendoAnual`, when it lands.
