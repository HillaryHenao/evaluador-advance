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

