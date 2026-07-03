export type CriterionValue = number | boolean | string | null

export interface EvalContext {
  baseCapex: number
  kWp: number
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

export interface CriterionModule {
  id: string
  label: string
  inputType: 'number' | 'toggle' | 'select'
  unit?: string
  dataSource: 'manual' | 'db' | 'db_or_manual'
  dbField?: string
  options?: SelectOption[]
  formulaDefined: boolean
  category: CriterionCategory
  riskType?: RiskType
  computeCost: (value: CriterionValue, context: EvalContext) => number
}

export interface TerrainData {
  code: string
  name: string
  municipality: string
  distancia_via: number | null
  distancia_red: number | null
  or: string | null
  nivel_tension: string | null
  cluster: number | null
  tipo_estructura: string | null
  ocupacion_cauce: boolean | null
  servidumbre: string | null
  servidumbre_detalle: EstadoDetalle | null
  aprovechamiento_forestal: string | null
  aprovechamiento_forestal_detalle: ProyectoEstadoDetalle[] | null
  coexistencias: boolean | null
  coexistencias_detalle: CoexistenciaDetalle[] | null
  numero_arboles: number | null
}

export interface CoexistenciaDetalle {
  entidad: string
  estado: string
}

export interface ProyectoEstadoDetalle {
  proyecto: string
  estado: string
}

export interface EstadoDetalle {
  tipo: string
  estado: string
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
