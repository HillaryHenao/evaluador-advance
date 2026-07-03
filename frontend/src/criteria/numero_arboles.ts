import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const numeroArboles: CriterionModule = {
  id: 'numero_arboles',
  label: 'Número de árboles',
  inputType: 'number',
  unit: 'árboles',
  dataSource: 'db',
  dbField: 'numero_arboles',
  formulaDefined: true,
  category: 'fijo',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === null || typeof value !== 'number') return 0
    return value * 142_500
  },
}

export default numeroArboles
