import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchTerrainData } from '@/services/terrainService'
import { loadCriteria, evaluateCriteria, aggregateCosts } from '@/engine/evaluatorEngine'
import { useAuthStore } from '@/stores/authStore'
import type { TerrainData, CriterionValue, AggregatedResult } from '@/types'

type CriterionValues = Record<string, CriterionValue>

const BASE_CAPEX_DEFAULT = 4_000_000_000
const KWP_DEFAULT = 1320

export const useEvaluatorStore = defineStore('evaluador', () => {
  const terrainData = ref<TerrainData | null>(null)
  const criterionValues = ref<CriterionValues>({})
  const baseCapex = ref(BASE_CAPEX_DEFAULT)
  const kWp = ref(KWP_DEFAULT)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const context = computed(() => ({ baseCapex: baseCapex.value, kWp: kWp.value }))

  const aggregated = computed<AggregatedResult>(() => {
    const results = evaluateCriteria(criterionValues.value, context.value)
    return aggregateCosts(results, context.value)
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
        if (criterion.dbField && data[criterion.dbField as keyof TerrainData] !== undefined) {
          dbValues[criterion.id] = data[criterion.dbField as keyof TerrainData] as CriterionValue
        }
      }
      criterionValues.value = { ...criterionValues.value, ...dbValues }
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

  function reset(): void {
    terrainData.value = null
    criterionValues.value = {}
    error.value = null
  }

  return {
    terrainData, criterionValues, baseCapex, kWp,
    loading, error, aggregated, fetchTerrain, setCriterionValue, reset,
  }
})
