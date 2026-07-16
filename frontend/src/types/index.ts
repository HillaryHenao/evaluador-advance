export type CriterionScope = 'proyecto' | 'terreno_dividido' | 'terreno_multiplicado'

export interface ProyectoData {
  nombre: string
  distancia_via: number | null
  distancia_red: number | null
  aprovechamiento_forestal: string | null
  aprovechamiento_forestal_detalle: string | null
  numero_arboles: number | null
  tipo_estructura: string | null
  arriendo_anual: number | null
}

export interface ObraHidraulicaItem {
  activo: boolean
  cantidad: number | null
}

export interface ObrasHidraulicasValue {
  canal_concreto: ObraHidraulicaItem
  cuneta_via: ObraHidraulicaItem
  box_culvert: ObraHidraulicaItem
  box_culvert_1m: ObraHidraulicaItem
  alcantarilla_cruce: ObraHidraulicaItem
  alcantarilla_cruce_1_5m: ObraHidraulicaItem
}

export type CriterionValue = number | boolean | string | null | ObrasHidraulicasValue

export interface EvalContext {
  baseCapex: number
  kWp: number
  projectCount?: number
}

export type CriterionCategory = 'fijo' | 'probabilidad' | 'ambas'

// Solo aplica a category 'probabilidad': 'meses' se traduce a tiempo de retraso,
// 'costo' es un monto estipulado fijo que no se convierte a meses.
export type RiskType = 'meses' | 'costo'

export interface CriterionResult {
  id: string
  label: string
  value: CriterionValue
  sobrecosto: number
  formulaDefined: boolean
  fromDb: boolean
  category: CriterionCategory
  riskType?: RiskType
}

export interface AggregatedResult {
  // Fijo + ambas → se suman al CAPEX
  totalSobrecostoFijo: number
  capexTotal: number
  // Probabilidad → caja separada de factor de riesgo (meses + costo estipulado)
  totalRetraso: number
  totalRetrasoMeses: number
  totalRiesgoCosto: number
  breakdown: CriterionResult[]
}

export interface SelectOption {
  value: string
  label: string
}

export interface ChecklistItemDef {
  key: string
  label: string
  unit: string
  group: 'metro' | 'fijo'
  groupLabel: string
  tarifa: number
}

export interface CriterionModule {
  id: string
  label: string
  inputType: 'number' | 'toggle' | 'select' | 'checklist'
  unit?: string
  dataSource: 'manual' | 'db' | 'db_or_manual'
  dbField?: string
  options?: SelectOption[]
  formulaDefined: boolean
  category: CriterionCategory
  riskType?: RiskType
  scope: CriterionScope
  checklistItems?: ChecklistItemDef[]
  computeCost: (value: CriterionValue, context: EvalContext) => number
}

export interface TerrainData {
  code: string
  name: string
  municipality: string
  or: string | null
  nivel_tension: string | null
  cluster: number | null
  ocupacion_cauce: boolean | null
  ocupacion_cauce_detalle: string | null
  servidumbre: number | null
  servidumbre_detalle: EstadoDetalle | null
  coexistencias: boolean | null
  coexistencias_detalle: CoexistenciaDetalle[] | null
  produccion_especifica: number | null
  arriendo_anual: number | null
  area_hectareas: number | null
  proyectos: ProyectoData[]
}

export interface CoexistenciaDetalle {
  entidad: string
  estado: string
}

export interface EstadoDetalle {
  tipo: string
  estado: string
}

export interface FinancialInputs {
  capex: number
  kWp: number
  kVA: number
  produccionEspecifica: number
  arriendoAnual: number
}

export interface FinancialResults {
  tir: number
  tirConBeneficios: number
  vpn: number
  vpnConBeneficios: number
  paybackAnios: number
  paybackConBeneficiosAnios: number
}

export interface AuthUser {
  pk: number
  username: string
  email: string
  first_name: string
  last_name: string
  groups: string[]
}

export interface AuthTokens {
  access: string
  refresh: string
  user: AuthUser
}
