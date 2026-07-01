import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const corte: CriterionModule = {
  id: 'corte',
  label: 'Corte',
  inputType: 'number',
  unit: 'm³',
  dataSource: 'manual',
  formulaDefined: true,
  category: 'fijo',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === null || typeof value !== 'number') return 0
    return value * 50_000
  },
}

export default corte
