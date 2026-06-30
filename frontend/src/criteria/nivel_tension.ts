import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const nivelTension: CriterionModule = {
  id: 'nivel_tension',
  label: 'Nivel de tensión',
  inputType: 'select',
  dataSource: 'db',
  dbField: 'nivel_tension',
  options: [
    { value: '13.8kV', label: '13.8 kV' },
    { value: '34.5kV', label: '34.5 kV' },
    { value: '115kV', label: '115 kV' },
  ],
  formulaDefined: false,
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default nivelTension
