<script setup lang="ts">
import { computed } from 'vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'
import { loadCriteria } from '@/engine/evaluatorEngine'
import type { CriterionResult } from '@/types'

const props = defineProps<{ result: CriterionResult }>()
const store = useEvaluatorStore()

const module = computed(() => loadCriteria().find(c => c.id === props.result.id))

const accentColor = computed(() => {
  if (!props.result.formulaDefined) return '#ea580c'
  if (props.result.value !== null) return 'var(--purple)'
  return 'var(--border)'
})

function formatCOP(value: number): string {
  if (value === 0) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const raw = target.value
  store.setCriterionValue(props.result.id, raw === '' ? null : Number(raw))
}

function handleSelect(event: Event) {
  const target = event.target as HTMLSelectElement
  store.setCriterionValue(props.result.id, target.value || null)
}

function handleToggle(event: Event) {
  const target = event.target as HTMLInputElement
  store.setCriterionValue(props.result.id, target.checked)
}
</script>

<template>
  <div class="criterion-card" :class="{ 'criterion-card--filled': result.value !== null, 'criterion-card--db': result.fromDb }">
    <div class="card-accent" :style="{ background: accentColor }" />
    <div class="card-header">
      <span class="card-label">{{ result.label }}</span>
      <div class="card-badges">
        <span v-if="result.category === 'ambas'" class="badge badge--ambas">Fijo + Prob.</span>
        <span v-if="result.fromDb" class="badge badge--db">BD</span>
        <span v-if="!result.formulaDefined" class="badge badge--pending">Pendiente</span>
      </div>
    </div>

    <div class="card-input">
      <template v-if="module?.inputType === 'number'">
        <input
          type="number"
          :value="result.value as number ?? ''"
          :disabled="result.fromDb"
          :placeholder="`0 ${module.unit ?? ''}`"
          class="input-field"
          @input="handleInput"
        />
        <span v-if="module.unit" class="input-unit">{{ module.unit }}</span>
      </template>

      <template v-else-if="module?.inputType === 'toggle'">
        <label class="toggle-label">
          <input
            type="checkbox"
            :checked="result.value === true"
            :disabled="result.fromDb"
            class="toggle-checkbox"
            @change="handleToggle"
          />
          <span>{{ result.value === true ? 'Sí' : 'No' }}</span>
        </label>
      </template>

      <template v-else-if="module?.inputType === 'select'">
        <select
          :value="result.value as string ?? ''"
          :disabled="result.fromDb"
          class="input-field"
          @change="handleSelect"
        >
          <option value="">— Seleccionar —</option>
          <option v-for="opt in module.options" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </template>
    </div>

    <div class="card-cost" v-if="result.formulaDefined">
      <span class="cost-label">Sobrecosto</span>
      <span class="cost-value" :class="{ 'cost-value--zero': result.sobrecosto === 0 }">
        {{ formatCOP(result.sobrecosto) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.criterion-card {
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 1rem 1rem 1rem 1.25rem;
  position: relative;
  overflow: hidden;
  transition: all 0.22s;
  box-shadow: 0 2px 8px rgba(145, 91, 216, 0.07);
}
.criterion-card:hover {
  border-color: #8EC8E9;
  background: var(--card-hover);
  box-shadow: 0 6px 20px rgba(142, 200, 233, 0.3);
  transform: translateY(-2px);
}
.criterion-card--db {
  border-color: rgba(19, 41, 75, 0.3);
}

.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  border-radius: 14px 0 0 14px;
  transition: background 0.3s;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.card-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  flex: 1;
}

.card-badges { display: flex; gap: 0.35rem; flex-wrap: wrap; }

.badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 5px;
  white-space: nowrap;
}
.badge--ambas {
  background: rgba(246, 255, 114, 0.15);
  color: #6b5a00;
  border: 1px solid rgba(246, 255, 114, 0.5);
}
.badge--db {
  background: rgba(145, 91, 216, 0.12);
  color: var(--purple);
  border: 1px solid rgba(145, 91, 216, 0.25);
}
.badge--pending {
  background: rgba(234, 88, 12, 0.1);
  color: var(--orange);
  border: 1px solid rgba(234, 88, 12, 0.25);
}

.card-input { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }

.input-field {
  background: #faf8fe;
  border: 1.5px solid var(--border);
  border-radius: 9px;
  padding: 0.45rem 0.7rem;
  color: var(--text);
  font-family: 'Montserrat', sans-serif;
  font-size: 0.85rem;
  outline: none;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
  appearance: none;
  -webkit-appearance: none;
}
.input-field:focus {
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(145, 91, 216, 0.12);
  background: #fff;
}
.input-field:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #f5f0fe;
  border-color: var(--border);
  color: var(--text-mid);
}

.input-unit { font-size: 0.78rem; color: var(--muted); white-space: nowrap; }

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text);
}
.toggle-checkbox { accent-color: var(--purple); width: 16px; height: 16px; }

.card-cost {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border);
  padding-top: 0.6rem;
  margin-top: 0.2rem;
}
.cost-label { font-size: 0.75rem; color: var(--muted); font-weight: 600; }
.cost-value { font-size: 0.88rem; font-weight: 700; color: var(--purple); }
.cost-value--zero { color: var(--muted); font-weight: 400; }
</style>
