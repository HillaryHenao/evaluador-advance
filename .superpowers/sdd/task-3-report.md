# Task 3 Report — Frontend: cluster credit repartido entre proyectos

## What was implemented

Previously, the `cluster` criterion's credit (a negative cost of -15M for cluster=2, -30M for cluster>2)
had `scope: 'terreno_no_dividido'`: it contributed to the general CAPEX total but was explicitly
skipped (`if (criterion.scope === 'terreno_no_dividido') continue`) when building each project's
per-project breakdown — so a project's "Fijos" card never showed its share of the cluster credit,
even though the general total already included it in full.

Changed `cluster` to `scope: 'terreno_dividido'` (same scope as e.g. `corte`/`lleno`), which means:
- General total: unchanged — still uses the full `computeCost` result (no `* n` multiplier, since
  `terreno_dividido` only multiplies for `terreno_multiplicado`).
- Per-project breakdown: now divides the credit by `projectCount` (`costoBase / n`), same as any
  other `terreno_dividido` criterion — so cluster=2 with 2 active projects gives -7.5M per project.

Removed the now-dead `'terreno_no_dividido'` scope entirely: deleted it from the `CriterionScope`
union type and deleted the `if (criterion.scope === 'terreno_no_dividido') continue` early-exit in
`evaluateScoped` (dead code — no criterion module used that scope value anymore).

## TDD evidence

### RED — tests updated, run before source change

Command (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`

```
 ❯ src/engine/__tests__/evaluatorEngine.test.ts (17 tests | 2 failed)
     × todos tienen un scope válido
     × cluster (terreno_dividido): general usa el crédito completo; por proyecto lo reparte entre N

AssertionError: expected [ Array(3) ] to include 'terreno_no_dividido'
AssertionError: expected undefined to be -7500000 // Object.is equality

 Test Files  1 failed (1)
      Tests  2 failed | 15 passed (17)
```

Matches the brief's expected failure exactly — `cluster.ts` still had `scope: 'terreno_no_dividido'`.

### GREEN — after source change (`cluster.ts`, `types/index.ts`, `evaluatorEngine.ts`)

Command (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`

```
 Test Files  1 passed (1)
      Tests  17 passed (17)
```

### `evaluatorStore.test.ts` fix (Step 6)

Updated the first `perProjectFinancials` test's expected capex from `store.baseCapex` to
`store.baseCapex - 7_500_000` for both P1 and P2 — since `cluster` now reaches per-project results
(cluster=2 → -15M / 2 projects = -7.5M each), reducing each project's capex by that amount. The
second test in the same describe block needed no change (it compares against
`store.aggregated.capexTotal` directly, so it already accounts for cluster on both sides).

## Full frontend suite and type-check (Step 7)

Command (from `frontend/`): `npx vitest run`

```
 Test Files  6 passed (6)
      Tests  86 passed (86)
```

Command (from `frontend/`): `npx vue-tsc -b`

```
vite.config.ts(13,3): error TS2769: No overload matches this call.
```

Exactly 1 error, matching the expected pre-existing `vite.config.ts` error — no new type errors.

## Live/browser verification (Step 8)

Not performed. No dev server was running and no browser-driving tool was available in this
session. Per the brief's fallback instruction, this is called out here rather than guessed at.

**Needs human verification:** with both dev servers running, search `COLBOYT147` (cluster = 2) and
confirm in "Desglose por proyecto" that each project card shows a **"Cluster: -$7.500.000"** line
inside its "Fijos" section, with the "Fijos" subtotal and "CAPEX total" for each card reflecting
that credit, and that "CAPEX Total del terreno" at the top is unchanged from before this plan.

## Files changed

- `frontend/src/criteria/cluster.ts` — `scope: 'terreno_no_dividido'` → `'terreno_dividido'`.
- `frontend/src/types/index.ts` — removed `'terreno_no_dividido'` from `CriterionScope`.
- `frontend/src/engine/evaluatorEngine.ts` — removed the dead `terreno_no_dividido` early-exit in `evaluateScoped`.
- `frontend/src/engine/__tests__/evaluatorEngine.test.ts` — replaced the `terreno_no_dividido` test with the new repartition test; narrowed the valid-scopes list.
- `frontend/src/stores/__tests__/evaluatorStore.test.ts` — updated expected per-project capex in `perProjectFinancials`'s first test to account for the cluster credit now reaching per-project results.

## Commit

```
e8f119c fix: repartir el crédito de cluster entre proyectos en vez de excluirlo del desglose
5 files changed, 12 insertions(+), 13 deletions(-)
```

## Self-review

- **Completeness**: All code steps (1, 3, 4, 6) from the brief were applied verbatim; verification steps (2, 5, 7) all matched expected output exactly. Step 8 (browser) is explicitly deferred to a human per the brief's allowed fallback.
- **Quality**: The change reuses the existing `terreno_dividido` code path rather than adding a special case for cluster — the scope reclassification alone produces the correct behavior, and the dead `terreno_no_dividido` branch was fully removed rather than left as unreachable code.
- **Discipline**: Only the five files named in the brief were staged/committed.
- **Correctness check**: -15,000,000 / 2 projects = -7,500,000 each — confirmed by both the new `evaluateScoped` unit test and the updated `evaluatorStore` integration test.

## Concerns

None beyond the deferred live verification (Step 8), same caveat as Task 2.

This was the last functional task in the plan (`docs/superpowers/plans/2026-07-15-credito-cluster-y-detalle-forestal.md`). Task 4 ("Final verification") remains — it does not add new code, only end-to-end verification across Tasks 1-3, which needs a human with running dev servers per the same browser-tool gap noted above.
