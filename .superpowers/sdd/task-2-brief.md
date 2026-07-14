### Task 2: Frontend types — `CriterionScope`, `ProyectoData`, `EvalContext.projectCount`

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: all 18 files in `frontend/src/criteria/*.ts` (add `scope` field)
- Modify: `frontend/src/engine/__tests__/evaluatorEngine.test.ts` (add scope coverage test)

**Interfaces:**
- Consumes: nothing from Task 1 directly (this is a pure frontend type change; Task 4 wires the new `proyectos` field into the store).
- Produces (used by Task 3, Task 4): `CriterionScope` type, `ProyectoData` interface, `CriterionModule.scope: CriterionScope` (now required on every module), `EvalContext.projectCount: number`.

- [ ] **Step 1: Update `frontend/src/types/index.ts`**

Find (line 1):

```ts
export interface ObraHidraulicaItem {
```

Insert immediately before it:

```ts
export type CriterionScope = 'proyecto' | 'terreno_dividido' | 'terreno_multiplicado' | 'terreno_no_dividido'

export interface ProyectoData {
  nombre: string
  distancia_via: number | null
  distancia_red: number | null
  aprovechamiento_forestal: string | null
  numero_arboles: number | null
  tipo_estructura: string | null
}

```

Find (lines 15-18):

```ts
export interface EvalContext {
  baseCapex: number
  kWp: number
}
```

Replace with:

```ts
export interface EvalContext {
  baseCapex: number
  kWp: number
  projectCount?: number
}
```

`projectCount` is optional so this change alone does not break type-checking on files this task doesn't touch: `evaluatorStore.ts`'s existing `context` computed (not updated until Task 4) and the pre-existing `ctx` test fixtures in `criteria.test.ts`/`evaluatorEngine.test.ts` (which never set it, since none of the 18 `computeCost` formulas read it) all keep compiling unchanged. `evaluateScoped` (Task 3) is the only place that reads `projectCount`, and it defaults to `1` when absent.

Find (lines 62-75):

```ts
export interface CriterionModule {
  id: string
  label: string
  inputType: 'number' | 'toggle' | 'select' | 'checklist'
  unit?: string
  dataSource: 'manual' | 'db' | 'db_or_manual'
  dbField?: string
  options?: SelectOption[]
  formulaDefined: boolean
  category: CriterionCategory
  riskType?: RiskType
  checklistItems?: ChecklistItemDef[]
  computeCost: (value: CriterionValue, context: EvalContext) => number
}
```

Replace with:

```ts
export interface CriterionModule {
  id: string
  label: string
  inputType: 'number' | 'toggle' | 'select' | 'checklist'
  unit?: string
  dataSource: 'manual' | 'db' | 'db_or_manual'
  dbField?: string
  options?: SelectOption[]
  formulaDefined: boolean
  category: CriterionCategory
  riskType?: RiskType
  scope: CriterionScope
  checklistItems?: ChecklistItemDef[]
  computeCost: (value: CriterionValue, context: EvalContext) => number
}
```

Find (lines 77-98):

```ts
export interface TerrainData {
  code: string
  name: string
  municipality: string
  distancia_via: number | null
  distancia_red: number | null
  or: string | null
  nivel_tension: string | null
  cluster: number | null
  tipo_estructura: string | null
  ocupacion_cauce: boolean | null
  ocupacion_cauce_detalle: string | null
  servidumbre: number | null
  servidumbre_detalle: EstadoDetalle | null
  aprovechamiento_forestal: string | null
  aprovechamiento_forestal_detalle: ProyectoEstadoDetalle[] | null
  coexistencias: boolean | null
  coexistencias_detalle: CoexistenciaDetalle[] | null
  numero_arboles: number | null
  produccion_especifica: number | null
  arriendo_anual: number | null
}
```

Replace with:

```ts
export interface TerrainData {
  code: string
  name: string
  municipality: string
  or: string | null
  nivel_tension: string | null
  cluster: number | null
  ocupacion_cauce: boolean | null
  ocupacion_cauce_detalle: string | null
  servidumbre: number | null
  servidumbre_detalle: EstadoDetalle | null
  coexistencias: boolean | null
  coexistencias_detalle: CoexistenciaDetalle[] | null
  produccion_especifica: number | null
  arriendo_anual: number | null
  proyectos: ProyectoData[]
}
```

Find (lines 105-108):

```ts
export interface ProyectoEstadoDetalle {
  proyecto: string
  estado: string
}
```

Delete this block entirely (no longer used — `aprovechamiento_forestal_detalle` is gone, replaced by `ProyectoData.aprovechamiento_forestal`).

- [ ] **Step 2: Add `scope` to each of the 18 criteria modules**

For each file below, find the `formulaDefined:` or `category:` line shown and add a `scope:` line immediately after `category:` (matching the existing code style, one line, no trailing comma changes needed since TS/the existing files already end object properties with commas throughout).

`frontend/src/criteria/distancia_via.ts` — find `category: 'fijo',` → add after it:
```ts
  scope: 'proyecto',
```

`frontend/src/criteria/distancia_red.ts` — same: find `category: 'fijo',` → add `scope: 'proyecto',` after.

`frontend/src/criteria/numero_arboles.ts` — find `category: 'fijo',` → add `scope: 'proyecto',` after.

`frontend/src/criteria/aprovechamiento_forestal.ts` — find `category: 'fijo',` → add `scope: 'proyecto',` after.

`frontend/src/criteria/pilotes.ts` — find `category: 'fijo',` → add `scope: 'proyecto',` after.

`frontend/src/criteria/tipo_estructura.ts` — find `category: 'probabilidad',` → add `scope: 'proyecto',` after.

`frontend/src/criteria/corte.ts` — find `category: 'fijo',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/lleno.ts` — find `category: 'fijo',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/obras_hidraulicas.ts` — find `category: 'fijo',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/ocupacion_cauce.ts` — find `category: 'fijo',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/coexistencias.ts` — find `category: 'probabilidad',` (immediately followed by `riskType: 'costo',`) → add `scope: 'terreno_dividido',` after `riskType: 'costo',`.

`frontend/src/criteria/comunidad.ts` — find `category: 'probabilidad',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/or.ts` — find `category: 'probabilidad',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/propietario.ts` — find `category: 'probabilidad',` (immediately followed by `riskType: 'costo',`) → add `scope: 'terreno_dividido',` after `riskType: 'costo',`.

`frontend/src/criteria/servidumbre.ts` — find `category: 'probabilidad',` (immediately followed by `riskType: 'meses',`) → add `scope: 'terreno_dividido',` after `riskType: 'meses',`.

`frontend/src/criteria/amenazas.ts` — find `category: 'probabilidad',` (immediately followed by `riskType: 'meses',`) → add `scope: 'terreno_dividido',` after `riskType: 'meses',`.

`frontend/src/criteria/nivel_tension.ts` — find `category: 'fijo',` → add `scope: 'terreno_multiplicado',` after.

`frontend/src/criteria/cluster.ts` — find `category: 'fijo',` → add `scope: 'terreno_no_dividido',` after.

- [ ] **Step 2b: Verify every file was updated**

Run (from `frontend/`):

```bash
grep -L "scope:" src/criteria/*.ts
```

Expected: no output (every criteria file except files in `__tests__/` now contains `scope:`). If any filename prints, that file was missed — go back and add its `scope:` line.

- [ ] **Step 3: Write the failing test for scope coverage**

Add this to `frontend/src/engine/__tests__/evaluatorEngine.test.ts`, inside the existing `describe('loadCriteria', ...)` block (after the `'todos tienen id, label e inputType'` test, before its closing `})`):

```ts
  it('todos tienen un scope válido', () => {
    const criteria = loadCriteria()
    const validScopes = ['proyecto', 'terreno_dividido', 'terreno_multiplicado', 'terreno_no_dividido']
    for (const c of criteria) {
      expect(validScopes).toContain(c.scope)
    }
  })
```

- [ ] **Step 4: Run the test to verify it passes**

This task adds `scope` as a required field on `CriterionModule` (Step 1) and completes it on all 18 criteria (Step 2) before writing this coverage guard (Step 3) — unlike most tasks in this plan, this isn't new runtime logic to drive with a failing test first; it's a schema field every module must carry, and the test exists to catch future criteria that forget it.

Run (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`

Expected: PASS, 11/11 tests (10 existing + 1 new) in this file. If it fails, Step 2 missed a file — recheck with the Step 2b grep command.

- [ ] **Step 5: Run the full frontend suite and type-check**

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass (no regressions).

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly the 2 pre-existing unrelated errors (see Global Constraints) — no new errors. If you see errors referencing `TerrainData`, `ProyectoEstadoDetalle`, or missing `scope`, a criteria file or a consumer of the deleted `TerrainData` fields still needs fixing — this plan's later tasks (Task 4 fixes `evaluatorStore.ts`, Task 5 fixes `CriterionCard.vue`) resolve their remaining references to the removed fields, so at this exact point in the plan you may see NEW errors in those two files referencing `terrainData.distancia_via` etc. If so, that's expected — note it in your report as `DONE_WITH_CONCERNS` rather than trying to fix files outside this task's scope.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/criteria/*.ts frontend/src/engine/__tests__/evaluatorEngine.test.ts
git commit -m "feat: add scope classification to CriterionModule, ProyectoData type"
```

---

