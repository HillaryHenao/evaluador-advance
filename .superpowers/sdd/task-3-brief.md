# Task 3 Brief: Motor de criterios (evaluatorEngine.ts)

## Context
Task 3 of 10. Tasks 1 and 2 are complete. The 19 criterion modules exist in `frontend/src/criteria/*.ts`. Your job is to build `evaluatorEngine.ts` — the central engine that loads all modules via `import.meta.glob` and exposes three functions.

## Global Constraints
- Work in `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend\`
- File: `src/engine/evaluatorEngine.ts`
- Tests: `src/engine/__tests__/evaluatorEngine.test.ts`
- Run with: `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`
- `@` alias resolves to `src/`
- All tests must PASS before committing
- Use PowerShell for commands

## Interface (from src/types/index.ts — do not redefine)
```typescript
import type { CriterionModule, CriterionValue, EvalContext, CriterionResult, AggregatedResult } from '@/types'
type CriterionValues = Record<string, CriterionValue>
```

## Three functions to implement

### loadCriteria(): CriterionModule[]
- Uses `import.meta.glob('../criteria/*.ts', { eager: true })` to load all criterion modules
- Caches result in module-level variable `_cachedCriteria`
- Filters out any falsy values
- Returns array of CriterionModule

### evaluateCriteria(values: CriterionValues, context: EvalContext): CriterionResult[]
- Calls `loadCriteria()`
- For each criterion: extracts `values[criterion.id] ?? null`, computes sobrecosto (0 if `formulaDefined === false`, else calls `computeCost`)
- Returns CriterionResult[] with ALL 19 criteria (even those with null value)
- CriterionResult shape: `{ id, label, value, sobrecosto, formulaDefined, fromDb: criterion.dataSource === 'db' }`

### aggregateCosts(results: CriterionResult[], context: EvalContext): AggregatedResult
- Sums sobrecosto of results where `formulaDefined === true` AND `value !== null`
- Returns: `{ totalSobrecosto, capexTotal: context.baseCapex + totalSobrecosto, breakdown: results }`

## Exact implementation

Create `src/engine/evaluatorEngine.ts`:
```typescript
import type { CriterionModule, CriterionValue, EvalContext, CriterionResult, AggregatedResult } from '@/types'

type CriterionValues = Record<string, CriterionValue>

let _cachedCriteria: CriterionModule[] | null = null

export function loadCriteria(): CriterionModule[] {
  if (_cachedCriteria) return _cachedCriteria

  const modules = import.meta.glob('../criteria/*.ts', { eager: true }) as Record<
    string,
    { default: CriterionModule }
  >

  _cachedCriteria = Object.values(modules)
    .map(m => m.default)
    .filter(Boolean)

  return _cachedCriteria
}

export function evaluateCriteria(
  values: CriterionValues,
  context: EvalContext,
): CriterionResult[] {
  const criteria = loadCriteria()

  return criteria.map(criterion => {
    const value = values[criterion.id] ?? null
    const sobrecosto = criterion.formulaDefined
      ? criterion.computeCost(value, context)
      : 0

    return {
      id: criterion.id,
      label: criterion.label,
      value,
      sobrecosto,
      formulaDefined: criterion.formulaDefined,
      fromDb: criterion.dataSource === 'db',
    }
  })
}

export function aggregateCosts(
  results: CriterionResult[],
  context: EvalContext,
): AggregatedResult {
  const totalSobrecosto = results
    .filter(r => r.formulaDefined && r.value !== null)
    .reduce((acc, r) => acc + r.sobrecosto, 0)

  return {
    totalSobrecosto,
    capexTotal: context.baseCapex + totalSobrecosto,
    breakdown: results,
  }
}
```

## Test file

Create `src/engine/__tests__/evaluatorEngine.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { loadCriteria, evaluateCriteria, aggregateCosts } from '../evaluatorEngine'
import type { EvalContext } from '@/types'

const ctx: EvalContext = { baseCapex: 4_000_000_000, kWp: 1320 }

beforeEach(() => {
  // Reset cache between tests
  // @ts-expect-error accessing module internals for test reset
  // The cache is module-level; re-importing is not needed — glob is eager
})

describe('loadCriteria', () => {
  it('carga exactamente 19 criterios', () => {
    const criteria = loadCriteria()
    expect(criteria).toHaveLength(19)
  })

  it('todos tienen id, label e inputType', () => {
    const criteria = loadCriteria()
    for (const c of criteria) {
      expect(c.id).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(['number', 'toggle', 'select']).toContain(c.inputType)
    }
  })
})

describe('evaluateCriteria', () => {
  it('calcula sobrecosto correcto para corte=100m³', () => {
    const values = { corte: 100 }
    const results = evaluateCriteria(values, ctx)
    const corteResult = results.find(r => r.id === 'corte')
    expect(corteResult?.sobrecosto).toBe(5_000_000)
  })

  it('retorna sobrecosto 0 para criterios con formulaDefined=false', () => {
    const values = { amenazas: 'alta' }
    const results = evaluateCriteria(values, ctx)
    const amenazasResult = results.find(r => r.id === 'amenazas')
    expect(amenazasResult?.sobrecosto).toBe(0)
    expect(amenazasResult?.formulaDefined).toBe(false)
  })

  it('incluye los 19 criterios en el resultado aunque no tengan valor', () => {
    const results = evaluateCriteria({}, ctx)
    expect(results).toHaveLength(19)
  })
})

describe('aggregateCosts', () => {
  it('suma solo los criterios con formulaDefined=true y valor distinto de null', () => {
    const values = { corte: 100, lleno: 10, pilotes: true }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    const expected = 100 * 50_000 + 10 * 250_000 + 156_000_000
    expect(aggregated.totalSobrecosto).toBe(expected)
  })

  it('calcula capexTotal = baseCapex + totalSobrecosto', () => {
    const values = { corte: 100 }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.capexTotal).toBe(ctx.baseCapex + 100 * 50_000)
  })

  it('retorna breakdown con todos los criterios', () => {
    const results = evaluateCriteria({}, ctx)
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.breakdown).toHaveLength(19)
  })
})
```

## Note on import.meta.glob in tests
Vitest supports `import.meta.glob` natively. The glob pattern `../criteria/*.ts` is relative to the engine file location (`src/engine/`), so it correctly resolves to `src/criteria/*.ts`. This should work without extra configuration.

## Steps
1. Create `src/engine/` directory
2. Create `src/engine/__tests__/` directory
3. Write `evaluatorEngine.ts` (exact code above)
4. Write the test file (exact code above)
5. Run tests: `cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend" && npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`
6. Fix any failures
7. Commit: `cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance" && git add frontend/src/engine/ && git commit -m "feat: add modular evaluator engine with glob-based criterion loading"`

## Report Contract
Write full report to: `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\.superpowers\sdd\task-3-report.md`

Return ONLY: status, commit hash(es), test summary (X/Y passing), concerns.
