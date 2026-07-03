import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const ocupacionCauce: CriterionModule = {
  id: 'ocupacion_cauce',
  label: 'Ocupación de cauce',
  inputType: 'toggle',
  dataSource: 'db',
  dbField: 'ocupacion_cauce',
  formulaDefined: true,
  category: 'fijo',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value !== true) return 0
    return 100_000_000
  },
}

export default ocupacionCauce
