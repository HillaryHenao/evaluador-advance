import type { CriterionModule, CriterionValue, EvalContext } from '@/types'
import { COSTO_POR_MES } from '@/engine/evaluatorEngine'

const servidumbre: CriterionModule = {
  id: 'servidumbre',
  label: 'Servidumbre',
  inputType: 'number',
  unit: 'meses de retraso',
  dataSource: 'db_or_manual',
  dbField: 'servidumbre',
  formulaDefined: true,
  category: 'probabilidad',
  riskType: 'meses',
  scope: 'terreno_dividido',
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === null || typeof value !== 'number' || value <= 0) return 0
    return value * COSTO_POR_MES
  },
}

export default servidumbre
