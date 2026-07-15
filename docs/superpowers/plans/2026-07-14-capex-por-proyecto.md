# CAPEX por proyecto y eliminación del resumen general — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the general "Resumen de costos" sidebar (`SummaryPanel.vue`) and make each project card in `ProjectBreakdownPanel.vue` self-sufficient with its own full CAPEX (base + fijos), while preserving the two terrain-wide figures that can't be correctly re-derived by summing per-project cards (CAPEX total, which includes the `cluster` adjustment that never appears per-project; and delay-risk months, which don't divide meaningfully per project).

**Architecture:** Delete `SummaryPanel.vue` and its mount point. Add two new stat rows to the top of `ProjectBreakdownPanel.vue` (CAPEX Total del terreno, Riesgo de retraso) sourced directly from the existing `store.aggregated` object — no new calculation. Add "CAPEX base" / "CAPEX total" rows inside each project card, computed from values already available in the component (`store.baseCapex`, the per-project `costosFijos` subtotal already computed there).

**Tech Stack:** Vue 3 + TypeScript + Pinia.

## Global Constraints

- This repo has **no automated component tests for `.vue` files** (established convention) — verification is type-check (`npx vue-tsc -b`) + code trace against the real backend + manual browser check if available, not a test suite.
- `SummaryPanel.vue` has zero editable inputs — verified in the codebase (`store.baseCapex` is only ever assigned in `evaluatorStore.ts`, never from a UI control). Deleting it removes no data-entry capability.
- `FinancialResultsPanel.vue` (the other sidebar — TIR/VPN general + kVA input + arriendo manual override) is **out of scope** — it does not change.
- "CAPEX Total del terreno" and "Riesgo de retraso" (terrain-wide) MUST come from `store.aggregated.capexTotal` / `store.aggregated.totalRetrasoMeses` / `store.aggregated.totalRetraso` / `store.aggregated.totalRiesgoCosto` directly — NOT re-derived by summing the per-project cards, because `cluster` (scope `terreno_no_dividido`) only ever appears in the general aggregate, never in any project's `perProjectResults`, so a sum-of-projects total would silently exclude it and be wrong.
- Test command: `cd frontend && npx vue-tsc -b` (expect exactly 1 pre-existing unrelated error: `vite.config.ts(13,3)`).

---

### Task 1: Remove `SummaryPanel.vue`, add terrain totals and per-project CAPEX to `ProjectBreakdownPanel.vue`

**Files:**
- Delete: `frontend/src/components/SummaryPanel.vue`
- Modify: `frontend/src/views/EvaluadorView.vue`
- Modify: `frontend/src/components/ProjectBreakdownPanel.vue`

**Interfaces:**
- Consumes: `store.aggregated: AggregatedResult` (existing, unchanged — `capexTotal`, `totalRetrasoMeses`, `totalRetraso`, `totalRiesgoCosto` fields), `store.baseCapex: number` (existing), `store.proyectoNombres: string[]` (existing). No new store/engine code.
- Produces: nothing consumed by other tasks — this is the only task in this plan.

- [ ] **Step 1: Delete `SummaryPanel.vue`**

```bash
git rm frontend/src/components/SummaryPanel.vue
```

- [ ] **Step 2: Remove its import and mount point from `EvaluadorView.vue`**

Find:

```ts
import SummaryPanel from '@/components/SummaryPanel.vue'
import FinancialResultsPanel from '@/components/FinancialResultsPanel.vue'
```

Replace with:

```ts
import FinancialResultsPanel from '@/components/FinancialResultsPanel.vue'
```

Find:

```html
      </main>
      <SummaryPanel />
      <FinancialResultsPanel />
```

Replace with:

```html
      </main>
      <FinancialResultsPanel />
```

- [ ] **Step 3: Add terrain-wide totals to `ProjectBreakdownPanel.vue`'s template**

Find:

```html
    <div v-if="store.financialResults" class="breakdown-financials-note">
      <span>TIR: {{ formatPct(store.financialResults.tir) }}</span>
      <span>Payback: {{ formatAnios(store.financialResults.paybackAnios) }}</span>
      <span class="breakdown-note-text">(igual para todos los proyectos del terreno)</span>
    </div>
```

Replace with:

```html
    <div class="breakdown-terreno-totals">
      <div class="breakdown-terreno-item">
        <span class="breakdown-terreno-label">CAPEX Total del terreno</span>
        <span class="breakdown-terreno-value">{{ formatCOP(store.aggregated.capexTotal) }}</span>
      </div>
      <div v-if="store.aggregated.totalRetraso > 0 || store.aggregated.totalRiesgoCosto > 0" class="breakdown-terreno-item">
        <span class="breakdown-terreno-label">
          Riesgo de retraso<template v-if="store.aggregated.totalRetraso > 0"> ({{ store.aggregated.totalRetrasoMeses }} meses)</template>
        </span>
        <span class="breakdown-terreno-value breakdown-terreno-value--riesgo">
          {{ formatCOP(store.aggregated.totalRetraso + store.aggregated.totalRiesgoCosto) }}
        </span>
      </div>
    </div>
    <div v-if="store.aggregated.totalRetraso > 0 || store.aggregated.totalRiesgoCosto > 0" class="breakdown-note-text">
      Riesgo no incluido en el CAPEX
    </div>

    <div v-if="store.financialResults" class="breakdown-financials-note">
      <span>TIR: {{ formatPct(store.financialResults.tir) }}</span>
      <span>Payback: {{ formatAnios(store.financialResults.paybackAnios) }}</span>
      <span class="breakdown-note-text">(igual para todos los proyectos del terreno)</span>
    </div>
```

- [ ] **Step 4: Add `capexBase`/`capexTotal` to the `proyectos` computed**

Find:

```ts
const proyectos = computed(() => {
  return store.proyectoNombres.map(nombre => {
    const results = store.perProjectResults[nombre] ?? []
    const aggregated = aggregateCosts(results, {
      baseCapex: store.baseCapex,
      kWp: store.kWp,
      projectCount: Math.max(store.proyectoNombres.length, 1),
    })
    const fijoItems = aggregated.breakdown.filter(
      r => (r.category === 'fijo' || r.category === 'ambas') && r.formulaDefined && r.sobrecosto !== 0,
    )
    // Solo el monto en pesos, sin traducir a meses — servidumbre/amenazas (riskType
    // 'meses') divididos entre proyectos pueden dar meses fraccionarios (spec: mostrar
    // solo el monto en el desglose por proyecto).
    const riesgoItems = aggregated.breakdown.filter(
      r => r.category === 'probabilidad' && r.formulaDefined && r.sobrecosto > 0,
    )
    return {
      nombre,
      fijoItems,
      riesgoItems,
      costosFijos: aggregated.totalSobrecostoFijo,
      riesgoMonto: aggregated.totalRetraso + aggregated.totalRiesgoCosto,
      vpn: store.perProjectFinancials?.[nombre]?.vpn ?? null,
      vpnConBeneficios: store.perProjectFinancials?.[nombre]?.vpnConBeneficios ?? null,
    }
  })
})
```

Replace with:

```ts
const proyectos = computed(() => {
  const n = Math.max(store.proyectoNombres.length, 1)
  return store.proyectoNombres.map(nombre => {
    const results = store.perProjectResults[nombre] ?? []
    const aggregated = aggregateCosts(results, {
      baseCapex: store.baseCapex,
      kWp: store.kWp,
      projectCount: n,
    })
    const fijoItems = aggregated.breakdown.filter(
      r => (r.category === 'fijo' || r.category === 'ambas') && r.formulaDefined && r.sobrecosto !== 0,
    )
    // Solo el monto en pesos, sin traducir a meses — servidumbre/amenazas (riskType
    // 'meses') divididos entre proyectos pueden dar meses fraccionarios (spec: mostrar
    // solo el monto en el desglose por proyecto).
    const riesgoItems = aggregated.breakdown.filter(
      r => r.category === 'probabilidad' && r.formulaDefined && r.sobrecosto > 0,
    )
    const capexBase = store.baseCapex / n
    return {
      nombre,
      fijoItems,
      riesgoItems,
      costosFijos: aggregated.totalSobrecostoFijo,
      capexBase,
      capexTotal: capexBase + aggregated.totalSobrecostoFijo,
      riesgoMonto: aggregated.totalRetraso + aggregated.totalRiesgoCosto,
      vpn: store.perProjectFinancials?.[nombre]?.vpn ?? null,
      vpnConBeneficios: store.perProjectFinancials?.[nombre]?.vpnConBeneficios ?? null,
    }
  })
})
```

- [ ] **Step 5: Render "CAPEX base"/"CAPEX total" inside each project card**

Find:

```html
        <div class="breakdown-row breakdown-row--subtotal">
          <span class="breakdown-label">Fijos</span>
          <span class="breakdown-value">{{ formatCOP(p.costosFijos) }}</span>
        </div>

        <template v-if="p.riesgoItems.length > 0">
```

Replace with:

```html
        <div class="breakdown-row breakdown-row--subtotal">
          <span class="breakdown-label">Fijos</span>
          <span class="breakdown-value">{{ formatCOP(p.costosFijos) }}</span>
        </div>

        <div class="breakdown-row">
          <span class="breakdown-label">CAPEX base</span>
          <span class="breakdown-value">{{ formatCOP(p.capexBase) }}</span>
        </div>
        <div class="breakdown-row breakdown-row--total">
          <span class="breakdown-label">CAPEX total</span>
          <span class="breakdown-value">{{ formatCOP(p.capexTotal) }}</span>
        </div>

        <template v-if="p.riesgoItems.length > 0">
```

- [ ] **Step 6: Add CSS for the terrain-totals row**

Find the closing `</style>` tag. Immediately before it, insert:

```css

.breakdown-terreno-totals {
  display: flex;
  gap: 1.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.3rem;
}
.breakdown-terreno-item { display: flex; flex-direction: column; gap: 0.1rem; }
.breakdown-terreno-label { font-size: 0.7rem; color: var(--muted); font-weight: 600; }
.breakdown-terreno-value { font-size: 1rem; font-weight: 800; color: var(--purple); }
.breakdown-terreno-value--riesgo { color: var(--warn); }
```

- [ ] **Step 7: Type-check**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly 1 error — `vite.config.ts(13,3)` (pre-existing, unrelated). No errors referencing `SummaryPanel` anywhere (confirms the deletion left no dangling import/reference).

- [ ] **Step 8: Verify against the running dev server**

This repo has no automated `.vue` component tests. Verify by code trace against real data, and by browser if available:

1. Ensure the backend dev server is running (`http://127.0.0.1:5000`) and the frontend dev server is running (`http://localhost:5173`) — restart either if needed (`cd backend && ./venv/Scripts/python.exe run.py`, `cd frontend && npm run dev`).
2. `curl -s http://127.0.0.1:5000/api/terrain/COLBOYT147` — confirm the API response is unchanged by this plan (this plan touches only frontend rendering).
3. If you have a live browser available: search `COLBOYT147` in the app. Confirm:
   - The general "Resumen de costos" sidebar is gone — only "Resultados financieros" remains on the right.
   - The top "Desglose por proyecto" panel now shows "CAPEX Total del terreno" and (if applicable) "Riesgo de retraso" above the TIR/Payback note.
   - Each project card shows "CAPEX base" and "CAPEX total" rows after the "Fijos" subtotal, before the risk section.
4. If no browser-driving tool is available, state plainly in your report that this step needs human verification — do not guess at the visual outcome.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/views/EvaluadorView.vue frontend/src/components/ProjectBreakdownPanel.vue
git commit -m "feat: remove general cost summary sidebar, add self-sufficient per-project CAPEX"
```

(The deletion of `SummaryPanel.vue` from Step 1's `git rm` is already staged — this commit includes it automatically.)

---
