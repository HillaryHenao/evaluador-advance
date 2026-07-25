### Task 3: Frontend — cluster credit repartido entre proyectos

**Files:**
- Modify: `frontend/src/criteria/cluster.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/engine/evaluatorEngine.ts`
- Modify: `frontend/src/engine/__tests__/evaluatorEngine.test.ts`
- Modify: `frontend/src/stores/__tests__/evaluatorStore.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1/2.
- Produces: nothing consumed by other tasks — this is the last functional task of this plan.

- [ ] **Step 1: Write the failing test for the new repartition behavior**

Find (in `frontend/src/engine/__tests__/evaluatorEngine.test.ts`):

```ts
  it('scope terreno_no_dividido: general sin cambios; no aparece por proyecto', () => {
    const values = { cluster: 2 }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'cluster')?.sobrecosto).toBe(-15_000_000)
    expect(porProyecto['P1'].find(r => r.id === 'cluster')).toBeUndefined()
    expect(porProyecto['P2'].find(r => r.id === 'cluster')).toBeUndefined()
  })
```

Replace:

```ts
  it('cluster (terreno_dividido): general usa el crédito completo; por proyecto lo reparte entre N', () => {
    const values = { cluster: 2 }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'cluster')?.sobrecosto).toBe(-15_000_000)
    expect(porProyecto['P1'].find(r => r.id === 'cluster')?.sobrecosto).toBe(-7_500_000)
    expect(porProyecto['P2'].find(r => r.id === 'cluster')?.sobrecosto).toBe(-7_500_000)
  })
```

Also find (the valid-scopes list, same file):

```ts
    const validScopes = ['proyecto', 'terreno_dividido', 'terreno_multiplicado', 'terreno_no_dividido']
```

Replace:

```ts
    const validScopes = ['proyecto', 'terreno_dividido', 'terreno_multiplicado']
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`

Expected: FAIL — `cluster.ts` still has `scope: 'terreno_no_dividido'`, so `porProyecto['P1'].find(r => r.id === 'cluster')` is still `undefined`, not `-7_500_000`.

- [ ] **Step 3: Change `cluster.ts`'s scope**

Find (in `frontend/src/criteria/cluster.ts`):

```ts
  scope: 'terreno_no_dividido',
```

Replace:

```ts
  scope: 'terreno_dividido',
```

- [ ] **Step 4: Remove the now-dead `'terreno_no_dividido'` scope**

Find (in `frontend/src/types/index.ts`):

```ts
export type CriterionScope = 'proyecto' | 'terreno_dividido' | 'terreno_multiplicado' | 'terreno_no_dividido'
```

Replace:

```ts
export type CriterionScope = 'proyecto' | 'terreno_dividido' | 'terreno_multiplicado'
```

Find (in `frontend/src/engine/evaluatorEngine.ts`, inside `evaluateScoped`):

```ts
    const value = values[criterion.id] ?? null
    const costoBase = criterion.formulaDefined ? criterion.computeCost(value, context) : 0
    const costoGeneral = criterion.scope === 'terreno_multiplicado' ? costoBase * n : costoBase
    general.push({ ...base, value, sobrecosto: costoGeneral })

    if (criterion.scope === 'terreno_no_dividido') continue

    const costoPorProyecto = criterion.scope === 'terreno_multiplicado' ? costoBase : costoBase / n
```

Replace:

```ts
    const value = values[criterion.id] ?? null
    const costoBase = criterion.formulaDefined ? criterion.computeCost(value, context) : 0
    const costoGeneral = criterion.scope === 'terreno_multiplicado' ? costoBase * n : costoBase
    general.push({ ...base, value, sobrecosto: costoGeneral })

    const costoPorProyecto = criterion.scope === 'terreno_multiplicado' ? costoBase : costoBase / n
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`

Expected: PASS — all tests in this file.

- [ ] **Step 6: Fix `evaluatorStore.test.ts`'s `perProjectFinancials` test — cluster credit now reaches per-project capex**

This test's mock has `cluster: 2`, which `fetchTerrain` auto-populates into `criterionValues.cluster` (see `evaluatorStore.ts`'s `dbValues` loop). After Step 3, `cluster` is scope `'terreno_dividido'`, so it now appears in `perProjectResults` for both `P1` and `P2` at `-15_000_000 / 2 = -7_500_000` each — reducing each project's capex by that amount.

Find (in `frontend/src/stores/__tests__/evaluatorStore.test.ts`, inside the first test of `describe('perProjectFinancials', ...)`):

```ts
      // Sin datos de scope 'proyecto' (todo null) para que el subtotal de sobrecostos
      // fijos de cada proyecto sea 0 y el capex de cada uno sea exactamente store.baseCapex
      // — así el test puede verificar el valor exacto sin recalcular fórmulas de criterios.
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    expect(store.perProjectFinancials).not.toBeNull()

    const esperadoP1 = calcularFinanzas({
      capex: store.baseCapex, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 12_000_000,
    })
    const esperadoP2 = calcularFinanzas({
      capex: store.baseCapex, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 8_000_000,
    })
```

Replace:

```ts
      // Sin datos de scope 'proyecto' (todo null). El único costo fijo que sí aplica es el
      // crédito de cluster (scope 'terreno_dividido', cluster=2 → -15M repartido entre los
      // 2 proyectos = -7.5M cada uno) — el capex de cada proyecto es store.baseCapex menos
      // ese crédito, no exactamente store.baseCapex.
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    expect(store.perProjectFinancials).not.toBeNull()

    const esperadoP1 = calcularFinanzas({
      capex: store.baseCapex - 7_500_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 12_000_000,
    })
    const esperadoP2 = calcularFinanzas({
      capex: store.baseCapex - 7_500_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 8_000_000,
    })
```

(The second test in this describe block, `'general (financialResults) multiplica kWp y kVA por N...'`, compares against `store.aggregated.capexTotal` directly rather than a hardcoded expectation — it already accounts for whatever `cluster` contributes on both sides of the comparison, so it needs no change.)

- [ ] **Step 7: Run the full frontend suite and type-check**

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass.

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly 1 error — `vite.config.ts(13,3)` (pre-existing, unrelated).

- [ ] **Step 8: Verify against the running dev server**

1. Ensure both dev servers are running, search `COLBOYT147` (cluster = 2).
2. In "Desglose por proyecto", confirm each project card now shows a **"Cluster: -$7.500.000"** line inside its "Fijos" section, and that the "Fijos" subtotal and "CAPEX total" for each card reflect that credit.
3. Confirm "CAPEX Total del terreno" at the top of the panel is unchanged from before this plan (the general total already included the full -15M once).
4. If no browser-driving tool is available, state plainly in the report that this step needs human verification.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/criteria/cluster.ts frontend/src/types/index.ts frontend/src/engine/evaluatorEngine.ts frontend/src/engine/__tests__/evaluatorEngine.test.ts frontend/src/stores/__tests__/evaluatorStore.test.ts
git commit -m "fix: repartir el crédito de cluster entre proyectos en vez de excluirlo del desglose"
```

---
