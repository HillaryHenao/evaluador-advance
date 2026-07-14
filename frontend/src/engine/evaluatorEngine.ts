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

export interface ScopedEvaluation {
  general: CriterionResult[]
  porProyecto: Record<string, CriterionResult[]>
}

export function evaluateScoped(
  values: CriterionValues,
  perProjectValues: Record<string, Record<string, CriterionValue>>,
  proyectoNombres: string[],
  context: EvalContext,
): ScopedEvaluation {
  const criteria = loadCriteria()
  const n = context.projectCount ?? 1

  const general: CriterionResult[] = []
  const porProyecto: Record<string, CriterionResult[]> = {}
  for (const nombre of proyectoNombres) porProyecto[nombre] = []

  for (const criterion of criteria) {
    const base = {
      id: criterion.id,
      label: criterion.label,
      formulaDefined: criterion.formulaDefined,
      fromDb: criterion.dataSource === 'db',
      category: criterion.category,
      riskType: criterion.riskType,
    }

    if (criterion.scope === 'proyecto') {
      const valoresPorProyecto = perProjectValues[criterion.id] ?? {}
      let sumaGeneral = 0
      for (const nombre of proyectoNombres) {
        const value = valoresPorProyecto[nombre] ?? null
        const sobrecosto = criterion.formulaDefined ? criterion.computeCost(value, context) : 0
        sumaGeneral += sobrecosto
        porProyecto[nombre].push({ ...base, value, sobrecosto })
      }
      general.push({ ...base, value: null, sobrecosto: sumaGeneral })
      continue
    }

    const value = values[criterion.id] ?? null
    const costoBase = criterion.formulaDefined ? criterion.computeCost(value, context) : 0
    const costoGeneral = criterion.scope === 'terreno_multiplicado' ? costoBase * n : costoBase
    general.push({ ...base, value, sobrecosto: costoGeneral })

    if (criterion.scope === 'terreno_no_dividido') continue

    const costoPorProyecto = criterion.scope === 'terreno_multiplicado' ? costoBase : costoBase / n
    for (const nombre of proyectoNombres) {
      porProyecto[nombre].push({ ...base, value, sobrecosto: costoPorProyecto })
    }
  }

  return { general, porProyecto }
}

export function aggregateCosts(
  results: CriterionResult[],
  context: EvalContext,
): AggregatedResult {
  const active = results.filter(r => r.formulaDefined)

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
