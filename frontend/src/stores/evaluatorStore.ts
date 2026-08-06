import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchTerrainData } from '@/services/terrainService'
import { loadCriteria, evaluateScoped, aggregateCosts } from '@/engine/evaluatorEngine'
import { calcularFinanzas } from '@/engine/financialEngine'
import { useAuthStore } from '@/stores/authStore'
import type { TerrainData, CriterionValue, CriterionResult, AggregatedResult, FinancialResults, ProyectoData } from '@/types'

type CriterionValues = Record<string, CriterionValue>
type PerProjectValues = Record<string, Record<string, CriterionValue>>

const BASE_CAPEX_DEFAULT = 4_000_000_000
const MESA_FIJA_CAPEX = 3_750_000_000
const KWP_DEFAULT = 1320.8
const KVA_DEFAULT = 990
// Estructura tracker capta ~10% más que el sitio "crudo" (Google Sheet de referencia:
// Producción específica día = 4.529 = 4.117 (radiación de plataforma) × 1.1 — ese 4.529
// es precisamente el caso de referencia usado en el golden master, un proyecto tracker).
// Mesa fija no lleva ajuste.
const FACTOR_PRODUCCION_TRACKER = 1.1
const PROYECTO_SCOPE_DB_FIELDS = ['distancia_via', 'distancia_red', 'aprovechamiento_forestal', 'numero_arboles', 'tipo_estructura']

export const useEvaluatorStore = defineStore('evaluador', () => {
  const terrainData = ref<TerrainData | null>(null)
  const criterionValues = ref<CriterionValues>({})
  const perProjectValues = ref<PerProjectValues>({})
  const baseCapex = ref(BASE_CAPEX_DEFAULT)
  const kWp = ref(KWP_DEFAULT)
  const kVA = ref(KVA_DEFAULT)
  const arriendoManual = ref<number | null>(null)
  const produccionEspecificaManual = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const proyectoNombres = computed(() => terrainData.value?.proyectos.map(p => p.nombre) ?? [])
  const projectCount = computed(() => Math.max(proyectoNombres.value.length, 1))

  // Mesa fija usa un CAPEX base distinto (menor) al resto de tipos de estructura —
  // cada proyecto resuelve el suyo propio según su tipo_estructura (scope 'proyecto').
  function capexBaseParaProyecto(nombre: string): number {
    return perProjectValues.value.tipo_estructura?.[nombre] === 'mesa_fija' ? MESA_FIJA_CAPEX : baseCapex.value
  }

  // Tracker capta ~10% más energía que la producción específica cruda del sitio — mesa
  // fija (o tipo aún sin resolver) no lleva ajuste. Ver FACTOR_PRODUCCION_TRACKER.
  function produccionEspecificaParaProyecto(nombre: string, base: number): number {
    return perProjectValues.value.tipo_estructura?.[nombre] === 'tracker' ? base * FACTOR_PRODUCCION_TRACKER : base
  }

  // Precio/Ha × Área negociada (ambos por proyecto, vía minifarm_project) es más confiable
  // que termsheet.rent_annual_cost_cop — ese campo puede quedar en 0/sin diligenciar aunque
  // el proyecto ya tenga precio y área cargados (caso real COLBOYT147P1: arriendo_anual=0,
  // pero 10.510.000 COP/Ha × 2.5 Ha = 26.275.000). Por eso el calculado tiene prioridad
  // siempre que existan ambos datos; si falta cualquiera, se cae a arriendo_anual/manual.
  function arriendoParaProyecto(proyecto: ProyectoData): number | null {
    if (proyecto.precio_hectarea != null && proyecto.area_hectareas != null) {
      return proyecto.precio_hectarea * proyecto.area_hectareas
    }
    return proyecto.arriendo_anual ?? arriendoManual.value
  }

  // baseCapex y kWp son magnitudes POR PROYECTO (cada proyecto construye su propia
  // instalación completa) — el contexto general suma el capex base de CADA proyecto
  // (no siempre el mismo, ver capexBaseParaProyecto) para que aggregateCosts sume
  // correctamente el capex de los N proyectos.
  const totalCapexBase = computed(() => {
    if (proyectoNombres.value.length === 0) return baseCapex.value * projectCount.value
    return proyectoNombres.value.reduce((acc, nombre) => acc + capexBaseParaProyecto(nombre), 0)
  })

  const context = computed(() => ({
    baseCapex: totalCapexBase.value,
    kWp: kWp.value * projectCount.value,
    projectCount: projectCount.value,
  }))

  const scopedEvaluation = computed(() => {
    return evaluateScoped(criterionValues.value, perProjectValues.value, proyectoNombres.value, context.value)
  })

  const aggregated = computed<AggregatedResult>(() => {
    return aggregateCosts(scopedEvaluation.value.general, context.value)
  })

  const perProjectResults = computed<Record<string, CriterionResult[]>>(() => {
    return scopedEvaluation.value.porProyecto
  })

  const financialResults = computed<FinancialResults | null>(() => {
    const produccionEspecifica = produccionEspecificaManual.value ?? terrainData.value?.produccion_especifica
    const arriendoAnual = arriendoManual.value ?? terrainData.value?.arriendo_anual
    // 0 es un arriendo válido (ej. COLBOYT147) — solo null/undefined significa "falta el dato".
    if (produccionEspecifica == null || arriendoAnual == null) return null
    return calcularFinanzas({
      capex: aggregated.value.capexTotal,
      kWp: kWp.value * projectCount.value,
      kVA: kVA.value * projectCount.value,
      produccionEspecifica,
      arriendoAnual,
    })
  })

  const perProjectFinancials = computed<Record<string, FinancialResults> | null>(() => {
    const produccionEspecifica = produccionEspecificaManual.value ?? terrainData.value?.produccion_especifica
    if (produccionEspecifica == null) return null

    const resultado: Record<string, FinancialResults> = {}
    for (const proyecto of terrainData.value?.proyectos ?? []) {
      const arriendoProyecto = arriendoParaProyecto(proyecto)
      // 0 es un arriendo válido (ej. COLBOYT147) — solo null/undefined significa "falta el dato".
      if (arriendoProyecto == null) continue

      // baseCapex/kWp/kVA son magnitudes POR PROYECTO — cada proyecto usa el valor
      // completo, sin dividir. Solo se le suma el subtotal de sobrecostos fijos propio
      // de ESE proyecto (perProjectResults ya trae los criterios terreno_dividido
      // divididos entre N y los de scope proyecto con el valor propio — ver
      // evaluateScoped en evaluatorEngine.ts).
      const results = perProjectResults.value[proyecto.nombre] ?? []
      const capexProyecto = capexBaseParaProyecto(proyecto.nombre) + aggregateCosts(results, {
        baseCapex: baseCapex.value, kWp: kWp.value, projectCount: 1,
      }).totalSobrecostoFijo

      resultado[proyecto.nombre] = calcularFinanzas({
        capex: capexProyecto,
        kWp: kWp.value,
        kVA: kVA.value,
        produccionEspecifica: produccionEspecificaParaProyecto(proyecto.nombre, produccionEspecifica),
        arriendoAnual: arriendoProyecto,
      })
    }
    return Object.keys(resultado).length > 0 ? resultado : null
  })

  async function fetchTerrain(code: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const auth = useAuthStore()
      const data = await fetchTerrainData(code, auth.accessToken ?? '')
      terrainData.value = data

      const criteria = loadCriteria()
      const dbValues: CriterionValues = {}
      for (const criterion of criteria) {
        if (criterion.scope === 'proyecto') continue
        if (criterion.dbField && data[criterion.dbField as keyof TerrainData] !== undefined) {
          dbValues[criterion.id] = data[criterion.dbField as keyof TerrainData] as CriterionValue
        }
      }
      criterionValues.value = { ...criterionValues.value, ...dbValues }

      const newPerProjectValues: PerProjectValues = {}
      for (const field of PROYECTO_SCOPE_DB_FIELDS) {
        newPerProjectValues[field] = {}
        for (const proyecto of data.proyectos) {
          newPerProjectValues[field][proyecto.nombre] = proyecto[field as keyof typeof proyecto] as CriterionValue
        }
      }
      perProjectValues.value = newPerProjectValues
    } catch (e) {
      error.value = 'No se encontró el terreno o error de conexión.'
      terrainData.value = null
    } finally {
      loading.value = false
    }
  }

  function setCriterionValue(id: string, value: CriterionValue): void {
    criterionValues.value = { ...criterionValues.value, [id]: value }
  }

  function setPilotesForProyecto(nombre: string, value: boolean): void {
    perProjectValues.value = {
      ...perProjectValues.value,
      pilotes: { ...perProjectValues.value.pilotes, [nombre]: value },
    }
  }

  function reset(): void {
    terrainData.value = null
    criterionValues.value = {}
    perProjectValues.value = {}
    error.value = null
  }

  return {
    terrainData, criterionValues, perProjectValues, baseCapex, kWp, kVA, arriendoManual, produccionEspecificaManual,
    loading, error, aggregated, financialResults, perProjectResults, perProjectFinancials,
    proyectoNombres, fetchTerrain, setCriterionValue, setPilotesForProyecto, reset,
    capexBaseParaProyecto,
  }
})
