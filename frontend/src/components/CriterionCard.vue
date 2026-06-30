<script setup lang="ts">
import { computed } from 'vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'
import { loadCriteria } from '@/engine/evaluatorEngine'
import type { CriterionResult } from '@/types'

const props = defineProps<{ result: CriterionResult }>()
const store = useEvaluatorStore()

const module = computed(() => loadCriteria().find(c => c.id === props.result.id))

const borderColor = computed(() => {
  if (!props.result.formulaDefined) return 'var(--color-orange)'
  if (props.result.value !== null) return 'var(--color-lemony)'
  return 'var(--color-gray)'
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
  <div class="criterion-card" :style="{ borderLeftColor: borderColor }">
    <div class="card-header">
      <span class="card-label">{{ result.label }}</span>
      <div class="card-badges">
        <span v-if="result.fromDb" class="badge badge--db">Desde BD</span>
        <span v-if="!result.formulaDefined" class="badge badge--pending">Fórmula pendiente</span>
      </div>
    </div>

    <div class="card-input">
      <!-- Number input -->
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

      <!-- Toggle -->
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

      <!-- Select -->
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
      <span class="cost-label">Sobrecosto:</span>
      <span class="cost-value">{{ formatCOP(result.sobrecosto) }}</span>
    </div>
  </div>
</template>

<style scoped>
.criterion-card {
  background: var(--color-navy-light);
  border: 1px solid rgba(255,255,255,0.08);
  border-left: 4px solid var(--color-gray);
  border-radius: 8px;
  padding: 1rem;
  transition: border-left-color 0.2s;
}
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; }
.card-label { font-size: 0.88rem; font-weight: 600; color: var(--color-white); }
.card-badges { display: flex; gap: 0.4rem; }
.badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}
.badge--db { background: rgba(142, 195, 225, 0.2); color: var(--color-nashville); }
.badge--pending { background: rgba(249, 115, 22, 0.2); color: var(--color-orange); }
.card-input { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }
.input-field {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 5px;
  padding: 0.4rem 0.6rem;
  color: var(--color-white);
  font-family: 'Montserrat', sans-serif;
  font-size: 0.85rem;
  outline: none;
  width: 100%;
  max-width: 180px;
}
.input-field:disabled { opacity: 0.6; cursor: not-allowed; }
.input-field:focus { border-color: var(--color-lemony); }
.input-unit { font-size: 0.78rem; color: var(--color-gray); }
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem; }
.toggle-checkbox { accent-color: var(--color-lemony); width: 16px; height: 16px; }
.card-cost { display: flex; justify-content: space-between; }
.cost-label { font-size: 0.78rem; color: var(--color-gray); }
.cost-value { font-size: 0.85rem; font-weight: 600; color: var(--color-lemony); }
</style>
