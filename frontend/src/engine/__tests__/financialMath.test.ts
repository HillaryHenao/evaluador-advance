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
