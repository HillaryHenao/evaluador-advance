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

    <div class="summary-section">
      <p class="summary-label">CAPEX base</p>
      <p class="summary-value">{{ formatCOP(store.baseCapex) }}</p>
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

    <div class="summary-section">
      <p class="summary-label">Total sobrecostos</p>
      <p class="summary-value summary-value--orange">{{ formatCOP(store.aggregated.totalSobrecosto) }}</p>
    </div>

    <div class="summary-total">
      <p class="summary-total-label">CAPEX Total</p>
      <p class="summary-total-value">{{ formatCOP(store.aggregated.capexTotal) }}</p>
    </div>
  </aside>
</template>

<style scoped>
.summary-panel {
  width: 280px;
  min-width: 280px;
  background: var(--color-navy-light);
  border-left: 1px solid rgba(255,255,255,0.08);
  padding: 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: sticky;
  top: 56px;
  height: calc(100vh - 56px);
  overflow-y: auto;
}
.summary-title { font-size: 0.9rem; font-weight: 700; color: var(--color-nashville); margin-bottom: 0.25rem; }
.summary-section { display: flex; justify-content: space-between; align-items: baseline; }
.summary-label { font-size: 0.78rem; color: var(--color-gray); }
.summary-value { font-size: 0.9rem; font-weight: 600; color: var(--color-white); }
.summary-value--orange { color: var(--color-orange); }
.summary-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 0.25rem 0; }
.summary-empty { font-size: 0.78rem; color: var(--color-gray); text-align: center; padding: 0.5rem 0; }
.summary-row { display: flex; justify-content: space-between; font-size: 0.8rem; }
.summary-row-label { color: var(--color-white); }
.summary-row-value { color: var(--color-lemony); font-weight: 600; }
.summary-total {
  margin-top: 0.25rem;
  padding: 0.75rem;
  background: rgba(226, 255, 101, 0.08);
  border: 1px solid rgba(226, 255, 101, 0.25);
  border-radius: 8px;
}
.summary-total-label { font-size: 0.78rem; color: var(--color-nashville); margin-bottom: 0.25rem; }
.summary-total-value { font-size: 1.15rem; font-weight: 700; color: var(--color-lemony); }
</style>
