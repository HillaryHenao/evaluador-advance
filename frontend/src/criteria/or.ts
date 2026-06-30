import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const or: CriterionModule = {
  id: 'or',
  label: 'Operador de Red',
  inputType: 'select',
  dataSource: 'db',
  dbField: 'or',
  options: [
    { value: 'AFINIA', label: 'AFINIA' },
    { value: 'ESSA', label: 'ESSA' },
    { value: 'EPM', label: 'EPM' },
    { value: 'ENEL', label: 'ENEL' },
    { value: 'EMCALI', label: 'EMCALI' },
    { value: 'ENERCA', label: 'ENERCA' },
    { value: 'CENS', label: 'CENS' },
    { value: 'CEDENAR', label: 'CEDENAR' },
  ],
  formulaDefined: false,
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default or
