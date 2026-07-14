import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const propietario: CriterionModule = {
  id: 'propietario',
  label: 'Propietario',
  inputType: 'select',
  dataSource: 'manual',
  options: [
    { value: 'bueno', label: 'Bueno' },
    { value: 'medio', label: 'Medio' },
    { value: 'malo', label: 'Malo' },
  ],
  formulaDefined: true,
  category: 'probabilidad',
  riskType: 'costo',
  scope: 'terreno_dividido',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === 'medio') return 30_000_000
    if (value === 'malo') return 60_000_000
    return 0
  },
}

export default propietario
