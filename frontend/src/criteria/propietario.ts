import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const propietario: CriterionModule = {
  id: 'propietario',
  label: 'Propietario',
  inputType: 'select',
  dataSource: 'manual',
  options: [
    { value: '5', label: '★★★★★' },
    { value: '4', label: '★★★★' },
    { value: '3', label: '★★★' },
    { value: '2', label: '★★' },
    { value: '1', label: '★' },
  ],
  formulaDefined: false,
  category: 'probabilidad',
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default propietario
