import type { CriterionModule, CriterionValue, EvalContext, CriterionResult, AggregatedResult } from '@/types'

type CriterionValues = Record<string, CriterionValue>

export const COSTO_POR_MES = 60_000_000

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
      category: criterion.category,
      riskType: criterion.riskType,
    }
  })
}

export function aggregateCosts(
  results: CriterionResult[],
  context: EvalContext,
): AggregatedResult {
  const active = results.filter(r => r.formulaDefined && r.value !== null)

  const totalSobrecostoFijo = active
    .filter(r => r.category === 'fijo' || r.category === 'ambas')
    .reduce((acc, r) => acc + r.sobrecosto, 0)

  const totalRetraso = active
    .filter(r => r.category === 'probabilidad' && r.riskType === 'meses')
    .reduce((acc, r) => acc + r.sobrecosto, 0)

  const totalRiesgoCosto = active
    .filter(r => r.category === 'probabilidad' && r.riskType === 'costo')
    .reduce((acc, r) => acc + r.sobrecosto, 0)

  return {
    totalSobrecostoFijo,
    capexTotal: context.baseCapex + totalSobrecostoFijo,
    totalRetraso,
    totalRetrasoMeses: totalRetraso / COSTO_POR_MES,
    totalRiesgoCosto,
    breakdown: results,
  }
}
