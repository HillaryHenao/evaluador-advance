import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadCriteria, evaluateCriteria, aggregateCosts, evaluateScoped } from '../evaluatorEngine'
import comunidad from '@/criteria/comunidad'
import type { EvalContext } from '@/types'

const ctx: EvalContext = { baseCapex: 4_000_000_000, kWp: 1320 }

beforeEach(() => {
  // Reset cache between tests
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

  it('todos tienen un scope válido', () => {
    const criteria = loadCriteria()
    const validScopes = ['proyecto', 'terreno_dividido', 'terreno_multiplicado', 'terreno_no_dividido']
    for (const c of criteria) {
      expect(validScopes).toContain(c.scope)
    }
  })
})

describe('evaluateCriteria', () => {
  it('calcula sobrecosto correcto para corte=100m³', () => {
    const values = { corte: 100 }
    const results = evaluateCriteria(values, ctx)
    const corteResult = results.find(r => r.id === 'corte')
    expect(corteResult?.sobrecosto).toBe(8_000_000)
  })

  it('retorna sobrecosto 0 para criterios con formulaDefined=false, sin invocar computeCost', () => {
    const computeCostSpy = vi.spyOn(comunidad, 'computeCost')
    const values = { comunidad: 'conflicto' }
    const results = evaluateCriteria(values, ctx)
    const result = results.find(r => r.id === 'comunidad')
    expect(result?.sobrecosto).toBe(0)
    expect(result?.formulaDefined).toBe(false)
    expect(computeCostSpy).not.toHaveBeenCalled()
    computeCostSpy.mockRestore()
  })

  it('incluye los 18 criterios en el resultado aunque no tengan valor', () => {
    const results = evaluateCriteria({}, ctx)
    expect(results).toHaveLength(18)
  })
})

describe('aggregateCosts', () => {
  it('suma al CAPEX solo los criterios fijos/ambas con formulaDefined=true', () => {
    const values = { corte: 100, lleno: 10, pilotes: true }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    const expected = 100 * 80_000 + 10 * 210_000 + 156_000_000
    expect(aggregated.totalSobrecostoFijo).toBe(expected)
  })

  it('cuenta un resultado con value=null pero sobrecosto real distinto de cero (caso scope proyecto de evaluateScoped)', () => {
    const results = [
      {
        id: 'numero_arboles', label: 'Número de árboles', value: null, sobrecosto: 285_000,
        formulaDefined: true, fromDb: true, category: 'fijo' as const,
      },
    ]
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.totalSobrecostoFijo).toBe(285_000)
    expect(aggregated.capexTotal).toBe(ctx.baseCapex + 285_000)
  })

  it('calcula capexTotal = baseCapex + totalSobrecostoFijo', () => {
    const values = { corte: 100 }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.capexTotal).toBe(ctx.baseCapex + 100 * 80_000)
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

describe('evaluateScoped', () => {
  const proyectoNombres = ['P1', 'P2']
  const scopedCtx = { ...ctx, projectCount: 2 }

  it('scope proyecto: general suma el costo de cada proyecto; por proyecto usa su propio valor', () => {
    const values = {}
    const perProjectValues = { numero_arboles: { P1: 2, P2: 3 } }
    const { general, porProyecto } = evaluateScoped(values, perProjectValues, proyectoNombres, scopedCtx)

    const generalArboles = general.find(r => r.id === 'numero_arboles')
    expect(generalArboles?.sobrecosto).toBe(2 * 142_500 + 3 * 142_500)
    expect(generalArboles?.value).toBeNull()

    expect(porProyecto['P1'].find(r => r.id === 'numero_arboles')?.sobrecosto).toBe(2 * 142_500)
    expect(porProyecto['P2'].find(r => r.id === 'numero_arboles')?.sobrecosto).toBe(3 * 142_500)
  })

  it('scope terreno_dividido: general usa el costo completo; por proyecto lo divide entre N', () => {
    const values = { corte: 100 }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'corte')?.sobrecosto).toBe(100 * 80_000)
    expect(porProyecto['P1'].find(r => r.id === 'corte')?.sobrecosto).toBe((100 * 80_000) / 2)
    expect(porProyecto['P2'].find(r => r.id === 'corte')?.sobrecosto).toBe((100 * 80_000) / 2)
  })

  it('scope terreno_multiplicado: general multiplica por N; por proyecto usa el costo completo sin dividir', () => {
    const values = { nivel_tension: '34.5kV' }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'nivel_tension')?.sobrecosto).toBe(30_000_000 * 2)
    expect(porProyecto['P1'].find(r => r.id === 'nivel_tension')?.sobrecosto).toBe(30_000_000)
    expect(porProyecto['P2'].find(r => r.id === 'nivel_tension')?.sobrecosto).toBe(30_000_000)
  })

  it('scope terreno_no_dividido: general sin cambios; no aparece por proyecto', () => {
    const values = { cluster: 2 }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'cluster')?.sobrecosto).toBe(-15_000_000)
    expect(porProyecto['P1'].find(r => r.id === 'cluster')).toBeUndefined()
    expect(porProyecto['P2'].find(r => r.id === 'cluster')).toBeUndefined()
  })

  it('sin proyectos activos (projectCount ausente): terreno_dividido no divide (usa 1)', () => {
    const values = { corte: 100 }
    const { general } = evaluateScoped(values, {}, [], ctx)
    expect(general.find(r => r.id === 'corte')?.sobrecosto).toBe(100 * 80_000)
  })
})
