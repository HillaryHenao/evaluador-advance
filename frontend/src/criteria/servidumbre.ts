import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const servidumbre: CriterionModule = {
  id: 'servidumbre',
  label: 'Servidumbre',
  inputType: 'select',
  dataSource: 'db_or_manual',
  dbField: 'servidumbre',
  options: [
    { value: 'bueno', label: 'Bueno' },
    { value: 'medio', label: 'Medio' },
    { value: 'malo', label: 'Malo' },
  ],
  formulaDefined: true,
  category: 'probabilidad',
  riskType: 'costo',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === 'medio') return 60_000_000
    if (value === 'malo') return 120_000_000
    return 0
  },
}

export default servidumbre
