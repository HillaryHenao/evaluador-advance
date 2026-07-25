### Task 2: Frontend — consume `aprovechamiento_forestal_detalle` in `CriterionCard.vue`

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/components/CriterionCard.vue`
- Modify: `frontend/src/stores/__tests__/evaluatorStore.test.ts`

**Interfaces:**
- Consumes: `ProyectoData.aprovechamiento_forestal_detalle` (Task 1's backend field).
- Produces: nothing consumed by later tasks — Task 3 (cluster) is independent of this one.

- [ ] **Step 1: Add the field to `ProyectoData`**

Find (in `frontend/src/types/index.ts`):

```ts
export interface ProyectoData {
  nombre: string
  distancia_via: number | null
  distancia_red: number | null
  aprovechamiento_forestal: string | null
  numero_arboles: number | null
  tipo_estructura: string | null
  arriendo_anual: number | null
}
```

Replace:

```ts
export interface ProyectoData {
  nombre: string
  distancia_via: number | null
  distancia_red: number | null
  aprovechamiento_forestal: string | null
  aprovechamiento_forestal_detalle: string | null
  numero_arboles: number | null
  tipo_estructura: string | null
  arriendo_anual: number | null
}
```

- [ ] **Step 2: Run the type-check to see the new errors**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: new errors in `frontend/src/stores/__tests__/evaluatorStore.test.ts` — 5 object literals typed as `ProyectoData` are now missing the required `aprovechamiento_forestal_detalle` property.

- [ ] **Step 3: Fix the 5 mock `proyectos` arrays in `evaluatorStore.test.ts`**

Find (top-level `mockTerrain`):

```ts
  proyectos: [
    { nombre: 'Test Proyecto', distancia_via: 120, distancia_red: 350, aprovechamiento_forestal: null, numero_arboles: 5, tipo_estructura: 'Tracker', arriendo_anual: 26275000 },
  ],
```

Replace:

```ts
  proyectos: [
    { nombre: 'Test Proyecto', distancia_via: 120, distancia_red: 350, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 5, tipo_estructura: 'Tracker', arriendo_anual: 26275000 },
  ],
```

Find (inside the `'perProjectValues y perProjectResults'` describe block, first test — `'se autopobla desde terrainData.proyectos al buscar terreno'`):

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: 'visita', numero_arboles: 2, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
```

Replace:

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: 'visita', aprovechamiento_forestal_detalle: 'Visita', numero_arboles: 2, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: 'Exonerado', numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
```

Find (inside the `'perProjectResults refleja la división terreno_dividido entre proyectos'` test):

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
```

Replace:

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 0, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
```

The exact same `proyectos` array (with `distancia_via: null` for both projects) appears **twice** in this file — once in each test inside `describe('perProjectFinancials', ...)`. Apply this same find/replace to **both** occurrences:

Find (appears twice):

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
      ],
```

Replace (both occurrences):

```ts
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
      ],
```

- [ ] **Step 4: Run the type-check and full test suite**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: back to exactly 1 pre-existing error — `vite.config.ts(13,3)`.

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass (86 tests, unchanged — this step only satisfies types, no assertions changed yet).

- [ ] **Step 5: Update `CriterionCard.vue` to show the detail when the criterion's own value is `null`**

Find (the `proyectoRows` computed):

```ts
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
```

Replace:

```ts
function detalleParaProyecto(nombre: string): string | null {
  if (props.result.id !== 'aprovechamiento_forestal') return null
  return store.terrainData?.proyectos.find(p => p.nombre === nombre)?.aprovechamiento_forestal_detalle ?? null
}

const proyectoRows = computed(() => {
  if (!isProyectoScope.value) return []
  const results = store.perProjectResults
  return store.proyectoNombres.map(nombre => {
    const result = results[nombre]?.find(r => r.id === props.result.id)
    return {
      nombre,
      value: result?.value ?? null,
      sobrecosto: result?.sobrecosto ?? 0,
      detalle: detalleParaProyecto(nombre),
    }
  })
})
```

Find (in the `<template>`, the proyecto-rows block):

```html
          <div v-for="row in proyectoRows" :key="row.nombre" class="proyecto-row">
            <span class="proyecto-row-nombre">{{ row.nombre }}</span>
            <span class="proyecto-row-valor">{{ row.value ?? '—' }}{{ module?.unit ? ` ${module.unit}` : '' }}</span>
            <span class="proyecto-row-sobrecosto">{{ formatCOP(row.sobrecosto) }}</span>
          </div>
```

Replace:

```html
          <div v-for="row in proyectoRows" :key="row.nombre" class="proyecto-row">
            <span class="proyecto-row-nombre">{{ row.nombre }}</span>
            <span class="proyecto-row-valor">{{ row.value ?? row.detalle ?? '—' }}{{ module?.unit ? ` ${module.unit}` : '' }}</span>
            <span class="proyecto-row-sobrecosto">{{ formatCOP(row.sobrecosto) }}</span>
          </div>
```

(`row.detalle` is `null` for every criterion except `aprovechamiento_forestal` — for those, this is exactly the same as before. `aprovechamiento_forestal` has no `unit` defined in `criteria/aprovechamiento_forestal.ts`, so the unit suffix stays empty either way — this change only affects the value text itself.)

- [ ] **Step 6: Run the type-check and full test suite again**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly 1 pre-existing error — `vite.config.ts(13,3)`.

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass.

- [ ] **Step 7: Verify against the running dev server**

This repo has no automated `.vue` component tests. Verify by code trace against real data (done — traced above), and by browser if available:

1. Ensure the backend dev server is running (restarted after Task 1) and the frontend dev server is running.
2. Search `COLBOYT147` (2 projects, both with `aprovechamiento_forestal_detalle: "Exonerado"` per Task 1's smoke test).
3. Find the "Aprovechamiento forestal" criterion card. Confirm each project row now shows **"Exonerado"** instead of a blank dash, with its cost column still showing `—` (0, unchanged — this only affects visibility, not cost).
4. If no browser-driving tool is available, state plainly in the report that this step needs human verification — do not guess at the visual outcome.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/CriterionCard.vue frontend/src/stores/__tests__/evaluatorStore.test.ts
git commit -m "feat: show resolved aprovechamiento forestal status (e.g. Exonerado) per project"
```

---

