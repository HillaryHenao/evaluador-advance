import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEvaluatorStore } from '../evaluatorStore'
import * as terrainService from '@/services/terrainService'
import type { TerrainData } from '@/types'

const mockTerrain: TerrainData = {
  code: 'COLCEST5',
  name: 'Test Proyecto',
  municipality: 'Aguachica',
  distancia_via: 120,
  distancia_red: 350,
  or: 'AFINIA',
  nivel_tension: '34.5 kV',
  cluster: 2,
  tipo_estructura: 'Tracker',
  ocupacion_cauce: false,
  ocupacion_cauce_detalle: 'No Requiere',
  servidumbre: 0,
  servidumbre_detalle: { tipo: 'Propia', estado: 'Aprobada' },
  aprovechamiento_forestal: null,
  aprovechamiento_forestal_detalle: [{ proyecto: 'Test Proyecto', estado: 'Exonerado' }],
  coexistencias: false,
  coexistencias_detalle: [],
  numero_arboles: 5,
  produccion_especifica: 4.5287,
  arriendo_anual: 26275000,
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useEvaluatorStore', () => {
  it('fetchTerrain autocompletea campos DB en criterionValues', async () => {
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue(mockTerrain)
    const store = useEvaluatorStore()
    await store.fetchTerrain('COLCEST5')
    expect(store.criterionValues['distancia_via']).toBe(120)
    expect(store.criterionValues['distancia_red']).toBe(350)
    expect(store.criterionValues['or']).toBe('AFINIA')
  })

  it('setCriterionValue actualiza el valor y recalcula', () => {
    const store = useEvaluatorStore()
    store.setCriterionValue('corte', 100)
    expect(store.criterionValues['corte']).toBe(100)
    const corteResult = store.aggregated.breakdown.find(r => r.id === 'corte')
    expect(corteResult?.sobrecosto).toBe(5_700_000)
  })

  it('aggregated.capexTotal incluye baseCapex + sobrecostos', () => {
    const store = useEvaluatorStore()
    store.setCriterionValue('corte', 100)
    expect(store.aggregated.capexTotal).toBe(store.baseCapex + 5_700_000)
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
