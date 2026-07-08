## Task 6: Wire en `evaluatorStore` (kVA, arriendo/producción reactivos, financialResults)

**Files:**
- Modify: `frontend/src/stores/evaluatorStore.ts`
- Modify: `frontend/src/stores/__tests__/evaluatorStore.test.ts`

**Interfaces:**
- Consumes: `calcularFinanzas` de `@/engine/financialEngine`.
- Produces: `evaluatorStore.kVA: Ref<number>`, `evaluatorStore.arriendoAnual: Ref<number | null>`, `evaluatorStore.financialResults: ComputedRef<FinancialResults | null>` — consumidos por Task 7 (`FinancialResultsPanel.vue`).

- [ ] **Step 1: Escribir el test (falla primero)**

Agrega a `frontend/src/stores/__tests__/evaluatorStore.test.ts`:

```ts
describe('financialResults', () => {
  it('es null si no hay producción específica ni arriendo cargados', () => {
    const store = useEvaluatorStore()
    expect(store.financialResults).toBeNull()
  })

  it('calcula TIR una vez cargados terrainData y kVA por defecto', async () => {
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue(mockTerrain)
    const store = useEvaluatorStore()
    await store.fetchTerrain('COLCEST5')
    expect(store.financialResults).not.toBeNull()
    expect(store.financialResults?.tir).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run evaluatorStore
```

Expected: FAIL — `store.financialResults` es `undefined`, no `null`.

- [ ] **Step 3: Leer el estado actual de `evaluatorStore.ts`**

Antes de editar, revisa el archivo completo para mantener el estilo existente (composables Pinia con `ref`/`computed`).

- [ ] **Step 4: Implementar en `evaluatorStore.ts`**

Agrega el import al inicio del archivo:

```ts
import { calcularFinanzas } from '@/engine/financialEngine'
import type { FinancialResults } from '@/types'
```

Dentro de `defineStore`, junto a la declaración de `kWp`:

```ts
  const kVA = ref(1000)
  const arriendoManual = ref<number | null>(null)
```

Agrega el computed `financialResults` (ubícalo junto al computed `aggregated` existente):

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

Y actualiza el `return` del store (al final de `defineStore`), agregando los 3 nuevos campos. Reemplaza:

```ts
  return {
    terrainData, criterionValues, baseCapex, kWp,
    loading, error, aggregated, fetchTerrain, setCriterionValue, reset,
  }
```

con:

```ts
  return {
    terrainData, criterionValues, baseCapex, kWp, kVA, arriendoManual,
    loading, error, aggregated, financialResults, fetchTerrain, setCriterionValue, reset,
  }
```

- [ ] **Step 5: Correr el test — iterar hasta que pase**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run evaluatorStore
```

Expected: PASS.

- [ ] **Step 6: Correr toda la suite y commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run
```

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add frontend/src/stores/evaluatorStore.ts frontend/src/stores/__tests__/evaluatorStore.test.ts
git commit -m "feat: wire financial engine into evaluatorStore reactively"
```

---

