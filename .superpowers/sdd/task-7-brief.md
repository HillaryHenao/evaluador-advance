## Task 7: `FinancialResultsPanel.vue`

**Files:**
- Create: `frontend/src/components/FinancialResultsPanel.vue`

**Interfaces:**
- Consumes: `useEvaluatorStore().financialResults`, `.arriendoManual`, `.kVA` (Task 6).
- Produces: componente `<FinancialResultsPanel />` sin props, consumido por Task 8 (`EvaluadorView.vue`).

- [ ] **Step 1: Crear el componente**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'

const store = useEvaluatorStore()

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatCOP(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2).replace('.', ',')} B`
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace('.', ',')} M`
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatAnios(value: number): string {
  return `${value.toFixed(1)} años`
}

const faltaProduccion = computed(() => !store.terrainData?.produccion_especifica)
const faltaArriendo = computed(() => !store.arriendoManual && !store.terrainData?.arriendo_anual)
</script>

<template>
  <aside class="financial-panel">
    <h2 class="financial-title">Resultados financieros</h2>

    <div v-if="!store.financialResults" class="financial-empty">
      <p v-if="faltaProduccion">Falta producción específica del terreno.</p>
      <p v-if="faltaArriendo">Falta arriendo anual — completa manualmente:</p>
      <input
        v-if="faltaArriendo"
        type="number"
        placeholder="Arriendo anual (COP)"
        class="financial-input"
        @change="(e) => (store.arriendoManual = Number((e.target as HTMLInputElement).value) || null)"
      />
    </div>

    <template v-else>
      <div class="financial-row">
        <span class="financial-label">TIR</span>
        <span class="financial-value">{{ formatPct(store.financialResults.tir) }}</span>
      </div>
      <div class="financial-row">
        <span class="financial-label">TIR c. beneficios tributarios</span>
        <span class="financial-value financial-value--highlight">{{ formatPct(store.financialResults.tirConBeneficios) }}</span>
      </div>
      <div class="financial-divider" />
      <div class="financial-row">
        <span class="financial-label">VPN</span>
        <span class="financial-value">{{ formatCOP(store.financialResults.vpn) }}</span>
      </div>
      <div class="financial-row">
        <span class="financial-label">VPN c. beneficios</span>
        <span class="financial-value financial-value--highlight">{{ formatCOP(store.financialResults.vpnConBeneficios) }}</span>
      </div>
      <div class="financial-divider" />
      <div class="financial-row">
        <span class="financial-label">Payback</span>
        <span class="financial-value">{{ formatAnios(store.financialResults.paybackAnios) }}</span>
      </div>
      <div class="financial-row">
        <span class="financial-label">Payback c. beneficios</span>
        <span class="financial-value financial-value--highlight">{{ formatAnios(store.financialResults.paybackConBeneficiosAnios) }}</span>
      </div>
    </template>

    <div class="financial-inputs">
      <label class="financial-input-label">
        Potencia AC (kVA)
        <input
          type="number"
          :value="store.kVA"
          class="financial-input"
          @change="(e) => (store.kVA = Number((e.target as HTMLInputElement).value) || 1000)"
        />
      </label>
    </div>
  </aside>
</template>

<style scoped>
.financial-panel {
  width: 280px;
  min-width: 280px;
  background: var(--card);
  border-left: 1.5px solid var(--border);
  padding: 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.financial-title {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--purple);
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--border);
  margin-bottom: 0.1rem;
}

.financial-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.8rem;
}
.financial-label { color: var(--text-mid); font-weight: 500; }
.financial-value { font-weight: 700; color: var(--text); }
.financial-value--highlight { color: var(--purple); }

.financial-divider { height: 1px; background: var(--border); margin: 0.2rem 0; }

.financial-empty {
  font-size: 0.78rem;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.financial-inputs {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border);
}
.financial-input-label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--muted);
}
.financial-input {
  background: #faf8fe;
  border: 1.5px solid var(--border);
  border-radius: 9px;
  padding: 0.45rem 0.7rem;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.85rem;
}
</style>
```

- [ ] **Step 2: Verificar que compila**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vue-tsc -b
```

Expected: mismos 2 errores preexistentes de siempre, ninguno nuevo en `FinancialResultsPanel.vue`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add frontend/src/components/FinancialResultsPanel.vue
git commit -m "feat: add FinancialResultsPanel component"
```

---

