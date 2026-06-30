import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const amenazas: CriterionModule = {
  id: 'amenazas',
  label: 'Amenazas',
  inputType: 'select',
  dataSource: 'manual',
  options: [
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
  ],
  formulaDefined: false,
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default amenazas
