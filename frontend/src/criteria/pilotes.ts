import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const pilotes: CriterionModule = {
  id: 'pilotes',
  label: 'Pilotes',
  inputType: 'toggle',
  dataSource: 'manual',
  formulaDefined: true,
  category: 'probabilidad',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value !== true) return 0
    return 156_000_000
  },
}

export default pilotes
