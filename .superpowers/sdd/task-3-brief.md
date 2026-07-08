## Task 3: Datos macro + utilidades matemáticas (IRR/NPV)

**Files:**
- Create: `frontend/src/engine/financialData.ts`
- Create: `frontend/src/engine/financialMath.ts`
- Test: `frontend/src/engine/__tests__/financialMath.test.ts`

**Interfaces:**
- Produces: `IPC: number[]`, `FX: number[]`, `PPA_CON_INDEXACION: number[]` (arrays de 34 elementos, índice 0 = año 2026, índice 33 = año 2059), `AÑO_BASE = 2026`. `irr(cashflows: number[]): number`, `npv(rate: number, cashflows: number[]): number`. Usadas por Task 4/5 (`financialEngine.ts`).

- [ ] **Step 1: Crear `financialData.ts` con las tablas macro exactas del Excel**

```ts
// Tablas macro extraídas literal de "Supuestos y resultados" filas 97-105 del Excel
// "Retail Modelo financiero - Plantilla Evaluador.xlsx". Índice 0 = año 2026, índice 33 = año 2059.

export const AÑO_BASE = 2026

export const IPC = [
  0.064, 0.0523, 0.0406, 0.0372, 0.0333, 0.032, 0.032, 0.032, 0.032, 0.032,
  0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032,
  0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032,
  0.032, 0.032, 0.032, 0.032,
]

export const FX = [
  3751.0, 3834.0, 3947.0, 3990.0, 4036.0, 4023.4, 4010.8, 3998.2, 3985.6, 3973,
  3960.4, 3947.8, 3935.2, 3922.6, 3910, 3897.4, 3884.8, 3872.2, 3859.6, 3847,
  3834.4, 3821.8, 3809.2, 3796.6, 3784, 3771.4, 3758.8, 3746.2, 3733.6, 3721,
  3708.4, 3695.8, 3683.2, 3670.6,
]

// PPA con indexación (COP/kWh) — ya incluye el ajuste por IPP acumulado del Excel (fila 105)
export const PPA_CON_INDEXACION = [
  350.9462719, 349.3700922, 343.6267887, 344.7270552, 353.8970224, 363.8061391,
  371.515938, 374.2800166, 382.1424431, 379.3889236, 376.1816073, 372.4972404,
  374.1578388, 378.624348, 389.2258297, 398.5363587, 408.0631242, 417.8109361,
  427.784704, 437.9894391, 448.4302562, 459.1123753, 470.0411238, 481.221938,
  492.6603657, 504.3620673, 516.3328184, 528.5785117, 541.105159, 553.9188929,
  567.0259695, 580.43277, 594.1458029, 608.1717064,
]

// Mantenimiento de tracker (fila 23 del Excel): ocurre cada 5 años empezando en el
// período 6 (año 2032), con el monto compuesto por IPC desde la ocurrencia anterior.
// Reemplazo de inversores y motores (fila 22): ocurre una sola vez, período 16 (año 2042).
// Ambos son valores ya calculados con las tarifas y tipo de cambio fijos del Excel —
// no dependen de los inputs del terreno (capex/kWp/producción/arriendo), por eso van
// literales aquí en vez de recalcularse.
export const MANTENIMIENTO_TRACKER: Record<number, number> = {
  6: -35_117_188.69,
  11: -41_107_231.39,
  16: -48_119_013.38,
  21: -56_326_815.75,
  26: -65_934_647.24,
}

export const REEMPLAZO_INVERSORES: Record<number, number> = {
  16: -250_052_057,
}
```

- [ ] **Step 2: Escribir el test de `irr`/`npv` (falla primero)**

```ts
import { describe, it, expect } from 'vitest'
import { irr, npv } from '../financialMath'

describe('npv', () => {
  it('calcula el valor presente neto con flujos simples', () => {
    // -1000 hoy, +600 año1, +600 año2, al 10% -> NPV ≈ 41.32
    const resultado = npv(0.10, [600, 600]) - 1000
    expect(resultado).toBeCloseTo(41.32, 1)
  })
})

describe('irr', () => {
  it('calcula la tasa que hace VPN=0 para un flujo simple', () => {
    // -1000, +1100 -> IRR = 10%
    expect(irr([-1000, 1100])).toBeCloseTo(0.10, 4)
  })

  it('calcula IRR para un flujo de varios períodos', () => {
    // -1000, +300, +400, +500, +600 -> IRR conocida ≈ 24.89%
    expect(irr([-1000, 300, 400, 500, 600])).toBeCloseTo(0.2489, 3)
  })
})
```

- [ ] **Step 2b: Correr el test para verificar que falla**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run financialMath
```

Expected: FAIL — `Cannot find module '../financialMath'`.

- [ ] **Step 3: Implementar `financialMath.ts`**

```ts
// npv replica Excel NPV(): descuenta cashflows[0] a t=1, cashflows[1] a t=2, etc.
// (NO incluye el flujo del año 0 — ese se suma aparte, igual que en el Excel: NPV(...)+C38)
export function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((acc, flujo, i) => acc + flujo / Math.pow(1 + rate, i + 1), 0)
}

// irr: Newton-Raphson sobre la función VPN completa (cashflows[0] es el flujo en t=0)
export function irr(cashflows: number[], guess = 0.1): number {
  const vpnCompleto = (rate: number) =>
    cashflows.reduce((acc, flujo, t) => acc + flujo / Math.pow(1 + rate, t), 0)
  const derivada = (rate: number) =>
    cashflows.reduce((acc, flujo, t) => acc - (t * flujo) / Math.pow(1 + rate, t + 1), 0)

  let rate = guess
  for (let i = 0; i < 100; i++) {
    const valor = vpnCompleto(rate)
    const pendiente = derivada(rate)
    if (Math.abs(pendiente) < 1e-12) break
    const siguienteRate = rate - valor / pendiente
    if (Math.abs(siguienteRate - rate) < 1e-9) return siguienteRate
    rate = siguienteRate
  }
  return rate
}
```

- [ ] **Step 4: Correr el test — debe pasar**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run financialMath
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add frontend/src/engine/financialData.ts frontend/src/engine/financialMath.ts frontend/src/engine/__tests__/financialMath.test.ts
git commit -m "feat: add IRR/NPV math utilities and macro assumption tables"
```

---

