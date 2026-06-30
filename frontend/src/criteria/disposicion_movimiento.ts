import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const disposicionMovimiento: CriterionModule = {
  id: 'disposicion_movimiento',
  label: 'Disposición del movimiento',
  inputType: 'select',
  dataSource: 'manual',
  options: [
    { value: 'en_sitio', label: 'En sitio' },
    { value: 'externo', label: 'Externo' },
  ],
  formulaDefined: false,
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default disposicionMovimiento
