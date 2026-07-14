### Task 5: UI — `CriterionCard.vue` per-project rows for scope `proyecto`

**Files:**
- Modify: `frontend/src/components/CriterionCard.vue`

**Interfaces:**
- Consumes: `store.perProjectValues`, `store.proyectoNombres`, `store.perProjectResults` (Task 4), `store.setPilotesForProyecto` (Task 4), `loadCriteria()` (existing, now returns modules with `.scope`).

- [ ] **Step 1: Remove now-invalid detail blocks referencing deleted `TerrainData` fields**

Find the `aprovechamientoDetalle` computed (search for `result.id !== 'aprovechamiento_forestal'` in the file) and its corresponding template block (search for `result.id === 'aprovechamiento_forestal'` in the `<template>`). Delete both the computed and its template block — `aprovechamiento_forestal_detalle` no longer exists on `TerrainData`; this criterion's detail now comes from the new scope-`proyecto` row rendering added in Step 3.

- [ ] **Step 2: Fix `accentColor` for scope-`proyecto` criteria**

`evaluateScoped` (Task 3) always sets `value: null` on the general result for scope-`proyecto` criteria, even when real per-project data exists (there's no single representative value at the terrain level — see Task 3's rationale). Left unfixed, `accentColor`'s existing `props.result.value !== null` check would make these 6 cards always render as "empty" (gray border) even when their per-project rows have real data. Check `store.perProjectResults` instead for this branch.

Find:

```ts
const accentColor = computed(() => {
  if (!props.result.formulaDefined) return '#ea580c'
  if (props.result.value !== null) return 'var(--purple)'
  return 'var(--border)'
})
```

Replace with:

```ts
const accentColor = computed(() => {
  if (!props.result.formulaDefined) return '#ea580c'
  if (module.value?.scope === 'proyecto') {
    const results = store.perProjectResults
    const tieneDatos = store.proyectoNombres.some(
      nombre => results[nombre]?.find(r => r.id === props.result.id)?.value !== null,
    )
    return tieneDatos ? 'var(--purple)' : 'var(--border)'
  }
  if (props.result.value !== null) return 'var(--purple)'
  return 'var(--border)'
})
```

- [ ] **Step 3: Add per-project computeds and handlers**

Find the `checklistItem` function and the block right after it (the `checklistGroups` computed, ending right before `function handleChecklistToggle`). Immediately after `checklistGroups`'s closing `})`, insert:

```ts

const isProyectoScope = computed(() => module.value?.scope === 'proyecto')

const proyectoRows = computed(() => {
  if (!isProyectoScope.value) return []
  const results = store.perProjectResults
  return store.proyectoNombres.map(nombre => {
    const result = results[nombre]?.find(r => r.id === props.result.id)
    return {
      nombre,
      value: result?.value ?? null,
      sobrecosto: result?.sobrecosto ?? 0,
    }
  })
})

const proyectoTotal = computed(() => proyectoRows.value.reduce((acc, row) => acc + row.sobrecosto, 0))

function handlePilotesToggle(nombre: string, event: Event) {
  const target = event.target as HTMLInputElement
  store.setPilotesForProyecto(nombre, target.checked)
}
```

- [ ] **Step 4: Add the per-project template branch**

Find the `.card-input` closing `</div>` (the one right after the `checklist` `v-else-if` template block ends). Immediately before that closing `</div>`, insert a new `v-else-if` branch:

```html
      <template v-else-if="isProyectoScope && result.id !== 'pilotes'">
        <div class="proyecto-rows">
          <div v-for="row in proyectoRows" :key="row.nombre" class="proyecto-row">
            <span class="proyecto-row-nombre">{{ row.nombre }}</span>
            <span class="proyecto-row-valor">{{ row.value ?? '—' }}{{ module?.unit ? ` ${module.unit}` : '' }}</span>
            <span class="proyecto-row-sobrecosto">{{ formatCOP(row.sobrecosto) }}</span>
          </div>
          <div class="proyecto-row proyecto-row--total">
            <span class="proyecto-row-nombre">Total</span>
            <span class="proyecto-row-sobrecosto">{{ formatCOP(proyectoTotal) }}</span>
          </div>
        </div>
      </template>

      <template v-else-if="isProyectoScope && result.id === 'pilotes'">
        <div class="proyecto-rows">
          <div v-for="nombre in store.proyectoNombres" :key="nombre" class="proyecto-row">
            <label class="toggle-label">
              <input
                type="checkbox"
                :checked="store.perProjectValues.pilotes?.[nombre] === true"
                class="toggle-checkbox"
                @change="handlePilotesToggle(nombre, $event)"
              />
              <span>{{ nombre }}</span>
            </label>
          </div>
        </div>
      </template>
```

- [ ] **Step 5: Hide the generic bottom cost row for scope-`proyecto` criteria**

Find the `<!-- Criterio fijo: muestra COP -->` template block (the `<div class="card-cost" v-if="result.formulaDefined && result.category !== 'probabilidad'">`). Change its `v-if` to also exclude scope-`proyecto` criteria (their own total is already shown inside `proyecto-rows` from Step 3):

Find:

```html
    <div class="card-cost" v-if="result.formulaDefined && result.category !== 'probabilidad'">
```

Replace with:

```html
    <div class="card-cost" v-if="result.formulaDefined && result.category !== 'probabilidad' && !isProyectoScope">
```

- [ ] **Step 6: Add CSS for the per-project rows**

Find the closing `</style>` tag. Immediately before it, insert:

```css

.proyecto-rows { display: flex; flex-direction: column; gap: 0.4rem; width: 100%; }
.proyecto-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
}
.proyecto-row-nombre { color: var(--text-mid); flex: 1; }
.proyecto-row-valor { color: var(--text); font-weight: 600; white-space: nowrap; }
.proyecto-row-sobrecosto { color: var(--purple); font-weight: 700; white-space: nowrap; }
.proyecto-row--total {
  border-top: 1px dashed var(--border);
  padding-top: 0.4rem;
  margin-top: 0.2rem;
  font-weight: 700;
}
```

- [ ] **Step 7: Type-check**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly the 2 pre-existing errors — no new errors in `CriterionCard.vue`.

- [ ] **Step 8: Manual verification against the running dev server**

This repo has no automated tests for `.vue` components (see prior features' plans) and no browser-automation tool is available — verify by code trace and, if you have a live browser available to you, by driving the app; otherwise state plainly in your report that this step needs human verification.

1. Restart backend + frontend dev servers if not already running.
2. Search terrain `COLSANT5` (2 projects).
3. Confirm the "Número de árboles" card shows two rows (P1: 2 árboles, P2: 0 árboles) each with its own sobrecosto, plus a Total row.
4. Confirm "Pilotes" card shows two checkboxes (one per project name) instead of a single toggle.
5. Confirm "Corte"/"Lleno" cards are UNCHANGED (single input, single sobrecosto — scope `terreno_dividido` criteria don't touch `CriterionCard.vue` in this task).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/CriterionCard.vue
git commit -m "feat: render per-project rows for scope-proyecto criteria in CriterionCard"
```

---

