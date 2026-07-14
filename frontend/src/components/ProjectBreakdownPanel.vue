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
