import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const coexistencias: CriterionModule = {
  id: 'coexistencias',
  label: 'Coexistencias',
  inputType: 'toggle',
  dataSource: 'db',
  dbField: 'coexistencias',
  formulaDefined: false,
  category: 'probabilidad',
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default coexistencias
