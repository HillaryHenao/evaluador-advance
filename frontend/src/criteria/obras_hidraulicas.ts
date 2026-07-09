import type { ChecklistItemDef, CriterionModule, CriterionValue, EvalContext, ObrasHidraulicasValue } from '@/types'

const ITEMS: ChecklistItemDef[] = [
  { key: 'canal_concreto', label: 'Canal en concreto (2m x 0.5m)', unit: 'm', group: 'metro', groupLabel: 'Costo por metro lineal', tarifa: 1_300_000 },
  { key: 'cuneta_via', label: 'Cuneta típica de vía', unit: 'm', group: 'metro', groupLabel: 'Costo por metro lineal', tarifa: 300_000 },
  { key: 'box_culvert', label: 'Box culvert (3m x 3m)', unit: 'cruces', group: 'fijo', groupLabel: 'Costo fijo por cruce', tarifa: 170_000_000 },
  { key: 'alcantarilla_cruce', label: 'Alcantarilla (Ø0.9m)', unit: 'cruces', group: 'fijo', groupLabel: 'Costo fijo por cruce', tarifa: 50_000_000 },
]

const obrasHidraulicas: CriterionModule = {
  id: 'obras_hidraulicas',
  label: 'Obras hidráulicas',
  inputType: 'checklist',
  dataSource: 'manual',
  formulaDefined: true,
  category: 'fijo',
  checklistItems: ITEMS,
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (!value || typeof value !== 'object') return 0
    const v = value as ObrasHidraulicasValue
    return ITEMS.reduce((total, item) => {
      const entry = v[item.key as keyof ObrasHidraulicasValue]
      if (!entry?.activo || typeof entry.cantidad !== 'number') return total
      return total + entry.cantidad * item.tarifa
    }, 0)
  },
}

export default obrasHidraulicas
