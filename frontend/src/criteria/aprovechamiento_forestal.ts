import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const aprovechamientoForestal: CriterionModule = {
  id: 'aprovechamiento_forestal',
  label: 'Aprovechamiento forestal',
  inputType: 'select',
  dataSource: 'db',
  dbField: 'aprovechamiento_forestal',
  options: [
    { value: 'exonerado', label: 'Exonerado' },
    { value: 'car_0.9', label: 'CAR nivel 0.9' },
    { value: 'car_0.8', label: 'CAR nivel 0.8' },
    { value: 'car_0.6', label: 'CAR nivel 0.6' },
    { value: 'car_0.1', label: 'CAR nivel 0.1' },
  ],
  formulaDefined: false,
  category: 'ambas',
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default aprovechamientoForestal
