# Task 8 Brief: EvaluadorView ensamblaje

## Context
Task 8 of 10. All components, stores, and services from Tasks 1-7 are complete. Your job: replace the EvaluadorView.vue placeholder with the real assembled view that wires together all 4 components with the evaluator store.

## Global Constraints
- Work in `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend\`
- Run `npx tsc --noEmit` to verify TypeScript compiles clean
- Use PowerShell for commands

## File to Modify
- `src/views/EvaluadorView.vue` (currently a placeholder)

## Implementation

Replace `src/views/EvaluadorView.vue` entirely with:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import TerrainSearch from '@/components/TerrainSearch.vue'
import CriterionCard from '@/components/CriterionCard.vue'
import SummaryPanel from '@/components/SummaryPanel.vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'
import { evaluateCriteria } from '@/engine/evaluatorEngine'

const store = useEvaluatorStore()

const results = computed(() => evaluateCriteria(store.criterionValues, {
  baseCapex: store.baseCapex,
  kWp: store.kWp,
}))
</script>

<template>
  <div class="evaluador-layout">
    <AppHeader />
    <div class="evaluador-body">
      <main class="evaluador-main">
        <TerrainSearch />
        <div class="criteria-grid">
          <CriterionCard
            v-for="result in results"
            :key="result.id"
            :result="result"
          />
        </div>
      </main>
      <SummaryPanel />
    </div>
  </div>
</template>

<style scoped>
.evaluador-layout { display: flex; flex-direction: column; min-height: 100vh; }
.evaluador-body { display: flex; flex: 1; overflow: hidden; }
.evaluador-main { flex: 1; overflow-y: auto; }
.criteria-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  padding: 1.25rem 1.5rem;
}
</style>
```

## Steps
1. Replace `src/views/EvaluadorView.vue` with the code above (IMPORTANT: do NOT create a new file — modify the existing one)
2. Run `npx tsc --noEmit` — must be clean
3. Commit: `cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance" && git add frontend/src/views/EvaluadorView.vue && git commit -m "feat: assemble EvaluadorView with full criteria grid and summary panel"`

## Report Contract
Write report to: `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\.superpowers\sdd\task-8-report.md`

Return ONLY: status, commit hash(es), one-line summary, concerns.
