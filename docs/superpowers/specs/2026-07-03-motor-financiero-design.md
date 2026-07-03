# Motor financiero (TIR/VPN/Payback) — Diseño

## Contexto y objetivo

El evaluador calcula hoy el CAPEX de un terreno (`aggregated.capexTotal`) a partir de un CAPEX base más los sobrecostos de los 18 criterios. El usuario tiene un modelo financiero en Excel (`Retail Modelo financiero - Plantilla Evaluador.xlsx`) que, a partir del CAPEX y otros supuestos, proyecta 30+ años de flujo de caja de un proyecto solar tipo "minigranja" y calcula la TIR del proyecto.

Objetivo: enlazar ambos — que el CAPEX calculado por el evaluador (y otros dos datos que ya existen en la plataforma: arriendo y producción específica) alimenten un motor que replique el Excel y muestre TIR / VPN / Payback en la misma pantalla, actualizándose en vivo con cada criterio.

## Alcance de esta v1 (decidido con el usuario)

- Motor completo: replica todas las fórmulas del Excel (ingresos, costos, CAPEX, depreciación acelerada, flujo del inversionista con y sin beneficios tributarios), no una versión simplificada.
- Vive en el frontend (TypeScript), igual que `evaluatorEngine.ts` — todo reactivo en el navegador, sin llamada de red adicional para calcular.
- Los ~30 supuestos macro que no dependen del terreno (IPC, IPP, spot price, PPA, tasa de descuento, tarifas de costos regulatorios, seguro, mantenimiento, etc.) quedan **fijos** en esta v1, con los mismos valores que trae hoy el Excel. No hay UI para editarlos todavía.
- El panel de resultados muestra solo las métricas resumen (TIR, TIR c. beneficios, VPN, VPN c. beneficios, Payback, Payback c. beneficios), sin tabla año por año.
- La "Potencia instalada AC" (kVA) del Excel no tiene un mapeo limpio 1:1 a nivel de proyecto en la BD (los campos de plataforma son por unidad, no por el clúster que ya maneja el evaluador con kWp manual). Queda como input manual nuevo, con el valor por defecto del Excel (1000 kVA) — igual que ya es manual el kWp (1320 por defecto).

## Fuentes de datos

| Parámetro Excel (celda) | Nombre | Origen |
|---|---|---|
| D7 — Inversión | CAPEX | `evaluatorStore.aggregated.capexTotal` (ya existe) |
| D8 — Potencia instalada DC | kWp | `evaluatorStore.kWp` (ya existe, manual, default 1320) |
| D9 — Potencia instalada AC | kVA | **Nuevo** input manual en el evaluador, default 1000 |
| D10 — Producción específica día | kWh/kWp/día | **Nuevo**: `termsheet_terrain.radiation` |
| D14 — Arriendo | COP/año | **Nuevo**: `termsheet_termsheet.rent_annual_cost_cop`, vía `minifarm_project.termsheet_id → termsheet_termsheet.id` |

Backend (`terrain_service.py`): agregar `produccion_especifica` (subconsulta directa `t.radiation`) y `arriendo_anual` (subconsulta `termsheet_termsheet.rent_annual_cost_cop` filtrando por `p.termsheet_id`) al SELECT principal y al dict de retorno. Si el proyecto no tiene `termsheet_id` o el termsheet no tiene renta cargada, `arriendo_anual` es `null` (el usuario podrá completarlo manualmente, igual que otros campos `db_or_manual`).

Frontend: se agregan `produccion_especifica: number | null` y `arriendo_anual: number | null` a `TerrainData`.

## Motor financiero — `frontend/src/engine/financialEngine.ts`

### Entradas

```ts
interface FinancialInputs {
  capex: number          // evaluatorStore.aggregated.capexTotal
  kWp: number             // evaluatorStore.kWp
  kVA: number             // nuevo input manual, default 1000
  produccionEspecifica: number  // kWh/kWp/día
  arriendoAnual: number  // COP/año
}
```

### Supuestos fijos (constantes del módulo, valores idénticos al Excel)

```ts
const SUPUESTOS = {
  factorDegradacion: 0.0035,       // anual %
  eficienciaInicial: 0.992,
  operacionPctIngresos: 0.038,     // "Operación y optimización del activo"
  cgmPorKwh: 6.0,                  // COP/kWh
  representacionPorKwh: 6.0,       // COP/kWh
  costosRegulatoriosPorKwh: 13.0,  // COP/kWh
  seguroPctCapex: 0.00185,
  crecimientoSeguro: 0.01,
  ica: 0.006,                      // % ingresos
  iva: 0.19,
  mantenimientoPorKva: 54000.0,    // COP/kVA/año
  serviciosPublicosMensual: 1500000.0,  // COP/mes
  reemplazoInversoresUsd: 40000.0,      // USD, se aplica una sola vez en CAPEX año 15 (ver punto 10)
  precioRecUsdMwh: 1.5,
  depreciacionAnios: 15,
  deduccionRentaAnios: 15,
  tasaDescuentoVpn: 0.10,
  tasaImpuestoRenta: 0.35,
  anioBase: 2026,               // C2: año de inversión (sin operación)
  duracionOperacionAnios: 30,   // D1 flag: activo mientras year <= anioBase+1+30
}

// Tablas macro 2025-2060 (índice 0 = 2025), copiadas literal del Excel:
const IPC = [0.051, 0.064, 0.0523, 0.0406, 0.0372, 0.0333, 0.032, /* … */]
const IPP = [-0.019, 0.029, 0.038, 0.034, 0.033, 0.03, 0.028, /* … repite 0.028 */]
const SPOT_PRICE = [269.0, 271.0, 227.0, 247.0, 262.0, 294.0, /* … cae a 400 fijo desde 2041 */]
const PPA_SIN_INDEXAR = [/* … */]
// PPA con indexación se deriva: ppaConIndexacion[i] = ppaSinIndexar[i] * (ippValue[i] / ippValueBase)
// ippValue se acumula: ippValue[0]=184.7 (dato fijo D103), ippValue[i] = ippValue[i-1]*(1+IPP[i])
```

(Los arrays completos —37-38 valores cada uno— se transcriben literal del Excel al implementar; ya los extraje y verifiqué en el análisis. No hace falta reproducirlos aquí completos, el implementador los copia de la hoja "Supuestos y resultados" filas 97-105.)

### Cálculo año por año (34 periodos: 2026 a 2059, index 0..33)

Para cada año `i` desde 1 (2027) — el año 0 (2026) es solo el desembolso del CAPEX, sin operación:

1. **Eficiencia**: `eficiencia[1] = eficienciaInicial` (0.992, sin degradar); `eficiencia[i] = eficiencia[i-1] - factorDegradacion` para i>1 (resta acumulada, no compuesta, empieza a aplicarse desde el segundo año de operación)
2. **Generación (kWh)**: `generacion[i] = eficiencia[i] * kWp * produccionEspecifica * 365 * activo[i]`
   - `activo[i] = i <= duracionOperacionAnios ? 1 : 0` (year > anioBase+1+30 → 0, replica el flag D1/E1/…)
3. **PPA (COP/kWh)**: tabla `ppaConIndexacion[i]` (macro, ver arriba)
4. **Precio REC (COP/kWh)**: `precioRec[i] = precioRecUsdMwh * fx[i] / 1000`
5. **Venta de energía**: `ventaEnergia[i] = ppaConIndexacion[i] * generacion[i] * activo[i]`
6. **REC**: `rec[i] = precioRec[i] * (generacion[i]/1000) * activo[i]`
7. **Ingresos**: `ingresos[i] = ventaEnergia[i] + rec[i]` (Losses siempre 0 en el template actual)
8. **Costos** (todos negativos, indexados por IPC salvo que se indique lo contrario):
   - Arriendo: año 1 = `-arriendoAnual`; después `costo[i] = costo[i-1]*(1+IPC[i])`
   - Operación y optimización: `-ingresos[i] * operacionPctIngresos`
   - CGM: `-generacion[i] * cgmPorKwh`, indexado por IPC en años siguientes igual que arriendo (fórmula `anterior/generación_anterior*(1+IPC)*generación_actual`)
   - Representación: igual patrón que CGM con `representacionPorKwh`
   - Costos regulatorios: igual patrón con `costosRegulatoriosPorKwh`
   - Seguro: año 1 = `-capex * seguroPctCapex`; después crece a tasa fija `crecimientoSeguro` (no IPC)
   - ICA: `-(ventaEnergia[i] + 0) * ica`
   - Mantenimiento: año 1 = `-kVA * mantenimientoPorKva`; después indexado por IPC
   - Servicios públicos: año 1 = `-serviciosPublicosMensual * 12`; después indexado por IPC
   - Reemplazo de inversores y mantenimiento de tracker (filas 22-23 del Excel) están **inertes en el template actual** (valores literales 0 en todos los años, pese a tener una tarifa definida en Supuestos) — replicar como 0, no como costo activo. El reemplazo de inversores sí se modela, pero únicamente dentro de CAPEX (punto 10).
9. **Flujo de caja operativo**: `ingresos[i] + sum(costos[i])`
10. **CAPEX**: año 0 = `-capex`; año `anioBase+1+15` (año 15 de operación) = `-reemplazoInversoresUsd * fx[i]` (único lugar donde se modela el reemplazo de inversores, vía `HLOOKUP` de `fx` en la tabla macro). El resto de los años, CAPEX = 0.
11. **Flujo de caja libre / neto**: operativo + capex (año 0 solo tiene capex)
12. **Flujo del inversionista**: `flujoNeto[i] * participacion` (participacion = 1 en el Excel, D29)

### Beneficio tributario (depreciación acelerada)

- Depreciación línea recta sobre `capex` a 15 años, con beneficio fiscal = `(capex/15) * tasaImpuestoRenta` durante los años 1-15.
- Depreciación acelerada adicional: desde el año 15, `(capex*50%/15) * tasaImpuestoRenta` durante 15 años más (años 16-30).
- `flujoInversionistaConBeneficios[i] = flujoInversionista[i] + beneficioTributario[i]`

### Resultados

```ts
interface FinancialResults {
  tir: number                    // IRR(flujoInversionista[0..33])
  tirConBeneficios: number       // IRR(flujoInversionistaConBeneficios[0..33])
  vpn: number                    // NPV(10%, flujoInversionista[1..31]) + flujoInversionista[0]
  vpnConBeneficios: number
  paybackAnios: number           // años hasta que el flujo acumulado cruza cero (con fracción del año de cruce)
  paybackConBeneficiosAnios: number
}
```

IRR se implementa con Newton-Raphson dentro del propio `financialEngine.ts` (no existe ningún cálculo de IRR/VPN reutilizable en este repo — el proyecto hermano `epc evaluador` tiene un `financialCalculator.ts` con IRR/VPN/Payback vía Newton-Raphson que sirve como referencia de implementación, pero es un repositorio distinto y no se importa directamente).

## Componente UI — `FinancialResultsPanel.vue`

Se ubica junto a `SummaryPanel.vue` en `EvaluadorView.vue` (mismo layout de dos columnas, o una tercera columna / sección debajo, a decidir en el plan de implementación según espacio disponible). Muestra:

- TIR / TIR con beneficios tributarios (% grande)
- VPN / VPN con beneficios (COP)
- Payback / Payback con beneficios (años)

Reactivo: recalcula automáticamente cuando cambia `aggregated.capexTotal`, `kWp`, `kVA`, `produccionEspecifica` o `arriendoAnual`.

Nuevo campo `kVA` en `evaluatorStore` (similar a `kWp`, manual, default 1000). `produccionEspecifica` y `arriendoAnual` llegan vía `terrainData` (con fallback manual editable si el terreno no tiene el dato, ya que `arriendo_anual` puede ser `null`).

## Validación

Test golden-master: instanciar `financialEngine` con los supuestos exactos del Excel actual (capex=4,587,742,837; kWp=1320; kVA=1000; producciónEspecífica=4.5287; arriendoAnual=26,275,000) y verificar que el resultado coincide con los valores actuales del Excel dentro de una tolerancia razonable (ej. 0.1 punto porcentual en TIR):

- TIR ≈ 11.01%
- VPN ≈ $391,839,624
- Payback ≈ 9 años
- TIR con beneficios ≈ 14.20%
- VPN con beneficios ≈ $1,576,145,841
- Payback con beneficios ≈ 7 años

## Fuera de alcance (v1)

- Edición de los ~30 supuestos macro (IPC, IPP, spot price, PPA, tasas, tarifas) — quedan fijos, se puede agregar un panel de "supuestos avanzados" después si se necesita.
- Tabla año-por-año del flujo de caja en la UI.
- Mantenimiento de tracker recurrente cada 5 años (fila 23/26 del Excel): en el template actual ya está inerte (valor 0 en todos los años pese a tener tarifa definida en Supuestos), así que replicarlo como 0 no reduce alcance — coincide con el comportamiento real del Excel hoy. Si más adelante se activa en el Excel, hay que revisar este motor también.
- Deuda / apalancamiento (el Excel actual no lo modela — D29 "Participación" = 1, sin deuda).
