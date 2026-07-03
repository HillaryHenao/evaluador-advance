# Motor Financiero (TIR/VPN/Payback) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enlazar el evaluador con el modelo financiero de Excel: usar el CAPEX ya calculado (más arriendo y producción específica traídos de la BD) para proyectar 30+ años de flujo de caja y mostrar TIR, VPN y Payback (con y sin beneficios tributarios) en la misma pantalla, en vivo.

**Architecture:** Un nuevo módulo TypeScript puro `frontend/src/engine/financialEngine.ts` replica año por año las fórmulas de la hoja "Flujo de caja" del Excel (ingresos, costos, CAPEX, depreciación acelerada) y calcula IRR/NPV/Payback con Newton-Raphson. El backend se extiende para exponer `produccion_especifica` (`termsheet_terrain.radiation`) y `arriendo_anual` (`termsheet_termsheet.rent_annual_cost_cop`). Un nuevo panel Vue (`FinancialResultsPanel.vue`) consume el motor de forma reactiva desde `evaluatorStore`.

**Tech Stack:** TypeScript (frontend, Vitest), Python/Flask + psycopg2 (backend, pytest), Vue 3 + Pinia.

## Global Constraints

- Los ~30 supuestos macro (IPC, IPP, spot price, PPA, tasa de descuento 10%, tarifas de costos, seguro, etc.) son constantes fijas en esta v1, con los mismos valores que trae hoy el Excel. No hay UI para editarlos.
- El panel de resultados muestra solo métricas resumen (TIR, TIR c. beneficios, VPN, VPN c. beneficios, Payback, Payback c. beneficios) — sin tabla año por año.
- "Potencia instalada AC" (kVA) es un input manual nuevo en el evaluador (no viene de BD), default 1000, siguiendo el mismo patrón que `kWp` (manual, default 1320).
- Referencia completa de las fórmulas del Excel: `docs/superpowers/specs/2026-07-03-motor-financiero-design.md`.
- Valores de referencia (golden master) del Excel actual: capex=4,587,742,837; kWp=1320; kVA=1000; producciónEspecífica=4.5287; arriendoAnual=26,275,000 → TIR≈0.1100882832, VPN≈391,839,623.5, Payback≈9; TIR c. beneficios≈0.1420435955, VPN c. beneficios≈1,576,145,841, Payback c. beneficios≈7.

---

## Mapa de archivos

```
backend/
  app/services/terrain_service.py     ← MODIFICAR: agregar produccion_especifica + arriendo_anual (Task 1)
  tests/test_terrain.py                ← MODIFICAR: mock data con los 2 campos nuevos (Task 1)

frontend/src/
  types/index.ts                       ← MODIFICAR: TerrainData + tipos FinancialInputs/FinancialResults (Task 2)
  engine/
    financialData.ts                   ← CREAR: tablas macro (IPC, FX, PPA con indexación) (Task 3)
    financialMath.ts                   ← CREAR: irr() y npv() genéricos (Task 3)
    financialEngine.ts                 ← CREAR: calcularFinanzas() — orquesta todo (Tasks 4-5)
    __tests__/
      financialMath.test.ts            ← CREAR (Task 3)
      financialEngine.test.ts          ← CREAR: golden master (Task 5)
  stores/
    evaluatorStore.ts                  ← MODIFICAR: kVA, arriendoAnual override, financialResults computed (Task 6)
    __tests__/evaluatorStore.test.ts   ← MODIFICAR (Task 6)
  components/
    FinancialResultsPanel.vue          ← CREAR (Task 7)
  views/
    EvaluadorView.vue                  ← MODIFICAR: incluir el panel (Task 8)
```

---

## Task 1: Backend — producción específica y arriendo desde BD

**Files:**
- Modify: `backend/app/services/terrain_service.py`
- Modify: `backend/tests/test_terrain.py`

**Interfaces:**
- Produces: `get_terrain_data()` ahora incluye en el dict retornado las claves `produccion_especifica: float | None` y `arriendo_anual: float | None`, consumidas por Task 2 (tipo `TerrainData`).

- [ ] **Step 1: Agregar las columnas al SELECT principal**

En `backend/app/services/terrain_service.py`, dentro de la función `get_terrain_data`, en el bloque `SELECT` (busca la línea `t.name AS code,`), agrega justo después de `t.name AS code,`:

```sql
                    t.radiation                                 AS produccion_especifica,
```

Y agrega, junto a las demás subconsultas del SELECT (por ejemplo después del bloque de `numero_arboles_raw`), una nueva subconsulta:

```sql
                    (
                        SELECT ts.rent_annual_cost_cop
                        FROM termsheet_termsheet ts
                        WHERE ts.id = p.termsheet_id
                    )                                           AS arriendo_anual
```

(Recuerda agregar la coma que falte entre subconsultas al insertar esta — revisa que la penúltima subconsulta del SELECT termine en `,` y la última no.)

- [ ] **Step 2: Verificar manualmente contra la BD real**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\backend"
./venv/Scripts/python.exe -c "
from app.services.terrain_service import get_terrain_data
import os
os.environ.setdefault('DATABASE_URL', 'postgresql://hillary:unergy2026*hillary@34.74.198.101:5432/originabotdb')
os.environ.setdefault('DATABASE_URL2', 'postgresql://hillary:unergy2026*hillary@34.74.198.101:5432/requestsdb')
d = get_terrain_data('COLCEST11')
print('produccion_especifica:', d.get('produccion_especifica'))
print('arriendo_anual:', d.get('arriendo_anual'))
"
```

Expected: `produccion_especifica: 4.569` y `arriendo_anual: 45000000.0` (valores conocidos de COLCEST11, verificados durante el diseño).

- [ ] **Step 3: Actualizar el mock de test existente**

En `backend/tests/test_terrain.py`, en `test_terrain_returns_data`, el diccionario `mock_data` debe incluir las 2 claves nuevas. Reemplaza:

```python
    mock_data = {
        'code': 'COLCEST5', 'name': 'Test', 'municipality': 'Aguachica',
        'distancia_via': 120, 'distancia_red': 350, 'or': 'AFINIA',
        'nivel_tension': '34.5 kV', 'cluster': 2, 'tipo_estructura': 'Tracker',
        'ocupacion_cauce': False, 'servidumbre': 'own',
        'aprovechamiento_forestal': 'Exonerado', 'coexistencias': False,
    }
```

con:

```python
    mock_data = {
        'code': 'COLCEST5', 'name': 'Test', 'municipality': 'Aguachica',
        'distancia_via': 120, 'distancia_red': 350, 'or': 'AFINIA',
        'nivel_tension': '34.5 kV', 'cluster': 2, 'tipo_estructura': 'Tracker',
        'ocupacion_cauce': False, 'servidumbre': 'own',
        'aprovechamiento_forestal': 'Exonerado', 'coexistencias': False,
        'produccion_especifica': 4.5287, 'arriendo_anual': 26275000.0,
    }
```

- [ ] **Step 4: Correr los tests del backend**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\backend"
./venv/Scripts/python.exe -m pytest -q
```

Expected: `3 passed, 1 failed` (la falla es `test_terrain_requires_auth`, preexistente por `FLASK_ENV=development` sin `JWT_SECRET` en `.env` — no relacionada con este cambio).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add backend/app/services/terrain_service.py backend/tests/test_terrain.py
git commit -m "feat: expose produccion_especifica and arriendo_anual from platform data"
```

---

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

## Task 5: Beneficio tributario + resultados finales (TIR/VPN/Payback) + golden master

**Files:**
- Modify: `frontend/src/engine/financialEngine.ts`
- Modify: `frontend/src/engine/__tests__/financialEngine.test.ts`

**Interfaces:**
- Consumes: `calcularFlujosDeCaja` (Task 4), `irr`, `npv` (Task 3).
- Produces: `calcularFinanzas(inputs: FinancialInputs): FinancialResults` — consumida por Task 6 (`evaluatorStore`).

- [ ] **Step 1: Escribir el test golden-master (falla primero)**

Agrega a `frontend/src/engine/__tests__/financialEngine.test.ts`:

```ts
import { calcularFinanzas } from '../financialEngine'

describe('calcularFinanzas — golden master contra el Excel', () => {
  const resultado = calcularFinanzas(INPUTS_EXCEL)

  it('TIR ≈ 11.01%', () => {
    expect(resultado.tir).toBeCloseTo(0.1100882832, 2)
  })

  it('TIR con beneficios tributarios ≈ 14.20%', () => {
    expect(resultado.tirConBeneficios).toBeCloseTo(0.1420435955, 2)
  })

  it('VPN ≈ $391.8M', () => {
    expect(resultado.vpn).toBeCloseTo(391_839_623.5, -6)
  })

  it('VPN con beneficios ≈ $1,576.1M', () => {
    expect(resultado.vpnConBeneficios).toBeCloseTo(1_576_145_841, -6)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run financialEngine
```

Expected: FAIL — `calcularFinanzas is not a function` (o similar).

- [ ] **Step 3: Implementar el beneficio tributario y `calcularFinanzas`**

Agrega al inicio de `financialEngine.ts`, junto al import existente de `financialData`:

```ts
import { irr, npv } from './financialMath'
import type { FinancialResults } from '@/types'
```

Y agrega al final del archivo (después de `calcularFlujosDeCaja`):

```ts
const DEPRECIACION_ANIOS = 15
const TASA_IMPUESTO_RENTA = 0.35
const TASA_DESCUENTO_VPN = 0.10

function calcularBeneficioTributario(capex: number): number[] {
  const beneficio: number[] = new Array(N_PERIODOS).fill(0)
  const depreciacionAnual = capex / DEPRECIACION_ANIOS
  const depreciacionAceleradaAnual = (capex * 0.5) / DEPRECIACION_ANIOS

  for (let k = 1; k < N_PERIODOS; k++) {
    const anio = AÑO_BASE + k
    let total = 0
    // Depreciación línea recta (años base+1 .. base+15)
    if (anio < AÑO_BASE + 1 + DEPRECIACION_ANIOS) {
      total += depreciacionAnual * TASA_IMPUESTO_RENTA
    }
    // Depreciación acelerada sobre 50% del capex, desplazada 1 año (años base+2 .. base+16)
    if (anio - 1 < AÑO_BASE + 1 + DEPRECIACION_ANIOS && k >= 2) {
      total += depreciacionAceleradaAnual * TASA_IMPUESTO_RENTA
    }
    beneficio[k] = total
  }
  return beneficio
}

function calcularPayback(flujos: number[]): number {
  // Replica el conteo del Excel (filas 45-47): el año de inversión (índice 0) siempre
  // contribuye 1 año completo; los años siguientes contribuyen 1 si aún no se recupera
  // la inversión, una fracción en el año que cruza a positivo, y 0 después.
  let contador = 1
  let remanente = -flujos[0]
  for (let k = 1; k < flujos.length; k++) {
    if (remanente <= 0) continue
    const remanenteAnterior = remanente
    remanente = remanente - flujos[k]
    if (remanente > 0) {
      contador += 1
    } else {
      contador += remanenteAnterior / flujos[k]
    }
  }
  return contador
}

export function calcularFinanzas(inputs: FinancialInputs): FinancialResults {
  const { flujoInversionista } = calcularFlujosDeCaja(inputs)
  const beneficioTributario = calcularBeneficioTributario(inputs.capex)
  const flujoInversionistaConBeneficios = flujoInversionista.map((f, i) => f + beneficioTributario[i])

  // NPV Excel: NPV(10%, años 1..31) + flujo año 0 (columnas D:AH del Excel = índices 1..31)
  const vpn = flujoInversionista[0] + npv(TASA_DESCUENTO_VPN, flujoInversionista.slice(1, 32))
  const vpnConBeneficios =
    flujoInversionistaConBeneficios[0] + npv(TASA_DESCUENTO_VPN, flujoInversionistaConBeneficios.slice(1, 32))

  return {
    tir: irr(flujoInversionista),
    tirConBeneficios: irr(flujoInversionistaConBeneficios),
    vpn,
    vpnConBeneficios,
    paybackAnios: calcularPayback(flujoInversionista),
    paybackConBeneficiosAnios: calcularPayback(flujoInversionistaConBeneficios),
  }
}
```

- [ ] **Step 4: Correr el test — iterar hasta que pase**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run financialEngine
```

Expected: todos los tests pasan. Si TIR/VPN no coinciden dentro de tolerancia, depurar comparando flujo por flujo contra la hoja "Flujo de caja" del Excel original (`Retail Modelo financiero - Plantilla Evaluador.xlsx`) fila 38 (sin beneficios) y fila 43 (con beneficios) — no contra el payback, que es el resultado más sensible a la convención exacta de fracción-de-año del Excel y puede quedar aproximado (ver Nota abajo).

**Nota sobre Payback:** El deliverable principal pedido por el usuario es la TIR; VPN es el segundo más importante. Si el payback no cuadra exactamente con el Excel (9 y 7 años) después de intentar la implementación de arriba, es aceptable dejarlo con una tolerancia más amplia (±1 año) y anotarlo como conocido en el commit — no bloquear la entrega de TIR/VPN por esto.

- [ ] **Step 5: Correr toda la suite de frontend**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run
```

Expected: todos los tests pasan (los existentes + los nuevos de esta task).

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add frontend/src/engine/financialEngine.ts frontend/src/engine/__tests__/financialEngine.test.ts
git commit -m "feat: add tax benefit calculation and TIR/VPN/Payback outputs"
```

---

## Task 6: Wire en `evaluatorStore` (kVA, arriendo/producción reactivos, financialResults)

**Files:**
- Modify: `frontend/src/stores/evaluatorStore.ts`
- Modify: `frontend/src/stores/__tests__/evaluatorStore.test.ts`

**Interfaces:**
- Consumes: `calcularFinanzas` de `@/engine/financialEngine`.
- Produces: `evaluatorStore.kVA: Ref<number>`, `evaluatorStore.arriendoAnual: Ref<number | null>`, `evaluatorStore.financialResults: ComputedRef<FinancialResults | null>` — consumidos por Task 7 (`FinancialResultsPanel.vue`).

- [ ] **Step 1: Escribir el test (falla primero)**

Agrega a `frontend/src/stores/__tests__/evaluatorStore.test.ts`:

```ts
describe('financialResults', () => {
  it('es null si no hay producción específica ni arriendo cargados', () => {
    const store = useEvaluatorStore()
    expect(store.financialResults).toBeNull()
  })

  it('calcula TIR una vez cargados terrainData y kVA por defecto', async () => {
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue(mockTerrain)
    const store = useEvaluatorStore()
    await store.fetchTerrain('COLCEST5')
    expect(store.financialResults).not.toBeNull()
    expect(store.financialResults?.tir).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run evaluatorStore
```

Expected: FAIL — `store.financialResults` es `undefined`, no `null`.

- [ ] **Step 3: Leer el estado actual de `evaluatorStore.ts`**

Antes de editar, revisa el archivo completo para mantener el estilo existente (composables Pinia con `ref`/`computed`).

- [ ] **Step 4: Implementar en `evaluatorStore.ts`**

Agrega el import al inicio del archivo:

```ts
import { calcularFinanzas } from '@/engine/financialEngine'
import type { FinancialResults } from '@/types'
```

Dentro de `defineStore`, junto a la declaración de `kWp`:

```ts
  const kVA = ref(1000)
  const arriendoManual = ref<number | null>(null)
```

Agrega el computed `financialResults` (ubícalo junto al computed `aggregated` existente):

```ts
  const financialResults = computed<FinancialResults | null>(() => {
    const produccionEspecifica = terrainData.value?.produccion_especifica
    const arriendoAnual = arriendoManual.value ?? terrainData.value?.arriendo_anual
    if (!produccionEspecifica || !arriendoAnual) return null
    return calcularFinanzas({
      capex: aggregated.value.capexTotal,
      kWp: kWp.value,
      kVA: kVA.value,
      produccionEspecifica,
      arriendoAnual,
    })
  })
```

Y actualiza el `return` del store (al final de `defineStore`), agregando los 3 nuevos campos. Reemplaza:

```ts
  return {
    terrainData, criterionValues, baseCapex, kWp,
    loading, error, aggregated, fetchTerrain, setCriterionValue, reset,
  }
```

con:

```ts
  return {
    terrainData, criterionValues, baseCapex, kWp, kVA, arriendoManual,
    loading, error, aggregated, financialResults, fetchTerrain, setCriterionValue, reset,
  }
```

- [ ] **Step 5: Correr el test — iterar hasta que pase**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run evaluatorStore
```

Expected: PASS.

- [ ] **Step 6: Correr toda la suite y commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vitest run
```

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add frontend/src/stores/evaluatorStore.ts frontend/src/stores/__tests__/evaluatorStore.test.ts
git commit -m "feat: wire financial engine into evaluatorStore reactively"
```

---

## Task 7: `FinancialResultsPanel.vue`

**Files:**
- Create: `frontend/src/components/FinancialResultsPanel.vue`

**Interfaces:**
- Consumes: `useEvaluatorStore().financialResults`, `.arriendoManual`, `.kVA` (Task 6).
- Produces: componente `<FinancialResultsPanel />` sin props, consumido por Task 8 (`EvaluadorView.vue`).

- [ ] **Step 1: Crear el componente**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'

const store = useEvaluatorStore()

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatCOP(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2).replace('.', ',')} B`
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace('.', ',')} M`
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatAnios(value: number): string {
  return `${value.toFixed(1)} años`
}

const faltaProduccion = computed(() => !store.terrainData?.produccion_especifica)
const faltaArriendo = computed(() => !store.arriendoManual && !store.terrainData?.arriendo_anual)
</script>

<template>
  <aside class="financial-panel">
    <h2 class="financial-title">Resultados financieros</h2>

    <div v-if="!store.financialResults" class="financial-empty">
      <p v-if="faltaProduccion">Falta producción específica del terreno.</p>
      <p v-if="faltaArriendo">Falta arriendo anual — completa manualmente:</p>
      <input
        v-if="faltaArriendo"
        type="number"
        placeholder="Arriendo anual (COP)"
        class="financial-input"
        @change="(e) => (store.arriendoManual = Number((e.target as HTMLInputElement).value) || null)"
      />
    </div>

    <template v-else>
      <div class="financial-row">
        <span class="financial-label">TIR</span>
        <span class="financial-value">{{ formatPct(store.financialResults.tir) }}</span>
      </div>
      <div class="financial-row">
        <span class="financial-label">TIR c. beneficios tributarios</span>
        <span class="financial-value financial-value--highlight">{{ formatPct(store.financialResults.tirConBeneficios) }}</span>
      </div>
      <div class="financial-divider" />
      <div class="financial-row">
        <span class="financial-label">VPN</span>
        <span class="financial-value">{{ formatCOP(store.financialResults.vpn) }}</span>
      </div>
      <div class="financial-row">
        <span class="financial-label">VPN c. beneficios</span>
        <span class="financial-value financial-value--highlight">{{ formatCOP(store.financialResults.vpnConBeneficios) }}</span>
      </div>
      <div class="financial-divider" />
      <div class="financial-row">
        <span class="financial-label">Payback</span>
        <span class="financial-value">{{ formatAnios(store.financialResults.paybackAnios) }}</span>
      </div>
      <div class="financial-row">
        <span class="financial-label">Payback c. beneficios</span>
        <span class="financial-value financial-value--highlight">{{ formatAnios(store.financialResults.paybackConBeneficiosAnios) }}</span>
      </div>
    </template>

    <div class="financial-inputs">
      <label class="financial-input-label">
        Potencia AC (kVA)
        <input
          type="number"
          :value="store.kVA"
          class="financial-input"
          @change="(e) => (store.kVA = Number((e.target as HTMLInputElement).value) || 1000)"
        />
      </label>
    </div>
  </aside>
</template>

<style scoped>
.financial-panel {
  width: 280px;
  min-width: 280px;
  background: var(--card);
  border-left: 1.5px solid var(--border);
  padding: 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.financial-title {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--purple);
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--border);
  margin-bottom: 0.1rem;
}

.financial-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.8rem;
}
.financial-label { color: var(--text-mid); font-weight: 500; }
.financial-value { font-weight: 700; color: var(--text); }
.financial-value--highlight { color: var(--purple); }

.financial-divider { height: 1px; background: var(--border); margin: 0.2rem 0; }

.financial-empty {
  font-size: 0.78rem;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.financial-inputs {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border);
}
.financial-input-label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--muted);
}
.financial-input {
  background: #faf8fe;
  border: 1.5px solid var(--border);
  border-radius: 9px;
  padding: 0.45rem 0.7rem;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.85rem;
}
</style>
```

- [ ] **Step 2: Verificar que compila**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npx vue-tsc -b
```

Expected: mismos 2 errores preexistentes de siempre, ninguno nuevo en `FinancialResultsPanel.vue`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add frontend/src/components/FinancialResultsPanel.vue
git commit -m "feat: add FinancialResultsPanel component"
```

---

## Task 8: Integrar el panel en `EvaluadorView.vue` y verificar en el navegador

**Files:**
- Modify: `frontend/src/views/EvaluadorView.vue`

**Interfaces:**
- Consumes: `<FinancialResultsPanel />` (Task 7).

- [ ] **Step 1: Agregar el import**

En `frontend/src/views/EvaluadorView.vue`, junto a los demás imports de componentes:

```ts
import FinancialResultsPanel from '@/components/FinancialResultsPanel.vue'
```

- [ ] **Step 2: Ubicar el componente en el template**

El layout actual es:

```vue
    <div class="evaluador-body">
      <main class="evaluador-main">
        ...
      </main>
      <SummaryPanel />
    </div>
```

`.evaluador-body` ya es `display: flex`, `.evaluador-main` ya tiene `flex: 1`, y `SummaryPanel` ya trae su propio `width: 280px; min-width: 280px` — por lo que agregar una tercera columna de ancho fijo no requiere tocar ningún CSS, `FinancialResultsPanel` ya trae el mismo patrón de ancho fijo. Reemplaza ese bloque por:

```vue
    <div class="evaluador-body">
      <main class="evaluador-main">
        ...
      </main>
      <SummaryPanel />
      <FinancialResultsPanel />
    </div>
```

(el `...` representa el contenido existente de `<main>`, que no cambia).

- [ ] **Step 3: Reiniciar el servidor de desarrollo**

El watcher de archivos de Vite en este entorno no siempre detecta cambios hechos por herramientas de edición — reinicia el proceso para asegurar que recoja el cambio:

```bash
# Detener el proceso que esté escuchando en el puerto 5173 y luego:
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\frontend"
npm run dev
```

- [ ] **Step 4: Verificar manualmente en el navegador**

Abre `http://localhost:5173/`, busca el terreno **COLCEST11** (tiene arriendo y producción específica reales conocidos: 45,000,000 y 4.569 respectivamente). Confirma:
- El panel "Resultados financieros" aparece junto al resumen de costos.
- Muestra TIR, VPN y Payback (con y sin beneficios) con valores numéricos razonables (TIR entre 0% y 30% es un rango sano para este tipo de proyecto).
- Cambiar cualquier criterio (por ejemplo activar Pilotes) mueve el CAPEX y el panel financiero se recalcula solo, sin recargar la página.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
git add frontend/src/views/EvaluadorView.vue
git commit -m "feat: integrate FinancialResultsPanel into EvaluadorView"
```

---

## Resumen de dependencias entre tasks

```
Task 1 (backend) ─┐
Task 2 (tipos)  ───┼──> Task 6 (store) ──> Task 7 (panel) ──> Task 8 (integración)
Task 3 (math/data) ─> Task 4 (flujos) ─> Task 5 (resultados) ──┘
```

Tasks 1, 2 y 3 pueden hacerse en paralelo (no dependen entre sí). Task 4 depende de Task 3. Task 5 depende de Task 4. Task 6 depende de Tasks 2 y 5. Task 7 depende de Task 6. Task 8 depende de Task 7.
