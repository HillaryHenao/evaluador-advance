import { describe, it, expect } from 'vitest'
import { calcularFlujosDeCaja, calcularFinanzas, costoMantenimientoTracker, costoReemplazoInversores } from '../financialEngine'

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

  it('Payback ≈ 9 años (±1 año, aproximación conocida)', () => {
    expect(resultado.paybackAnios).toBeGreaterThan(8)
    expect(resultado.paybackAnios).toBeLessThan(10)
  })

  it('Payback con beneficios ≈ 7 años (±1 año, aproximación conocida)', () => {
    expect(resultado.paybackConBeneficiosAnios).toBeGreaterThan(6)
    expect(resultado.paybackConBeneficiosAnios).toBeLessThan(8)
  })
})

describe('costoMantenimientoTracker — escala proporcional al kWp (referencia 1320 kWp)', () => {
  it('en el caso de referencia (1320 kWp) devuelve el monto literal del Excel', () => {
    expect(costoMantenimientoTracker(6, 1320)).toBeCloseTo(-35_117_188.69, 2)
    expect(costoMantenimientoTracker(16, 1320)).toBeCloseTo(-48_119_013.38, 2)
  })

  it('duplica el costo si el kWp del proyecto duplica al de referencia', () => {
    expect(costoMantenimientoTracker(6, 2640)).toBeCloseTo(-35_117_188.69 * 2, 2)
  })

  it('reduce el costo a la mitad si el kWp es la mitad del de referencia', () => {
    expect(costoMantenimientoTracker(6, 660)).toBeCloseTo(-35_117_188.69 * 0.5, 2)
  })

  it('es 0 en períodos sin mantenimiento de tracker', () => {
    expect(costoMantenimientoTracker(7, 1320)).toBe(0)
  })
})

describe('costoReemplazoInversores — escala proporcional al kVA (referencia 1000 kVA)', () => {
  it('en el caso de referencia (1000 kVA) devuelve el monto literal del Excel', () => {
    expect(costoReemplazoInversores(16, 1000)).toBeCloseTo(-250_052_057, 2)
  })

  it('reduce el costo a la mitad si el kVA es la mitad del de referencia', () => {
    expect(costoReemplazoInversores(16, 500)).toBeCloseTo(-250_052_057 * 0.5, 2)
  })

  it('duplica el costo si el kVA duplica al de referencia', () => {
    expect(costoReemplazoInversores(16, 2000)).toBeCloseTo(-250_052_057 * 2, 2)
  })

  it('es 0 en períodos sin reemplazo de inversores', () => {
    expect(costoReemplazoInversores(15, 1000)).toBe(0)
  })
})
