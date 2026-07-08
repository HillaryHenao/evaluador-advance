## Task 4: Motor financiero — ingresos, costos y CAPEX año por año

**Files:**
- Create: `frontend/src/engine/financialEngine.ts`
- Test: `frontend/src/engine/__tests__/financialEngine.test.ts`

**Interfaces:**
- Consumes: `IPC`, `FX`, `PPA_CON_INDEXACION`, `AÑO_BASE` de `financialData.ts`; `irr`, `npv` de `financialMath.ts`; `FinancialInputs`, `FinancialResults` de `@/types`.
- Produces: función interna `calcularFlujosDeCaja(inputs: FinancialInputs): { flujoInversionista: number[] }` — consumida por Task 5 para construir `calcularFinanzas()` (Task 5 agrega el beneficio tributario por separado para obtener el flujo "con beneficios").

- [ ] **Step 1: Escribir el test de generación de ingresos (falla primero)**

Crea `frontend/src/engine/__tests__/financialEngine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularFlujosDeCaja } from '../financialEngine'

const INPUTS_EXCEL = {
  capex: 4_587_742_837,
  kWp: 1320,
  kVA: 1000,
  produccionEspecifica: 4.5287,
  arriendoAnual: 26_275_000,
}

describe('calcularFlujosDeCaja', () => {
  it('el año 0 (inversión) es -capex en el flujo del inversionista', () => {
    const { flujoInversionista } = calcularFlujosDeCaja(INPUTS_EXCEL)
    expect(flujoInversionista[0]).toBeCloseTo(-4_587_742_837, 0)
  })

  it('genera 34 períodos (2026 a 2059)', () => {
    const { flujoInversionista } = calcularFlujosDeCaja(INPUTS_EXCEL)
    expect(flujoInversionista).toHaveLength(34)
  })

  it('el flujo operativo del año 1 (2027) es positivo y del orden esperado', () => {
    const { flujoInversionista } = calcularFlujosDeCaja(INPUTS_EXCEL)
    // El Excel da flujo del inversionista año 2027 (D38) ≈ 561,776,560.8 (ver Supuestos!Q4)
    expect(flujoInversionista[1]).toBeCloseTo(561_776_560.8, -3)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run financialEngine
```

Expected: FAIL — `Cannot find module '../financialEngine'`.

- [ ] **Step 3: Implementar `financialEngine.ts` (ingresos + costos + CAPEX)**

```ts
import type { FinancialInputs } from '@/types'
import { AÑO_BASE, IPC, FX, PPA_CON_INDEXACION, MANTENIMIENTO_TRACKER, REEMPLAZO_INVERSORES } from './financialData'

const N_PERIODOS = 34               // 2026 (inversión) a 2059
const DURACION_OPERACION_ANIOS = 30 // activo mientras (año - (AÑO_BASE+1)) <= 30
const EFICIENCIA_INICIAL = 0.992
const FACTOR_DEGRADACION = 0.0035
const OPERACION_PCT_INGRESOS = 0.038
const CGM_POR_KWH = 6.0
const REPRESENTACION_POR_KWH = 6.0
const COSTOS_REGULATORIOS_POR_KWH = 13.0
const SEGURO_PCT_CAPEX = 0.00185
const CRECIMIENTO_SEGURO = 0.01
const ICA = 0.006
const IVA = 0.19
const MANTENIMIENTO_POR_KVA = 54000.0
const SERVICIOS_PUBLICOS_MENSUAL = 1_500_000.0
const PRECIO_REC_USD_MWH = 1.5

function activo(anio: number): number {
  return anio - (AÑO_BASE + 1) <= DURACION_OPERACION_ANIOS ? 1 : 0
}

export function calcularFlujosDeCaja(inputs: FinancialInputs): {
  flujoInversionista: number[]
} {
  const { capex, kWp, kVA, produccionEspecifica, arriendoAnual } = inputs

  const eficiencia: number[] = new Array(N_PERIODOS).fill(0)
  const generacion: number[] = new Array(N_PERIODOS).fill(0)
  const ingresos: number[] = new Array(N_PERIODOS).fill(0)
  const arriendo: number[] = new Array(N_PERIODOS).fill(0)
  const operacion: number[] = new Array(N_PERIODOS).fill(0)
  const cgm: number[] = new Array(N_PERIODOS).fill(0)
  const representacion: number[] = new Array(N_PERIODOS).fill(0)
  const costosRegulatorios: number[] = new Array(N_PERIODOS).fill(0)
  const seguro: number[] = new Array(N_PERIODOS).fill(0)
  const ica: number[] = new Array(N_PERIODOS).fill(0)
  const iva: number[] = new Array(N_PERIODOS).fill(0)
  const mantenimiento: number[] = new Array(N_PERIODOS).fill(0)
  const serviciosPublicos: number[] = new Array(N_PERIODOS).fill(0)
  const flujoOperativo: number[] = new Array(N_PERIODOS).fill(0)
  const flujoInversionista: number[] = new Array(N_PERIODOS).fill(0)

  // CGM/Representación/Costos regulatorios se cobran como una tarifa COP/kWh que crece
  // con IPC cada año (igual que el Excel: fila 14/15/16 recuperan la tarifa implícita del
  // año anterior vía "costo_anterior/generación_anterior" y la crecen antes de multiplicar
  // por la generación del año actual). Se trackean aparte para no perder precisión.
  let tarifaCgm = CGM_POR_KWH
  let tarifaRepresentacion = REPRESENTACION_POR_KWH
  let tarifaCostosRegulatorios = COSTOS_REGULATORIOS_POR_KWH

  // Año 0 (2026): solo el desembolso de la inversión (Supuestos!D30).
  flujoInversionista[0] = -capex

  for (let k = 1; k < N_PERIODOS; k++) {
    const anio = AÑO_BASE + k
    const act = activo(anio)

    // Eficiencia y generación
    eficiencia[k] = k === 1 ? EFICIENCIA_INICIAL : eficiencia[k - 1] - FACTOR_DEGRADACION
    generacion[k] = eficiencia[k] * kWp * produccionEspecifica * 365 * act

    // Ingresos: PPA usa el valor del AÑO ANTERIOR de la tabla macro (offset -1, ver spec)
    const ppa = PPA_CON_INDEXACION[k - 1] ?? PPA_CON_INDEXACION[PPA_CON_INDEXACION.length - 1]
    const ventaEnergia = ppa * generacion[k] * act
    const fx = FX[k] ?? FX[FX.length - 1]
    const precioRecCopPorMwh = PRECIO_REC_USD_MWH * fx
    const rec = precioRecCopPorMwh * (generacion[k] / 1000) * act
    ingresos[k] = ventaEnergia + rec

    // Costos (todos negativos). Crecimiento por IPC: para pasar del año (k-1) al año k
    // se usa IPC[k-1] (el IPC "del año k-1", que es la tasa que lo infla hacia el año k) —
    // IPC[i] en financialData.ts está alineado por año calendario (índice 0 = 2026).
    if (k === 1) {
      arriendo[k] = -arriendoAnual
    } else {
      arriendo[k] = arriendo[k - 1] * (1 + IPC[k - 1]) * act
    }
    operacion[k] = -ingresos[k] * OPERACION_PCT_INGRESOS * act

    if (k > 1) {
      tarifaCgm *= 1 + IPC[k - 1]
      tarifaRepresentacion *= 1 + IPC[k - 1]
      tarifaCostosRegulatorios *= 1 + IPC[k - 1]
    }
    cgm[k] = -generacion[k] * tarifaCgm * act
    representacion[k] = -generacion[k] * tarifaRepresentacion * act
    costosRegulatorios[k] = -generacion[k] * tarifaCostosRegulatorios * act

    if (k === 1) {
      seguro[k] = -capex * SEGURO_PCT_CAPEX
    } else {
      seguro[k] = seguro[k - 1] * (1 + CRECIMIENTO_SEGURO) * act
    }

    ica[k] = -ventaEnergia * ICA

    if (k === 1) {
      mantenimiento[k] = -kVA * MANTENIMIENTO_POR_KVA
    } else {
      mantenimiento[k] = mantenimiento[k - 1] * (1 + IPC[k - 1]) * act
    }

    // IVA no deducible sobre operación (mitad), representación y mantenimiento
    iva[k] = (operacion[k] / 2 + representacion[k] + mantenimiento[k]) * IVA

    if (k === 1) {
      serviciosPublicos[k] = -SERVICIOS_PUBLICOS_MENSUAL * 12
    } else {
      serviciosPublicos[k] = serviciosPublicos[k - 1] * (1 + IPC[k - 1]) * act
    }

    // Mantenimiento de tracker (cada 5 años) y reemplazo de inversores (una vez, año 16):
    // montos fijos ya calculados con las tarifas y FX del Excel (ver financialData.ts).
    const mantenimientoTracker = MANTENIMIENTO_TRACKER[k] ?? 0
    const reemplazoInversores = REEMPLAZO_INVERSORES[k] ?? 0

    flujoOperativo[k] =
      ingresos[k] +
      arriendo[k] + operacion[k] + cgm[k] + representacion[k] +
      costosRegulatorios[k] + seguro[k] + ica[k] + iva[k] + mantenimiento[k] + serviciosPublicos[k] +
      mantenimientoTracker + reemplazoInversores

    flujoInversionista[k] = flujoOperativo[k] // participación = 1 en el Excel (D29)
  }

  return { flujoInversionista }
}
```

- [ ] **Step 4: Correr el test — iterar hasta que pase**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run financialEngine
```

Expected: los 3 tests deben pasar. Si `flujoInversionista[1]` no da el valor esperado dentro de tolerancia, revisa primero el offset de `PPA_CON_INDEXACION` y de `IPC` contra `docs/superpowers/specs/2026-07-03-motor-financiero-design.md` (sección "Cálculo año por año") — son los puntos más propensos a errores de índice.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add frontend/src/engine/financialEngine.ts frontend/src/engine/__tests__/financialEngine.test.ts
git commit -m "feat: compute revenue, operating costs and CAPEX cash flows"
```

---

