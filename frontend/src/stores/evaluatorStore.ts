import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchTerrainData } from '@/services/terrainService'
import { loadCriteria, evaluateScoped, aggregateCosts } from '@/engine/evaluatorEngine'
import { calcularFinanzas } from '@/engine/financialEngine'
import { useAuthStore } from '@/stores/authStore'
import type { TerrainData, CriterionValue, CriterionResult, AggregatedResult, FinancialResults } from '@/types'

type CriterionValues = Record<string, CriterionValue>
type PerProjectValues = Record<string, Record<string, CriterionValue>>

const BASE_CAPEX_DEFAULT = 4_000_000_000
const KWP_DEFAULT = 1320
const PROYECTO_SCOPE_DB_FIELDS = ['distancia_via', 'distancia_red', 'aprovechamiento_forestal', 'numero_arboles', 'tipo_estructura']

export const useEvaluatorStore = defineStore('evaluador', () => {
  const terrainData = ref<TerrainData | null>(null)
  const criterionValues = ref<CriterionValues>({})
  const perProjectValues = ref<PerProjectValues>({})
  const baseCapex = ref(BASE_CAPEX_DEFAULT)
  const kWp = ref(KWP_DEFAULT)
  const kVA = ref(1000)
  const arriendoManual = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const proyectoNombres = computed(() => terrainData.value?.proyectos.map(p => p.nombre) ?? [])
  const projectCount = computed(() => Math.max(proyectoNombres.value.length, 1))

  const context = computed(() => ({ baseCapex: baseCapex.value, kWp: kWp.value, projectCount: projectCount.value }))

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
    const produccionEspecifica = terrainData.value?.produccion_especifica
    const arriendoAnual = arriendoManual.value ?? terrainData.value?.arriendo_anual
    if (!produccionEspecifica || !arriendoAnual) return null
    return calcularFinanzas({
      capex: aggregated.value.capexTotal,
      kWp: kWp.value,
      kVA: kVA.value,
      produccionEspecifica,
      arriendoAnual,
    })
  })

  const perProjectFinancials = computed<Record<string, { vpn: number; vpnConBeneficios: number }> | null>(() => {
    const produccionEspecifica = terrainData.value?.produccion_especifica
    const arriendoAnual = arriendoManual.value ?? terrainData.value?.arriendo_anual
    if (!produccionEspecifica || !arriendoAnual) return null
    const n = projectCount.value
    // Divide el CAPEX GENERAL ya agregado (no reconstruir desde perProjectResults —
    // eso ya divide los criterios terreno_dividido dentro de evaluateScoped; volver
    // a dividir aquí dividiría dos veces esa porción, y baseCapex quedaría sin dividir).
    const capexPorProyecto = aggregated.value.capexTotal / n

    const resultado: Record<string, { vpn: number; vpnConBeneficios: number }> = {}
    for (const nombre of proyectoNombres.value) {
      const finanzas = calcularFinanzas({
        capex: capexPorProyecto,
        kWp: kWp.value / n,
        kVA: kVA.value / n,
        produccionEspecifica,
        arriendoAnual: arriendoAnual / n,
      })
      resultado[nombre] = { vpn: finanzas.vpn, vpnConBeneficios: finanzas.vpnConBeneficios }
    }
    return resultado
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
    terrainData, criterionValues, perProjectValues, baseCapex, kWp, kVA, arriendoManual,
    loading, error, aggregated, financialResults, perProjectResults, perProjectFinancials,
    proyectoNombres, fetchTerrain, setCriterionValue, setPilotesForProyecto, reset,
  }
})
