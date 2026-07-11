# Desglose de sobrecostos por proyecto — Diseño

## Contexto y objetivo

Un terreno puede tener varios proyectos (ej. COLSANT5 tiene P1 y P2). Hoy el evaluador trata cada terreno como una sola unidad: el backend (`terrain_service.py`) elige **un solo proyecto arbitrario** por terreno (`ORDER BY p.id DESC LIMIT 1`) para casi todos los campos, y el motor de criterios (`evaluatorEngine.ts`) calcula un único sobrecosto total para el terreno completo.

Esto ya causó un bug real (`numero_arboles` mostraba 0 cuando P1 tenía 2 árboles registrados y P2 tenía 0 — el sistema solo veía el proyecto elegido). El objetivo de este diseño es doble:

1. Corregir de raíz este patrón de "un solo proyecto arbitrario" para los campos que sí varían por proyecto.
2. Presentar, además del resumen general del terreno, un **desglose por proyecto**: cuánto le corresponde a cada proyecto individual de los sobrecostos totales.

## Clasificación de los 18 criterios

Cada criterio se comporta de una de 4 formas posibles según de dónde viene su dato y cómo se reparte su costo entre los proyectos del terreno:

| Scope | Comportamiento | Criterios |
|---|---|---|
| `proyecto` | Cada proyecto tiene su propio valor y su propio sobrecosto, calculado de forma independiente (no se reparte ni se multiplica) | distancia_via, distancia_red, aprovechamiento_forestal, numero_arboles, pilotes, tipo_estructura |
| `terreno_dividido` | Se calcula una vez para el terreno completo; el sobrecosto total se reparte entre N proyectos (división simple, no ponderada por tamaño) | corte, lleno, obras_hidraulicas, ocupacion_cauce, coexistencias, comunidad, or, propietario, servidumbre, amenazas |
| `terreno_multiplicado` | Un solo dato para todo el terreno, pero cada proyecto carga el costo completo (no se divide, no varía por proyecto) | nivel_tension |
| `terreno_no_dividido` | Se calcula una vez para el terreno; es un ajuste al total general y **no aparece** en el desglose por proyecto | cluster |

**N (cantidad de proyectos)**: mismo conteo que ya usa el criterio `cluster` hoy — excluye proyectos en estado `dead`, `paused` o `uci`.

### Corrección de "peor escenario" (scope `terreno_dividido`/`terreno_multiplicado`)

Los criterios `ocupacion_cauce`, `servidumbre`, `coexistencias` y `nivel_tension` hoy derivan su valor de un solo proyecto elegido arbitrariamente. Al ser scope de terreno, deben en cambio consultar **todos los proyectos del terreno** y aplicar la regla de "peor escenario" que ya existe para `aprovechamiento_forestal` (el estado más desfavorable manda para todo el terreno). Ejemplo: si P1 no requiere ocupación de cauce pero P2 sí, el terreno completo carga el sobrecosto de ocupación de cauce.

Los criterios de scope `proyecto` (incluido `aprovechamiento_forestal` y `numero_arboles`) **no** usan peor-escenario — cada proyecto usa únicamente su propio dato, sin funnel a un valor compartido. Esto es un cambio respecto a como funciona hoy `aprovechamiento_forestal` (que sí calcula un peor-escenario compartido) y respecto al fix reciente de `numero_arboles` (que suma todos los proyectos en un solo total) — ambos pasan a exponer un valor **por proyecto**, sin agregación previa.

## Backend (`terrain_service.py`)

Nueva función para listar los proyectos activos del terreno (mismo filtro de `stage` que ya usa `cluster`):

```python
def _get_proyectos_activos(terrain_id: int) -> list[dict]:
    """Proyectos activos del terreno (mismo filtro de stage que ya usa 'cluster')."""
```

El API (`GET /api/terrain/<code>`) agrega un array nuevo al payload:

```json
"proyectos": [
  {
    "nombre": "COLSANT5P1_GIRON_SUR",
    "distancia_via": 10.0,
    "distancia_red": 30.0,
    "aprovechamiento_forestal": "visita",
    "numero_arboles": 2,
    "tipo_estructura": "tracker"
  },
  {
    "nombre": "COLSANT5P2_GIRON_SUR",
    "distancia_via": 12.0,
    "distancia_red": 28.0,
    "aprovechamiento_forestal": null,
    "numero_arboles": 0,
    "tipo_estructura": "mesa_fija"
  }
]
```

Los campos de nivel superior `distancia_via`, `distancia_red`, `aprovechamiento_forestal`, `numero_arboles`, `aprovechamiento_forestal_detalle`, `tipo_estructura` **se eliminan** de la respuesta — dejarían de tener un significado único y no ambiguo ahora que existen por proyecto. Todo consumidor debe leer desde `proyectos[]`.

Los campos de nivel superior `ocupacion_cauce`, `ocupacion_cauce_detalle`, `servidumbre`, `servidumbre_detalle`, `coexistencias`, `coexistencias_detalle`, `nivel_tension` **se mantienen** en el nivel superior (representan el terreno completo), pero su lógica interna cambia de "un proyecto arbitrario" a "peor escenario entre todos los proyectos activos".

`pilotes` no tiene campo en BD (siempre manual) — no aparece en `proyectos[]`; su valor por proyecto vive únicamente en el frontend.

## Frontend — tipos y motor

**`types/index.ts`**:

```ts
export type CriterionScope = 'proyecto' | 'terreno_dividido' | 'terreno_multiplicado' | 'terreno_no_dividido'

export interface ProyectoData {
  nombre: string
  distancia_via: number | null
  distancia_red: number | null
  aprovechamiento_forestal: string | null
  numero_arboles: number | null
  tipo_estructura: string | null
}
```

`TerrainData` gana `proyectos: ProyectoData[]`, pierde los 6 campos de nivel superior mencionados arriba.

`CriterionModule` gana `scope: CriterionScope` (obligatorio en los 18 criterios).

`EvalContext` gana `projectCount: number`.

**Store (`evaluatorStore.ts`)**: se agrega `perProjectValues: Record<criterionId, Record<proyectoNombre, CriterionValue>>`, poblado automáticamente desde `terrainData.proyectos` para los 5 criterios de solo lectura del Grupo `proyecto` al buscar el terreno. `pilotes` es el único editable ahí — el usuario lo marca/desmarca por proyecto.

**Motor (`evaluatorEngine.ts`)**:
- El cálculo del **resumen general** (sin cambio de comportamiento visible): scope `proyecto` → se suma el costo de cada proyecto; `terreno_dividido` → costo completo del terreno (sin dividir); `terreno_multiplicado` → costo completo × N; `terreno_no_dividido` (cluster) → descuento igual que hoy.
- Nueva función para el **resumen por proyecto**: para cada proyecto activo, scope `proyecto` → su propio costo; `terreno_dividido` → costo del terreno ÷ N; `terreno_multiplicado` → costo completo (igual en todos los proyectos); `terreno_no_dividido` → excluido.
- Para `servidumbre` y `amenazas` (`riskType: 'meses'`, scope `terreno_dividido`): en el desglose por proyecto se muestra solo el monto en pesos, sin traducir a meses (evita mostrar meses fraccionarios como "1.5 meses").

## Motor financiero (`financialEngine.ts`)

Para el resumen por proyecto, se recalcula `calcularFinanzas` con `capex/N`, `kWp/N`, `kVA/N`, `arriendoAnual/N` (misma N de la división de criterios).

- **VPN / VPN con beneficios**: se muestran por proyecto (salen en proporción 1/N del general, ya que escalar todo el flujo de caja proporcionalmente no cambia la forma de la curva, solo su magnitud).
- **TIR / TIR con beneficios / Payback / Payback con beneficios**: son invariantes a un escalamiento proporcional uniforme del flujo de caja, así que salen matemáticamente idénticos al resumen general. Se muestran **una sola vez** (no por proyecto), con una nota aclarando que aplican igual a todos los proyectos del terreno.

## UI

**`CriterionCard.vue`**: sin cambios para los criterios de scope `terreno_dividido`/`terreno_multiplicado`/`terreno_no_dividido` (siguen con un solo valor/toggle y un solo sobrecosto). Cambian los 6 de scope `proyecto`:

- Los 5 de solo lectura (distancia_via, distancia_red, aprovechamiento_forestal, numero_arboles, tipo_estructura): la tarjeta muestra una fila por proyecto activo (nombre + valor + su propio sobrecosto calculado), en vez de un solo campo deshabilitado. Mismo patrón visual que ya usan `coexistencias`/`servidumbre` para su detalle. Se agrega un total al final de la tarjeta (suma de los sobrecostos de todos los proyectos).
- `pilotes`: fila por proyecto con un checkbox editable en cada una (patrón nuevo — hoy es un solo toggle para todo el terreno).

**Nueva sección "Desglose por proyecto"** (`EvaluadorView.vue`, área principal, debajo de "Factores de riesgo" — no en el panel lateral angosto): TIR/Payback se muestran una sola vez arriba de la sección con la nota de aplicabilidad general; debajo, una tarjeta por proyecto activo mostrando solo **totales** (no vuelve a itemizar cada criterio, eso ya está en las tarjetas de criterio): Costos fijos totales, Riesgo total (meses + monto, salvo servidumbre/amenazas que solo aportan el monto), y VPN (con/sin beneficios).

## Fuera de alcance

- No se pondera la división `terreno_dividido` por tamaño de proyecto (ej. kWp) — es una división simple entre N.
- El motor financiero por proyecto no soporta edición manual de supuestos avanzados (mismo alcance que el motor financiero general, ver `docs/superpowers/specs/2026-07-03-motor-financiero-design.md`).
- No se agrega un selector para "ver solo el proyecto X" — el desglose siempre muestra todos los proyectos activos a la vez.
- La reasignación de `cluster` (hoy un descuento por tener varios proyectos) no se revisa en este diseño — se mantiene como ajuste exclusivo del resumen general, sin aparecer en el desglose por proyecto.
