// Tablas macro extraídas literal de "Supuestos y resultados" filas 97-105 del Excel
// "Retail Modelo financiero - Plantilla Evaluador.xlsx". Índice 0 = año 2026, índice 33 = año 2059.

export const AÑO_BASE = 2026

export const IPC = [
  0.064, 0.0523, 0.0406, 0.0372, 0.0333, 0.032, 0.032, 0.032, 0.032, 0.032,
  0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032,
  0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032, 0.032,
  0.032, 0.032, 0.032, 0.032,
]

export const FX = [
  3751.0, 3834.0, 3947.0, 3990.0, 4036.0, 4023.4, 4010.8, 3998.2, 3985.6, 3973,
  3960.4, 3947.8, 3935.2, 3922.6, 3910, 3897.4, 3884.8, 3872.2, 3859.6, 3847,
  3834.4, 3821.8, 3809.2, 3796.6, 3784, 3771.4, 3758.8, 3746.2, 3733.6, 3721,
  3708.4, 3695.8, 3683.2, 3670.6,
]

// PPA con indexación (COP/kWh) — ya incluye el ajuste por IPP acumulado del Excel (fila 105).
// NOTA de indexación: en financialEngine.ts se consume con un año de rezago, PPA_CON_INDEXACION[k-1]
// (igual que IPC[k-1]), mientras que FX se consume del mismo año, FX[k] — pese a que las tres tablas
// están alineadas por año calendario aquí (índice 0 = 2026).
export const PPA_CON_INDEXACION = [
  350.9462719, 349.3700922, 343.6267887, 344.7270552, 353.8970224, 363.8061391,
  371.515938, 374.2800166, 382.1424431, 379.3889236, 376.1816073, 372.4972404,
  374.1578388, 378.624348, 389.2258297, 398.5363587, 408.0631242, 417.8109361,
  427.784704, 437.9894391, 448.4302562, 459.1123753, 470.0411238, 481.221938,
  492.6603657, 504.3620673, 516.3328184, 528.5785117, 541.105159, 553.9188929,
  567.0259695, 580.43277, 594.1458029, 608.1717064,
]

// Mantenimiento de tracker (fila 23 del Excel): ocurre cada 5 años empezando en el
// período 6 (año 2032), con el monto compuesto por IPC desde la ocurrencia anterior.
// Reemplazo de inversores y motores (fila 22): ocurre una sola vez, período 16 (año 2042).
// Ambos son valores ya calculados con las tarifas y tipo de cambio fijos del Excel —
// no dependen de los inputs del terreno (capex/kWp/producción/arriendo), por eso van
// literales aquí en vez de recalcularse.
export const MANTENIMIENTO_TRACKER: Record<number, number> = {
  6: -35_117_188.69,
  11: -41_107_231.39,
  16: -48_119_013.38,
  21: -56_326_815.75,
  26: -65_934_647.24,
}

export const REEMPLAZO_INVERSORES: Record<number, number> = {
  16: -250_052_057,
}
