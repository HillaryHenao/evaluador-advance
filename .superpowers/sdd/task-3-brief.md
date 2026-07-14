### Task 3: Frontend engine — scope-aware evaluation (general total + per-project breakdown)

**Files:**
- Modify: `frontend/src/engine/evaluatorEngine.ts`
- Modify: `frontend/src/engine/__tests__/evaluatorEngine.test.ts`

**Interfaces:**
- Consumes: `CriterionModule.scope` (Task 2), `EvalContext.projectCount` (Task 2).
- Produces (used by Task 4): `evaluateScoped(values: CriterionValues, perProjectValues: Record<string, Record<string, CriterionValue>>, proyectoNombres: string[], context: EvalContext) => { general: CriterionResult[]; porProyecto: Record<string, CriterionResult[]> }`.

**Why a single combined function, not two separate ones:** the existing `evaluateCriteria` (unchanged, still exported, still used by other tests) computes each criterion's `sobrecosto` from a single shared `values[criterion.id]` — but for scope `proyecto` criteria (distancia_via, distancia_red, aprovechamiento_forestal, numero_arboles, pilotes, tipo_estructura), `criterionValues` no longer holds any value at all (Task 4's `fetchTerrain` skips populating it for these — there's no single shared value, only per-project ones). If the general CAPEX total kept calling plain `evaluateCriteria`, these 6 criteria would silently contribute **$0** to `aggregated.capexTotal` forever. The general total must independently sum each project's own `computeCost` result for `proyecto`-scope criteria, and multiply by N for `terreno_multiplicado` (nivel_tension) — both of which are impossible to express as "one shared value fed through the existing per-criterion formula." `evaluateScoped` computes the general total and the per-project breakdown in the same pass so they can never drift apart from two independent implementations.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/engine/__tests__/evaluatorEngine.test.ts`, after the existing `describe('aggregateCosts', ...)` block's closing `})`:

```ts

describe('evaluateScoped', () => {
  const proyectoNombres = ['P1', 'P2']
  const scopedCtx = { ...ctx, projectCount: 2 }

  it('scope proyecto: general suma el costo de cada proyecto; por proyecto usa su propio valor', () => {
    const values = {}
    const perProjectValues = { numero_arboles: { P1: 2, P2: 3 } }
    const { general, porProyecto } = evaluateScoped(values, perProjectValues, proyectoNombres, scopedCtx)

    const generalArboles = general.find(r => r.id === 'numero_arboles')
    expect(generalArboles?.sobrecosto).toBe(2 * 142_500 + 3 * 142_500)
    expect(generalArboles?.value).toBeNull()

    expect(porProyecto['P1'].find(r => r.id === 'numero_arboles')?.sobrecosto).toBe(2 * 142_500)
    expect(porProyecto['P2'].find(r => r.id === 'numero_arboles')?.sobrecosto).toBe(3 * 142_500)
  })

  it('scope terreno_dividido: general usa el costo completo; por proyecto lo divide entre N', () => {
    const values = { corte: 100 }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'corte')?.sobrecosto).toBe(100 * 80_000)
    expect(porProyecto['P1'].find(r => r.id === 'corte')?.sobrecosto).toBe((100 * 80_000) / 2)
    expect(porProyecto['P2'].find(r => r.id === 'corte')?.sobrecosto).toBe((100 * 80_000) / 2)
  })

  it('scope terreno_multiplicado: general multiplica por N; por proyecto usa el costo completo sin dividir', () => {
    const values = { nivel_tension: '34.5kV' }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'nivel_tension')?.sobrecosto).toBe(30_000_000 * 2)
    expect(porProyecto['P1'].find(r => r.id === 'nivel_tension')?.sobrecosto).toBe(30_000_000)
    expect(porProyecto['P2'].find(r => r.id === 'nivel_tension')?.sobrecosto).toBe(30_000_000)
  })

  it('scope terreno_no_dividido: general sin cambios; no aparece por proyecto', () => {
    const values = { cluster: 2 }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'cluster')?.sobrecosto).toBe(-15_000_000)
    expect(porProyecto['P1'].find(r => r.id === 'cluster')).toBeUndefined()
    expect(porProyecto['P2'].find(r => r.id === 'cluster')).toBeUndefined()
  })

  it('sin proyectos activos (projectCount ausente): terreno_dividido no divide (usa 1)', () => {
    const values = { corte: 100 }
    const { general } = evaluateScoped(values, {}, [], ctx)
    expect(general.find(r => r.id === 'corte')?.sobrecosto).toBe(100 * 80_000)
  })
})
```

`aggregateCosts` (existing function, in the same file) has its own bug that would silently defeat the fix above: it filters `results.filter(r => r.formulaDefined && r.value !== null)` before summing anything. Since `evaluateScoped`'s general result deliberately sets `value: null` for scope-`proyecto` criteria (there's no single representative value — only a summed `sobrecosto`), that filter would exclude them from `totalSobrecostoFijo`/`capexTotal` even though `evaluateScoped` computed their sobrecosto correctly. Rename the existing test to stop asserting the soon-to-be-wrong "y valor distinto de null" rule, and add a test proving the new correct behavior.

Find (the existing `aggregateCosts` test's name and body):

```ts
describe('aggregateCosts', () => {
  it('suma al CAPEX solo los criterios fijos/ambas con formulaDefined=true y valor distinto de null', () => {
    const values = { corte: 100, lleno: 10, pilotes: true }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    const expected = 100 * 80_000 + 10 * 210_000 + 156_000_000
    expect(aggregated.totalSobrecostoFijo).toBe(expected)
  })
```

Replace with:

```ts
describe('aggregateCosts', () => {
  it('suma al CAPEX solo los criterios fijos/ambas con formulaDefined=true', () => {
    const values = { corte: 100, lleno: 10, pilotes: true }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    const expected = 100 * 80_000 + 10 * 210_000 + 156_000_000
    expect(aggregated.totalSobrecostoFijo).toBe(expected)
  })

  it('cuenta un resultado con value=null pero sobrecosto real distinto de cero (caso scope proyecto de evaluateScoped)', () => {
    const results = [
      {
        id: 'numero_arboles', label: 'Número de árboles', value: null, sobrecosto: 285_000,
        formulaDefined: true, fromDb: true, category: 'fijo' as const,
      },
    ]
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.totalSobrecostoFijo).toBe(285_000)
    expect(aggregated.capexTotal).toBe(ctx.baseCapex + 285_000)
  })
```

(Leave every other existing test in this `describe('aggregateCosts', ...)` block untouched — only the one named test above changes.)

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts -t "evaluateScoped|aggregateCosts"`

Expected: FAIL — `evaluateScoped` tests fail with `evaluateScoped is not defined` (the function doesn't exist yet), and the new "cuenta un resultado con value=null..." test fails because `aggregateCosts`'s current filter (`r.value !== null`) excludes the synthetic result, giving `totalSobrecostoFijo: 0` instead of the expected `285_000`.

- [ ] **Step 3: Add `evaluateScoped` to `frontend/src/engine/evaluatorEngine.ts`**

Find (right before `export function aggregateCosts`, i.e. immediately after the closing `}` of the existing `evaluateCriteria` function — do not modify `evaluateCriteria` itself, it stays exactly as-is for its existing callers):

```ts
export function aggregateCosts(
```

Insert immediately before this line:

```ts
export interface ScopedEvaluation {
  general: CriterionResult[]
  porProyecto: Record<string, CriterionResult[]>
}

export function evaluateScoped(
  values: CriterionValues,
  perProjectValues: Record<string, Record<string, CriterionValue>>,
  proyectoNombres: string[],
  context: EvalContext,
): ScopedEvaluation {
  const criteria = loadCriteria()
  const n = context.projectCount ?? 1

  const general: CriterionResult[] = []
  const porProyecto: Record<string, CriterionResult[]> = {}
  for (const nombre of proyectoNombres) porProyecto[nombre] = []

  for (const criterion of criteria) {
    const base = {
      id: criterion.id,
      label: criterion.label,
      formulaDefined: criterion.formulaDefined,
      fromDb: criterion.dataSource === 'db',
      category: criterion.category,
      riskType: criterion.riskType,
    }

    if (criterion.scope === 'proyecto') {
      const valoresPorProyecto = perProjectValues[criterion.id] ?? {}
      let sumaGeneral = 0
      for (const nombre of proyectoNombres) {
        const value = valoresPorProyecto[nombre] ?? null
        const sobrecosto = criterion.formulaDefined ? criterion.computeCost(value, context) : 0
        sumaGeneral += sobrecosto
        porProyecto[nombre].push({ ...base, value, sobrecosto })
      }
      general.push({ ...base, value: null, sobrecosto: sumaGeneral })
      continue
    }

    const value = values[criterion.id] ?? null
    const costoBase = criterion.formulaDefined ? criterion.computeCost(value, context) : 0
    const costoGeneral = criterion.scope === 'terreno_multiplicado' ? costoBase * n : costoBase
    general.push({ ...base, value, sobrecosto: costoGeneral })

    if (criterion.scope === 'terreno_no_dividido') continue

    const costoPorProyecto = criterion.scope === 'terreno_multiplicado' ? costoBase : costoBase / n
    for (const nombre of proyectoNombres) {
      porProyecto[nombre].push({ ...base, value, sobrecosto: costoPorProyecto })
    }
  }

  return { general, porProyecto }
}

```

- [ ] **Step 4: Fix `aggregateCosts`'s null-value filter**

Find:

```ts
export function aggregateCosts(
  results: CriterionResult[],
  context: EvalContext,
): AggregatedResult {
  const active = results.filter(r => r.formulaDefined && r.value !== null)
```

Replace with:

```ts
export function aggregateCosts(
  results: CriterionResult[],
  context: EvalContext,
): AggregatedResult {
  const active = results.filter(r => r.formulaDefined)
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`

Expected: PASS — all tests in the file pass, including the 5 new `evaluateScoped` tests and the new `aggregateCosts` null-value test.

- [ ] **Step 6: Run the full suite and type-check**

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass.

Run (from `frontend/`): `npx vue-tsc -b`

Expected: same 2 pre-existing errors as before, plus whatever `TerrainData`-field errors were already present from Task 2 (still expected to be resolved by Task 4 and Task 5 — do not fix them in this task).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/engine/evaluatorEngine.ts frontend/src/engine/__tests__/evaluatorEngine.test.ts
git commit -m "feat: add evaluateScoped for scope-aware general total + per-project breakdown"
```

---

