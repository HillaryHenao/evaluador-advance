import type { CriterionModule, CriterionValue, EvalContext } from '@/types'
import { COSTO_POR_MES } from '@/engine/evaluatorEngine'

const amenazas: CriterionModule = {
  id: 'amenazas',
  label: 'Amenazas',
  inputType: 'select',
  dataSource: 'manual',
  options: [
    { value: 'bueno', label: 'Bueno — sin retraso ($0)' },
    { value: 'medio', label: 'Medio — 1 mes de retraso ($60.000.000)' },
    { value: 'malo', label: 'Malo — +2 meses de retraso ($120.000.000)' },
  ],
  formulaDefined: true,
  category: 'probabilidad',
  riskType: 'meses',
  scope: 'terreno_dividido',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === 'medio') return 1 * COSTO_POR_MES
    if (value === 'malo') return 2 * COSTO_POR_MES
    return 0
  },
}

export default amenazas
