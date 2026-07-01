# Task 2 Report: Módulos de criterios (19)

## Status
DONE

## Commit
cb4e03a — feat: add 19 criterion modules (5 with formulas, 14 pending)

## Files Created (20 total)

### Criteria with formulas (formulaDefined: true)
- `frontend/src/criteria/corte.ts` — 50,000 COP/m³
- `frontend/src/criteria/lleno.ts` — 250,000 COP/m³
- `frontend/src/criteria/pilotes.ts` — 156,000,000 COP (toggle)
- `frontend/src/criteria/distancia_red.ts` — tiered pricing (5 bands)
- `frontend/src/criteria/distancia_via.ts` — 457,292 COP/m

### Pending criteria (formulaDefined: false, computeCost returns 0)
- `frontend/src/criteria/nivel_tension.ts`
- `frontend/src/criteria/cluster.ts`
- `frontend/src/criteria/obras_hidraulicas.ts`
- `frontend/src/criteria/disposicion_movimiento.ts`
- `frontend/src/criteria/amenazas.ts`
- `frontend/src/criteria/or.ts`
- `frontend/src/criteria/propietario.ts`
- `frontend/src/criteria/tipo_estructura.ts`
- `frontend/src/criteria/ocupacion_cauce.ts`
- `frontend/src/criteria/servidumbre.ts`
- `frontend/src/criteria/aprovechamiento_forestal.ts`
- `frontend/src/criteria/coexistencias.ts`
- `frontend/src/criteria/numero_arboles.ts`
- `frontend/src/criteria/comunidad.ts`

### Test file
- `frontend/src/criteria/__tests__/criteria.test.ts`

## Test Output

Command: `cd frontend && npx vitest run src/criteria/__tests__/criteria.test.ts`

```
 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  15:53:31
   Duration  2.45s
```

15/15 tests passing (the brief required all 12 minimum; vitest counted 15 because the suite contains 3 extra assertions included in the test file as written).

## Deviations
None. All ids, labels, formulas, options, and file names match the brief verbatim.
