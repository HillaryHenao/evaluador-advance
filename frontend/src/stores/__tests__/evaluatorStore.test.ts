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
  area_hectareas: 6,
  precio_hectarea: 4379166,
  proyectos: [
    { nombre: 'Test Proyecto', distancia_via: 120, distancia_red: 350, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 5, tipo_estructura: 'Tracker', arriendo_anual: 26275000, precio_hectarea: null, area_hectareas: null },
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
    expect(store.criterionValues['nivel_tension']).toBe('34.5 kV')
    // 'or' ahora es puramente manual (meses de retraso) — el nombre real del operador vive
    // en terrainData.or (mostrado como detalle de solo lectura), no se autopobla en criterionValues.
    expect(store.criterionValues['or']).toBeUndefined()
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

  it('arriendoManual sobrescribe el arriendo de la plataforma, no solo cuando falta', async () => {
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue(mockTerrain)
    const store = useEvaluatorStore()
    await store.fetchTerrain('COLCEST5')
    store.arriendoManual = 30_000_000

    const esperado = calcularFinanzas({
      capex: store.aggregated.capexTotal, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: mockTerrain.produccion_especifica!, arriendoAnual: 30_000_000,
    })
    expect(store.financialResults!.vpn).toBeCloseTo(esperado.vpn, 6)
  })

  it('produccionEspecificaManual sobrescribe la producción de la plataforma, no solo cuando falta', async () => {
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue(mockTerrain)
    const store = useEvaluatorStore()
    await store.fetchTerrain('COLCEST5')
    store.produccionEspecificaManual = 5.0

    const esperado = calcularFinanzas({
      capex: store.aggregated.capexTotal, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 5.0, arriendoAnual: mockTerrain.arriendo_anual!,
    })
    expect(store.financialResults!.vpn).toBeCloseTo(esperado.vpn, 6)
  })

  it('arriendo_anual en $0 (real, no ausente) SÍ calcula financialResults — 0 no es "falta el dato"', async () => {
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({ ...mockTerrain, arriendo_anual: 0 })
    const store = useEvaluatorStore()
    await store.fetchTerrain('COLCEST5')
    expect(store.financialResults).not.toBeNull()
  })

  it('produccionEspecificaManual permite calcular financialResults cuando la plataforma no la trae', async () => {
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({ ...mockTerrain, produccion_especifica: null })
    const store = useEvaluatorStore()
    await store.fetchTerrain('COLCEST5')
    expect(store.financialResults).toBeNull()

    store.produccionEspecificaManual = 4.8
    expect(store.financialResults).not.toBeNull()
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
      produccion_especifica: 4.5, arriendo_anual: 20_000_000, area_hectareas: 10, precio_hectarea: 2_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: 'visita', aprovechamiento_forestal_detalle: 'Visita', numero_arboles: 2, tipo_estructura: 'tracker', arriendo_anual: 12_000_000, precio_hectarea: null, area_hectareas: null },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: 'Exonerado', numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000, precio_hectarea: null, area_hectareas: null },
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
      produccion_especifica: 4.5, arriendo_anual: 20_000_000, area_hectareas: 10, precio_hectarea: 2_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: 10, distancia_red: 30, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 0, tipo_estructura: 'tracker', arriendo_anual: 12_000_000, precio_hectarea: null, area_hectareas: null },
        { nombre: 'P2', distancia_via: 12, distancia_red: 28, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000, precio_hectarea: null, area_hectareas: null },
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
      produccion_especifica: 4.5, arriendo_anual: 20_000_000, area_hectareas: 10, precio_hectarea: 2_000_000,
      // Sin datos de scope 'proyecto' (todo null). El único costo fijo que sí aplica es el
      // crédito de cluster (scope 'terreno_dividido', cluster=2 → -15M repartido entre los
      // 2 proyectos = -7.5M cada uno) — el capex de cada proyecto es store.baseCapex menos
      // ese crédito, no exactamente store.baseCapex.
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000, precio_hectarea: null, area_hectareas: null },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000, precio_hectarea: null, area_hectareas: null },
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

  it('incluye TIR y Payback completos por proyecto, no solo VPN', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000, area_hectareas: 10, precio_hectarea: 2_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000, precio_hectarea: null, area_hectareas: null },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000, precio_hectarea: null, area_hectareas: null },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    const esperadoP1 = calcularFinanzas({
      capex: store.baseCapex - 7_500_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 12_000_000,
    })

    expect(store.perProjectFinancials!['P1'].tir).toBeCloseTo(esperadoP1.tir, 6)
    expect(store.perProjectFinancials!['P1'].tirConBeneficios).toBeCloseTo(esperadoP1.tirConBeneficios, 6)
    expect(store.perProjectFinancials!['P1'].paybackAnios).toBeCloseTo(esperadoP1.paybackAnios, 6)
    expect(store.perProjectFinancials!['P1'].paybackConBeneficiosAnios).toBeCloseTo(esperadoP1.paybackConBeneficiosAnios, 6)
    // P1 y P2 tienen arriendo distinto → su TIR también debe diferir (no solo el VPN).
    expect(store.perProjectFinancials!['P1'].tir).not.toBe(store.perProjectFinancials!['P2'].tir)
  })

  it('mesa_fija usa un CAPEX base distinto (3.750M) al de los demás proyectos (4.000M)', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000, area_hectareas: 10, precio_hectarea: 2_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: 'tracker', arriendo_anual: 12_000_000, precio_hectarea: null, area_hectareas: null },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000, precio_hectarea: null, area_hectareas: null },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    // El crédito de cluster (terreno_dividido, cluster=2 → -15M) se sigue repartiendo por
    // igual entre los 2 proyectos (-7.5M c/u), independiente del capex base de cada uno.
    // P1 es tracker → produccionEspecifica lleva el factor 1.1 (P2 es mesa_fija, sin ajuste).
    const esperadoP1 = calcularFinanzas({
      capex: store.baseCapex - 7_500_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5 * 1.1, arriendoAnual: 12_000_000,
    })
    const esperadoP2 = calcularFinanzas({
      capex: 3_750_000_000 - 7_500_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 8_000_000,
    })

    expect(store.perProjectFinancials!['P1'].vpn).toBeCloseTo(esperadoP1.vpn, 6)
    expect(store.perProjectFinancials!['P2'].vpn).toBeCloseTo(esperadoP2.vpn, 6)

    // El total general suma el capex base de CADA proyecto (4.000M + 3.750M), no
    // baseCapex * N (que asumiría que todos los proyectos usan el mismo capex base).
    expect(store.aggregated.capexTotal).toBe(store.baseCapex + 3_750_000_000 - 15_000_000)
  })

  it('tracker multiplica la producción específica x1.1 — Google Sheet de referencia: 4.117 × 1.1 = 4.529', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLBOYT147', name: 'Test', municipality: 'Tunja', or: 'EBSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.117, arriendo_anual: 20_000_000, area_hectareas: null, precio_hectarea: null,
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: 'tracker', arriendo_anual: 12_000_000, precio_hectarea: null, area_hectareas: null },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: 'mesa_fija', arriendo_anual: 8_000_000, precio_hectarea: null, area_hectareas: null },
      ],
    })
    await store.fetchTerrain('COLBOYT147')

    const esperadoP1 = calcularFinanzas({
      capex: store.baseCapex - 7_500_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.117 * 1.1, arriendoAnual: 12_000_000,
    })
    const esperadoP2 = calcularFinanzas({
      capex: 3_750_000_000 - 7_500_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.117, arriendoAnual: 8_000_000,
    })

    expect(store.perProjectFinancials!['P1'].vpn).toBeCloseTo(esperadoP1.vpn, 6)
    expect(store.perProjectFinancials!['P2'].vpn).toBeCloseTo(esperadoP2.vpn, 6)
    // El ajuste solo aplica al tracker — mismos VPN si P1 no recibiera el factor 1.1.
    expect(store.perProjectFinancials!['P1'].vpn).not.toBeCloseTo(
      calcularFinanzas({
        capex: store.baseCapex - 7_500_000, kWp: store.kWp, kVA: store.kVA,
        produccionEspecifica: 4.117, arriendoAnual: 12_000_000,
      }).vpn,
      6,
    )
  })

  it('general (financialResults) multiplica kWp y kVA por N, no los deja sin escalar', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000, area_hectareas: 10, precio_hectarea: 2_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000, precio_hectarea: null, area_hectareas: null },
        { nombre: 'P2', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 8_000_000, precio_hectarea: null, area_hectareas: null },
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

  it('arriendo_anual en $0 por proyecto (real, no ausente) SÍ incluye ese proyecto — caso real COLBOYT147', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLBOYT147', name: 'Test', municipality: 'Tunja', or: 'EBSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: true, ocupacion_cauce_detalle: 'Pendiente',
      servidumbre: null, servidumbre_detalle: { tipo: 'Ajena', estado: 'Pendiente' },
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.117, arriendo_anual: 0, area_hectareas: null, precio_hectarea: 8_255_000,
      proyectos: [
        { nombre: 'P1', distancia_via: 20, distancia_red: 190, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: 'Exonerado', numero_arboles: 0, tipo_estructura: 'tracker', arriendo_anual: 0, precio_hectarea: 10_510_000, area_hectareas: null },
        { nombre: 'P2', distancia_via: 20, distancia_red: 190, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: 'Exonerado', numero_arboles: 0, tipo_estructura: 'mesa_fija', arriendo_anual: 0, precio_hectarea: 6_000_000, area_hectareas: null },
      ],
    })
    await store.fetchTerrain('COLBOYT147')

    expect(store.perProjectFinancials).not.toBeNull()
    expect(store.perProjectFinancials!['P1']).toBeDefined()
    expect(store.perProjectFinancials!['P2']).toBeDefined()
  })

  it('precio/Ha × área reemplaza a arriendo_anual cuando ambos existen — valores reales COLBOYT147P1 (10.510.000 COP/Ha × 2.5 Ha)', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.117, arriendo_anual: 20_000_000, area_hectareas: 2.5, precio_hectarea: 10_510_000,
      proyectos: [
        // arriendo_anual=0 (como el termsheet real de COLBOYT147P1, sin diligenciar) pero
        // con precio_hectarea/area_hectareas presentes — debe ganar el calculado.
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 0, precio_hectarea: 10_510_000, area_hectareas: 2.5 },
      ],
    })
    await store.fetchTerrain('COLSANT5')

    // Un solo proyecto en el terreno → crédito de cluster completo (-15M), sin dividir.
    const esperado = calcularFinanzas({
      capex: store.baseCapex - 15_000_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.117, arriendoAnual: 26_275_000,
    })
    const usandoArriendoAnualCero = calcularFinanzas({
      capex: store.baseCapex - 15_000_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.117, arriendoAnual: 0,
    })

    expect(store.perProjectFinancials!['P1'].vpn).toBeCloseTo(esperado.vpn, 6)
    expect(store.perProjectFinancials!['P1'].vpn).not.toBeCloseTo(usandoArriendoAnualCero.vpn, 6)
  })

  it('arriendoManual sirve de fallback para un proyecto sin arriendo_anual propio', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: null, area_hectareas: 10, precio_hectarea: 2_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: null, precio_hectarea: null, area_hectareas: null },
      ],
    })
    await store.fetchTerrain('COLSANT5')
    expect(store.perProjectFinancials).toBeNull()

    store.arriendoManual = 15_000_000
    expect(store.perProjectFinancials).not.toBeNull()
    // cluster=2 con un solo proyecto en el terreno aplica el crédito completo (-15M) sin dividir.
    const esperado = calcularFinanzas({
      capex: store.baseCapex - 15_000_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 4.5, arriendoAnual: 15_000_000,
    })
    expect(store.perProjectFinancials!['P1'].vpn).toBeCloseTo(esperado.vpn, 6)
  })

  it('produccionEspecificaManual sobrescribe la producción usada por cada proyecto', async () => {
    const store = useEvaluatorStore()
    vi.spyOn(terrainService, 'fetchTerrainData').mockResolvedValue({
      code: 'COLSANT5', name: 'Test', municipality: 'Giron', or: 'ESSA',
      nivel_tension: '13.8kV', cluster: 2,
      ocupacion_cauce: false, ocupacion_cauce_detalle: 'No Requiere',
      servidumbre: 0, servidumbre_detalle: null,
      coexistencias: false, coexistencias_detalle: [],
      produccion_especifica: 4.5, arriendo_anual: 20_000_000, area_hectareas: 10, precio_hectarea: 2_000_000,
      proyectos: [
        { nombre: 'P1', distancia_via: null, distancia_red: null, aprovechamiento_forestal: null, aprovechamiento_forestal_detalle: null, numero_arboles: null, tipo_estructura: null, arriendo_anual: 12_000_000, precio_hectarea: null, area_hectareas: null },
      ],
    })
    await store.fetchTerrain('COLSANT5')
    store.produccionEspecificaManual = 5.2

    const esperado = calcularFinanzas({
      capex: store.baseCapex - 15_000_000, kWp: store.kWp, kVA: store.kVA,
      produccionEspecifica: 5.2, arriendoAnual: 12_000_000,
    })
    expect(store.perProjectFinancials!['P1'].vpn).toBeCloseTo(esperado.vpn, 6)
  })
})
