import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const lleno: CriterionModule = {
  id: 'lleno',
  label: 'Lleno',
  inputType: 'number',
  unit: 'm³',
  dataSource: 'manual',
  formulaDefined: true,
  category: 'fijo',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === null || typeof value !== 'number') return 0
    return value * 190_000
  },
}

export default lleno
