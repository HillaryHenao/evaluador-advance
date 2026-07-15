# Crédito de cluster repartido + detalle de aprovechamiento forestal — Diseño

## Contexto y objetivo

Revisión de usuario sobre `COLBOYT147` (cluster de 2 proyectos) encontró dos vacíos, confirmados contra la base de datos real:

1. El evaluador aplica un crédito de -15M por ser cluster de 2 proyectos (`cluster.ts`), pero ese crédito no aparece en ninguna tarjeta de "Desglose por proyecto" — solo se ve en el total general del terreno, sin ninguna línea que explique por qué la suma de las tarjetas no coincide con ese total.
2. `Licencia de aprovechamiento forestal` de ambos proyectos de COLBOYT147 tiene `value='Exonerado'` en `validation_field`, pero el evaluador no muestra nada — el backend traduce cualquier estado resuelto (Exonerado, Solicitud aprobada) a `null` porque no genera sobrecosto, y ese `null` es indistinguible de "sin dato registrado".

Un tercer punto reportado (Coexistencias en blanco) se investigó y **no** es un bug: se consultó `entities_coexistence` directamente (609 filas en la tabla) filtrando por los IDs y por el `project_name` de los 2 proyectos de COLBOYT147 — cero coincidencias. El terreno realmente no tiene registros de coexistencia; `coexistencias: false` es correcto. No forma parte de este spec.

## 1. Crédito de cluster repartido entre proyectos

**Hoy:** `cluster.ts` tiene `scope: 'terreno_no_dividido'`. En `evaluatorEngine.ts`, ese scope calcula el costo una sola vez para el total general (`general.push(...)`) y explícitamente se salta el reparto por proyecto (`if (criterion.scope === 'terreno_no_dividido') continue`, línea 95) — por diseño explícito del spec original (`2026-07-11-desglose-por-proyecto-design.md`): "es un ajuste al total general y **no aparece** en el desglose por proyecto".

**Cambio:** `cluster.ts` pasa a `scope: 'terreno_dividido'` — el mismo scope que ya usan `corte`, `lleno`, `servidumbre`, etc. Sin ningún otro cambio en `evaluatorEngine.ts`, esto activa automáticamente el reparto que ya existe para ese scope: el total general no cambia (sigue siendo el costoBase completo, -15M o -30M), y cada proyecto recibe `costoBase / N`.

Para COLBOYT147 (cluster=2): cada proyecto recibe -7.5M en vez de nada.

**Efecto downstream (sin cambios de código adicionales):**
- `ProjectBreakdownPanel.vue` arma `fijoItems` desde `store.perProjectResults`, así que "Cluster: -$7.500.000" aparece automáticamente en cada tarjeta, dentro del subtotal "Fijos" y del "CAPEX total" de esa tarjeta.
- `perProjectFinancials` en `evaluatorStore.ts` también arma el capex de cada proyecto desde `perProjectResults`, así que el VPN por proyecto pasa a incluir este crédito (hoy no lo incluye en absoluto). Esto acerca la suma de VPNs por proyecto al VPN general — no lo iguala exactamente, por las razones ya documentadas en `.superpowers/sdd/progress.md` (costos fijos de instalación completa que no escalan).

**Limpieza incluida:** `cluster` es el único criterio que usa `'terreno_no_dividido'`. El plan elimina ese valor de `CriterionScope` (`types/index.ts`) y la rama que lo maneja en `evaluatorEngine.ts` (código muerto tras el cambio) — evita dejar un scope sin ningún criterio que lo use.

**Tests afectados:**
- `frontend/src/engine/__tests__/evaluatorEngine.test.ts`: el test `'scope terreno_no_dividido: general sin cambios; no aparece por proyecto'` (línea 150) se reemplaza por uno que confirme el reparto (-7.5M/-7.5M para N=2, general sigue en -15M). La lista `validScopes` (línea 30) pierde `'terreno_no_dividido'`.
- Ningún test de `criteria.test.ts` para `cluster.computeCost` cambia — la fórmula del crédito no se toca, solo cómo se reparte.

## 2. Detalle de aprovechamiento forestal por proyecto

**Backend** (`terrain_service.py`, función `_get_proyectos_activos`): agrega `aprovechamiento_forestal_detalle: str | None` a cada entrada de `proyectos[]`, usando el mismo `aprov_raw` ya calculado en esa función (incluye el fallback a `'Exonerado'` cuando `aprov_status == 'exonerated'` sin valor). `None` cuando `aprov_raw` es cadena vacía.

```json
{
  "nombre": "COLBOYT147P1_TUNJA_OCCIDENTE",
  "aprovechamiento_forestal": null,
  "aprovechamiento_forestal_detalle": "Exonerado",
  ...
}
```

**Frontend:**
- `ProyectoData` (`types/index.ts`) gana `aprovechamiento_forestal_detalle: string | null`.
- `CriterionCard.vue`: `aprovechamiento_forestal` es scope `'proyecto'`, se renderiza por la fila genérica de `proyectoRows` (no por el bloque `coexistencias-detalle` que usan servidumbre/ocupación de cauce, porque ese bloque es para criterios de terreno completo, no por-proyecto). Se ajusta esa fila específicamente para este criterio: si `row.value` existe (visita/radicada/otro — estado no resuelto, con sobrecosto), se muestra igual que hoy; si `row.value` es `null`, se busca el detalle del proyecto (`terrainData.proyectos.find(...).aprovechamiento_forestal_detalle`) y se muestra ese texto (ej. "Exonerado") en vez de "—"; si tampoco hay detalle, sí se muestra "—" (caso real de "sin dato registrado").

No cambia el cálculo de sobrecosto (sigue siendo 0 para estados resueltos) — solo la visibilidad del estado real.

**Fuera de alcance:** el issue ya conocido de que los criterios `select` por-proyecto muestran el código crudo (`"visita"`) en vez de la etiqueta (`"Visita"`) — documentado como minor en `.superpowers/sdd/progress.md`, no se toca aquí.

## Testing

- Backend: `test_terrain_service.py` — extender el test de `_get_proyectos_activos` con `aprovechamiento_forestal_detalle` en mocks y assertions (mismo patrón que se usó para agregar `arriendo_anual`).
- Frontend: `evaluatorEngine.test.ts` para el reparto de cluster; no hay tests de componente `.vue` en este repo (verificación por vue-tsc + trace de código + browser, como ya es el patrón establecido).
