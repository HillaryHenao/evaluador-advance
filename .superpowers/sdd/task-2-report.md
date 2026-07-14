# Task 2 Implementation Report: Frontend types — CriterionScope, ProyectoData, EvalContext.projectCount

## Status
**DONE_WITH_CONCERNS** — Implementation complete and tested, with expected type errors in files outside this task's scope (Task 4 and 5 will resolve them).

## What Was Implemented

### Step 1: Updated `frontend/src/types/index.ts`
- Added `CriterionScope` type definition: `'proyecto' | 'terreno_dividido' | 'terreno_multiplicado' | 'terreno_no_dividido'`
- Added `ProyectoData` interface with fields: `nombre`, `distancia_via`, `distancia_red`, `aprovechamiento_forestal`, `numero_arboles`, `tipo_estructura`
- Updated `EvalContext` interface to include optional `projectCount?: number` field
- Updated `CriterionModule` interface to include required `scope: CriterionScope` field
- Updated `TerrainData` interface:
  - Removed project-level fields: `distancia_via`, `distancia_red`, `tipo_estructura`, `numero_arboles`, `aprovechamiento_forestal`, `aprovechamiento_forestal_detalle`
  - Added new field: `proyectos: ProyectoData[]`
- Deleted `ProyectoEstadoDetalle` interface (no longer used)

### Step 2: Added `scope` field to all 18 criteria modules
Updated the following files with appropriate `scope` values:

**scope: 'proyecto'** (6 files):
- `frontend/src/criteria/distancia_via.ts`
- `frontend/src/criteria/distancia_red.ts`
- `frontend/src/criteria/numero_arboles.ts`
- `frontend/src/criteria/aprovechamiento_forestal.ts`
- `frontend/src/criteria/pilotes.ts`
- `frontend/src/criteria/tipo_estructura.ts`

**scope: 'terreno_dividido'** (10 files):
- `frontend/src/criteria/corte.ts`
- `frontend/src/criteria/lleno.ts`
- `frontend/src/criteria/obras_hidraulicas.ts`
- `frontend/src/criteria/ocupacion_cauce.ts`
- `frontend/src/criteria/coexistencias.ts`
- `frontend/src/criteria/comunidad.ts`
- `frontend/src/criteria/or.ts`
- `frontend/src/criteria/propietario.ts`
- `frontend/src/criteria/servidumbre.ts`
- `frontend/src/criteria/amenazas.ts`

**scope: 'terreno_multiplicado'** (1 file):
- `frontend/src/criteria/nivel_tension.ts`

**scope: 'terreno_no_dividido'** (1 file):
- `frontend/src/criteria/cluster.ts`

### Step 3: Added scope coverage test
Added test case to `frontend/src/engine/__tests__/evaluatorEngine.test.ts`:
```typescript
it('todos tienen un scope válido', () => {
  const criteria = loadCriteria()
  const validScopes = ['proyecto', 'terreno_dividido', 'terreno_multiplicado', 'terreno_no_dividido']
  for (const c of criteria) {
    expect(validScopes).toContain(c.scope)
  }
})
```

## Testing Results

### Step 2b: Verification
Verified all 18 criteria files have `scope:` field using grep — found exactly 18 files with scope, zero files missing it.

### Step 4: Test execution
```
evaluatorEngine.test.ts: 11/11 tests PASS ✓ (10 existing + 1 new scope coverage test)
```
The new test specifically validates that all loaded criteria have a valid scope value.

### Step 5: Full suite and type-check results

**vitest run (evaluator-related tests):**
```
Test Files: 2 passed (evaluatorEngine + criteria)
Tests: 55 passed
```
All evaluator and criteria tests pass. Pre-existing test failures in authStore are unrelated to this task.

**npx vue-tsc -b results:**
```
Errors found: 4 total
- 2 pre-existing unrelated errors (as expected):
  × evaluatorEngine.test.ts(10,3): Unused '@ts-expect-error' directive
  × vite.config.ts(13,3): No overload matches this call (UserConfigExport test config)
  
- 2 expected new errors from TerrainData schema changes (will be fixed by Task 4-5):
  × CriterionCard.vue(83,29): Property 'aprovechamiento_forestal_detalle' does not exist
  × evaluatorStore.test.ts(11,3): Property 'distancia_via' does not exist in TerrainData
```

These errors are expected because Task 1 changed the API response shape, and:
- Task 4 (evaluatorStore.ts) will wire the new `proyectos` field into the store
- Task 5 (CriterionCard.vue) will update the UI to reference the new per-project fields

This task correctly introduced the schema changes; downstream consumers will be updated in later tasks.

## Files Changed

**Modified (20 files total):**
- frontend/src/types/index.ts (4 sections)
- frontend/src/criteria/distancia_via.ts
- frontend/src/criteria/distancia_red.ts
- frontend/src/criteria/numero_arboles.ts
- frontend/src/criteria/aprovechamiento_forestal.ts
- frontend/src/criteria/pilotes.ts
- frontend/src/criteria/tipo_estructura.ts
- frontend/src/criteria/corte.ts
- frontend/src/criteria/lleno.ts
- frontend/src/criteria/obras_hidraulicas.ts
- frontend/src/criteria/ocupacion_cauce.ts
- frontend/src/criteria/coexistencias.ts
- frontend/src/criteria/comunidad.ts
- frontend/src/criteria/or.ts
- frontend/src/criteria/propietario.ts
- frontend/src/criteria/servidumbre.ts
- frontend/src/criteria/amenazas.ts
- frontend/src/criteria/nivel_tension.ts
- frontend/src/criteria/cluster.ts
- frontend/src/engine/__tests__/evaluatorEngine.test.ts

## Self-Review Findings

**Completeness:** ✓
- All 18 criteria files updated with scope field
- New types (CriterionScope, ProyectoData) added and integrated
- EvalContext and CriterionModule interfaces updated
- TerrainData schema updated per spec
- ProyectoEstadoDetalle deleted as specified
- Test coverage added for scope field

**Quality:** ✓
- Code follows existing patterns and style (no restructuring of criteria files)
- Changes are minimal and focused (only added scope, no other modifications)
- Test correctly validates all scope values are valid
- Type definitions match the new API response shape from Task 1

**Discipline:** ✓
- Stayed within task scope — only modified files specified in the brief
- No changes to UI or evaluation logic (that's Tasks 3-6)
- No unauthorized modifications to test fixtures or other code

**Type Safety:** ✓
- New `scope` field is required on CriterionModule (not optional)
- All 18 criteria modules provide the field
- CriterionScope type is narrow and explicit (4 valid values)
- `projectCount` is optional on EvalContext to avoid breaking existing code

## Concerns

**Expected type errors (not failures):** The type-check output shows 2 new errors in CriterionCard.vue and evaluatorStore.test.ts referencing removed TerrainData fields. These are expected because:
1. Task 1 changed the API shape to return `proyectos: list[dict]` instead of top-level fields
2. This task propagates that change into the frontend type system
3. Task 4 and Task 5 are responsible for wiring up the new fields and removing references to old ones

This is **not** a failure — it's the correct progression of the plan. The schema is now correct; downstream consumers will be updated in order.

## Commit
```
a2ddd9d feat: add scope classification to CriterionModule, ProyectoData type
```

## Next Steps
Ready for Task 3 (Frontend engine — evaluateScoped). The type system is now stable and type-safe for per-project evaluation logic.
