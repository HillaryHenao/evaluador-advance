<script setup lang="ts">
import { computed } from 'vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'

const store = useEvaluatorStore()

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatCOP(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    const millones = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(abs / 1_000_000)
    return `${sign}$${millones} M`
  }
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatAnios(value: number): string {
  return `${value.toFixed(1)} años`
}

const faltaProduccion = computed(() => store.produccionEspecificaManual == null && store.terrainData?.produccion_especifica == null)
const faltaArriendo = computed(() => store.arriendoManual == null && store.terrainData?.arriendo_anual == null)
const produccionEfectiva = computed(() => store.produccionEspecificaManual ?? store.terrainData?.produccion_especifica ?? null)

function precioHectareaProyecto(nombre: string): number | null {
  return store.terrainData?.proyectos.find(p => p.nombre === nombre)?.precio_hectarea ?? null
}

function areaProyecto(nombre: string): number | null {
  return store.terrainData?.proyectos.find(p => p.nombre === nombre)?.area_hectareas ?? null
}

// Precio/Ha × Ha arrendadas del proyecto — este es el valor que TIR/VPN/Payback usan como
// arriendo cuando ambos datos existen (más confiable que arriendo_anual del termsheet, ver
// evaluatorStore.arriendoParaProyecto).
function arriendoCalculadoProyecto(nombre: string): number | null {
  const precio = precioHectareaProyecto(nombre)
  const area = areaProyecto(nombre)
  if (precio == null || area == null) return null
  return precio * area
}
</script>

<template>
  <aside class="financial-panel">
    <h2 class="financial-title">Resultados financieros</h2>

    <div v-if="!store.perProjectFinancials" class="financial-empty">
      <p v-if="faltaProduccion">Falta producción específica del terreno — completa manualmente abajo.</p>
      <p v-if="faltaArriendo">Falta arriendo anual de plataforma para este terreno.</p>
    </div>

    <template v-else>
      <div v-for="nombre in store.proyectoNombres" :key="nombre" class="financial-project">
        <div class="financial-project-title">{{ nombre }}</div>

        <div class="financial-row" v-if="precioHectareaProyecto(nombre)">
          <span class="financial-label">Precio / Ha</span>
          <span class="financial-value">{{ formatCOP(precioHectareaProyecto(nombre)!) }}</span>
        </div>

        <div class="financial-row" v-if="areaProyecto(nombre)">
          <span class="financial-label">Área del proyecto</span>
          <span class="financial-value">{{ areaProyecto(nombre) }} Ha</span>
        </div>

        <div class="financial-row" v-if="arriendoCalculadoProyecto(nombre)">
          <span class="financial-label">Arriendo total del proyecto x año</span>
          <span class="financial-value">{{ formatCOP(arriendoCalculadoProyecto(nombre)!) }}</span>
        </div>

        <template v-if="store.perProjectFinancials[nombre]">
          <div class="financial-row">
            <span class="financial-label">TIR</span>
            <span class="financial-value">{{ formatPct(store.perProjectFinancials[nombre].tir) }}</span>
          </div>
          <div class="financial-row">
            <span class="financial-label">TIR c. beneficios</span>
            <span class="financial-value financial-value--highlight">{{ formatPct(store.perProjectFinancials[nombre].tirConBeneficios) }}</span>
          </div>
          <div class="financial-row">
            <span class="financial-label">VPN</span>
            <span class="financial-value">{{ formatCOP(store.perProjectFinancials[nombre].vpn) }}</span>
          </div>
          <div class="financial-row">
            <span class="financial-label">VPN c. beneficios</span>
            <span class="financial-value financial-value--highlight">{{ formatCOP(store.perProjectFinancials[nombre].vpnConBeneficios) }}</span>
          </div>
          <div class="financial-row">
            <span class="financial-label">Payback</span>
            <span class="financial-value">{{ formatAnios(store.perProjectFinancials[nombre].paybackAnios) }}</span>
          </div>
          <div class="financial-row">
            <span class="financial-label">Payback c. beneficios</span>
            <span class="financial-value financial-value--highlight">{{ formatAnios(store.perProjectFinancials[nombre].paybackConBeneficiosAnios) }}</span>
          </div>
        </template>
        <p v-else class="financial-project-empty">Falta arriendo anual de este proyecto.</p>
      </div>
    </template>

    <div class="financial-inputs">
      <label class="financial-input-label">
        Producción específica (kWh/kWp/día) — {{ store.terrainData?.produccion_especifica ? 'de plataforma, editable' : 'no viene de plataforma' }}
        <input
          type="number"
          step="0.0001"
          :value="produccionEfectiva ?? ''"
          placeholder="Producción específica (kWh/kWp/día)"
          class="financial-input"
          @change="(e) => (store.produccionEspecificaManual = Number((e.target as HTMLInputElement).value) || null)"
        />
      </label>

      <div class="financial-row" v-if="store.terrainData?.area_hectareas">
        <span class="financial-label">Ha negociadas</span>
        <span class="financial-value">{{ store.terrainData.area_hectareas }} Ha</span>
      </div>

      <label class="financial-input-label">
        Potencia DC (kWp)
        <input
          type="number"
          step="0.1"
          :value="store.kWp"
          class="financial-input"
          @change="(e) => (store.kWp = Number((e.target as HTMLInputElement).value) || 1320.8)"
        />
      </label>

      <label class="financial-input-label">
        Potencia AC (kVA)
        <input
          type="number"
          :value="store.kVA"
          class="financial-input"
          @change="(e) => (store.kVA = Number((e.target as HTMLInputElement).value) || 990)"
        />
      </label>
    </div>
  </aside>
</template>

<style scoped>
.financial-panel {
  width: 360px;
  min-width: 360px;
  background: var(--card);
  border-left: 1.5px solid var(--border);
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.financial-title {
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--purple);
  padding-bottom: 0.85rem;
  border-bottom: 2px solid var(--border);
  margin-bottom: 0.2rem;
}

.financial-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.25rem 0.5rem;
  font-size: 0.9rem;
}
.financial-label { color: var(--text-mid); font-weight: 500; }
.financial-value { font-weight: 700; color: var(--text); font-size: 1rem; }
.financial-value--highlight { color: var(--purple); }

.financial-divider { height: 1px; background: var(--border); margin: 0.2rem 0; }

.financial-project { padding: 0.6rem 0; }
.financial-project:not(:last-child) { border-bottom: 1px dashed var(--border); }
.financial-project-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.4rem;
  overflow-wrap: break-word;
}
.financial-project-empty { font-size: 0.75rem; color: var(--muted); }

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
