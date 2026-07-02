import type { CriterionModule, CriterionValue, EvalContext } from '@/types'
import { COSTO_POR_MES } from '@/engine/evaluatorEngine'

const amenazas: CriterionModule = {
  id: 'amenazas',
  label: 'Amenazas',
  inputType: 'select',
  dataSource: 'manual',
  options: [
    { value: 'bueno', label: 'Bueno — sin retraso' },
    { value: 'medio', label: 'Medio — 1 mes de retraso' },
    { value: 'malo', label: 'Malo — +2 meses de retraso' },
  ],
  formulaDefined: true,
  category: 'probabilidad',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === 'medio') return 1 * COSTO_POR_MES
    if (value === 'malo') return 2 * COSTO_POR_MES
    return 0
  },
}

export default amenazas
