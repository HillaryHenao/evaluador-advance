## Task 2: Tipos TypeScript para el motor financiero

**Files:**
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `TerrainData.produccion_especifica`, `TerrainData.arriendo_anual`, `FinancialInputs`, `FinancialResults` — usados en Tasks 3-8.

- [ ] **Step 1: Agregar los 2 campos a `TerrainData`**

En `frontend/src/types/index.ts`, dentro de `TerrainData`, agrega (junto a `numero_arboles`):

```ts
  produccion_especifica: number | null
  arriendo_anual: number | null
```

- [ ] **Step 2: Agregar las interfaces del motor financiero**

Al final del archivo, antes de `AuthUser`, agrega:

```ts
export interface FinancialInputs {
  capex: number
  kWp: number
  kVA: number
  produccionEspecifica: number
  arriendoAnual: number
}

export interface FinancialResults {
  tir: number
  tirConBeneficios: number
  vpn: number
  vpnConBeneficios: number
  paybackAnios: number
  paybackConBeneficiosAnios: number
}
```

- [ ] **Step 3: Verificar que el proyecto compila**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vue-tsc -b
```

Expected: los mismos 2 errores preexistentes de siempre (`evaluatorEngine.test.ts` `@ts-expect-error` no usado, `vite.config.ts` propiedad `test`) — ninguno nuevo relacionado con `TerrainData` o los tipos agregados.

- [ ] **Step 4: Actualizar los mocks de test existentes que usan `TerrainData`**

En `frontend/src/stores/__tests__/evaluatorStore.test.ts`, el objeto `mockTerrain` debe incluir los 2 campos nuevos. Agrega al final del objeto (antes del `}` de cierre):

```ts
  produccion_especifica: 4.5287,
  arriendo_anual: 26275000,
```

- [ ] **Step 5: Correr tests y commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run
```

Expected: todos los tests pasan (mismo conteo que antes, ninguno roto por el cambio de tipo).

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add frontend/src/types/index.ts frontend/src/stores/__tests__/evaluatorStore.test.ts
git commit -m "feat: add TerrainData platform fields and financial engine types"
```

---

