# Task 4 Report: Motor financiero — ingresos, costos y CAPEX año por año

## What was implemented

Created `frontend/src/engine/financialEngine.ts` exporting `calcularFlujosDeCaja(inputs: FinancialInputs): { flujoInversionista: number[] }`.

The function computes, for 34 periods (index 0 = año 2026 investment year, indices 1..33 = años 2027..2059):

- Year 0: `flujoInversionista[0] = -capex` (the CAPEX disbursement).
- For each year k = 1..33:
  - Panel efficiency (`eficiencia`) starting at 0.992 and degrading by 0.0035/year.
  - Generation (`generacion`) from efficiency × kWp × produccionEspecifica × 365, gated by the `activo()` window (30 operating years starting the year after AÑO_BASE).
  - Revenue (`ingresos`) = PPA sale (using `PPA_CON_INDEXACION[k-1]`, an intentional one-year offset) + REC revenue (USD/MWh converted via `FX[k]`).
  - Costs, all as running series that either bootstrap at k=1 from a flat base (arriendo, seguro, mantenimiento, servicios públicos) or escalate off the prior year by `(1 + IPC[k-1])` (or 1.01 for seguro): arriendo, operación (3.8% of ingresos), CGM/representación/costos regulatorios (COP/kWh tariffs tracked via running `tarifaCgm`/`tarifaRepresentacion`/`tarifaCostosRegulatorios` variables that compound by IPC), seguro (0.185% of CAPEX), ICA (0.6% of venta de energía), IVA (19% of half of operación + representación + mantenimiento), servicios públicos.
  - Periodic fixed costs `MANTENIMIENTO_TRACKER[k]` and `REEMPLAZO_INVERSORES[k]` (looked up from `financialData.ts`, defaulting to 0 when absent).
  - `flujoOperativo[k]` sums all of the above; `flujoInversionista[k] = flujoOperativo[k]` (participation = 1).

The code was transcribed verbatim from the task brief (`.superpowers/sdd/task-4-brief.md`, Step 3) — no formulas were altered.

## TDD Evidence

### RED

Command:
```
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run financialEngine
```

Output (before `financialEngine.ts` existed):
```
 RUN  v4.1.9 C:/Users/EQUIPO/Documents/Claude/evaluador-advance/frontend

 ❯ src/engine/__tests__/financialEngine.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/engine/__tests__/financialEngine.test.ts [ src/engine/__tests__/financialEngine.test.ts ]
Error: Failed to resolve import "../financialEngine" from "src/engine/__tests__/financialEngine.test.ts". Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

Failed for the expected reason: the module didn't exist yet.

### GREEN

Command:
```
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run financialEngine --reporter=verbose
```

Output:
```
 RUN  v4.1.9 C:/Users/EQUIPO/Documents/Claude/evaluador-advance/frontend

 ✓ src/engine/__tests__/financialEngine.test.ts > calcularFlujosDeCaja > el año 0 (inversión) es -capex en el flujo del inversionista 2ms
 ✓ src/engine/__tests__/financialEngine.test.ts > calcularFlujosDeCaja > genera 34 períodos (2026 a 2059) 1ms
 ✓ src/engine/__tests__/financialEngine.test.ts > calcularFlujosDeCaja > el flujo operativo del año 1 (2027) es positivo y del orden esperado 0ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Actual numeric values (verified via a throwaway `tsx` script that imported `calcularFlujosDeCaja` with `INPUTS_EXCEL` and logged the results, then deleted):

- `flujoInversionista.length` = `34` (assertion 2: expects `34`) — match.
- `flujoInversionista[0]` = `-4587742837` (assertion 1: expects `≈ -4_587_742_837`) — exact match.
- `flujoInversionista[1]` = `561776560.8413973` (assertion 3: expects `≈ 561_776_560.8`) — match to the cent.

Full suite (all engine/store/criteria tests in the repo):
```
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run
```
```
 Test Files  6 passed (6)
      Tests  59 passed (59)
```

`npx vue-tsc --noEmit` also ran clean (no output / no errors).

## Files changed

- `frontend/src/engine/financialEngine.ts` (new) — the implementation.
- `frontend/src/engine/__tests__/financialEngine.test.ts` (new) — the 3 tests from the brief, transcribed verbatim.

Both are staged and committed in commit `0275683` on branch `feature/motor-financiero`:
```
feat: compute revenue, operating costs and CAPEX cash flows
```

(Note: several `.superpowers/sdd/*.md` files show as modified in `git status` from a prior session — these were not touched by this task and were left unstaged/uncommitted, as instructed to only commit the two files listed in the brief's Step 5. Also note: this report file previously contained leftover content from an unrelated "Auth service + store Pinia" task under the same filename — that has been replaced with this task's report.)

## Self-review findings

Performed a byte-for-byte diff (`diff -u --strip-trailing-cr`) between the brief's Step 3 code block and the committed `financialEngine.ts`. The only difference was a trailing newline at EOF (present in my file, absent in the brief's markdown-extracted snippet due to how the code fence was closed) — the code itself is character-for-character identical to the brief.

Explicit confirmation of the 4 required checks:

1. **IVA line present**: `iva[k] = (operacion[k] / 2 + representacion[k] + mantenimiento[k]) * IVA` — present at line 106, exactly as specified.
2. **All three IPC-growth costs use `IPC[k - 1]`**: confirmed for `arriendo[k]` (line 78), `mantenimiento[k]` (line 102), and `serviciosPublicos[k]` (line 111) — all use `IPC[k - 1]`, none use `k - 2` or `k`.
3. **CGM/Representación/CostosRegulatorios escalate via running tariff variables**: `tarifaCgm`, `tarifaRepresentacion`, `tarifaCostosRegulatorios` are declared once outside the loop (lines 49-51) and compounded in place (`tarifaCgm *= 1 + IPC[k - 1]`, etc., lines 83-85) only when `k > 1`, then multiplied by `generacion[k]` each iteration — not recomputed flat per year.
4. **`MANTENIMIENTO_TRACKER`/`REEMPLAZO_INVERSORES` added into `flujoOperativo[k]`**: confirmed at lines 116-117 (lookup) and line 123 (`mantenimientoTracker + reemplazoInversores` included in the `flujoOperativo[k]` sum).

## Concerns

None. The implementation is a verbatim transcription of the pre-verified brief code, all three test assertions pass with values matching the Excel-derived expectations to well within tolerance, the full test suite (59 tests) passes, and `vue-tsc --noEmit` reports no type errors.
