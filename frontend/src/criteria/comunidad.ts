import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const comunidad: CriterionModule = {
  id: 'comunidad',
  label: 'Comunidad',
  inputType: 'select',
  dataSource: 'manual',
  options: [
    { value: 'sin_restriccion', label: 'Sin restricción' },
    { value: 'consulta_previa', label: 'Consulta previa' },
    { value: 'conflicto', label: 'Conflicto activo' },
  ],
  formulaDefined: false,
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default comunidad
