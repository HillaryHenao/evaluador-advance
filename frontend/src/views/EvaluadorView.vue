<script setup lang="ts">
import { computed } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import TerrainSearch from '@/components/TerrainSearch.vue'
import CriterionCard from '@/components/CriterionCard.vue'
import SummaryPanel from '@/components/SummaryPanel.vue'
import FinancialResultsPanel from '@/components/FinancialResultsPanel.vue'
import ProjectBreakdownPanel from '@/components/ProjectBreakdownPanel.vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'

const store = useEvaluatorStore()

const results = computed(() => store.aggregated.breakdown)

const FIJO_ORDER = [
  'distancia_red', 'distancia_via',
  'corte', 'lleno',
  'nivel_tension', 'cluster',
  'obras_hidraulicas', 'aprovechamiento_forestal',
]

const fijoResults = computed(() => {
  const items = results.value.filter(r => r.category === 'fijo' || r.category === 'ambas')
  return items.slice().sort((a, b) => {
    const ai = FIJO_ORDER.indexOf(a.id)
    const bi = FIJO_ORDER.indexOf(b.id)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
})

const probabilidadResults = computed(() =>
  results.value.filter(r => r.category === 'probabilidad'),
)
</script>

<template>
  <div class="evaluador-layout">
    <AppHeader />
    <div class="evaluador-body">
      <main class="evaluador-main">
        <TerrainSearch />

        <div class="criteria-content">
          <section class="criteria-section">
            <div class="section-title">Costos fijos del terreno</div>
            <div class="criteria-grid">
              <CriterionCard
                v-for="result in fijoResults"
                :key="result.id"
                :result="result"
              />
            </div>
          </section>

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
      <SummaryPanel />
      <FinancialResultsPanel />
    </div>
  </div>
</template>

<style scoped>
.evaluador-layout { display: flex; flex-direction: column; min-height: 100vh; }
.evaluador-body { display: flex; flex: 1; overflow: hidden; }
.evaluador-main { flex: 1; overflow-y: auto; background: var(--bg); }

.criteria-content {
  max-width: 1200px;
  padding: 0 1.5rem 3rem;
  margin: 0 auto;
}

.criteria-section { padding-bottom: 1.5rem; }

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

.section-title--probabilidad {
  color: var(--text-mid);
  border-bottom-color: #13294B;
}

.criteria-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 1rem;
}
</style>
