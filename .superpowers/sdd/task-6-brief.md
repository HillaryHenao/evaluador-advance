### Task 6: UI — "Desglose por proyecto" section

**Files:**
- Create: `frontend/src/components/ProjectBreakdownPanel.vue`
- Modify: `frontend/src/views/EvaluadorView.vue`

**Interfaces:**
- Consumes: `store.proyectoNombres`, `store.perProjectResults`, `store.perProjectFinancials`, `store.financialResults`, `store.aggregated.breakdown` (all Task 4), `aggregateCosts` (existing, from `evaluatorEngine.ts`).

- [ ] **Step 1: Create `frontend/src/components/ProjectBreakdownPanel.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'
import { aggregateCosts } from '@/engine/evaluatorEngine'

const store = useEvaluatorStore()

function formatCOP(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000)
    return `${sign}$${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} B`
  if (abs >= 1_000_000)
    return `${sign}$${(abs / 1_000_000).toFixed(1).replace('.', ',')} M`
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatAnios(value: number): string {
  return `${value.toFixed(1)} años`
}

const proyectos = computed(() => {
  return store.proyectoNombres.map(nombre => {
    const results = store.perProjectResults[nombre] ?? []
    const aggregated = aggregateCosts(results, {
      baseCapex: store.baseCapex,
      kWp: store.kWp,
      projectCount: Math.max(store.proyectoNombres.length, 1),
    })
    return {
      nombre,
      costosFijos: aggregated.totalSobrecostoFijo,
      // Solo el monto en pesos, sin traducir a meses — servidumbre/amenazas (riskType
      // 'meses') divididos entre proyectos pueden dar meses fraccionarios (spec: mostrar
      // solo el monto en el desglose por proyecto).
      riesgoMonto: aggregated.totalRetraso + aggregated.totalRiesgoCosto,
      vpn: store.perProjectFinancials?.[nombre]?.vpn ?? null,
      vpnConBeneficios: store.perProjectFinancials?.[nombre]?.vpnConBeneficios ?? null,
    }
  })
})
</script>

<template>
  <section v-if="proyectos.length > 0" class="breakdown-section">
    <div class="section-title">Desglose por proyecto</div>

    <div v-if="store.financialResults" class="breakdown-financials-note">
      <span>TIR: {{ formatPct(store.financialResults.tir) }}</span>
      <span>Payback: {{ formatAnios(store.financialResults.paybackAnios) }}</span>
      <span class="breakdown-note-text">(igual para todos los proyectos del terreno)</span>
    </div>

    <div class="breakdown-grid">
      <div v-for="p in proyectos" :key="p.nombre" class="breakdown-card">
        <div class="breakdown-card-title">{{ p.nombre }}</div>
        <div class="breakdown-row">
          <span class="breakdown-label">Costos fijos</span>
          <span class="breakdown-value">{{ formatCOP(p.costosFijos) }}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-label">Riesgo</span>
          <span class="breakdown-value">{{ formatCOP(p.riesgoMonto) }}</span>
        </div>
        <div v-if="p.vpn !== null" class="breakdown-row">
          <span class="breakdown-label">VPN</span>
          <span class="breakdown-value">{{ formatCOP(p.vpn) }}</span>
        </div>
        <div v-if="p.vpnConBeneficios !== null" class="breakdown-row">
          <span class="breakdown-label">VPN c. beneficios</span>
          <span class="breakdown-value breakdown-value--highlight">{{ formatCOP(p.vpnConBeneficios) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.breakdown-section { padding-bottom: 1.5rem; }

.section-title {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--purple);
  margin: 1.75rem 0 1rem;
  padding-bottom: 0.6rem;
  border-bottom: 2px solid #13294B;
}

.breakdown-financials-note {
  display: flex;
  gap: 1rem;
  align-items: baseline;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 1rem;
}
.breakdown-note-text { font-size: 0.72rem; font-weight: 500; color: var(--muted); }

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.breakdown-card {
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 1rem 1.25rem;
  box-shadow: 0 2px 8px rgba(145, 91, 216, 0.07);
}
.breakdown-card-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.6rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
.breakdown-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.8rem;
  padding: 0.15rem 0;
}
.breakdown-label { color: var(--text-mid); font-weight: 500; }
.breakdown-value { color: var(--purple); font-weight: 700; }
.breakdown-value--highlight { color: var(--green); }
</style>
```

- [ ] **Step 2: Stop duplicating criteria evaluation in `EvaluadorView.vue`, and wire in the new panel**

`EvaluadorView.vue` currently recomputes its own `results` via a direct `evaluateCriteria(store.criterionValues, {...})` call — a second, independent evaluation path that (after Task 3/4) would be the OLD, non-scope-aware function, giving `$0`/`null` for scope-`proyecto` criteria in the cards it feeds (harmless today only because `CriterionCard.vue`'s scope-`proyecto` branch, added in Task 5, ignores its `result.value`/`result.sobrecosto` props entirely and reads `store.perProjectResults` directly instead — but this is fragile and duplicates logic that already lives correctly in the store). Switch to reading `store.aggregated.breakdown`, which is already `evaluateScoped(...).general` (Task 4) — the single source of truth.

Find:

```ts
import AppHeader from '@/components/AppHeader.vue'
import TerrainSearch from '@/components/TerrainSearch.vue'
import CriterionCard from '@/components/CriterionCard.vue'
import SummaryPanel from '@/components/SummaryPanel.vue'
import FinancialResultsPanel from '@/components/FinancialResultsPanel.vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'
import { evaluateCriteria } from '@/engine/evaluatorEngine'

const store = useEvaluatorStore()

const results = computed(() => evaluateCriteria(store.criterionValues, {
  baseCapex: store.baseCapex,
  kWp: store.kWp,
}))
```

Replace with:

```ts
import AppHeader from '@/components/AppHeader.vue'
import TerrainSearch from '@/components/TerrainSearch.vue'
import CriterionCard from '@/components/CriterionCard.vue'
import SummaryPanel from '@/components/SummaryPanel.vue'
import FinancialResultsPanel from '@/components/FinancialResultsPanel.vue'
import ProjectBreakdownPanel from '@/components/ProjectBreakdownPanel.vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'

const store = useEvaluatorStore()

const results = computed(() => store.aggregated.breakdown)
```

Find (the `<template>` section's `criteria-content` div, specifically right after the closing `</section>` of the "Factores de riesgo" section and before the closing `</div>` of `criteria-content`):

```html
          <section class="criteria-section">
            <div class="section-title section-title--probabilidad">Factores de riesgo</div>
            <div class="criteria-grid">
              <CriterionCard
                v-for="result in probabilidadResults"
                :key="result.id"
                :result="result"
              />
            </div>
          </section>
        </div>
      </main>
```

Replace with:

```html
          <section class="criteria-section">
            <div class="section-title section-title--probabilidad">Factores de riesgo</div>
            <div class="criteria-grid">
              <CriterionCard
                v-for="result in probabilidadResults"
                :key="result.id"
                :result="result"
              />
            </div>
          </section>

          <ProjectBreakdownPanel />
        </div>
      </main>
```

- [ ] **Step 3: Type-check**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly the 2 pre-existing errors — no new errors in `ProjectBreakdownPanel.vue` or `EvaluadorView.vue`.

- [ ] **Step 4: Run the full frontend suite**

Run (from `frontend/`): `npx vitest run`

Expected: all pass (this task adds no new `.test.ts` files — this is a regression check).

- [ ] **Step 5: Manual verification against the running dev server**

Same caveat as Task 5 — no automated component tests or browser-automation tool; verify by code trace and, if available, a live browser.

1. Search terrain `COLSANT5`.
2. Confirm a new "Desglose por proyecto" section appears below "Factores de riesgo", showing TIR/Payback once at the top with the "igual para todos los proyectos" note, followed by one card per project with Costos fijos / Riesgo / VPN.
3. Confirm the sum of both projects' "Costos fijos" cards is reasonably consistent with the general "Total sobrecostos fijos" in the sidebar `SummaryPanel` (exact equality isn't guaranteed to the cent given floating-point division, but should be within rounding).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ProjectBreakdownPanel.vue frontend/src/views/EvaluadorView.vue
git commit -m "feat: add Desglose por proyecto section with per-project fijo/riesgo/VPN totals"
```
