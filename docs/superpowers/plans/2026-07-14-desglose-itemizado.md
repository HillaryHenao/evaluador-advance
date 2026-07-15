# Desglose por proyecto itemizado y reubicado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the "Desglose por proyecto" panel from the bottom of the page to the top (right after the terrain search box) and itemize each project's cost breakdown line-by-line, instead of showing only totals.

**Architecture:** Pure UI change in `frontend/src/components/ProjectBreakdownPanel.vue` (add itemized fijo/riesgo line items per project, reusing `aggregateCosts`'s existing `breakdown` output — already computed there, just not rendered) and `frontend/src/views/EvaluadorView.vue` (move the component's mount point). No backend, type, store, or engine changes — all data needed already exists in `store.perProjectResults`/`store.perProjectFinancials`.

**Tech Stack:** Vue 3 + TypeScript + Pinia.

## Global Constraints

- This repo has **no automated component tests for `.vue` files** (established convention from prior plans) — verification is type-check (`npx vue-tsc -b`) + code trace against the real backend + manual browser check if available, not a test suite.
- For `servidumbre`/`amenazas` (`riskType: 'meses'`) in the per-project view: show **only the COP amount**, never translate to fractional months (already-established rule from `docs/superpowers/specs/2026-07-11-desglose-por-proyecto-design.md`, already implemented via `riesgoMonto` — this plan does not change that number, only adds itemized rows above it using the same `sobrecosto` values).
- TIR/Payback stay shown **once**, above all project cards — no per-project change to this section.
- The sidebar `SummaryPanel.vue` (general terrain-wide summary) does **not** change in this plan.
- Test command: `cd frontend && npx vue-tsc -b` (expect exactly 1 pre-existing unrelated error: `vite.config.ts(13,3)` — `UserConfigExport` overload mismatch. No `.test.ts` files are added or run for this plan — see no-component-tests constraint above).

---

### Task 1: Itemize `ProjectBreakdownPanel.vue` and move it above the criteria sections

**Files:**
- Modify: `frontend/src/components/ProjectBreakdownPanel.vue`
- Modify: `frontend/src/views/EvaluadorView.vue`

**Interfaces:**
- Consumes: `store.perProjectResults: Record<string, CriterionResult[]>`, `store.perProjectFinancials`, `store.proyectoNombres`, `store.financialResults`, `store.baseCapex`, `store.kWp` (all existing, from `evaluatorStore.ts` — unchanged), `aggregateCosts(results: CriterionResult[], context: EvalContext): AggregatedResult` (existing, from `evaluatorEngine.ts` — unchanged; its `AggregatedResult.breakdown` field is literally the `results` array passed in, so filtering it does not require any new engine code).
- Produces: nothing consumed by other tasks — this is the final task of this plan.

- [ ] **Step 1: Add itemized fijo/riesgo line items to `ProjectBreakdownPanel.vue`'s `proyectos` computed**

Read the current file first — it's short (139 lines). Find the `proyectos` computed:

```ts
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
```

Replace with (adds `fijoItems`/`riesgoItems`, filtered from `aggregated.breakdown` with the exact same predicates `SummaryPanel.vue` already uses for its general-terrain `fijoBreakdown`/`retrasoBreakdown`):

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

- [ ] **Step 2: Render the itemized rows in the template**

Find:

```html
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
```

Replace with:

```html
      <div v-for="p in proyectos" :key="p.nombre" class="breakdown-card">
        <div class="breakdown-card-title">{{ p.nombre }}</div>

        <div v-if="p.fijoItems.length === 0" class="breakdown-empty">
          Sin sobrecostos fijos calculados.
        </div>
        <div v-for="item in p.fijoItems" :key="item.id" class="breakdown-item-row">
          <span class="breakdown-item-label">{{ item.label }}</span>
          <span class="breakdown-item-value">{{ formatCOP(item.sobrecosto) }}</span>
        </div>
        <div class="breakdown-row breakdown-row--subtotal">
          <span class="breakdown-label">Fijos</span>
          <span class="breakdown-value">{{ formatCOP(p.costosFijos) }}</span>
        </div>

        <template v-if="p.riesgoItems.length > 0">
          <div class="breakdown-divider" />
          <div v-for="item in p.riesgoItems" :key="item.id" class="breakdown-item-row">
            <span class="breakdown-item-label">{{ item.label }}</span>
            <span class="breakdown-item-value breakdown-item-value--riesgo">{{ formatCOP(item.sobrecosto) }}</span>
          </div>
          <div class="breakdown-row breakdown-row--subtotal">
            <span class="breakdown-label">Riesgo</span>
            <span class="breakdown-value">{{ formatCOP(p.riesgoMonto) }}</span>
          </div>
        </template>

        <div v-if="p.vpn !== null" class="breakdown-row breakdown-row--total">
          <span class="breakdown-label">VPN</span>
          <span class="breakdown-value">{{ formatCOP(p.vpn) }}</span>
        </div>
        <div v-if="p.vpnConBeneficios !== null" class="breakdown-row">
          <span class="breakdown-label">VPN c. beneficios</span>
          <span class="breakdown-value breakdown-value--highlight">{{ formatCOP(p.vpnConBeneficios) }}</span>
        </div>
      </div>
```

- [ ] **Step 3: Add CSS for the itemized rows**

Find the closing `</style>` tag. Immediately before it, insert:

```css

.breakdown-item-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.76rem;
  padding: 0.1rem 0;
}
.breakdown-item-label { color: var(--text-mid); font-weight: 500; }
.breakdown-item-value { color: var(--purple); font-weight: 600; white-space: nowrap; }
.breakdown-item-value--riesgo { color: var(--warn); }

.breakdown-row--subtotal {
  border-top: 1px dashed var(--border);
  margin-top: 0.3rem;
  padding-top: 0.3rem;
  font-weight: 700;
}
.breakdown-row--total {
  border-top: 1px solid var(--border);
  margin-top: 0.4rem;
  padding-top: 0.4rem;
}

.breakdown-empty {
  font-size: 0.72rem;
  color: var(--muted);
  padding: 0.3rem 0;
}

.breakdown-divider { height: 1px; background: var(--border); margin: 0.3rem 0; }
```

- [ ] **Step 4: Move `<ProjectBreakdownPanel />` above the criteria sections in `EvaluadorView.vue`**

Find:

```html
        <div class="criteria-content">
          <section class="criteria-section">
            <div class="section-title">Costos fijos del terreno</div>
```

Replace with:

```html
        <div class="criteria-content">
          <ProjectBreakdownPanel />

          <section class="criteria-section">
            <div class="section-title">Costos fijos del terreno</div>
```

Find (the panel's old mount point, right before the closing `</div>` of `criteria-content`):

```html
          </section>

          <ProjectBreakdownPanel />
        </div>
      </main>
```

Replace with:

```html
          </section>
        </div>
      </main>
```

- [ ] **Step 5: Type-check**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly 1 error — `vite.config.ts(13,3)` (pre-existing, unrelated `UserConfigExport` overload mismatch). No errors in `ProjectBreakdownPanel.vue` or `EvaluadorView.vue`.

- [ ] **Step 6: Verify against the running dev server**

This repo has no automated `.vue` component tests. Verify by code trace against real data, and by browser if available:

1. Ensure the backend dev server is running (`http://127.0.0.1:5000`) and the frontend dev server is running (`http://localhost:5173`) — restart either if needed (`cd backend && ./venv/Scripts/python.exe run.py`, `cd frontend && npm run dev`).
2. `curl -s http://127.0.0.1:5000/api/terrain/COLBOYT147` — confirm the response still has the `proyectos[]` shape used by the store (unchanged by this plan).
3. If you have a live browser available: search `COLBOYT147` in the app. Confirm:
   - "Desglose por proyecto" now appears immediately below the terrain search box, before "Costos fijos del terreno".
   - Each project card lists individual line items (e.g. "Número de árboles", "Corte", "Servidumbre") with their own COP amounts, followed by a "Fijos" subtotal, then (if any) itemized risk rows followed by a "Riesgo" subtotal, then VPN / VPN con beneficios.
   - TIR/Payback still appear once, above the project cards.
   - The old bottom-of-page duplicate section is gone (there is only one "Desglose por proyecto" section now).
4. If no browser-driving tool is available, state plainly in your report that this step needs human verification — do not guess at the visual outcome.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ProjectBreakdownPanel.vue frontend/src/views/EvaluadorView.vue
git commit -m "feat: itemize per-project cost breakdown and move it above the criteria sections"
```

---
