import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const servidumbre: CriterionModule = {
  id: 'servidumbre',
  label: 'Servidumbre',
  inputType: 'select',
  dataSource: 'db',
  dbField: 'servidumbre',
  options: [
    { value: 'own', label: 'Propia' },
    { value: 'public', label: 'Pública' },
    { value: 'foreign', label: 'Ajena' },
    { value: 'public_and_foreign', label: 'Pública y Ajena' },
  ],
  formulaDefined: false,
  category: 'probabilidad',
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default servidumbre
