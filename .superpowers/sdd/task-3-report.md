# Task 3 Report: Frontend engine — scope-aware evaluation

## Implementation Summary

Successfully implemented `evaluateScoped` function and fixed `aggregateCosts` filter to enable scope-aware evaluation with both general terrain-wide totals and per-project breakdowns in a single pass.

## What Was Implemented

### 1. **`evaluateScoped` Function** (evaluatorEngine.ts, lines 54-104)
- New exported function that computes both general and per-project cost breakdowns simultaneously
- Signature: `evaluateScoped(values, perProjectValues, proyectoNombres, context): ScopedEvaluation`
- Implements all 4 scope types correctly:
  - **scope `proyecto`**: General sums all project costs (with `value: null`); per-project uses individual project values
  - **scope `terreno_dividido`**: General uses full cost; per-project divides by N (number of projects)
  - **scope `terreno_multiplicado`**: General multiplies base cost by N; per-project uses base cost (no multiplication)
  - **scope `terreno_no_dividido`**: General includes; per-project excluded (not listed for individual projects)

### 2. **ScopedEvaluation Interface** (evaluatorEngine.ts, lines 49-52)
- Defines return type with `general: CriterionResult[]` and `porProyecto: Record<string, CriterionResult[]>`

### 3. **aggregateCosts Filter Fix** (evaluatorEngine.ts, line 110)
- Changed filter from `r.formulaDefined && r.value !== null` to `r.formulaDefined`
- Allows results with `value: null` (like scope-`proyecto` criteria from `evaluateScoped`) to contribute their computed `sobrecosto`

### 4. **Test Suite Enhancements**

Updated `evaluatorEngine.test.ts`:
- Renamed test: "suma al CAPEX solo los criterios fijos/ambas con formulaDefined=true" (removed "valor distinto de null" requirement)
- Added 5 new `evaluateScoped` tests:
  - Scope `proyecto`: Verifies general sums project costs and per-project uses individual values
  - Scope `terreno_dividido`: Verifies general uses full cost, per-project divides by N
  - Scope `terreno_multiplicado`: Verifies general multiplies by N, per-project uses base cost
  - Scope `terreno_no_dividido`: Verifies general included, per-project excluded
  - Edge case: No active projects (projectCount absent) → uses n=1
- Added new `aggregateCosts` test: "cuenta un resultado con value=null pero sobrecosto real distinto de cero"

## Test Results

### GREEN — All tests pass:
```
Test Files  1 passed (1)
Tests       17 passed (17)
```

### Test Evidence
- `evaluateScoped` tests exercise all 4 scope types with actual computation verification
- Division/multiplication logic tested with explicit expected values:
  - `numero_arboles`: 2×142,500 + 3×142,500 per-project sums to general total
  - `corte` (terreno_dividido): 100×80,000 → divided by 2 per project
  - `nivel_tension` (terreno_multiplicado): base×2 for general, base per-project
  - `cluster` (terreno_no_dividido): only in general, excluded from per-project
- `aggregateCosts` null-value fix verified with synthetic result containing `value: null` and real `sobrecosto`

## Type-Check Results

```
3 errors (unchanged from Task 2):
- src/components/CriterionCard.vue(83,29) — Property 'aprovechamiento_forestal_detalle' (Task 5)
- src/stores/__tests__/evaluatorStore.test.ts(11,3) — 'distancia_via' not in TerrainData (Task 4)
- vite.config.ts(13,3) — 'test' not in UserConfigExport (pre-existing)
```

These are deferred to Tasks 4-5 as expected. No new errors introduced by this task.

## Files Changed

1. **frontend/src/engine/evaluatorEngine.ts**
   - Added `ScopedEvaluation` interface (lines 49-52)
   - Added `evaluateScoped` function (lines 54-104)
   - Fixed `aggregateCosts` filter (line 110)

2. **frontend/src/engine/__tests__/evaluatorEngine.test.ts**
   - Added import of `evaluateScoped` (line 2)
   - Updated test name: removed "valor distinto de null" requirement (line 64)
   - Added new `aggregateCosts` null-value test (lines 72-78)
   - Added 5 new `evaluateScoped` describe block with all scope tests (lines 105-160)
   - Removed unused `@ts-expect-error` directive (line 10)

## Self-Review Findings

✓ **Scope handling**: All 4 scopes implemented correctly
  - `proyecto`: Sums projects in general, individual values per-project
  - `terreno_dividido`: Full cost general, divided per-project (÷N)
  - `terreno_multiplicado`: Multiplied general (×N), base per-project
  - `terreno_no_dividido`: General only, excluded from per-project

✓ **Division/multiplication logic**: Thoroughly tested
  - Division tests use concrete expected values (e.g., 8,000,000 ÷ 2 = 4,000,000)
  - Multiplication tests verify N×base in general and base in per-project

✓ **aggregateCosts filter**: Minimal change (one operator removed)
  - Only the filter condition changed; no other behavior affected
  - Now accepts `value: null` when `sobrecosto` is real

✓ **Test coverage**: New tests exercise actual computation, not just function calls
  - Each test verifies concrete values from `computeCost` results
  - All 4 scope types covered with explicit assertions

✓ **No modifications to `evaluateCriteria`**: Function remains unchanged, as required

✓ **Backward compatibility**: Existing tests all pass; `evaluateCriteria` still works for existing callers

## Concerns

None. The implementation follows the brief exactly, all tests pass, and type-check shows only expected pre-existing errors from Tasks 4-5.

## Commit

```
a4effb3 feat: add evaluateScoped for scope-aware general total + per-project breakdown
```
