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
