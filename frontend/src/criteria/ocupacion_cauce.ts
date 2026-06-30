import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const ocupacionCauce: CriterionModule = {
  id: 'ocupacion_cauce',
  label: 'Ocupación de cauce',
  inputType: 'toggle',
  dataSource: 'db',
  dbField: 'ocupacion_cauce',
  formulaDefined: false,
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default ocupacionCauce
