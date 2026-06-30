import type { CriterionModule, CriterionValue, EvalContext } from '@/types'

function tieredCostPerMeter(meters: number): number {
  if (meters <= 99) return 509_000
  if (meters <= 299) return 420_000
  if (meters <= 499) return 380_000
  if (meters <= 799) return 350_000
  return 312_500
}

const distanciaRed: CriterionModule = {
  id: 'distancia_red',
  label: 'Distancia a la red',
  inputType: 'number',
  unit: 'm',
  dataSource: 'db',
  dbField: 'distancia_red',
  formulaDefined: true,
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (value === null || typeof value !== 'number' || value <= 0) return 0
    return value * tieredCostPerMeter(value)
  },
}

export default distanciaRed
