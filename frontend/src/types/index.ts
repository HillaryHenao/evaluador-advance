export type CriterionValue = number | boolean | string | null

export interface EvalContext {
  baseCapex: number
  kWp: number
}

export interface CriterionResult {
  id: string
  label: string
  value: CriterionValue
  sobrecosto: number
  formulaDefined: boolean
  fromDb: boolean
}

export interface AggregatedResult {
  totalSobrecosto: number
  capexTotal: number
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
  aprovechamiento_forestal: string | null
  coexistencias: boolean | null
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
