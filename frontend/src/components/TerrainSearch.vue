<script setup lang="ts">
import { ref } from 'vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'

const store = useEvaluatorStore()
const code = ref('')

async function handleSearch() {
  if (!code.value.trim()) return
  await store.fetchTerrain(code.value.trim().toUpperCase())
}
</script>

<template>
  <div class="terrain-search">
    <div class="search-row">
      <input
        v-model="code"
        type="text"
        placeholder="Ej. COLCEST5"
        class="search-input"
        @keyup.enter="handleSearch"
      />
      <button class="search-btn" @click="handleSearch" :disabled="store.loading">
        {{ store.loading ? 'Buscando...' : 'Buscar' }}
      </button>
    </div>
    <div v-if="store.terrainData" class="terrain-info">
      <span class="terrain-badge terrain-badge--ok">✓</span>
      <span>{{ store.terrainData.code }}</span>
      <span class="terrain-sep">·</span>
      <span>{{ store.terrainData.municipality }}</span>
      <span class="terrain-sep">·</span>
      <span>{{ store.terrainData.or ?? 'OR no disponible' }}</span>
    </div>
    <div v-if="store.error" class="terrain-error">{{ store.error }}</div>
  </div>
</template>

<style scoped>
.terrain-search { padding: 1rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
.search-row { display: flex; gap: 0.75rem; }
.search-input {
  flex: 1;
  max-width: 280px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  padding: 0.5rem 0.8rem;
  color: var(--color-white);
  font-family: 'Montserrat', sans-serif;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
  text-transform: uppercase;
}
.search-input:focus { border-color: var(--color-lemony); }
.search-btn {
  background: var(--color-lemony);
  color: var(--color-navy);
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.2rem;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: opacity 0.2s;
}
.search-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.terrain-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.6rem;
  font-size: 0.85rem;
  color: var(--color-nashville);
}
.terrain-badge--ok { color: var(--color-lemony); font-weight: 700; }
.terrain-sep { opacity: 0.4; }
.terrain-error { margin-top: 0.5rem; font-size: 0.82rem; color: #f87171; }
</style>
