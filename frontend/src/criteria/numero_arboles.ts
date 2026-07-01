import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const numeroArboles: CriterionModule = {
  id: 'numero_arboles',
  label: 'Número de árboles',
  inputType: 'number',
  unit: 'árboles',
  dataSource: 'manual',
  formulaDefined: false,
  category: 'probabilidad',
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default numeroArboles
