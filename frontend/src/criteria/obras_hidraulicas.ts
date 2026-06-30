import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const obrasHidraulicas: CriterionModule = {
  id: 'obras_hidraulicas',
  label: 'Obras hidráulicas',
  inputType: 'select',
  dataSource: 'manual',
  options: [
    { value: 'ninguna', label: 'Ninguna' },
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
  ],
  formulaDefined: false,
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default obrasHidraulicas
