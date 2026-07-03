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
