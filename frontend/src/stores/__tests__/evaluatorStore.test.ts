import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEvaluatorStore } from '../evaluatorStore'
import * as terrainService from '@/services/terrainService'
import { calcularFinanzas } from '@/engine/financialEngine'
import type { TerrainData } from '@/types'

const mockTerrain: TerrainData = {
  code: 'COLCEST5',
  name: 'Test Proyecto',
  municipality: 'Aguachica',
  or: 'AFINIA',
  nivel_tension: '34.5 kV',
  cluster: 2,
  ocupacion_cauce: false,
  ocupacion_cauce_detalle: 'No Requiere',
  servidumbre: 0,
  servidumbre_detalle: { tipo: 'Propia', estado: 'Aprobada' },
  coexistencias: false,
  coexistencias_detalle: [],
  produccion_especifica: 4.5287,
  arriendo_anual: 26275000,
  proyectos: [
    { nombre: 'Test Proyecto', distancia_via: 120, distancia_red: 350, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 5, tipo_estructura: 'Tracker', arriendo_anual: 26275000 },
  ],
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useEvaluatorStore', () => {
  it('fetchTerrain autocompletea campos DB en criterionValues', async () => {
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue(mockTerrain)
    const store = useEvaluatorStore()
    await store.fetchTerrain('COLCEST5')
    expect(store.criterionValues['or']).toBe('AFINIA')
    expect(store.criterionValues['nivel_tension']).toBe('34.5 kV')
    // Los criterios scope 'proyecto' ya no se autopoblan en criterionValues:
    // viven en perProjectValues (ver describe 'perProjectValues y perProjectResults').
    expect(store.criterionValues['distancia_via']).toBeUndefined()
    expect(store.perProjectValues['distancia_via']).toEqual({ 'Test Proyecto': 120 })
  })

  it('setCriterionValue actualiza el valor y recalcula', () => {
    const store = useEvaluatorStore()
    store.setCriterionValue('corte', 100)
    expect(store.criterionValues['corte']).toBe(100)
    const corteResult = store.aggregated.breakdown.find(r => r.id === 'corte')
    expect(corteResult?.sobrecosto).toBe(8_000_000)
  })

  it('aggregated.capexTotal incluye baseCapex + sobrecostos', () => {
    const store = useEvaluatorStore()
    store.setCriterionValue('corte', 100)
    expect(store.aggregated.capexTotal).toBe(store.baseCapex + 8_000_000)
  })
})

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

describe('perProjectValues y perProjectResults', () => {
  it('se autopobla desde terrainData.proyectos al buscar terreno', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: 'visita', aprovechamiento_forestal_detalle: 'Visita', numero_arboles: 2, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: 'Exonerado', numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    expect(store.perProjectValues['numero_arboles']).toEqual({ P1: 2, P2: 0 })
    expect(store.perProjectValues['distancia_via']).toEqual({ P1: 10, P2: 12 })
  })

  it('setPilotesForProyecto actualiza solo el proyecto indicado', () => {
    const store = useEvaluatorStore()
    store.setPilotesForProyecto('P1', true)
    store.setPilotesForProyecto('P2', false)
    expect(store.perProjectValues['pilotes']).toEqual({ P1: true, P2: false })
  })

  it('perProjectResults refleja la división terreno_dividido entre proyectos', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 0, tipo_estructura: 'tracker', arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000 },
      ],
    })
    await store.fetchTerrain('COLSANT5')
    store.setCriterionValue('corte', 100)

    const p1Corte = store.perProjectResults['P1'].find(r => r.id === 'corte')
    expect(p1Corte?.sobrecosto).toBe((100 * 80_000) / 2)
  })
})

describe('perProjectFinancials', () => {
  it('cada proyecto usa su propio capex/kWp/kVA/arriendo COMPLETOS, sin dividir entre N', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000,
      // Sin datos de scope 'proyecto' (todo null). El único costo fijo que sí aplica es el
      // crédito de cluster (scope 'terreno_dividido', cluster=2 → -15M repartido entre los
      // 2 proyectos = -7.5M cada uno) — el capex de cada proyecto es store.baseCapex menos
      // ese crédito, no exactamente store.baseCapex.
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    expect(store.perProjectFinancials).not.toBeNull()

    const esperadoP1 = calcularFinanzas({
      capex: store.baseCapex - 7_500_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 12_000_000,
    })
    const esperadoP2 = calcularFinanzas({
      capex: store.baseCapex - 7_500_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 8_000_000,
    })

    expect(store.perProjectFinancials!['P1'].vpn).toBeCloseTo(esperadoP1.vpn, 6)
    expect(store.perProjectFinancials!['P2'].vpn).toBeCloseTo(esperadoP2.vpn, 6)
    // P1 y P2 tienen arriendo distinto (12M vs 8M) y NADA se divide entre ellos — por eso
    // sus VPN deben diferir. Bajo el modelo anterior (dividir por N) ambos habrían recibido
    // el mismo arriendo compartido y habrían dado resultados idénticos; este test falla si
    // alguien reintroduce esa división.
    expect(store.perProjectFinancials!['P1'].vpn).not.toBe(store.perProjectFinancials!['P2'].vpn)
  })

  it('general (financialResults) multiplica kWp y kVA por N, no los deja sin escalar', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000 },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000 },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    const esperado = calcularFinanzas({
      capex: store.aggregated.capexTotal,
      kWp: store.kWp * 2,
      kVA: store.kVA * 2,
      produccionEspecifica: 4.5,
      arriendoAnual: 20_000_000,
    })

    expect(store.financialResults!.vpn).toBeCloseTo(esperado.vpn, 6)
  })
})
