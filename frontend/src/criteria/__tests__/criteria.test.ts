import { describe, it, expect } from 'vitest'
import corte from '../corte'
import lleno from '../lleno'
import pilotes from '../pilotes'
import distanciaRed from '../distancia_red'
import distanciaVia from '../distancia_via'

const ctx = { baseCapex: 4_000_000_000, kWp: 1320 }

describe('corte', () => {
  it('calcula 57.000 COP por m³', () => {
    expect(corte.computeCost(100, ctx)).toBe(5_700_000)
  })
  it('retorna 0 para valor nulo', () => {
    expect(corte.computeCost(null, ctx)).toBe(0)
  })
  it('tiene formulaDefined true', () => {
    expect(corte.formulaDefined).toBe(true)
  })
})

describe('lleno', () => {
  it('calcula 190.000 COP por m³', () => {
    expect(lleno.computeCost(10, ctx)).toBe(1_900_000)
  })
  it('retorna 0 para valor nulo', () => {
    expect(lleno.computeCost(null, ctx)).toBe(0)
  })
})

describe('pilotes', () => {
  it('retorna 156.000.000 cuando es true', () => {
    expect(pilotes.computeCost(true, ctx)).toBe(156_000_000)
  })
  it('retorna 0 cuando es false', () => {
    expect(pilotes.computeCost(false, ctx)).toBe(0)
  })
})

describe('distancia_red', () => {
  it('aplica tarifa de 509.000/m para ≤99m', () => {
    expect(distanciaRed.computeCost(65, ctx)).toBe(65 * 509_000)
  })
  it('aplica tarifa de 420.000/m para tramo 100-299m', () => {
    expect(distanciaRed.computeCost(130, ctx)).toBe(130 * 420_000)
  })
  it('aplica tarifa de 380.000/m para tramo 300-499m', () => {
    expect(distanciaRed.computeCost(400, ctx)).toBe(400 * 380_000)
  })
  it('aplica tarifa de 350.000/m para tramo 500-799m', () => {
    expect(distanciaRed.computeCost(600, ctx)).toBe(600 * 350_000)
  })
  it('aplica tarifa de 312.500/m para ≥800m', () => {
    expect(distanciaRed.computeCost(1000, ctx)).toBe(1000 * 312_500)
  })
  it('retorna 0 para valor nulo', () => {
    expect(distanciaRed.computeCost(null, ctx)).toBe(0)
  })
})

describe('distancia_via', () => {
  it('calcula 457.292 COP por metro', () => {
    expect(distanciaVia.computeCost(100, ctx)).toBe(100 * 457_292)
  })
  it('retorna 0 para valor nulo', () => {
    expect(distanciaVia.computeCost(null, ctx)).toBe(0)
  })
})
