# Obras hidráulicas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the qualitative `obras_hidraulicas` placeholder criterion (Ninguna/Baja/Media/Alta select that never adds cost) with a real checklist of 4 hydraulic work types, each with its own manual quantity and cost formula, combinable within one terrain.

**Architecture:** One `CriterionModule` (`obras_hidraulicas`) with a new `inputType: 'checklist'`. Its `CriterionValue` is a compound object (`ObrasHidraulicasValue`) instead of a scalar — a targeted, single-criterion exception to the "one criterion = one scalar" pattern, following the same precedent `CriterionCard.vue` already uses for per-id detail rendering (`coexistencias`, `servidumbre`, etc.). No changes to `evaluatorEngine.ts`, `evaluatorStore.ts`, or `EvaluadorView.vue` — all three are already generic enough to handle this criterion unmodified.

**Tech Stack:** Vue 3 + TypeScript (frontend only), Vitest for unit tests. Reference spec: `docs/superpowers/specs/2026-07-09-obras-hidraulicas-design.md`.

## Global Constraints

- This is a frontend-only change (`frontend/src/...`). No backend, no DB, no new network calls.
- All 4 work-type quantities are always manual (`dataSource: 'manual'`) — no DB field exists for any of them.
- Category for the whole criterion is `'fijo'` — contributes to `aggregated.capexTotal`, not to the risk/probability bucket.
- Rates (exact, do not round): Canal en concreto = $1.300.000/m · Cuneta típica de vía = $300.000/m · Box culvert = $170.000.000/cruce · Alcantarilla = $50.000.000/cruce.
- Follow existing project conventions: `.vue` components in this repo have no automated unit tests (verified: no file imports `@vue/test-utils` despite it being a devDependency) — verify UI changes manually against the running dev server, not by adding new component-test infrastructure.
- Test command: `npx vitest run` (run from `frontend/`). Type-check command: `npx vue-tsc -b` (run from `frontend/`) — expect exactly 2 pre-existing unrelated errors (`evaluatorEngine.test.ts` unused `@ts-expect-error`, `vite.config.ts` overload mismatch); no new errors should appear.

---

### Task 1: `obras_hidraulicas` types + criterion module + unit tests

**Files:**
- Modify: `frontend/src/types/index.ts:1` (widen `CriterionValue`, add new interfaces), `frontend/src/types/index.ts:41-53` (extend `CriterionModule`)
- Modify: `frontend/src/criteria/obras_hidraulicas.ts` (full rewrite)
- Modify: `frontend/src/criteria/__tests__/criteria.test.ts` (add tests, add import)

**Interfaces:**
- Produces (used by Task 2): `ObraHidraulicaItem { activo: boolean; cantidad: number | null }`, `ObrasHidraulicasValue { canal_concreto: ObraHidraulicaItem; cuneta_via: ObraHidraulicaItem; box_culvert: ObraHidraulicaItem; alcantarilla_cruce: ObraHidraulicaItem }`, `ChecklistItemDef { key: string; label: string; unit: string; group: 'metro' | 'fijo'; groupLabel: string; tarifa: number }`, all exported from `@/types`.
- Produces (used by Task 2): `CriterionModule.checklistItems?: ChecklistItemDef[]` — populated on the `obras_hidraulicas` module with the 4 item definitions, in this exact order: `canal_concreto`, `cuneta_via`, `box_culvert`, `alcantarilla_cruce`.

- [ ] **Step 1: Update `frontend/src/types/index.ts` — widen `CriterionValue` and add new interfaces**

Replace line 1 (`export type CriterionValue = number | boolean | string | null`) with:

```ts
export interface ObraHidraulicaItem {
  activo: boolean
  cantidad: number | null
}

export interface ObrasHidraulicasValue {
  canal_concreto: ObraHidraulicaItem
  cuneta_via: ObraHidraulicaItem
  box_culvert: ObraHidraulicaItem
  alcantarilla_cruce: ObraHidraulicaItem
}

export type CriterionValue = number | boolean | string | null | ObrasHidraulicasValue
```

- [ ] **Step 2: Update `CriterionModule` interface — add `ChecklistItemDef` and `checklistItems`**

Find this block (currently lines 41-53):

```ts
export interface CriterionModule {
  id: string
  label: string
  inputType: 'number' | 'toggle' | 'select'
  unit?: string
  dataSource: 'manual' | 'db' | 'db_or_manual'
  dbField?: string
  options?: SelectOption[]
  formulaDefined: boolean
  category: CriterionCategory
  riskType?: RiskType
  computeCost: (value: CriterionValue, context: EvalContext) => number
}
```

Replace it with:

```ts
export interface ChecklistItemDef {
  key: string
  label: string
  unit: string
  group: 'metro' | 'fijo'
  groupLabel: string
  tarifa: number
}

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

- [ ] **Step 3: Write the failing tests in `frontend/src/criteria/__tests__/criteria.test.ts`**

Add this import at the top of the file, alongside the other criterion imports (after line 11, `import distanciaVia from '../distancia_via'`):

```ts
import obrasHidraulicas from '../obras_hidraulicas'
```

Append this `describe` block at the end of the file (after the closing `})` of the `distancia_via` describe block):

```ts

describe('obras_hidraulicas', () => {
  const vacio = {
    canal_concreto: { activo: false, cantidad: null },
    cuneta_via: { activo: false, cantidad: null },
    box_culvert: { activo: false, cantidad: null },
    alcantarilla_cruce: { activo: false, cantidad: null },
  }

  it('calcula 40m de canal en concreto a 1.300.000/m', () => {
    const value = { ...vacio, canal_concreto: { activo: true, cantidad: 40 } }
    expect(obrasHidraulicas.computeCost(value, ctx)).toBe(52_000_000)
  })

  it('suma varios tipos activos (canal + box culvert)', () => {
    const value = {
      ...vacio,
      canal_concreto: { activo: true, cantidad: 40 },
      box_culvert: { activo: true, cantidad: 1 },
    }
    expect(obrasHidraulicas.computeCost(value, ctx)).toBe(52_000_000 + 170_000_000)
  })

  it('ignora la cantidad de un ítem no activo', () => {
    const value = { ...vacio, alcantarilla_cruce: { activo: false, cantidad: 3 } }
    expect(obrasHidraulicas.computeCost(value, ctx)).toBe(0)
  })

  it('retorna 0 para valor nulo', () => {
    expect(obrasHidraulicas.computeCost(null, ctx)).toBe(0)
  })

  it('tiene formulaDefined true y category fijo', () => {
    expect(obrasHidraulicas.formulaDefined).toBe(true)
    expect(obrasHidraulicas.category).toBe('fijo')
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/criteria/__tests__/criteria.test.ts`

Expected: FAIL — the `obras_hidraulicas` tests fail because the current module always returns `0` from `computeCost` regardless of input (it's still the qualitative placeholder), so the "40m de canal" and "suma varios tipos" assertions fail (expected `52_000_000`, got `0`).

- [ ] **Step 5: Rewrite `frontend/src/criteria/obras_hidraulicas.ts`**

Replace the entire file content with:

```ts
import type { ChecklistItemDef, CriterionModule, CriterionValue, EvalContext, ObrasHidraulicasValue } from '@/types'

const ITEMS: ChecklistItemDef[] = [
  { key: 'canal_concreto', label: 'Canal en concreto (2m x 0.5m)', unit: 'm', group: 'metro', groupLabel: 'Costo por metro lineal', tarifa: 1_300_000 },
  { key: 'cuneta_via', label: 'Cuneta típica de vía', unit: 'm', group: 'metro', groupLabel: 'Costo por metro lineal', tarifa: 300_000 },
  { key: 'box_culvert', label: 'Box culvert (3m x 3m)', unit: 'cruces', group: 'fijo', groupLabel: 'Costo fijo por cruce', tarifa: 170_000_000 },
  { key: 'alcantarilla_cruce', label: 'Alcantarilla (Ø0.9m)', unit: 'cruces', group: 'fijo', groupLabel: 'Costo fijo por cruce', tarifa: 50_000_000 },
]

const obrasHidraulicas: CriterionModule = {
  id: 'obras_hidraulicas',
  label: 'Obras hidráulicas',
  inputType: 'checklist',
  dataSource: 'manual',
  formulaDefined: true,
  category: 'fijo',
  checklistItems: ITEMS,
  computeCost(value: CriterionValue, _context: EvalContext): number {
    if (!value || typeof value !== 'object') return 0
    const v = value as ObrasHidraulicasValue
    return ITEMS.reduce((total, item) => {
      const entry = v[item.key as keyof ObrasHidraulicasValue]
      if (!entry?.activo || typeof entry.cantidad !== 'number') return total
      return total + entry.cantidad * item.tarifa
    }, 0)
  },
}

export default obrasHidraulicas
```

- [ ] **Step 6: Run tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/criteria/__tests__/criteria.test.ts`

Expected: PASS — all tests in the file pass, including the 5 new `obras_hidraulicas` tests.

- [ ] **Step 7: Run the full test suite and type-check**

Run (from `frontend/`): `npx vitest run`
Expected: all test files pass (no regressions in other criteria/engine/store tests).

Run (from `frontend/`): `npx vue-tsc -b`
Expected: exactly the 2 pre-existing unrelated errors listed in Global Constraints — no new errors referencing `obras_hidraulicas.ts` or `types/index.ts`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/criteria/obras_hidraulicas.ts frontend/src/criteria/__tests__/criteria.test.ts
git commit -m "feat: replace obras_hidraulicas placeholder with real checklist formula"
```

---

### Task 2: Checklist UI in `CriterionCard.vue`

**Files:**
- Modify: `frontend/src/components/CriterionCard.vue:5` (import types), `:10-16` (add computeds/helpers after `accentColor`), `:66-77` (add dynamic class to `.card-input`), `:103-116` (add checklist template branch), `:293-294` (add checklist CSS)

**Interfaces:**
- Consumes: `ObrasHidraulicasValue`, `ObraHidraulicaItem` from `@/types` (Task 1). `CriterionModule.checklistItems: ChecklistItemDef[]` (Task 1) via the existing `module` computed (`CriterionCard.vue:10`).
- Consumes: `store.setCriterionValue(id: string, value: CriterionValue): void` (existing, unchanged, `evaluatorStore.ts:68`).

- [ ] **Step 1: Update the type import**

Find (line 5):

```ts
import type { CriterionResult } from '@/types'
```

Replace with:

```ts
import type { CriterionResult, ObrasHidraulicasValue, ObraHidraulicaItem } from '@/types'
```

- [ ] **Step 2: Add checklist computeds and event handlers**

Find this block (lines 12-16):

```ts
const accentColor = computed(() => {
  if (!props.result.formulaDefined) return '#ea580c'
  if (props.result.value !== null) return 'var(--purple)'
  return 'var(--border)'
})
```

Immediately after it (before `function formatCOP`), insert:

```ts

const EMPTY_OBRAS_HIDRAULICAS: ObrasHidraulicasValue = {
  canal_concreto: { activo: false, cantidad: null },
  cuneta_via: { activo: false, cantidad: null },
  box_culvert: { activo: false, cantidad: null },
  alcantarilla_cruce: { activo: false, cantidad: null },
}

const checklistValue = computed<ObrasHidraulicasValue>(() => {
  const v = props.result.value
  return (v && typeof v === 'object') ? v as ObrasHidraulicasValue : EMPTY_OBRAS_HIDRAULICAS
})

function checklistItem(key: string): ObraHidraulicaItem {
  return checklistValue.value[key as keyof ObrasHidraulicasValue]
}

const checklistGroups = computed(() => {
  const items = module.value?.checklistItems ?? []
  const order: string[] = []
  const groups = new Map<string, { groupLabel: string; items: typeof items }>()
  for (const item of items) {
    if (!groups.has(item.group)) {
      groups.set(item.group, { groupLabel: item.groupLabel, items: [] })
      order.push(item.group)
    }
    groups.get(item.group)!.items.push(item)
  }
  return order.map(key => groups.get(key)!)
})

function handleChecklistToggle(key: string, event: Event) {
  const target = event.target as HTMLInputElement
  const updated = { ...checklistValue.value, [key]: { ...checklistItem(key), activo: target.checked } } as ObrasHidraulicasValue
  store.setCriterionValue(props.result.id, updated)
}

function handleChecklistCantidad(key: string, event: Event) {
  const target = event.target as HTMLInputElement
  const raw = target.value
  const updated = { ...checklistValue.value, [key]: { ...checklistItem(key), cantidad: raw === '' ? null : Number(raw) } } as ObrasHidraulicasValue
  store.setCriterionValue(props.result.id, updated)
}
```

- [ ] **Step 3: Give `.card-input` a dynamic modifier class**

Find (line 77):

```html
    <div class="card-input">
```

Replace with:

```html
    <div class="card-input" :class="{ 'card-input--checklist': module?.inputType === 'checklist' }">
```

- [ ] **Step 4: Add the checklist template branch**

Find this block (lines 103-115, the `select` branch, ending right before the closing `</div>` of `.card-input` at line 116):

```html
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
```

Replace with (adds the new branch before the closing `</div>`):

```html
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

      <template v-else-if="module?.inputType === 'checklist'">
        <div class="checklist-groups">
          <div v-for="group in checklistGroups" :key="group.groupLabel" class="checklist-group">
            <span class="checklist-group-label">{{ group.groupLabel }}</span>
            <div v-for="item in group.items" :key="item.key" class="checklist-item">
              <label class="checklist-item-label">
                <input
                  type="checkbox"
                  :checked="checklistItem(item.key).activo"
                  class="toggle-checkbox"
                  @change="handleChecklistToggle(item.key, $event)"
                />
                <span>{{ item.label }}</span>
              </label>
              <div v-if="checklistItem(item.key).activo" class="checklist-item-cantidad">
                <input
                  type="number"
                  :value="checklistItem(item.key).cantidad ?? ''"
                  :placeholder="`0 ${item.unit}`"
                  class="input-field input-field--small"
                  @input="handleChecklistCantidad(item.key, $event)"
                />
                <span class="input-unit">{{ item.unit }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
```

- [ ] **Step 5: Add checklist CSS**

Find (line 294):

```css
.input-unit { font-size: 0.78rem; color: var(--muted); white-space: nowrap; }
```

Immediately after it, insert:

```css

.card-input--checklist { flex-direction: column; align-items: stretch; }

.checklist-groups { display: flex; flex-direction: column; gap: 0.75rem; width: 100%; }
.checklist-group { display: flex; flex-direction: column; gap: 0.4rem; }
.checklist-group-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--muted);
}
.checklist-item { display: flex; flex-direction: column; gap: 0.35rem; }
.checklist-item-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--text);
}
.checklist-item-cantidad { display: flex; align-items: center; gap: 0.5rem; padding-left: 1.6rem; }
.input-field--small { padding: 0.35rem 0.6rem; font-size: 0.8rem; }
```

- [ ] **Step 6: Manual verification against the running dev server**

This project has no automated tests for `.vue` components (only `criteria/`, `engine/`, and `stores/` have `__tests__`), so verify by driving the actual UI, per this repo's established convention.

1. Ensure the backend (`http://127.0.0.1:5000`) and frontend (`http://127.0.0.1:5173`) dev servers are running.
2. Open `http://127.0.0.1:5173` in a browser, search a terrain code (e.g. `COLCEST5`).
3. Find the "Obras hidráulicas" card. Confirm it shows two group labels ("Costo por metro lineal" and "Costo fijo por cruce") each with their items, and no "Pendiente" badge (since `formulaDefined` is now `true`).
4. Check "Canal en concreto (2m x 0.5m)" — confirm a quantity field appears. Enter `40`. Confirm the card's "Sobrecosto" shows `$52.000.000` and the `SummaryPanel`/CAPEX total increases by the same amount.
5. Also check "Box culvert (3m x 3m)" and enter `1`. Confirm the card's total sobrecosto is now `$52.000.000 + $170.000.000 = $222.000.000`, and CAPEX total reflects the combined increase.
6. Uncheck "Canal en concreto" (leave the `40` in the field). Confirm the sobrecosto drops back to `$170.000.000` (the canal quantity is ignored while unchecked, per spec).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/CriterionCard.vue
git commit -m "feat: add grouped checklist UI for obras_hidraulicas criterion"
```
