import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const cluster: CriterionModule = {
  id: 'cluster',
  label: 'Cluster',
  inputType: 'number',
  unit: '# proyectos',
  dataSource: 'db',
  dbField: 'cluster',
  formulaDefined: true,
  category: 'fijo',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === null || typeof value !== 'number') return 0
    if (value > 2) return -30_000_000
    if (value === 2) return -15_000_000
    return 0
  },
}

export default cluster
