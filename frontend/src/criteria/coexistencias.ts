import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const coexistencias: CriterionModule = {
  id: 'coexistencias',
  label: 'Coexistencias',
  inputType: 'toggle',
  dataSource: 'db',
  dbField: 'coexistencias',
  formulaDefined: true,
  category: 'probabilidad',
  riskType: 'costo',
  scope: 'terreno_dividido',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value !== true) return 0
    return 60_000_000
  },
}

export default coexistencias
