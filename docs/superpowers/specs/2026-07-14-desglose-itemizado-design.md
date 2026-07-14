# Desglose por proyecto itemizado y reubicado — Diseño

## Contexto y objetivo

El diseño anterior (`docs/superpowers/specs/2026-07-11-desglose-por-proyecto-design.md`) agregó una sección "Desglose por proyecto" al final de la página, mostrando solo **totales** por proyecto (Costos fijos, Riesgo, VPN). Ya en uso, resultó poco visible (al fondo de la página) y demasiado resumida: no se ve QUÉ criterios componen cada total.

Objetivo de este cambio: mover esa sección a la parte superior de la página (justo debajo del buscador de terreno) y mostrar el desglose **itemizado, criterio por criterio**, igual de detallado que el "Resumen de costos" del sidebar general — pero con los valores propios de cada proyecto.

Este es un cambio de UI puro. Todo el dato que necesita ya existe en `store.perProjectResults[nombre]` (poblado por `evaluateScoped`, ver el diseño anterior) — no se toca backend, tipos, store ni el motor de evaluación.

## Decisiones de diseño

Validadas con mockups (ver `.superpowers/brainstorm/`):

- **Ubicación**: el panel sube de "debajo de Factores de riesgo" a **debajo del buscador de terreno**, antes de las secciones de criterios generales (Costos fijos / Factores de riesgo). Resuelve directamente que hoy pasa desapercibido.
- **Nivel de detalle**: cada tarjeta de proyecto pasa de solo-totales a **itemizada**: una fila por criterio con sobrecosto ≠ 0 (mismo criterio de filtro que ya usa `SummaryPanel.vue`), más los totales al final.
- **Estado**: siempre expandida (no colapsable) — con la cantidad de proyectos activos que maneja hoy el evaluador (típicamente 2-3 por terreno), el itemizado no genera un scroll excesivo.
- **La sección actual de solo-totales se elimina** — el panel nuevo cubre la misma información con más detalle; mantener ambas sería redundante.
- **El sidebar "Resumen de costos" (general del terreno) no cambia.**

## Componente: `ProjectBreakdownPanel.vue`

Se modifica en el lugar (no se crea un componente nuevo). Por cada proyecto en `store.proyectoNombres`:

1. **Fijos** (itemizado): se filtran `store.perProjectResults[nombre]` con el mismo criterio que `SummaryPanel.vue` usa hoy para `fijoBreakdown` — `(category === 'fijo' || category === 'ambas') && formulaDefined && sobrecosto !== 0` — una fila por resultado (`label` + `sobrecosto` formateado). Subtotal "Fijos" al final (ya existe: `aggregateCosts(...).totalSobrecostoFijo`).
2. **Riesgo** (itemizado): mismo patrón con el filtro de `retrasoBreakdown` — `category === 'probabilidad' && formulaDefined && sobrecosto > 0`. Cada fila muestra **solo el monto en COP**, nunca meses (regla ya vigente del diseño anterior para el desglose por proyecto — `servidumbre`/`amenazas` pueden dar meses fraccionarios al dividir entre N). Subtotal "Riesgo" al final (`totalRetraso + totalRiesgoCosto`, ya calculado).
3. **VPN / VPN con beneficios**: igual que hoy, al final de la tarjeta (`store.perProjectFinancials[nombre]`).
4. **TIR / Payback**: se mantienen mostrados una sola vez arriba de todas las tarjetas, con la nota "igual para todos los proyectos del terreno" — sin cambios respecto a hoy.

No hace falta ningún dato nuevo del store: `aggregateCosts(store.perProjectResults[nombre], context)` ya devuelve `breakdown` (la lista itemizada) además de los totales — se reutiliza tal cual, solo se deja de descartar `breakdown` y se renderiza.

## `EvaluadorView.vue`

Se mueve el punto de montaje de `<ProjectBreakdownPanel />`: de después de la sección "Factores de riesgo" (al final de `criteria-content`) a justo después del componente de búsqueda de terreno, antes de la primera sección de criterios ("Costos fijos").

## Fuera de alcance

- No se agrega un toggle para colapsar/expandir tarjetas — queda para una iteración futura si el número de proyectos por terreno crece y el itemizado empieza a ocupar demasiado espacio vertical.
- No cambia el sidebar general (`SummaryPanel.vue`).
- No cambia ningún cálculo de `evaluatorEngine.ts`, `evaluatorStore.ts` ni el backend — es exclusivamente reubicación + rendering de datos que ya se calculan hoy.
- Los comportamientos ya conocidos y aceptados del diseño anterior (VPN por proyecto no suma exacto al VPN general por costos fijos no escalables del motor financiero; `nivel_tension` con peor-escenario × N en terrenos de tensión mixta) no cambian con este ajuste — se heredan tal cual.
