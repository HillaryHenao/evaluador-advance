import type { FinancialInputs } from '@/types'
import { AÑO_BASE, IPC, FX, PPA_CON_INDEXACION, MANTENIMIENTO_TRACKER, REEMPLAZO_INVERSORES } from './financialData'

const N_PERIODOS = 34               // 2026 (inversión) a 2059
const DURACION_OPERACION_ANIOS = 30 // activo mientras (año - (AÑO_BASE+1)) <= 30
const EFICIENCIA_INICIAL = 0.992
const FACTOR_DEGRADACION = 0.0035
const OPERACION_PCT_INGRESOS = 0.038
const CGM_POR_KWH = 6.0
const REPRESENTACION_POR_KWH = 6.0
const COSTOS_REGULATORIOS_POR_KWH = 13.0
const SEGURO_PCT_CAPEX = 0.00185
const CRECIMIENTO_SEGURO = 0.01
const ICA = 0.006
const IVA = 0.19
const MANTENIMIENTO_POR_KVA = 54000.0
const SERVICIOS_PUBLICOS_MENSUAL = 1_500_000.0
const PRECIO_REC_USD_MWH = 1.5

function activo(anio: number): number {
  return anio - (AÑO_BASE + 1) <= DURACION_OPERACION_ANIOS ? 1 : 0
}

export function calcularFlujosDeCaja(inputs: FinancialInputs): {
  flujoInversionista: number[]
} {
  const { capex, kWp, kVA, produccionEspecifica, arriendoAnual } = inputs

  const eficiencia: number[] = new Array(N_PERIODOS).fill(0)
  const generacion: number[] = new Array(N_PERIODOS).fill(0)
  const ingresos: number[] = new Array(N_PERIODOS).fill(0)
  const arriendo: number[] = new Array(N_PERIODOS).fill(0)
  const operacion: number[] = new Array(N_PERIODOS).fill(0)
  const cgm: number[] = new Array(N_PERIODOS).fill(0)
  const representacion: number[] = new Array(N_PERIODOS).fill(0)
  const costosRegulatorios: number[] = new Array(N_PERIODOS).fill(0)
  const seguro: number[] = new Array(N_PERIODOS).fill(0)
  const ica: number[] = new Array(N_PERIODOS).fill(0)
  const iva: number[] = new Array(N_PERIODOS).fill(0)
  const mantenimiento: number[] = new Array(N_PERIODOS).fill(0)
  const serviciosPublicos: number[] = new Array(N_PERIODOS).fill(0)
  const flujoOperativo: number[] = new Array(N_PERIODOS).fill(0)
  const flujoInversionista: number[] = new Array(N_PERIODOS).fill(0)

  // CGM/Representación/Costos regulatorios se cobran como una tarifa COP/kWh que crece
  // con IPC cada año (igual que el Excel: fila 14/15/16 recuperan la tarifa implícita del
  // año anterior vía "costo_anterior/generación_anterior" y la crecen antes de multiplicar
  // por la generación del año actual). Se trackean aparte para no perder precisión.
  let tarifaCgm = CGM_POR_KWH
  let tarifaRepresentacion = REPRESENTACION_POR_KWH
  let tarifaCostosRegulatorios = COSTOS_REGULATORIOS_POR_KWH

  // Año 0 (2026): solo el desembolso de la inversión (Supuestos!D30).
  flujoInversionista[0] = -capex

  for (let k = 1; k < N_PERIODOS; k++) {
    const anio = AÑO_BASE + k
    const act = activo(anio)

    // Eficiencia y generación
    eficiencia[k] = k === 1 ? EFICIENCIA_INICIAL : eficiencia[k - 1] - FACTOR_DEGRADACION
    generacion[k] = eficiencia[k] * kWp * produccionEspecifica * 365 * act

    // Ingresos: PPA usa el valor del AÑO ANTERIOR de la tabla macro (offset -1, ver spec)
    const ppa = PPA_CON_INDEXACION[k - 1] ?? PPA_CON_INDEXACION[PPA_CON_INDEXACION.length - 1]
    const ventaEnergia = ppa * generacion[k] * act
    const fx = FX[k] ?? FX[FX.length - 1]
    const precioRecCopPorMwh = PRECIO_REC_USD_MWH * fx
    const rec = precioRecCopPorMwh * (generacion[k] / 1000) * act
    ingresos[k] = ventaEnergia + rec

    // Costos (todos negativos). Crecimiento por IPC: para pasar del año (k-1) al año k
    // se usa IPC[k-1] (el IPC "del año k-1", que es la tasa que lo infla hacia el año k) —
    // IPC[i] en financialData.ts está alineado por año calendario (índice 0 = 2026).
    if (k === 1) {
      arriendo[k] = -arriendoAnual
    } else {
      arriendo[k] = arriendo[k - 1] * (1 + IPC[k - 1]) * act
    }
    operacion[k] = -ingresos[k] * OPERACION_PCT_INGRESOS * act

    if (k > 1) {
      tarifaCgm *= 1 + IPC[k - 1]
      tarifaRepresentacion *= 1 + IPC[k - 1]
      tarifaCostosRegulatorios *= 1 + IPC[k - 1]
    }
    cgm[k] = -generacion[k] * tarifaCgm * act
    representacion[k] = -generacion[k] * tarifaRepresentacion * act
    costosRegulatorios[k] = -generacion[k] * tarifaCostosRegulatorios * act

    if (k === 1) {
      seguro[k] = -capex * SEGURO_PCT_CAPEX
    } else {
      seguro[k] = seguro[k - 1] * (1 + CRECIMIENTO_SEGURO) * act
    }

    ica[k] = -ventaEnergia * ICA

    if (k === 1) {
      mantenimiento[k] = -kVA * MANTENIMIENTO_POR_KVA
    } else {
      mantenimiento[k] = mantenimiento[k - 1] * (1 + IPC[k - 1]) * act
    }

    // IVA no deducible sobre operación (mitad), representación y mantenimiento
    iva[k] = (operacion[k] / 2 + representacion[k] + mantenimiento[k]) * IVA

    if (k === 1) {
      serviciosPublicos[k] = -SERVICIOS_PUBLICOS_MENSUAL * 12
    } else {
      serviciosPublicos[k] = serviciosPublicos[k - 1] * (1 + IPC[k - 1]) * act
    }

    // Mantenimiento de tracker (cada 5 años) y reemplazo de inversores (una vez, año 16):
    // montos fijos ya calculados con las tarifas y FX del Excel (ver financialData.ts).
    const mantenimientoTracker = MANTENIMIENTO_TRACKER[k] ?? 0
    const reemplazoInversores = REEMPLAZO_INVERSORES[k] ?? 0

    flujoOperativo[k] =
      ingresos[k] +
      arriendo[k] + operacion[k] + cgm[k] + representacion[k] +
      costosRegulatorios[k] + seguro[k] + ica[k] + iva[k] + mantenimiento[k] + serviciosPublicos[k] +
      mantenimientoTracker + reemplazoInversores

    flujoInversionista[k] = flujoOperativo[k] // participación = 1 en el Excel (D29)
  }

  return { flujoInversionista }
}
