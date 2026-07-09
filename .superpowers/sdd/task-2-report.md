# Task 2 Report: Checklist UI in CriterionCard.vue

## Summary
Successfully implemented all 5 steps of Task 2: added grouped checklist UI for the `obras_hidraulicas` criterion in `CriterionCard.vue`.

## Implementation Details

### Step 1: Type Import
✓ Updated line 5 to import `ObrasHidraulicasValue` and `ObraHidraulicaItem` from `@/types`

### Step 2: Checklist Computeds and Handlers
✓ Added after `accentColor` computed (lines 18-59):
- `EMPTY_OBRAS_HIDRAULICAS` constant with all 4 correct item keys:
  - `canal_concreto`
  - `cuneta_via`
  - `box_culvert`
  - `alcantarilla_cruce`
- `checklistValue` computed: reads `props.result.value` and falls back to empty state
- `checklistItem(key)` helper: retrieves item data by key
- `checklistGroups` computed: groups items by `item.group`, preserving `groupLabel` and order
- `handleChecklistToggle(key, event)`: updates `activo` property and calls store
- `handleChecklistCantidad(key, event)`: parses quantity, handles empty strings as null

### Step 3: Dynamic Class
✓ Added `:class="{ 'card-input--checklist': module?.inputType === 'checklist' }"` to `.card-input` (line 120)

### Step 4: Checklist Template Branch
✓ Added new template branch (lines 160-187) correctly nested in the v-if/v-else-if chain:
- Loops through `checklistGroups` with correct keys
- Displays group labels (uppercase, muted, with letter-spacing)
- For each item: checkbox input with `@change="handleChecklistToggle(item.key, $event)"`
- Conditional quantity field (appears only when `activo` is true)
- Quantity input with `@input="handleChecklistCantidad(item.key, $event)"`
- Unit label display

### Step 5: CSS Styling
✓ Added 9 CSS rules (lines 368-389):
- `.card-input--checklist`: flex-direction column, align-items stretch
- `.checklist-groups`: flex column with 0.75rem gap, full width
- `.checklist-group`: flex column with 0.4rem gap
- `.checklist-group-label`: 0.68rem, bold, uppercase, 0.6px letter-spacing, muted color
- `.checklist-item`: flex column with 0.35rem gap
- `.checklist-item-label`: flex center, gap 0.5rem, cursor pointer, 0.82rem, text color
- `.checklist-item-cantidad`: flex center, 0.5rem gap, 1.6rem left padding
- `.input-field--small`: reduced padding (0.35rem 0.6rem), reduced font (0.8rem)

## Type Checking Results
```
src/engine/__tests__/evaluatorEngine.test.ts(10,3): error TS2578: Unused '@ts-expect-error' directive.
vite.config.ts(13,3): error TS2769: No overload matches this call.
```
✓ Only 2 pre-existing errors (as expected). No new errors in CriterionCard.vue.

## Test Suite Results
```
Test Files  1 failed | 5 passed (6)
Tests  2 failed | 71 passed (73)
```
✓ 2 pre-existing authStore test failures (unrelated to this task). No regressions introduced by the checklist UI changes.

## Manual Code Trace Verification

### Correctness Checks
1. ✓ All 4 item keys present and correctly spelled in `EMPTY_OBRAS_HIDRAULICAS`
2. ✓ `checklistValue` computed safely handles non-object values
3. ✓ `checklistItem(key)` correctly accesses by key and returns `ObraHidraulicaItem`
4. ✓ `checklistGroups` properly buckets by `item.group` and preserves `groupLabel`
5. ✓ `handleChecklistToggle` correctly updates `activo` property
6. ✓ `handleChecklistCantidad` correctly converts to number/null, ignores quantity when `activo` is false
7. ✓ Dynamic class `.card-input--checklist` applies only when `module?.inputType === 'checklist'`
8. ✓ Template branch correctly nested in v-if/v-else-if chain (after select, before closing div)
9. ✓ Group loop: `v-for="group in checklistGroups" :key="group.groupLabel"`
10. ✓ Item loop: `v-for="item in group.items" :key="item.key"`
11. ✓ Checkbox bound to `checklistItem(item.key).activo`
12. ✓ Checkbox @change calls `handleChecklistToggle(item.key, $event)`
13. ✓ Quantity field visibility: `v-if="checklistItem(item.key).activo"`
14. ✓ Quantity input @input calls `handleChecklistCantidad(item.key, $event)`
15. ✓ Unit label: `{{ item.unit }}`
16. ✓ All CSS classes present and correctly scoped (no conflicts with existing rules)

### Event Wiring Summary
- **Checkbox @change:** `handleChecklistToggle(item.key, $event)` → updates `activo` → `store.setCriterionValue(id, updated)`
- **Quantity @input:** `handleChecklistCantidad(item.key, $event)` → updates `cantidad` → `store.setCriterionValue(id, updated)`
- **Conditional rendering:** Quantity field appears only when checkbox is checked (`activo: true`)
- **Store integration:** Both handlers call the existing `store.setCriterionValue(props.result.id, updated)` with the full `ObrasHidraulicasValue` object

## Important Limitation
**Interactive browser verification was NOT performed.** This is not possible in this automated environment (no browser, no Playwright/Chromium driver). A human with a real browser must verify:
- Opening the works ("Obras hidráulicas") card
- Seeing the two group labels ("Costo por metro lineal" and "Costo fijo por cruce")
- Checking/unchecking items and seeing the quantity field appear/disappear
- Entering quantities and seeing the sobrecosto/CAPEX total update correctly
- Unchecking an item with a quantity still entered and confirming the cost drops (quantity ignored when unchecked)

## Files Changed
- `frontend/src/components/CriterionCard.vue` (97 lines added)

## Commit
```
f9fe2e4 feat: add grouped checklist UI for obras_hidraulicas criterion
```

## Self-Review Findings
None. All implementation matches the brief exactly:
- All 5 steps completed as specified
- No extraneous changes
- Template branch properly nested in existing v-if/v-else-if chain
- CSS scoped consistently with existing rules
- No unintended side effects on other input types (number/toggle/select)
