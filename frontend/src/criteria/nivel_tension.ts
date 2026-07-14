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
  formulaDefined: true,
  category: 'fijo',
  scope: 'terreno_multiplicado',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    return value === '34.5kV' ? 30_000_000 : 0
  },
}

export default nivelTension
