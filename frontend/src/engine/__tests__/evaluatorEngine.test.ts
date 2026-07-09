import { describe, it, expect, beforeEach } from 'vitest'
import { loadCriteria, evaluateCriteria, aggregateCosts } from '../evaluatorEngine'
import type { EvalContext } from '@/types'

const ctx: EvalContext = { baseCapex: 4_000_000_000, kWp: 1320 }

beforeEach(() => {
  // Reset cache between tests
  // @ts-expect-error accessing module internals for test reset
  // The cache is module-level; re-importing is not needed — glob is eager
})

describe('loadCriteria', () => {
  it('carga exactamente 18 criterios', () => {
    const criteria = loadCriteria()
    expect(criteria).toHaveLength(18)
  })

  it('todos tienen id, label e inputType', () => {
    const criteria = loadCriteria()
    for (const c of criteria) {
      expect(c.id).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(['number', 'toggle', 'select', 'checklist']).toContain(c.inputType)
    }
  })
})

describe('evaluateCriteria', () => {
  it('calcula sobrecosto correcto para corte=100m³', () => {
    const values = { corte: 100 }
    const results = evaluateCriteria(values, ctx)
    const corteResult = results.find(r => r.id === 'corte')
    expect(corteResult?.sobrecosto).toBe(5_700_000)
  })

  it('retorna sobrecosto 0 para criterios con formulaDefined=false', () => {
    const values = { obras_hidraulicas: 'alta' }
    const results = evaluateCriteria(values, ctx)
    const result = results.find(r => r.id === 'obras_hidraulicas')
    expect(result?.sobrecosto).toBe(0)
    expect(result?.formulaDefined).toBe(true)
  })

  it('incluye los 18 criterios en el resultado aunque no tengan valor', () => {
    const results = evaluateCriteria({}, ctx)
    expect(results).toHaveLength(18)
  })
})

describe('aggregateCosts', () => {
  it('suma al CAPEX solo los criterios fijos/ambas con formulaDefined=true y valor distinto de null', () => {
    const values = { corte: 100, lleno: 10, pilotes: true }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    const expected = 100 * 57_000 + 10 * 190_000 + 156_000_000
    expect(aggregated.totalSobrecostoFijo).toBe(expected)
  })

  it('calcula capexTotal = baseCapex + totalSobrecostoFijo', () => {
    const values = { corte: 100 }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.capexTotal).toBe(ctx.baseCapex + 100 * 57_000)
  })

  it('pilotes suma 156M al CAPEX como costo fijo, no al factor de riesgo', () => {
    const values = { pilotes: true }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.totalSobrecostoFijo).toBe(156_000_000)
    expect(aggregated.capexTotal).toBe(ctx.baseCapex + 156_000_000)
    expect(aggregated.totalRiesgoCosto).toBe(0)
    expect(aggregated.totalRetraso).toBe(0)
  })

  it('amenazas suma a totalRetraso en meses, no a totalRiesgoCosto', () => {
    const values = { amenazas: 'malo' }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.totalRetrasoMeses).toBe(2)
    expect(aggregated.totalRiesgoCosto).toBe(0)
  })

  it('retorna breakdown con todos los criterios', () => {
    const results = evaluateCriteria({}, ctx)
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.breakdown).toHaveLength(18)
  })
})
