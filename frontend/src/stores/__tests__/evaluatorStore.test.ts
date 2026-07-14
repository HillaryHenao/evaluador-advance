import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEvaluatorStore } from '../evaluatorStore'
import * as terrainService from '@/services/terrainService'
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
    { nombre: 'Test Proyecto', distancia_via: 120, distancia_red: 350, aprovechamiento_forestal: null, numero_arboles: 5, tipo_estructura: 'Tracker' },
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
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: 'visita', numero_arboles: 2, tipo_estructura: 'tracker' },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija' },
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
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'tracker' },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija' },
      ],
    })
    await store.fetchTerrain('COLSANT5')
    store.setCriterionValue('corte', 100)

    const p1Corte = store.perProjectResults['P1'].find(r => r.id === 'corte')
    expect(p1Corte?.sobrecosto).toBe((100 * 80_000) / 2)
  })
})

describe('perProjectFinancials', () => {
  it('divide capex, kWp, kVA y arriendo entre N proyectos para el VPN', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'tracker' },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, numero_arboles: 0, tipo_estructura: 'mesa_fija' },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    expect(store.perProjectFinancials).not.toBeNull()
    const p1 = store.perProjectFinancials!['P1'].vpn
    const p2 = store.perProjectFinancials!['P2'].vpn
    // Ambos proyectos reciben la misma división (N=2) con datos simétricos, así que
    // deben coincidir exactamente entre sí.
    expect(p1).toBe(p2)
    // No se espera igualdad exacta con financialResults.vpn / 2: calcularFinanzas() incluye
    // costos absolutos que NO escalan con capex/kWp/kVA (servicios públicos, mantenimiento
    // de tracker, reemplazo de inversores — ver financialEngine.ts). Al dividir un terreno
    // en N proyectos esos costos fijos se pagan N veces en vez de dividirse entre N, así que
    // el VPN por proyecto queda por debajo de (vpn total / N), no exactamente en la mitad.
    // Se verifica un rango razonable en lugar de una igualdad exacta.
    const mitad = store.financialResults!.vpn / 2
    expect(p1).toBeGreaterThan(mitad * 0.5)
    expect(p1).toBeLessThan(mitad)
  })
})
