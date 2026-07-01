<script setup lang="ts">
import { computed } from 'vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'

const store = useEvaluatorStore()

function formatCOP(value: number): string {
  if (value >= 1_000_000_000)
    return `$${(value / 1_000_000_000).toFixed(2).replace('.', ',')} B`
  if (value >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1).replace('.', ',')} M`
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

const activeBreakdown = computed(() =>
  store.aggregated.breakdown.filter(r => r.formulaDefined && r.value !== null && r.sobrecosto > 0)
)
</script>

<template>
  <aside class="summary-panel">
    <h2 class="summary-title">Resumen de costos</h2>

    <div class="summary-row summary-row--spaced">
      <span class="summary-label">CAPEX base</span>
      <span class="summary-value">{{ formatCOP(store.baseCapex) }}</span>
    </div>

    <div class="summary-divider" />

    <div v-if="activeBreakdown.length === 0" class="summary-empty">
      Sin sobrecostos calculados aún.
    </div>

    <div v-for="item in activeBreakdown" :key="item.id" class="summary-row">
      <span class="summary-row-label">{{ item.label }}</span>
      <span class="summary-row-value">{{ formatCOP(item.sobrecosto) }}</span>
    </div>

    <div v-if="activeBreakdown.length > 0" class="summary-divider" />

    <div class="summary-row summary-row--spaced">
      <span class="summary-label">Total sobrecostos</span>
      <span class="summary-value summary-value--orange">{{ formatCOP(store.aggregated.totalSobrecosto) }}</span>
    </div>

    <div class="summary-total">
      <p class="summary-total-label">CAPEX Total estimado</p>
      <p class="summary-total-value">{{ formatCOP(store.aggregated.capexTotal) }}</p>
    </div>
  </aside>
</template>

<style scoped>
.summary-panel {
  width: 280px;
  min-width: 280px;
  background: var(--card);
  border-left: 1.5px solid var(--border);
  padding: 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  position: sticky;
  top: 60px;
  height: calc(100vh - 60px);
  overflow-y: auto;
  box-shadow: -2px 0 12px rgba(145, 91, 216, 0.06);
}

.summary-title {
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--purple);
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--border);
  margin-bottom: 0.1rem;
}

.summary-label { font-size: 0.75rem; color: var(--muted); font-weight: 500; }
.summary-value { font-size: 0.9rem; font-weight: 700; color: var(--text); }
.summary-value--orange { color: var(--orange); }

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.8rem;
}
.summary-row--spaced { margin: 0.1rem 0; }
.summary-row-label { color: var(--text-mid); font-weight: 500; flex: 1; padding-right: 0.5rem; line-height: 1.35; }
.summary-row-value { color: var(--purple); font-weight: 700; white-space: nowrap; }

.summary-divider {
  height: 1px;
  background: var(--border);
  margin: 0.2rem 0;
}

.summary-empty {
  font-size: 0.78rem;
  color: var(--muted);
  text-align: center;
  padding: 0.75rem 0;
  background: #f9f5ff;
  border-radius: 9px;
  border: 1.5px dashed var(--border);
}

.summary-total {
  margin-top: 0.35rem;
  padding: 0.85rem 1rem;
  background: #13294B;
  border-top: 3px solid #D6E965;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(19, 41, 75, 0.3);
}
.summary-total-label {
  font-size: 0.72rem;
  color: #8EC8E9;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 0.3rem;
}
.summary-total-value {
  font-size: 1.1rem;
  font-weight: 800;
  color: #D6E965;
  letter-spacing: -0.5px;
}
</style>
