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
  it('carga exactamente 19 criterios', () => {
    const criteria = loadCriteria()
    expect(criteria).toHaveLength(19)
  })

  it('todos tienen id, label e inputType', () => {
    const criteria = loadCriteria()
    for (const c of criteria) {
      expect(c.id).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(['number', 'toggle', 'select']).toContain(c.inputType)
    }
  })
})

describe('evaluateCriteria', () => {
  it('calcula sobrecosto correcto para corte=100m³', () => {
    const values = { corte: 100 }
    const results = evaluateCriteria(values, ctx)
    const corteResult = results.find(r => r.id === 'corte')
    expect(corteResult?.sobrecosto).toBe(5_000_000)
  })

  it('retorna sobrecosto 0 para criterios con formulaDefined=false', () => {
    const values = { amenazas: 'alta' }
    const results = evaluateCriteria(values, ctx)
    const amenazasResult = results.find(r => r.id === 'amenazas')
    expect(amenazasResult?.sobrecosto).toBe(0)
    expect(amenazasResult?.formulaDefined).toBe(false)
  })

  it('incluye los 19 criterios en el resultado aunque no tengan valor', () => {
    const results = evaluateCriteria({}, ctx)
    expect(results).toHaveLength(19)
  })
})

describe('aggregateCosts', () => {
  it('suma solo los criterios con formulaDefined=true y valor distinto de null', () => {
    const values = { corte: 100, lleno: 10, pilotes: true }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    const expected = 100 * 50_000 + 10 * 250_000 + 156_000_000
    expect(aggregated.totalSobrecosto).toBe(expected)
  })

  it('calcula capexTotal = baseCapex + totalSobrecosto', () => {
    const values = { corte: 100 }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.capexTotal).toBe(ctx.baseCapex + 100 * 50_000)
  })

  it('retorna breakdown con todos los criterios', () => {
    const results = evaluateCriteria({}, ctx)
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.breakdown).toHaveLength(19)
  })
})
