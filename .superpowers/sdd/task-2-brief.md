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
