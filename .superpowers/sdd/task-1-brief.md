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

