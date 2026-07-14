import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

const tipoEstructura: CriterionModule = {
  id: 'tipo_estructura',
  label: 'Tipo de estructura',
  inputType: 'select',
  dataSource: 'db',
  dbField: 'tipo_estructura',
  options: [
    { value: 'mesa_fija', label: 'Mesa fija' },
    { value: 'tracker', label: 'Tracker' },
  ],
  formulaDefined: false,
  category: 'probabilidad',
  scope: 'proyecto',
  computeCost(_value: CriterionValue, _context: EvalContext): number {
    return 0
  },
}

export default tipoEstructura
