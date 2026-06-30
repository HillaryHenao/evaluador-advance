import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const cluster: CriterionModule = {
  id: 'cluster',
  label: 'Cluster',
  inputType: 'number',
  unit: '# proyectos',
  dataSource: 'db',
  dbField: 'cluster',
  formulaDefined: false,
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default cluster
