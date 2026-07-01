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
      <span class="search-label">Código terreno</span>
      <input
        v-model="code"
        type="text"
        placeholder="Ej. COLCEST5"
        class="search-input"
        @keyup.enter="handleSearch"
      />
      <button class="search-btn" @click="handleSearch" :disabled="store.loading">
        <svg v-if="!store.loading" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        {{ store.loading ? 'Buscando...' : 'Consultar' }}
      </button>
    </div>

    <div v-if="store.terrainData" class="terrain-info terrain-info--found">
      <span class="terrain-check">✓</span>
      <strong>{{ store.terrainData.code }}</strong>
      <span class="terrain-sep">·</span>
      <span>{{ store.terrainData.municipality }}</span>
      <span class="terrain-sep">·</span>
      <span>{{ store.terrainData.or ?? 'OR no disponible' }}</span>
    </div>

    <div v-if="store.error" class="terrain-error">⚠ {{ store.error }}</div>
  </div>
</template>

<style scoped>
.terrain-search {
  padding: 1.25rem 1.5rem;
  border-bottom: 1.5px solid var(--border);
  background: var(--card);
}

.search-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-label {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--purple);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  white-space: nowrap;
}

.search-input {
  background: #fff;
  border: 1.5px solid var(--border);
  border-radius: 9px;
  padding: 0.55rem 0.9rem;
  color: var(--text);
  font-family: 'Montserrat', sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  outline: none;
  width: 200px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.search-input::placeholder {
  text-transform: none;
  font-weight: 400;
  letter-spacing: 0;
  color: #bbb;
}
.search-input:focus {
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(145, 91, 216, 0.15);
}

.search-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--purple);
  color: #fff;
  border: none;
  border-radius: 9px;
  padding: 0.55rem 1.1rem;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.search-btn:hover { background: var(--purple-deep); color: var(--yellow); }
.search-btn:active { transform: scale(0.97); }
.search-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.terrain-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.9rem;
  border-radius: 9px;
  font-size: 0.85rem;
  border: 1.5px solid transparent;
}
.terrain-info--found {
  background: #f0e8ff;
  border-color: var(--purple);
  color: var(--purple-deep);
}
.terrain-check { color: var(--purple); font-weight: 800; }
.terrain-sep { color: var(--purple-soft); }

.terrain-error {
  margin-top: 0.5rem;
  font-size: 0.82rem;
  color: var(--red);
  background: rgba(220, 38, 38, 0.08);
  padding: 0.4rem 0.75rem;
  border-radius: 7px;
  border: 1px solid rgba(220, 38, 38, 0.2);
}
</style>
