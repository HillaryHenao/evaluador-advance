import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const aprovechamientoForestal: CriterionModule = {
  id: 'aprovechamiento_forestal',
  label: 'Aprovechamiento forestal',
  inputType: 'select',
  dataSource: 'db',
  dbField: 'aprovechamiento_forestal',
  options: [
    { value: 'visita', label: 'Visita' },
    { value: 'radicada', label: 'Solicitud radicada' },
    { value: 'otro', label: 'Otro estado pendiente' },
  ],
  formulaDefined: true,
  category: 'fijo',
  scope: 'proyecto',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === 'visita') return 20_000_000
    if (value === 'radicada') return 150_000_000
    if (value === 'otro') return 200_000_000
    return 0
  },
}

export default aprovechamientoForestal
