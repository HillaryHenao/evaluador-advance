import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const distanciaVia: CriterionModule = {
  id: 'distancia_via',
  label: 'Distancia a la vía',
  inputType: 'number',
  unit: 'm',
  dataSource: 'db',
  dbField: 'distancia_via',
  formulaDefined: true,
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === null || typeof value !== 'number' || value <= 0) return 0
    return value * 457_292
  },
}

export default distanciaVia
