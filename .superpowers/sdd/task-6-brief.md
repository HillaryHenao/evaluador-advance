# Task 6 Brief: Terrain service + evaluator store

## Context
Task 6 of 10. Tasks 1-5 complete. `useAuthStore` exists with `accessToken`. `evaluatorEngine.ts` has `loadCriteria`, `evaluateCriteria`, `aggregateCosts`. Your job: build `terrainService.ts` (HTTP call to Flask backend) and `evaluatorStore.ts` (Pinia store that ties terrain data + criterion values + computed costs together).

## Global Constraints
- Work in `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend\`
- `@` alias = `src/`
- Tests: `npx vitest run src/stores/__tests__/evaluatorStore.test.ts`
- All tests must pass before committing
- Use PowerShell for commands
- Backend URL: `http://localhost:5000` (configurable via `VITE_API_URL` env var)

## Files to Create
- `src/services/terrainService.ts`
- `src/stores/evaluatorStore.ts`
- `src/stores/__tests__/evaluatorStore.test.ts`

## Implementation

### src/services/terrainService.ts
```typescript
import axios from 'axios'
import type { TerrainData } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export async function fetchTerrainData(code: string, token: string): Promise<TerrainData> {
  const response = await axios.get<TerrainData>(`${API_BASE}/api/terrain/${code}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}
```

### src/stores/evaluatorStore.ts
```typescript
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
```

### src/stores/__tests__/evaluatorStore.test.ts
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEvaluatorStore } from '../evaluatorStore'
import * as terrainService from '@/services/terrainService'
import type { TerrainData } from '@/types'

const mockTerrain: TerrainData = {
  code: 'COLCEST5',
  name: 'Test Proyecto',
  municipality: 'Aguachica',
  distancia_via: 120,
  distancia_red: 350,
  or: 'AFINIA',
  nivel_tension: '34.5 kV',
  cluster: 2,
  tipo_estructura: 'Tracker',
  ocupacion_cauce: false,
  servidumbre: 'own',
  aprovechamiento_forestal: 'Exonerado',
  coexistencias: false,
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useEvaluatorStore', () => {
  it('fetchTerrain autocompletea campos DB en criterionValues', async () => {
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue(mockTerrain)
    const store = useEvaluatorStore()
    await store.fetchTerrain('COLCEST5')
    expect(store.criterionValues['distancia_via']).toBe(120)
    expect(store.criterionValues['distancia_red']).toBe(350)
    expect(store.criterionValues['or']).toBe('AFINIA')
  })

  it('setCriterionValue actualiza el valor y recalcula', () => {
    const store = useEvaluatorStore()
    store.setCriterionValue('corte', 100)
    expect(store.criterionValues['corte']).toBe(100)
    const corteResult = store.aggregated.breakdown.find(r => r.id === 'corte')
    expect(corteResult?.sobrecosto).toBe(5_000_000)
  })

  it('aggregated.capexTotal incluye baseCapex + sobrecostos', () => {
    const store = useEvaluatorStore()
    store.setCriterionValue('corte', 100)
    expect(store.aggregated.capexTotal).toBe(store.baseCapex + 5_000_000)
  })
})
```

## Steps
1. Create `src/services/terrainService.ts`
2. Create `src/stores/evaluatorStore.ts`
3. Create `src/stores/__tests__/evaluatorStore.test.ts`
4. Run tests: `cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend" && npx vitest run src/stores/__tests__/evaluatorStore.test.ts`
5. Fix any failures
6. Commit: `cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance" && git add frontend/src/services/terrainService.ts frontend/src/stores/evaluatorStore.ts "frontend/src/stores/__tests__/evaluatorStore.test.ts" && git commit -m "feat: add terrain service and evaluator Pinia store with reactivity"`

## Report Contract
Write report to: `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\.superpowers\sdd\task-6-report.md`

Return ONLY: status, commit hash(es), test summary (X/Y passing), concerns.
