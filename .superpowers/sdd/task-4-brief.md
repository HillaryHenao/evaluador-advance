### Task 4: Frontend store — `perProjectValues`, auto-population, financial per-project VPN

**Files:**
- Modify: `frontend/src/stores/evaluatorStore.ts`
- Modify: `frontend/src/stores/__tests__/evaluatorStore.test.ts`
- Modify: `frontend/src/components/SummaryPanel.vue`

**Interfaces:**
- Consumes: `TerrainData.proyectos` (Task 1/2), `evaluateScoped` (Task 3), `EvalContext.projectCount` (Task 2), `calcularFinanzas` (existing, unchanged signature).
- Produces (used by Task 5, Task 6): store getters `perProjectValues: Record<string, Record<string, CriterionValue>>`, `perProjectResults: Record<string, CriterionResult[]>` (computed), `perProjectFinancials: Record<string, { vpn: number; vpnConBeneficios: number }>` (computed), `setPilotesForProyecto(nombre: string, value: boolean): void`.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/stores/__tests__/evaluatorStore.test.ts` (check the file's existing imports/setup first — it already imports `useEvaluatorStore` and sets up Pinia per existing tests; add a new top-level `describe` block at the end of the file):

```ts

describe('perProjectValues y perProjectResults', () => {
  it('se autopobla desde terrainData.proyectos al buscar terreno', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: 'visita', numero_arboles: 2, tipo_estructura: 'tracker' },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija' },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    expect(store.perProjectValues['numero_arboles']).toEqual({ P1: 2, P2: 0 })
    expect(store.perProjectValues['distancia_via']).toEqual({ P1: 10, P2: 12 })
  })

  it('setPilotesForProyecto actualiza solo el proyecto indicado', () => {
    const store = useEvaluatorStore()
    store.setPilotesForProyecto('P1', true)
    store.setPilotesForProyecto('P2', false)
    expect(store.perProjectValues['pilotes']).toEqual({ P1: true, P2: false })
  })

  it('perProjectResults refleja la división terreno_dividido entre proyectos', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'tracker' },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija' },
      ],
    })
    await store.fetchTerrain('COLSANT5')
    store.setCriterionValue('corte', 100)

    const p1Corte = store.perProjectResults['P1'].find(r => r.id === 'corte')
    expect(p1Corte?.sobrecosto).toBe((100 * 80_000) / 2)
  })
})

describe('perProjectFinancials', () => {
  it('divide capex, kWp, kVA y arriendo entre N proyectos para el VPN', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'tracker' },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija' },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    expect(store.perProjectFinancials).not.toBeNull()
    expect(store.perProjectFinancials!['P1'].vpn).toBeCloseTo(store.financialResults!.vpn / 2, 0)
    expect(store.perProjectFinancials!['P2'].vpn).toBeCloseTo(store.financialResults!.vpn / 2, 0)
  })
})
```

Check the top of `frontend/src/stores/__tests__/evaluatorStore.test.ts` for the exact existing import of `terrainService` (it should already be imported as `import * as terrainService from '@/services/terrainService'` or similar, since the file already spies on `terrainService.fetchTerrainData` per the codebase's existing test — reuse that same import, do not add a duplicate).

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/stores/__tests__/evaluatorStore.test.ts`

Expected: FAIL — `store.perProjectValues` is `undefined`, `setPilotesForProyecto` is not a function, `perProjectResults`/`perProjectFinancials` are undefined.

- [ ] **Step 3: Update `frontend/src/stores/evaluatorStore.ts`**

Find (line 1-11):

```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchTerrainData } from '@/services/terrainService'
import { loadCriteria, evaluateCriteria, aggregateCosts } from '@/engine/evaluatorEngine'
import { calcularFinanzas } from '@/engine/financialEngine'
import { useAuthStore } from '@/stores/authStore'
import type { TerrainData, CriterionValue, AggregatedResult, FinancialResults } from '@/types'

type CriterionValues = Record<string, CriterionValue>

const BASE_CAPEX_DEFAULT = 4_000_000_000
const KWP_DEFAULT = 1320
```

Replace with:

```ts
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
```

Note: `evaluateCriteria` (plain, non-scope-aware) stays exported from `evaluatorEngine.ts` and untouched — this store simply stops importing it, switching to `evaluateScoped` instead. Other existing tests that call `evaluateCriteria` directly keep working unchanged.

Find (lines 14-24):

```ts
export const useEvaluatorStore = defineStore('evaluador', () => {
  const terrainData = ref<TerrainData | null>(null)
  const criterionValues = ref<CriterionValues>({})
  const baseCapex = ref(BASE_CAPEX_DEFAULT)
  const kWp = ref(KWP_DEFAULT)
  const kVA = ref(1000)
  const arriendoManual = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const context = computed(() => ({ baseCapex: baseCapex.value, kWp: kWp.value }))
```

Replace with:

```ts
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
```

Find (lines 26-29, the `aggregated` computed):

```ts
  const aggregated = computed<AggregatedResult>(() => {
    const results = evaluateCriteria(criterionValues.value, context.value)
    return aggregateCosts(results, context.value)
  })
```

Replace with (both `aggregated` and the new `perProjectResults` are derived from the SAME `evaluateScoped` call, so the general total and the per-project breakdown can never drift apart from two independently-computed sources):

```ts
  const scopedEvaluation = computed(() => {
    return evaluateScoped(criterionValues.value, perProjectValues.value, proyectoNombres.value, context.value)
  })

  const aggregated = computed<AggregatedResult>(() => {
    return aggregateCosts(scopedEvaluation.value.general, context.value)
  })

  const perProjectResults = computed<Record<string, CriterionResult[]>>(() => {
    return scopedEvaluation.value.porProyecto
  })
```

Find (lines 31-42, the `financialResults` computed):

```ts
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
```

Immediately after it, insert:

```ts

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
```

Find (lines 44-66, `fetchTerrain`):

```ts
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
```

Replace with:

```ts
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
```

Find (lines 68-70, `setCriterionValue`):

```ts
  function setCriterionValue(id: string, value: CriterionValue): void {
    criterionValues.value = { ...criterionValues.value, [id]: value }
  }
```

Immediately after it, insert:

```ts

  function setPilotesForProyecto(nombre: string, value: boolean): void {
    perProjectValues.value = {
      ...perProjectValues.value,
      pilotes: { ...perProjectValues.value.pilotes, [nombre]: value },
    }
  }
```

Find (lines 72-76, `reset`):

```ts
  function reset(): void {
    terrainData.value = null
    criterionValues.value = {}
    error.value = null
  }
```

Replace with:

```ts
  function reset(): void {
    terrainData.value = null
    criterionValues.value = {}
    perProjectValues.value = {}
    error.value = null
  }
```

Find (lines 78-81, the return statement):

```ts
  return {
    terrainData, criterionValues, baseCapex, kWp, kVA, arriendoManual,
    loading, error, aggregated, financialResults, fetchTerrain, setCriterionValue, reset,
  }
```

Replace with:

```ts
  return {
    terrainData, criterionValues, perProjectValues, baseCapex, kWp, kVA, arriendoManual,
    loading, error, aggregated, financialResults, perProjectResults, perProjectFinancials,
    proyectoNombres, fetchTerrain, setCriterionValue, setPilotesForProyecto, reset,
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/stores/__tests__/evaluatorStore.test.ts`

Expected: PASS — all tests, including the new ones.

- [ ] **Step 5: Fix `frontend/src/components/SummaryPanel.vue`'s itemized breakdown filters**

`evaluateScoped` (Task 3) sets `value: null` for scope-`proyecto` criteria in the **general** result (there's no single representative value at the terrain level — only a summed `sobrecosto`, see Task 3's rationale). `SummaryPanel.vue`'s itemized lists currently require `r.value !== null` to show a line, which would silently hide distancia_via/distancia_red/numero_arboles/aprovechamiento_forestal/pilotes from the sidebar breakdown even though they now correctly contribute to the total shown below them. Since `sobrecosto !== 0` already excludes "nothing to show" criteria on its own, drop the redundant `value !== null` check.

Find:

```ts
const fijoBreakdown = computed(() =>
  store.aggregated.breakdown.filter(
    r => (r.category === 'fijo' || r.category === 'ambas') && r.formulaDefined && r.value !== null && r.sobrecosto !== 0,
  ),
)

const retrasoBreakdown = computed(() =>
  store.aggregated.breakdown.filter(
    r => r.category === 'probabilidad' && r.formulaDefined && r.value !== null && r.sobrecosto > 0,
  ),
)
```

Replace with:

```ts
const fijoBreakdown = computed(() =>
  store.aggregated.breakdown.filter(
    r => (r.category === 'fijo' || r.category === 'ambas') && r.formulaDefined && r.sobrecosto !== 0,
  ),
)

const retrasoBreakdown = computed(() =>
  store.aggregated.breakdown.filter(
    r => r.category === 'probabilidad' && r.formulaDefined && r.sobrecosto > 0,
  ),
)
```

- [ ] **Step 6: Run the full suite and type-check**

Run (from `frontend/`): `npx vitest run`

Expected: all pass.

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly the 2 pre-existing errors — any `TerrainData` field errors from earlier tasks should now be resolved by this task's rewrite of `fetchTerrain`, EXCEPT `CriterionCard.vue`'s references to the removed fields (`aprovechamiento_forestal_detalle`, `ocupacion_cauce_detalle` is still valid — only check for `distancia_via`/`numero_arboles`/`tipo_estructura`/`aprovechamiento_forestal` top-level reads), which Task 5 fixes. If `vue-tsc` shows errors in `CriterionCard.vue`, note them in your report as expected/deferred to Task 5 — do not fix `CriterionCard.vue` in this task.

- [ ] **Step 7: Manual verification against the running dev server**

This repo has no automated tests for `.vue` components — verify by code trace and, if a live browser is available, drive the app; otherwise state plainly in your report that this needs human verification.

1. Restart backend + frontend dev servers if running.
2. Search terrain `COLSANT5`.
3. Confirm the sidebar "Resumen de costos" now shows line items for "Número de árboles" (and any other scope-`proyecto` criteria with a non-zero total) with the correct SUMMED value (e.g. `2 árboles` worth `2 * 142_500` + `0 árboles` worth `0` from the other project = `$285.000` total), where before this task it would have shown `$0` or been silently missing.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/stores/evaluatorStore.ts frontend/src/stores/__tests__/evaluatorStore.test.ts frontend/src/components/SummaryPanel.vue
git commit -m "feat: add perProjectValues, perProjectResults, perProjectFinancials to evaluatorStore"
```

---

