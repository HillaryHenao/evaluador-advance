# Task 3 Report: Datos macro + utilidades matemáticas (IRR/NPV)

## Status
DONE

## What was implemented

1. `frontend/src/engine/financialData.ts` — literal macro assumption tables transcribed
   exactly from the task brief:
   - `AÑO_BASE = 2026`
   - `IPC: number[]` (34 elements)
   - `FX: number[]` (34 elements)
   - `PPA_CON_INDEXACION: number[]` (34 elements)
   - `MANTENIMIENTO_TRACKER: Record<number, number>` (5 entries, periods 6/11/16/21/26)
   - `REEMPLAZO_INVERSORES: Record<number, number>` (1 entry, period 16)

2. `frontend/src/engine/financialMath.ts` — generic, pure math utilities:
   - `npv(rate, cashflows)` — Excel-style NPV (discounts `cashflows[0]` to t=1, i.e. does
     NOT include a t=0 flow; that's added separately by the caller, same convention as
     Excel's `NPV(...)+C38`).
   - `irr(cashflows, guess = 0.1)` — Newton-Raphson root-finder on the full VPN function
     (where `cashflows[0]` IS the t=0 flow), 100 iterations, 1e-9 convergence tolerance,
     bails out if the derivative underflows (1e-12).

3. `frontend/src/engine/__tests__/financialMath.test.ts` — 3 tests covering `npv` (simple
   2-period flow) and `irr` (2-period exact 10% case, and a 5-period flow with a
   known ~24.89% IRR).

Neither module imports from or depends on Task 1/2 work; both are pure, self-contained
data/math with no side effects, as scoped.

## TDD Evidence

### RED

Command:
```
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run financialMath
```

Output (abridged):
```
FAIL  src/engine/__tests__/financialMath.test.ts [ src/engine/__tests__/financialMath.test.ts ]
Error: Failed to resolve import "../financialMath" from "src/engine/__tests__/financialMath.test.ts". Does the file exist?
...
 Test Files  1 failed (1)
      Tests  no tests
```

Failed for the expected reason: `financialMath.ts` did not exist yet. `financialData.ts`
was already created at this point (Step 1 in the brief happens before the test), but the
test file only imports from `../financialMath`, so this failure is unrelated to
`financialData.ts` correctness.

### GREEN

Command:
```
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run financialMath
```

Output:
```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Full suite re-run to confirm no regressions elsewhere:
```
npx vitest run
 Test Files  5 passed (5)
      Tests  56 passed (56)
```

## Commit
8d9a7cb — feat: add IRR/NPV math utilities and macro assumption tables

## Files Created
- `frontend/src/engine/financialData.ts`
- `frontend/src/engine/financialMath.ts`
- `frontend/src/engine/__tests__/financialMath.test.ts`

## Self-review findings

- Extracted the three ```ts code blocks from `task-3-brief.md` programmatically (regex
  over the raw markdown) and diffed each one byte-for-byte against the corresponding
  created file (`financialData.ts`, the test file, and `financialMath.ts`). All three
  diffs were empty — **confirmed identical, no transcription errors**.
- Independently counted the elements of `IPC`, `FX`, and `PPA_CON_INDEXACION` via a
  small script: all three have exactly 34 elements, matching the stated index range
  (0 = 2026 .. 33 = 2059).
- Verified `MANTENIMIENTO_TRACKER` has the 5 specified period keys (6, 11, 16, 21, 26)
  and `REEMPLAZO_INVERSORES` has the 1 specified key (16), with values matching the
  brief exactly (checked as part of the whole-file diff above).
- Verified `npv`/`irr` implementations match the brief's code exactly (whole-file diff,
  no edits made beyond what the brief specified).
- Confirmed the tests genuinely exercise the functions: they were RED before
  `financialMath.ts` existed (import failure) and GREEN after implementing it, with
  no other file changes in between — not a trivial/tautological pass.
- Ran the full project test suite (`npx vitest run`) after the change: 56/56 tests pass
  across 5 files, no regressions.
- No stray/temporary files were left in the repo; `git status` before commit showed only
  the three intended new files as untracked, and the commit added exactly those three.

## Concerns
None. Numbers, formulas, and test results all match the brief exactly; no ambiguity was
encountered.
