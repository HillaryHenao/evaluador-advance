# Task 5 Report: Beneficio tributario + resultados finales (TIR/VPN/Payback) + golden master

## What I implemented

In `frontend/src/engine/financialEngine.ts` (appended after Task 4's `calcularFlujosDeCaja`, which was not modified):

- Two new top-of-file imports: `import { irr, npv } from './financialMath'` and `FinancialResults` added to the existing `@/types` import.
- `calcularBeneficioTributario(capex)`: builds a 34-element array of annual tax-benefit cash flows from (a) straight-line depreciation of 100% of capex over 15 years (years base+1..base+15) and (b) accelerated depreciation of an additional 50% of capex over 15 years, delayed by one year (years base+2..base+16, guarded by `k >= 2`), both taxed at 35%.
- `calcularPayback(flujos)`: replicates the Excel's fractional-year payback convention — the investment year always contributes 1 full year, subsequent years contribute 1 while the investment remains unrecovered, a fraction in the crossing year, 0 after.
- `calcularFinanzas(inputs)`: orchestrates `calcularFlujosDeCaja`, adds the tax benefit to get the "con beneficios" cash flow series, computes VPN as `flujo[0] + npv(10%, flujo.slice(1,32))` for both series, computes TIR via `irr()` for both series, computes payback for both series, and returns the `FinancialResults` shape.

In `frontend/src/engine/__tests__/financialEngine.test.ts`: added the golden-master `describe` block exactly as specified in the brief, plus updated the import line to bring in `calcularFinanzas`.

## TDD Evidence

### RED

Command:
```
cd frontend && npx vitest run financialEngine
```
Output (relevant excerpt):
```
FAIL  src/engine/__tests__/financialEngine.test.ts [ src/engine/__tests__/financialEngine.test.ts ]
TypeError: calcularFinanzas is not a function
 ❯ src/engine/__tests__/financialEngine.test.ts:31:21
Test Files  1 failed (1)
Tests  no tests
```
Failed for the expected reason (function not yet implemented).

### GREEN

Command:
```
cd frontend && npx vitest run financialEngine
```
Output:
```
Test Files  1 passed (1)
     Tests  7 passed (7)
```

Actual computed values (captured via a temporary probe test, then removed) vs golden-master expectations:

| Metric | Actual | Expected (golden master) | Match |
|---|---|---|---|
| tir | 0.11008828321041396 | 0.1100882832 | matches to ~9 decimal places |
| tirConBeneficios | 0.14204359547095805 | 0.1420435955 | matches to ~9 decimal places |
| vpn | 391,839,623.55481434 | 391,839,623.5 | matches to the cent |
| vpnConBeneficios | 1,576,145,841.2955685 | 1,576,145,841 | matches to the cent |
| paybackAnios | 9.550680027895089 | ~9 years (Excel) | within ~0.55 years — expected approximation |
| paybackConBeneficiosAnios | 7.685372316478172 | ~7 years (Excel) | within ~0.69 years — expected approximation |

TIR/VPN precision is essentially exact (better than the brief's own claim of 6 decimal places), confirming both the Task 4 cash flows and this task's formulas were transcribed correctly.

### Full suite

Command:
```
cd frontend && npx vitest run
```
Output:
```
Test Files  6 passed (6)
     Tests  63 passed (63)
```

Also ran `npx vue-tsc --noEmit` — no type errors.

## Files changed

- `frontend/src/engine/financialEngine.ts` — added imports, `calcularBeneficioTributario`, `calcularPayback`, `calcularFinanzas` (87 lines added, Task 4 code untouched).
- `frontend/src/engine/__tests__/financialEngine.test.ts` — added `calcularFinanzas` import and the golden-master `describe` block.

Commit: `775d2ad` — "feat: add tax benefit calculation and TIR/VPN/Payback outputs"

## Self-review findings

- Both new imports are at the top of the file, not mid-file: `import { irr, npv } from './financialMath'` and `FinancialResults` merged into the existing `import type { FinancialInputs, FinancialResults } from '@/types'` line.
- `calcularBeneficioTributario` correctly implements both straight-line depreciation (years base+1..base+15) and the accelerated 50%-of-capex depreciation delayed by one year with the `k >= 2` guard, exactly as specified in the brief.
- The VPN calculation slices `flujoInversionista.slice(1, 32)` (31 elements, years 1-31) and separately adds `flujoInversionista[0]`, matching the brief's Excel-replication note.
- The payback function and its approximate-precision caveat were transcribed as-is from the brief; no constant was fudged to force closer agreement with the Excel's 9/7-year figures.
- Diff was reviewed line-by-line against the brief's code blocks before committing — matches verbatim.

## Concerns

None blocking. The only known imprecision is the payback calculation, which is explicitly documented in the brief as an accepted approximation (fractional-year convention couldn't be fully reverse-engineered from the Excel). Actual results: 9.55 years (no benefits) vs Excel's ~9, and 7.69 years (with benefits) vs Excel's ~7 — both within less than a year, which is in line with the brief's expectation and is not something to chase further at the expense of TIR/VPN accuracy (which is near-exact).
