# Desglose de sobrecostos por proyecto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "single arbitrary project" bug for terrain-level data, classify all 18 evaluator criteria into 4 scopes (`proyecto` / `terreno_dividido` / `terreno_multiplicado` / `terreno_no_dividido`), and surface a per-project cost/VPN breakdown alongside the existing terrain-wide summary.

**Architecture:** Backend returns a new `proyectos[]` array (one entry per active project) for the 6 scope-`proyecto` criteria, and fixes 4 terrain-wide criteria to use worst-case-across-active-projects instead of one arbitrary project. Frontend tags each `CriterionModule` with a `scope`, and adds one scope-aware engine function (`evaluateScoped`) that computes the general terrain-wide total AND the per-project breakdown together in a single pass — the general total itself needed fixing, not just an additional per-project view, since scope-`proyecto` criteria have no single shared value the old `evaluateCriteria` could read anymore. Reuses existing `computeCost` functions unchanged; adds new UI surfaces for per-project display.

**Tech Stack:** Flask/psycopg2 (backend), Vue 3 + TypeScript + Pinia (frontend), Vitest, pytest.

Reference spec: `docs/superpowers/specs/2026-07-11-desglose-por-proyecto-design.md`

## Global Constraints

- **N (project count)**: active projects only — `stage NOT IN ('dead', 'paused', 'uci')`, same filter `cluster` already uses. Every new/changed query in this plan uses this exact filter for "which projects count."
- **Scope classification** (exact, do not deviate): `proyecto` = distancia_via, distancia_red, aprovechamiento_forestal, numero_arboles, pilotes, tipo_estructura. `terreno_dividido` = corte, lleno, obras_hidraulicas, ocupacion_cauce, coexistencias, comunidad, or, propietario, servidumbre, amenazas. `terreno_multiplicado` = nivel_tension. `terreno_no_dividido` = cluster.
- Criteria of scope `proyecto` do **not** use worst-case aggregation — each project uses only its own data, independently.
- Criteria of scope `terreno_dividido`/`terreno_multiplicado` that are DB-sourced (`ocupacion_cauce`, `servidumbre`, `coexistencias`, `nivel_tension`) **do** use worst-case aggregation across all active projects.
- `or`, `comunidad`, `propietario`, `corte`, `lleno`, `obras_hidraulicas`, `amenazas` are `terreno_dividido` but are either pure-manual or `formulaDefined: false` today — no backend worst-case fix needed for them in this plan (no DB query to fix).
- For `servidumbre`/`amenazas` (`riskType: 'meses'`) in the **per-project view**, show only the COP amount — do not translate to fractional months.
- Financial per-project view: recompute with `capex/N`, `kWp/N`, `kVA/N`, `arriendoAnual/N`. VPN/VPN-con-beneficios scale down per project; TIR/TIR-con-beneficios/Payback/Payback-con-beneficios are shown once (mathematically identical across projects and to the general figures — proportional scaling of an entire cash flow does not change IRR or payback timing).
- Test commands: backend `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -v`; frontend `cd frontend && npx vitest run` and `npx vue-tsc -b` (expect exactly 2 pre-existing unrelated tsc errors: `evaluatorEngine.test.ts` unused `@ts-expect-error`, `vite.config.ts` overload mismatch).
- The backend test `test_terrain_requires_auth` fails locally only because of the developer's own `backend/.env` (`FLASK_ENV=development` + empty `JWT_SECRET` triggers the dev-mode auth bypass) — this is a pre-existing local-environment artifact, not something this plan's changes should fix or touch.

---

### Task 1: Backend — `proyectos[]` per-project data (scope `proyecto`)

**Files:**
- Modify: `backend/app/services/terrain_service.py` (full rewrite of `get_terrain_data` and its helpers)
- Modify: `backend/tests/test_terrain.py:25-44` (update mock shape)
- Modify: `backend/tests/test_terrain_service.py` (replace the 3 `numero_arboles`-summing tests with per-project tests)

**Interfaces:**
- Produces (used by Task 2): `_get_active_project_ids(terrain_id: int) -> list[int]` — the shared "which projects count" helper.
- Produces (used by Task 2, Task 3): the API response gains `proyectos: list[dict]`, each `{nombre: str, distancia_via: float|None, distancia_red: float|None, tipo_estructura: str|None, numero_arboles: int|None, aprovechamiento_forestal: str|None}`. The response loses top-level `distancia_via`, `distancia_red`, `tipo_estructura`, `numero_arboles`, `aprovechamiento_forestal`, `aprovechamiento_forestal_detalle`.

- [ ] **Step 1: Write the failing tests**

Replace the full content of `backend/tests/test_terrain_service.py` with:

```python
from unittest.mock import patch, MagicMock

from app.services import terrain_service


def _mock_conn(rows):
    cur = MagicMock()
    cur.fetchall.return_value = rows
    cur.fetchone.return_value = rows[0] if rows else None
    cur.__enter__.return_value = cur
    cur.__exit__.return_value = False
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn


def test_resolve_aprovechamiento_nivel_visita():
    assert terrain_service._resolve_aprovechamiento_nivel('Visita') == 'visita'


def test_resolve_aprovechamiento_nivel_radicada():
    assert terrain_service._resolve_aprovechamiento_nivel('Solicitud radicada') == 'radicada'


def test_resolve_aprovechamiento_nivel_otro():
    assert terrain_service._resolve_aprovechamiento_nivel('Pausado') == 'otro'


def test_resolve_aprovechamiento_nivel_resuelto():
    assert terrain_service._resolve_aprovechamiento_nivel('Exonerado') is None
    assert terrain_service._resolve_aprovechamiento_nivel('Solicitud aprobada') is None


def test_resolve_aprovechamiento_nivel_vacio():
    assert terrain_service._resolve_aprovechamiento_nivel('') is None


def test_get_proyectos_activos_devuelve_datos_por_proyecto():
    # COLSANT5: P1 en visita con 2 árboles, P2 exonerado con 0 árboles — cada uno con su
    # propio dato, sin funnel a un valor compartido del terreno.
    rows = [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR',
            'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_raw': '1P TRACKER', 'numero_arboles_raw': '2',
            'aprov_value': 'Visita', 'aprov_status': 'pending',
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR',
            'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_raw': 'MESA FIJA', 'numero_arboles_raw': '0',
            'aprov_value': None, 'aprov_status': 'exonerated',
        },
    ]
    with patch.object(terrain_service, '_connect', return_value=_mock_conn(rows)):
        proyectos = terrain_service._get_proyectos_activos(287)

    assert proyectos == [
        {
            'nombre': 'COLSANT5P1_GIRON_SUR', 'distancia_via': 10.0, 'distancia_red': 30.0,
            'tipo_estructura': 'tracker', 'numero_arboles': 2, 'aprovechamiento_forestal': 'visita',
        },
        {
            'nombre': 'COLSANT5P2_GIRON_SUR', 'distancia_via': 12.0, 'distancia_red': 28.0,
            'tipo_estructura': 'mesa_fija', 'numero_arboles': 0, 'aprovechamiento_forestal': None,
        },
    ]


def test_get_proyectos_activos_sin_proyectos():
    with patch.object(terrain_service, '_connect', return_value=_mock_conn([])):
        assert terrain_service._get_proyectos_activos(287) == []


def test_get_active_project_ids():
    rows = [{'id': 64}, {'id': 2606}]
    with patch.object(terrain_service, '_connect', return_value=_mock_conn(rows)):
        assert terrain_service._get_active_project_ids(287) == [64, 2606]
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v`

Expected: FAIL with `AttributeError: module 'app.services.terrain_service' has no attribute '_resolve_aprovechamiento_nivel'` (and similarly for `_get_proyectos_activos`, `_get_active_project_ids`) — these functions don't exist yet.

- [ ] **Step 3: Replace `backend/app/services/terrain_service.py` with this full content**

```python
import os
from typing import Optional
import psycopg2
import psycopg2.extras


def _connect(url: str):
    return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)


def _get_active_project_ids(terrain_id: int) -> list[int]:
    """IDs de los proyectos activos del terreno (mismo filtro que 'cluster'): excluye
    dead/paused/uci."""
    conn = _connect(os.environ['DATABASE_URL'])
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id FROM minifarm_project
                   WHERE terrain_id = %s AND stage NOT IN ('dead', 'paused', 'uci')
                   ORDER BY id""",
                (terrain_id,),
            )
            return [r['id'] for r in cur.fetchall()]
    finally:
        conn.close()


def _get_nivel_tension_terreno(project_ids: list[int]) -> Optional[str]:
    """Peor escenario de nivel de tensión entre todos los proyectos activos del terreno:
    si alguno reporta 34.5kV (el único nivel con sobrecosto hoy en nivel_tension.ts), ese
    nivel manda para todo el terreno. Si ninguno lo reporta, se usa el primer valor no
    nulo encontrado (no hay sobrecosto en juego, cualquier valor consistente sirve para
    mostrar). Consulta requestsdb (cae a originabotdb si no hay DATABASE_URL2)."""
    if not project_ids:
        return None
    db2_url = os.environ.get('DATABASE_URL2') or os.environ.get('DATABASE_URL')
    try:
        conn = _connect(db2_url)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT DISTINCT ON (project) project, tension_level
                       FROM supplies_supplyrequest
                       WHERE project = ANY(%s) AND tension_level IS NOT NULL
                       ORDER BY project, id DESC""",
                    (project_ids,),
                )
                rows = cur.fetchall()
        finally:
            conn.close()
    except Exception:
        return None

    valores = []
    for r in rows:
        raw = r['tension_level'] or ''
        num = raw.replace(' ', '').lower().replace('kv', '').strip()
        valores.append(_TENSION_MAP.get(num) or (raw.strip() or None))
    valores = [v for v in valores if v]
    if not valores:
        return None
    return max(valores, key=lambda v: _TENSION_RANK.get(v, 0))


_TENSION_MAP = {'13.8': '13.8kV', '13.2': '13.8kV', '34.5': '34.5kV', '115': '115kV', '110': '115kV'}
_TENSION_RANK = {'34.5kV': 1}  # única con sobrecosto hoy (nivel_tension.ts computeCost); el resto rank 0


# Estados de validation_field.status (workflow de originabotdb)
_VALIDATION_STATUS_LABELS = {
    'approved': 'Aprobada',
    'preapproved': 'Pre-aprobada',
    'pending': 'Pendiente',
    'request': 'Solicitada',
    'exonerated': 'Exonerada',
}

_TIPO_LABELS = {'own': 'Propia', 'public': 'Pública', 'foreign': 'Ajena', 'public_and_foreign': 'Pública y Ajena'}
_EASEMENT_STATUS_LABELS = {
    'validation': 'En validación',
    'negotiation': 'En negociación',
    'not_viable': 'No viable',
    'signed': 'Firmada',
    'pending': 'Pendiente',
    'initial': 'Inicial',
    'obtained_license': 'Licencia obtenida',
}


def _resolve_servidumbre(vf_value: Optional[str], vf_status: Optional[str],
                          easement_type: Optional[str],
                          easement_foreign_status: Optional[str],
                          easement_public_status: Optional[str]) -> tuple[Optional[str], bool, Optional[str]]:
    """Resuelve tipo + estado de resolución de servidumbre para UN proyecto, con la MISMA
    fuente para tipo y estado (no cruza validation_field con easements_easement para el
    estado si el tipo vino del otro). Retorna (tipo, resuelto, estado_label)."""
    vf_value = (vf_value or '').lower()
    if vf_value:
        if 'pública y ajena' in vf_value or 'publica y ajena' in vf_value:
            tipo = 'public_and_foreign'
        elif 'propia' in vf_value:
            tipo = 'own'
        elif 'pública' in vf_value or 'publica' in vf_value:
            tipo = 'public'
        elif 'ajena' in vf_value:
            tipo = 'foreign'
        else:
            tipo = None
        resuelto = tipo == 'own' or vf_status == 'approved'
        estado_label = _VALIDATION_STATUS_LABELS.get(vf_status, vf_status) if vf_status else 'Sin registro'
        return tipo, resuelto, estado_label
    if easement_type:
        tipo = easement_type
        if tipo == 'own':
            return tipo, True, 'N/A'
        if tipo == 'foreign':
            resuelto = easement_foreign_status == 'signed'
            estado_label = _EASEMENT_STATUS_LABELS.get(easement_foreign_status, easement_foreign_status) if easement_foreign_status else 'Sin registro'
            return tipo, resuelto, estado_label
        resuelto = easement_public_status == 'obtained_license'
        estado_label = _EASEMENT_STATUS_LABELS.get(easement_public_status, easement_public_status) if easement_public_status else 'Sin registro'
        return tipo, resuelto, estado_label
    return None, False, None


def _get_servidumbre(terrain_id: int) -> tuple[Optional[int], Optional[dict]]:
    """Peor escenario de servidumbre entre todos los proyectos activos del terreno: si
    alguno no está resuelto, el terreno completo requiere ingreso manual de meses de
    retraso (None). Si todos están resueltos, no hay sobrecosto (0). easements_easement
    ya es una tabla terreno-completo (no por proyecto) — se consulta una sola vez y sirve
    de fallback para cualquier proyecto sin registro en validation_field."""
    try:
        conn = _connect(os.environ['DATABASE_URL'])
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT type, foreign_status, public_status FROM easements_easement
                       WHERE terrain_id = %s AND character = 'electrical'
                       ORDER BY id DESC LIMIT 1""",
                    (terrain_id,),
                )
                easement_row = cur.fetchone()
                easement_type = easement_row['type'] if easement_row else None
                easement_foreign_status = easement_row['foreign_status'] if easement_row else None
                easement_public_status = easement_row['public_status'] if easement_row else None

                cur.execute(
                    """SELECT DISTINCT ON (vf.project_id) vf.value, vf.status
                       FROM validation_field vf
                       JOIN minifarm_project p ON p.id = vf.project_id
                       WHERE p.terrain_id = %s
                         AND p.stage NOT IN ('dead', 'paused', 'uci')
                         AND vf.name = 'Servidumbre'
                         AND vf.value IS NOT NULL
                       ORDER BY vf.project_id, vf.id DESC""",
                    (terrain_id,),
                )
                vf_rows = cur.fetchall()
        finally:
            conn.close()
    except Exception:
        return None, None

    resultados = [
        _resolve_servidumbre(r['value'], r['status'], easement_type, easement_foreign_status, easement_public_status)
        for r in vf_rows
    ]
    if not resultados and easement_type:
        resultados = [_resolve_servidumbre(None, None, easement_type, easement_foreign_status, easement_public_status)]
    if not resultados:
        return None, None

    peor = next((r for r in resultados if not r[1]), resultados[0])
    tipo, _resuelto_peor, estado_label = peor
    todos_resueltos = all(r[1] for r in resultados)

    detalle = {'tipo': _TIPO_LABELS.get(tipo, tipo), 'estado': estado_label} if tipo else None
    return (0 if todos_resueltos else None), detalle


# Estados que se consideran resueltos (sin sobrecosto) para 'Ocupación de cauce'
_OCUPACION_RESUELTO = {'no requiere', 'aprobado', 'exonerado'}


def _get_ocupacion_cauce(terrain_id: int) -> tuple[Optional[bool], Optional[str]]:
    """Peor escenario de 'Ocupación de cauce' entre todos los proyectos activos del
    terreno: si alguno tiene un estado no resuelto, el terreno completo carga el
    sobrecosto. Retorna (aplica_sobrecosto, detalle) del peor estado encontrado."""
    try:
        conn = _connect(os.environ['DATABASE_URL'])
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT DISTINCT ON (vf.project_id) vf.value, vf.status
                       FROM validation_field vf
                       JOIN minifarm_project p ON p.id = vf.project_id
                       WHERE p.terrain_id = %s
                         AND p.stage NOT IN ('dead', 'paused', 'uci')
                         AND vf.name = 'Ocupación de cauce'
                         AND (vf.value IS NOT NULL OR vf.status = 'exonerated')
                       ORDER BY vf.project_id, vf.id DESC""",
                    (terrain_id,),
                )
                rows = cur.fetchall()
        finally:
            conn.close()
    except Exception:
        return None, None

    peor_detalle = None
    aplica_sobrecosto = False
    for r in rows:
        raw = (r['value'] or '').strip()
        if not raw and r['status'] == 'exonerated':
            raw = 'Exonerado'
        if raw.startswith('/media/') or raw.startswith('validation/'):
            raw = 'Evidencia sin resolver'
        if not raw:
            continue
        no_resuelto = raw.lower() not in _OCUPACION_RESUELTO
        if no_resuelto:
            aplica_sobrecosto = True
            peor_detalle = raw
        elif peor_detalle is None:
            peor_detalle = raw
    if peor_detalle is None:
        return None, None
    return aplica_sobrecosto, peor_detalle


# Estados de entities_coexistence.status que se consideran resueltos (sin sobrecosto)
_COEXISTENCIA_RESUELTA = {'approved', 'not_applicable'}
_ESTADO_LABELS = {
    'approved': 'Aprobado',
    'pending': 'Pendiente',
    'sent': 'Enviado',
    'communication': 'En comunicación',
    'not_applicable': 'No aplica',
}


def _get_coexistencias_terreno(project_ids: list[int]) -> tuple[bool, list[dict]]:
    """Consulta solicitudes de coexistencia (entities_coexistence) de TODOS los proyectos
    activos del terreno (requestsdb). aplica_sobrecosto es True si alguna solicitud de
    CUALQUIER proyecto está en un estado distinto de resuelto/aprobado (peor escenario)."""
    if not project_ids:
        return False, []
    db2_url = os.environ.get('DATABASE_URL2') or os.environ.get('DATABASE_URL')
    try:
        conn = _connect(db2_url)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT c.status, o.name AS operator_name
                       FROM entities_coexistence c
                       LEFT JOIN entities_operator o ON o.id = c.operator_id
                       WHERE c.project_id = ANY(%s)
                       ORDER BY o.name""",
                    ([str(pid) for pid in project_ids],),
                )
                rows = cur.fetchall()
                detalle = [
                    {
                        'entidad': r['operator_name'] or 'Desconocido',
                        'estado': _ESTADO_LABELS.get(r['status'], r['status']),
                    }
                    for r in rows
                ]
                aplica_sobrecosto = any(r['status'] not in _COEXISTENCIA_RESUELTA for r in rows)
                return aplica_sobrecosto, detalle
        finally:
            conn.close()
    except Exception:
        return False, []


# Estados del valor de 'Licencia de aprovechamiento forestal' que se consideran resueltos
_APROV_RESUELTO = {'exonerado', 'solicitud aprobada'}
_APROV_NIVEL_RANK = {'visita': 1, 'solicitud radicada': 2}
_APROV_NIVEL_DEFAULT_RANK = 3  # cualquier otro estado no resuelto (Pausado, Programado, etc.)
_APROV_RANK_TO_NIVEL = {1: 'visita', 2: 'radicada', 3: 'otro'}


def _resolve_aprovechamiento_nivel(raw: str) -> Optional[str]:
    """Resuelve el valor crudo de 'Licencia de aprovechamiento forestal' de UN proyecto a
    None (resuelto/sin registro), 'visita', 'radicada' u 'otro'. Sin peor-escenario —
    aprovechamiento_forestal es scope 'proyecto': cada proyecto usa solo su propio dato."""
    low = raw.lower()
    if not raw or low in _APROV_RESUELTO:
        return None
    rank = _APROV_NIVEL_RANK.get(low, _APROV_NIVEL_DEFAULT_RANK)
    return _APROV_RANK_TO_NIVEL[rank]


def _get_proyectos_activos(terrain_id: int) -> list[dict]:
    """Proyectos activos del terreno (mismo filtro de stage que 'cluster'). Devuelve los
    5 campos de scope 'proyecto' — distancia_via/distancia_red (columnas propias de
    minifarm_project, ya per-proyecto), tipo_estructura, numero_arboles y
    aprovechamiento_forestal (validation_field por project_id, sin peor-escenario) —
    cada uno resuelto individualmente por proyecto, sin funnel a un valor compartido."""
    conn = _connect(os.environ['DATABASE_URL'])
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT
                       p.name                                      AS nombre,
                       p.road_distance                             AS distancia_via,
                       p.network_distance                          AS distancia_red,
                       (
                           SELECT vf.value FROM validation_field vf
                           WHERE (vf.project_id = p.id OR vf.terrain_id = p.terrain_id)
                             AND vf.name = 'Tipo de arreglo'
                             AND vf.value IS NOT NULL
                           ORDER BY vf.id DESC LIMIT 1
                       )                                           AS tipo_raw,
                       (
                           SELECT vf.value FROM validation_field vf
                           WHERE vf.project_id = p.id
                             AND vf.name = 'Número de árboles'
                             AND vf.value IS NOT NULL
                           ORDER BY vf.id DESC LIMIT 1
                       )                                           AS numero_arboles_raw,
                       (
                           SELECT vf.value FROM validation_field vf
                           WHERE vf.project_id = p.id
                             AND vf.name = 'Licencia de aprovechamiento forestal'
                           ORDER BY vf.id DESC LIMIT 1
                       )                                           AS aprov_value,
                       (
                           SELECT vf.status FROM validation_field vf
                           WHERE vf.project_id = p.id
                             AND vf.name = 'Licencia de aprovechamiento forestal'
                           ORDER BY vf.id DESC LIMIT 1
                       )                                           AS aprov_status
                   FROM minifarm_project p
                   WHERE p.terrain_id = %s
                     AND p.stage NOT IN ('dead', 'paused', 'uci')
                   ORDER BY p.id""",
                (terrain_id,),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    proyectos = []
    for r in rows:
        tipo_raw = (r['tipo_raw'] or '').upper()
        if '1P' in tipo_raw or '2P' in tipo_raw:
            tipo_estructura = 'tracker'
        elif 'MESA' in tipo_raw:
            tipo_estructura = 'mesa_fija'
        else:
            tipo_estructura = None

        arboles_raw = (r['numero_arboles_raw'] or '').strip()
        numero_arboles = int(arboles_raw) if arboles_raw.isdigit() else None

        aprov_raw = (r['aprov_value'] or '').strip()
        if not aprov_raw and r['aprov_status'] == 'exonerated':
            aprov_raw = 'Exonerado'

        proyectos.append({
            'nombre': r['nombre'],
            'distancia_via': r['distancia_via'],
            'distancia_red': r['distancia_red'],
            'tipo_estructura': tipo_estructura,
            'numero_arboles': numero_arboles,
            'aprovechamiento_forestal': _resolve_aprovechamiento_nivel(aprov_raw),
        })
    return proyectos


def get_terrain_data(code: str) -> Optional[dict]:
    """Fetch terrain data from PostgreSQL. Returns None if terrain not found."""
    database_url = os.environ['DATABASE_URL']
    conn = _connect(database_url)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    t.id                                        AS terrain_id,
                    t.name                                      AS code,
                    t.radiation                                 AS produccion_especifica,
                    p.name                                      AS name,
                    tc.name                                     AS municipality,
                    p.grid_operator_id                          AS "or",
                    (
                        SELECT COUNT(*)
                        FROM minifarm_project mp2
                        WHERE mp2.terrain_id = t.id
                          AND mp2.stage NOT IN ('dead', 'paused', 'uci')
                    )                                           AS cluster,
                    (
                        SELECT ts.rent_annual_cost_cop
                        FROM termsheet_termsheet ts
                        WHERE ts.id = p.termsheet_id
                    )                                           AS arriendo_anual

                FROM termsheet_terrain t
                JOIN minifarm_project p ON p.terrain_id = t.id
                LEFT JOIN territorial_city tc ON tc.id = t.city_id
                WHERE UPPER(t.name) = UPPER(%s)
                ORDER BY p.id DESC
                LIMIT 1
            """, (code,))
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return None

    d = dict(row)
    terrain_id: int = d.pop('terrain_id')

    # municipio: derivado del nombre del proyecto "{CODIGO}_{MUNICIPIO}_{ZONA}"
    # (territorial_city.name puede estar mal asignado en el terreno). Cae a tc.name si no matchea el patrón.
    name_parts = (d.get('name') or '').split('_')
    if len(name_parts) >= 3:
        d['municipality'] = name_parts[-2].replace('-', ' ').title()

    # operador de red: frontend usa mayúsculas (AFINIA, ESSA, EPM…)
    if d.get('or'):
        d['or'] = d['or'].upper()

    project_ids = _get_active_project_ids(terrain_id)

    d['nivel_tension'] = _get_nivel_tension_terreno(project_ids)
    d['ocupacion_cauce'], d['ocupacion_cauce_detalle'] = _get_ocupacion_cauce(terrain_id)
    d['servidumbre'], d['servidumbre_detalle'] = _get_servidumbre(terrain_id)
    d['coexistencias'], d['coexistencias_detalle'] = _get_coexistencias_terreno(project_ids)
    d['proyectos'] = _get_proyectos_activos(terrain_id)

    return d
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/test_terrain_service.py -v`

Expected: PASS — all 8 tests pass.

- [ ] **Step 5: Update `backend/tests/test_terrain.py`**

Find (lines 25-44):

```python
def test_terrain_returns_data(client):
    mock_data = {
        'code': 'COLCEST5', 'name': 'Test', 'municipality': 'Aguachica',
        'distancia_via': 120, 'distancia_red': 350, 'or': 'AFINIA',
        'nivel_tension': '34.5 kV', 'cluster': 2, 'tipo_estructura': 'Tracker',
        'ocupacion_cauce': False, 'servidumbre': 'own',
        'aprovechamiento_forestal': 'Exonerado', 'coexistencias': False,
        'produccion_especifica': 4.5287, 'arriendo_anual': 26275000.0,
    }
    with patch('app.routes.terrain.validate_token', return_value={'pk': 1}), \
         patch('app.services.terrain_service.get_terrain_data', return_value=mock_data):
        response = client.get(
            '/api/terrain/COLCEST5',
            headers={'Authorization': 'Bearer fake-token'}
        )
    assert response.status_code == 200
    data = response.get_json()
    assert data['code'] == 'COLCEST5'
    assert data['distancia_via'] == 120
```

Replace with:

```python
def test_terrain_returns_data(client):
    mock_data = {
        'code': 'COLCEST5', 'name': 'Test', 'municipality': 'Aguachica',
        'or': 'AFINIA', 'nivel_tension': '34.5 kV', 'cluster': 2,
        'ocupacion_cauce': False, 'servidumbre': 0, 'servidumbre_detalle': None,
        'coexistencias': False, 'coexistencias_detalle': [],
        'produccion_especifica': 4.5287, 'arriendo_anual': 26275000.0,
        'proyectos': [
            {
                'nombre': 'COLCEST5P1_AGUACHICA_SUR', 'distancia_via': 120, 'distancia_red': 350,
                'tipo_estructura': 'tracker', 'numero_arboles': 0, 'aprovechamiento_forestal': None,
            },
        ],
    }
    with patch('app.routes.terrain.validate_token', return_value={'pk': 1}), \
         patch('app.services.terrain_service.get_terrain_data', return_value=mock_data):
        response = client.get(
            '/api/terrain/COLCEST5',
            headers={'Authorization': 'Bearer fake-token'}
        )
    assert response.status_code == 200
    data = response.get_json()
    assert data['code'] == 'COLCEST5'
    assert data['proyectos'][0]['distancia_via'] == 120
```

- [ ] **Step 6: Run the full backend suite**

Run (from `backend/`): `./venv/Scripts/python.exe -m pytest tests/ -v`

Expected: all pass except `test_terrain_requires_auth` (pre-existing local-env artifact, see Global Constraints).

- [ ] **Step 7: Smoke-test against the live dev backend**

If the backend dev server is running (`http://127.0.0.1:5000`), restart it (it auto-reloads on file save with Flask debug mode) and run:

```bash
curl -s http://127.0.0.1:5000/api/terrain/COLSANT5
```

Expected: JSON response with a `proyectos` array containing 2 entries (P1, P2), each with its own `numero_arboles` (P1: `2`, P2: `0`) — no top-level `distancia_via`/`numero_arboles`/`aprovechamiento_forestal` keys.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/terrain_service.py backend/tests/test_terrain.py backend/tests/test_terrain_service.py
git commit -m "feat: return proyectos[] with per-project data, fix worst-case for terrain-wide criteria"
```

---

### Task 2: Frontend types — `CriterionScope`, `ProyectoData`, `EvalContext.projectCount`

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: all 18 files in `frontend/src/criteria/*.ts` (add `scope` field)
- Modify: `frontend/src/engine/__tests__/evaluatorEngine.test.ts` (add scope coverage test)

**Interfaces:**
- Consumes: nothing from Task 1 directly (this is a pure frontend type change; Task 4 wires the new `proyectos` field into the store).
- Produces (used by Task 3, Task 4): `CriterionScope` type, `ProyectoData` interface, `CriterionModule.scope: CriterionScope` (now required on every module), `EvalContext.projectCount: number`.

- [ ] **Step 1: Update `frontend/src/types/index.ts`**

Find (line 1):

```ts
export interface ObraHidraulicaItem {
```

Insert immediately before it:

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

Find (lines 15-18):

```ts
export interface EvalContext {
  baseCapex: number
  kWp: number
}
```

Replace with:

```ts
export interface EvalContext {
  baseCapex: number
  kWp: number
  projectCount?: number
}
```

`projectCount` is optional so this change alone does not break type-checking on files this task doesn't touch: `evaluatorStore.ts`'s existing `context` computed (not updated until Task 4) and the pre-existing `ctx` test fixtures in `criteria.test.ts`/`evaluatorEngine.test.ts` (which never set it, since none of the 18 `computeCost` formulas read it) all keep compiling unchanged. `evaluateScoped` (Task 3) is the only place that reads `projectCount`, and it defaults to `1` when absent.

Find (lines 62-75):

```ts
export interface CriterionModule {
  id: string
  label: string
  inputType: 'number' | 'toggle' | 'select' | 'checklist'
  unit?: string
  dataSource: 'manual' | 'db' | 'db_or_manual'
  dbField?: string
  options?: SelectOption[]
  formulaDefined: boolean
  category: CriterionCategory
  riskType?: RiskType
  checklistItems?: ChecklistItemDef[]
  computeCost: (value: CriterionValue, context: EvalContext) => number
}
```

Replace with:

```ts
export interface CriterionModule {
  id: string
  label: string
  inputType: 'number' | 'toggle' | 'select' | 'checklist'
  unit?: string
  dataSource: 'manual' | 'db' | 'db_or_manual'
  dbField?: string
  options?: SelectOption[]
  formulaDefined: boolean
  category: CriterionCategory
  riskType?: RiskType
  scope: CriterionScope
  checklistItems?: ChecklistItemDef[]
  computeCost: (value: CriterionValue, context: EvalContext) => number
}
```

Find (lines 77-98):

```ts
export interface TerrainData {
  code: string
  name: string
  municipality: string
  distancia_via: number | null
  distancia_red: number | null
  or: string | null
  nivel_tension: string | null
  cluster: number | null
  tipo_estructura: string | null
  ocupacion_cauce: boolean | null
  ocupacion_cauce_detalle: string | null
  servidumbre: number | null
  servidumbre_detalle: EstadoDetalle | null
  aprovechamiento_forestal: string | null
  aprovechamiento_forestal_detalle: ProyectoEstadoDetalle[] | null
  coexistencias: boolean | null
  coexistencias_detalle: CoexistenciaDetalle[] | null
  numero_arboles: number | null
  produccion_especifica: number | null
  arriendo_anual: number | null
}
```

Replace with:

```ts
export interface TerrainData {
  code: string
  name: string
  municipality: string
  or: string | null
  nivel_tension: string | null
  cluster: number | null
  ocupacion_cauce: boolean | null
  ocupacion_cauce_detalle: string | null
  servidumbre: number | null
  servidumbre_detalle: EstadoDetalle | null
  coexistencias: boolean | null
  coexistencias_detalle: CoexistenciaDetalle[] | null
  produccion_especifica: number | null
  arriendo_anual: number | null
  proyectos: ProyectoData[]
}
```

Find (lines 105-108):

```ts
export interface ProyectoEstadoDetalle {
  proyecto: string
  estado: string
}
```

Delete this block entirely (no longer used — `aprovechamiento_forestal_detalle` is gone, replaced by `ProyectoData.aprovechamiento_forestal`).

- [ ] **Step 2: Add `scope` to each of the 18 criteria modules**

For each file below, find the `formulaDefined:` or `category:` line shown and add a `scope:` line immediately after `category:` (matching the existing code style, one line, no trailing comma changes needed since TS/the existing files already end object properties with commas throughout).

`frontend/src/criteria/distancia_via.ts` — find `category: 'fijo',` → add after it:
```ts
  scope: 'proyecto',
```

`frontend/src/criteria/distancia_red.ts` — same: find `category: 'fijo',` → add `scope: 'proyecto',` after.

`frontend/src/criteria/numero_arboles.ts` — find `category: 'fijo',` → add `scope: 'proyecto',` after.

`frontend/src/criteria/aprovechamiento_forestal.ts` — find `category: 'fijo',` → add `scope: 'proyecto',` after.

`frontend/src/criteria/pilotes.ts` — find `category: 'fijo',` → add `scope: 'proyecto',` after.

`frontend/src/criteria/tipo_estructura.ts` — find `category: 'probabilidad',` → add `scope: 'proyecto',` after.

`frontend/src/criteria/corte.ts` — find `category: 'fijo',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/lleno.ts` — find `category: 'fijo',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/obras_hidraulicas.ts` — find `category: 'fijo',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/ocupacion_cauce.ts` — find `category: 'fijo',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/coexistencias.ts` — find `category: 'probabilidad',` (immediately followed by `riskType: 'costo',`) → add `scope: 'terreno_dividido',` after `riskType: 'costo',`.

`frontend/src/criteria/comunidad.ts` — find `category: 'probabilidad',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/or.ts` — find `category: 'probabilidad',` → add `scope: 'terreno_dividido',` after.

`frontend/src/criteria/propietario.ts` — find `category: 'probabilidad',` (immediately followed by `riskType: 'costo',`) → add `scope: 'terreno_dividido',` after `riskType: 'costo',`.

`frontend/src/criteria/servidumbre.ts` — find `category: 'probabilidad',` (immediately followed by `riskType: 'meses',`) → add `scope: 'terreno_dividido',` after `riskType: 'meses',`.

`frontend/src/criteria/amenazas.ts` — find `category: 'probabilidad',` (immediately followed by `riskType: 'meses',`) → add `scope: 'terreno_dividido',` after `riskType: 'meses',`.

`frontend/src/criteria/nivel_tension.ts` — find `category: 'fijo',` → add `scope: 'terreno_multiplicado',` after.

`frontend/src/criteria/cluster.ts` — find `category: 'fijo',` → add `scope: 'terreno_no_dividido',` after.

- [ ] **Step 2b: Verify every file was updated**

Run (from `frontend/`):

```bash
grep -L "scope:" src/criteria/*.ts
```

Expected: no output (every criteria file except files in `__tests__/` now contains `scope:`). If any filename prints, that file was missed — go back and add its `scope:` line.

- [ ] **Step 3: Write the failing test for scope coverage**

Add this to `frontend/src/engine/__tests__/evaluatorEngine.test.ts`, inside the existing `describe('loadCriteria', ...)` block (after the `'todos tienen id, label e inputType'` test, before its closing `})`):

```ts
  it('todos tienen un scope válido', () => {
    const criteria = loadCriteria()
    const validScopes = ['proyecto', 'terreno_dividido', 'terreno_multiplicado', 'terreno_no_dividido']
    for (const c of criteria) {
      expect(validScopes).toContain(c.scope)
    }
  })
```

- [ ] **Step 4: Run the test to verify it passes**

This task adds `scope` as a required field on `CriterionModule` (Step 1) and completes it on all 18 criteria (Step 2) before writing this coverage guard (Step 3) — unlike most tasks in this plan, this isn't new runtime logic to drive with a failing test first; it's a schema field every module must carry, and the test exists to catch future criteria that forget it.

Run (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`

Expected: PASS, 11/11 tests (10 existing + 1 new) in this file. If it fails, Step 2 missed a file — recheck with the Step 2b grep command.

- [ ] **Step 5: Run the full frontend suite and type-check**

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass (no regressions).

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly the 2 pre-existing unrelated errors (see Global Constraints) — no new errors. If you see errors referencing `TerrainData`, `ProyectoEstadoDetalle`, or missing `scope`, a criteria file or a consumer of the deleted `TerrainData` fields still needs fixing — this plan's later tasks (Task 4 fixes `evaluatorStore.ts`, Task 5 fixes `CriterionCard.vue`) resolve their remaining references to the removed fields, so at this exact point in the plan you may see NEW errors in those two files referencing `terrainData.distancia_via` etc. If so, that's expected — note it in your report as `DONE_WITH_CONCERNS` rather than trying to fix files outside this task's scope.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/criteria/*.ts frontend/src/engine/__tests__/evaluatorEngine.test.ts
git commit -m "feat: add scope classification to CriterionModule, ProyectoData type"
```

---

### Task 3: Frontend engine — scope-aware evaluation (general total + per-project breakdown)

**Files:**
- Modify: `frontend/src/engine/evaluatorEngine.ts`
- Modify: `frontend/src/engine/__tests__/evaluatorEngine.test.ts`

**Interfaces:**
- Consumes: `CriterionModule.scope` (Task 2), `EvalContext.projectCount` (Task 2).
- Produces (used by Task 4): `evaluateScoped(values: CriterionValues, perProjectValues: Record<string, Record<string, CriterionValue>>, proyectoNombres: string[], context: EvalContext) => { general: CriterionResult[]; porProyecto: Record<string, CriterionResult[]> }`.

**Why a single combined function, not two separate ones:** the existing `evaluateCriteria` (unchanged, still exported, still used by other tests) computes each criterion's `sobrecosto` from a single shared `values[criterion.id]` — but for scope `proyecto` criteria (distancia_via, distancia_red, aprovechamiento_forestal, numero_arboles, pilotes, tipo_estructura), `criterionValues` no longer holds any value at all (Task 4's `fetchTerrain` skips populating it for these — there's no single shared value, only per-project ones). If the general CAPEX total kept calling plain `evaluateCriteria`, these 6 criteria would silently contribute **$0** to `aggregated.capexTotal` forever. The general total must independently sum each project's own `computeCost` result for `proyecto`-scope criteria, and multiply by N for `terreno_multiplicado` (nivel_tension) — both of which are impossible to express as "one shared value fed through the existing per-criterion formula." `evaluateScoped` computes the general total and the per-project breakdown in the same pass so they can never drift apart from two independent implementations.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/engine/__tests__/evaluatorEngine.test.ts`, after the existing `describe('aggregateCosts', ...)` block's closing `})`:

```ts

describe('evaluateScoped', () => {
  const proyectoNombres = ['P1', 'P2']
  const scopedCtx = { ...ctx, projectCount: 2 }

  it('scope proyecto: general suma el costo de cada proyecto; por proyecto usa su propio valor', () => {
    const values = {}
    const perProjectValues = { numero_arboles: { P1: 2, P2: 3 } }
    const { general, porProyecto } = evaluateScoped(values, perProjectValues, proyectoNombres, scopedCtx)

    const generalArboles = general.find(r => r.id === 'numero_arboles')
    expect(generalArboles?.sobrecosto).toBe(2 * 142_500 + 3 * 142_500)
    expect(generalArboles?.value).toBeNull()

    expect(porProyecto['P1'].find(r => r.id === 'numero_arboles')?.sobrecosto).toBe(2 * 142_500)
    expect(porProyecto['P2'].find(r => r.id === 'numero_arboles')?.sobrecosto).toBe(3 * 142_500)
  })

  it('scope terreno_dividido: general usa el costo completo; por proyecto lo divide entre N', () => {
    const values = { corte: 100 }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'corte')?.sobrecosto).toBe(100 * 80_000)
    expect(porProyecto['P1'].find(r => r.id === 'corte')?.sobrecosto).toBe((100 * 80_000) / 2)
    expect(porProyecto['P2'].find(r => r.id === 'corte')?.sobrecosto).toBe((100 * 80_000) / 2)
  })

  it('scope terreno_multiplicado: general multiplica por N; por proyecto usa el costo completo sin dividir', () => {
    const values = { nivel_tension: '34.5kV' }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'nivel_tension')?.sobrecosto).toBe(30_000_000 * 2)
    expect(porProyecto['P1'].find(r => r.id === 'nivel_tension')?.sobrecosto).toBe(30_000_000)
    expect(porProyecto['P2'].find(r => r.id === 'nivel_tension')?.sobrecosto).toBe(30_000_000)
  })

  it('scope terreno_no_dividido: general sin cambios; no aparece por proyecto', () => {
    const values = { cluster: 2 }
    const { general, porProyecto } = evaluateScoped(values, {}, proyectoNombres, scopedCtx)

    expect(general.find(r => r.id === 'cluster')?.sobrecosto).toBe(-15_000_000)
    expect(porProyecto['P1'].find(r => r.id === 'cluster')).toBeUndefined()
    expect(porProyecto['P2'].find(r => r.id === 'cluster')).toBeUndefined()
  })

  it('sin proyectos activos (projectCount ausente): terreno_dividido no divide (usa 1)', () => {
    const values = { corte: 100 }
    const { general } = evaluateScoped(values, {}, [], ctx)
    expect(general.find(r => r.id === 'corte')?.sobrecosto).toBe(100 * 80_000)
  })
})
```

`aggregateCosts` (existing function, in the same file) has its own bug that would silently defeat the fix above: it filters `results.filter(r => r.formulaDefined && r.value !== null)` before summing anything. Since `evaluateScoped`'s general result deliberately sets `value: null` for scope-`proyecto` criteria (there's no single representative value — only a summed `sobrecosto`), that filter would exclude them from `totalSobrecostoFijo`/`capexTotal` even though `evaluateScoped` computed their sobrecosto correctly. Rename the existing test to stop asserting the soon-to-be-wrong "y valor distinto de null" rule, and add a test proving the new correct behavior.

Find (the existing `aggregateCosts` test's name and body):

```ts
describe('aggregateCosts', () => {
  it('suma al CAPEX solo los criterios fijos/ambas con formulaDefined=true y valor distinto de null', () => {
    const values = { corte: 100, lleno: 10, pilotes: true }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    const expected = 100 * 80_000 + 10 * 210_000 + 156_000_000
    expect(aggregated.totalSobrecostoFijo).toBe(expected)
  })
```

Replace with:

```ts
describe('aggregateCosts', () => {
  it('suma al CAPEX solo los criterios fijos/ambas con formulaDefined=true', () => {
    const values = { corte: 100, lleno: 10, pilotes: true }
    const results = evaluateCriteria(values, ctx)
    const aggregated = aggregateCosts(results, ctx)
    const expected = 100 * 80_000 + 10 * 210_000 + 156_000_000
    expect(aggregated.totalSobrecostoFijo).toBe(expected)
  })

  it('cuenta un resultado con value=null pero sobrecosto real distinto de cero (caso scope proyecto de evaluateScoped)', () => {
    const results = [
      {
        id: 'numero_arboles', label: 'Número de árboles', value: null, sobrecosto: 285_000,
        formulaDefined: true, fromDb: true, category: 'fijo' as const,
      },
    ]
    const aggregated = aggregateCosts(results, ctx)
    expect(aggregated.totalSobrecostoFijo).toBe(285_000)
    expect(aggregated.capexTotal).toBe(ctx.baseCapex + 285_000)
  })
```

(Leave every other existing test in this `describe('aggregateCosts', ...)` block untouched — only the one named test above changes.)

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts -t "evaluateScoped|aggregateCosts"`

Expected: FAIL — `evaluateScoped` tests fail with `evaluateScoped is not defined` (the function doesn't exist yet), and the new "cuenta un resultado con value=null..." test fails because `aggregateCosts`'s current filter (`r.value !== null`) excludes the synthetic result, giving `totalSobrecostoFijo: 0` instead of the expected `285_000`.

- [ ] **Step 3: Add `evaluateScoped` to `frontend/src/engine/evaluatorEngine.ts`**

Find (right before `export function aggregateCosts`, i.e. immediately after the closing `}` of the existing `evaluateCriteria` function — do not modify `evaluateCriteria` itself, it stays exactly as-is for its existing callers):

```ts
export function aggregateCosts(
```

Insert immediately before this line:

```ts
export interface ScopedEvaluation {
  general: CriterionResult[]
  porProyecto: Record<string, CriterionResult[]>
}

export function evaluateScoped(
  values: CriterionValues,
  perProjectValues: Record<string, Record<string, CriterionValue>>,
  proyectoNombres: string[],
  context: EvalContext,
): ScopedEvaluation {
  const criteria = loadCriteria()
  const n = context.projectCount ?? 1

  const general: CriterionResult[] = []
  const porProyecto: Record<string, CriterionResult[]> = {}
  for (const nombre of proyectoNombres) porProyecto[nombre] = []

  for (const criterion of criteria) {
    const base = {
      id: criterion.id,
      label: criterion.label,
      formulaDefined: criterion.formulaDefined,
      fromDb: criterion.dataSource === 'db',
      category: criterion.category,
      riskType: criterion.riskType,
    }

    if (criterion.scope === 'proyecto') {
      const valoresPorProyecto = perProjectValues[criterion.id] ?? {}
      let sumaGeneral = 0
      for (const nombre of proyectoNombres) {
        const value = valoresPorProyecto[nombre] ?? null
        const sobrecosto = criterion.formulaDefined ? criterion.computeCost(value, context) : 0
        sumaGeneral += sobrecosto
        porProyecto[nombre].push({ ...base, value, sobrecosto })
      }
      general.push({ ...base, value: null, sobrecosto: sumaGeneral })
      continue
    }

    const value = values[criterion.id] ?? null
    const costoBase = criterion.formulaDefined ? criterion.computeCost(value, context) : 0
    const costoGeneral = criterion.scope === 'terreno_multiplicado' ? costoBase * n : costoBase
    general.push({ ...base, value, sobrecosto: costoGeneral })

    if (criterion.scope === 'terreno_no_dividido') continue

    const costoPorProyecto = criterion.scope === 'terreno_multiplicado' ? costoBase : costoBase / n
    for (const nombre of proyectoNombres) {
      porProyecto[nombre].push({ ...base, value, sobrecosto: costoPorProyecto })
    }
  }

  return { general, porProyecto }
}

```

- [ ] **Step 4: Fix `aggregateCosts`'s null-value filter**

Find:

```ts
export function aggregateCosts(
  results: CriterionResult[],
  context: EvalContext,
): AggregatedResult {
  const active = results.filter(r => r.formulaDefined && r.value !== null)
```

Replace with:

```ts
export function aggregateCosts(
  results: CriterionResult[],
  context: EvalContext,
): AggregatedResult {
  const active = results.filter(r => r.formulaDefined)
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/engine/__tests__/evaluatorEngine.test.ts`

Expected: PASS — all tests in the file pass, including the 5 new `evaluateScoped` tests and the new `aggregateCosts` null-value test.

- [ ] **Step 6: Run the full suite and type-check**

Run (from `frontend/`): `npx vitest run`

Expected: all test files pass.

Run (from `frontend/`): `npx vue-tsc -b`

Expected: same 2 pre-existing errors as before, plus whatever `TerrainData`-field errors were already present from Task 2 (still expected to be resolved by Task 4 and Task 5 — do not fix them in this task).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/engine/evaluatorEngine.ts frontend/src/engine/__tests__/evaluatorEngine.test.ts
git commit -m "feat: add evaluateScoped for scope-aware general total + per-project breakdown"
```

---

### Task 4: Frontend store — `perProjectValues`, auto-population, financial per-project VPN

**Files:**
- Modify: `frontend/src/stores/evaluatorStore.ts`
- Modify: `frontend/src/stores/__tests__/evaluatorStore.test.ts`
- Modify: `frontend/src/components/SummaryPanel.vue`

**Interfaces:**
- Consumes: `TerrainData.proyectos` (Task 1/2), `evaluateScoped` (Task 3), `EvalContext.projectCount` (Task 2), `calcularFinanzas` (existing, unchanged signature).
- Produces (used by Task 5, Task 6): store getters `perProjectValues: Record<string, Record<string, CriterionValue>>`, `perProjectResults: Record<string, CriterionResult[]>` (computed), `perProjectFinancials: Record<string, { vpn: number; vpnConBeneficios: number }>` (computed), `setPilotesForProyecto(nombre: string, value: boolean): void`.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/stores/__tests__/evaluatorStore.test.ts` (check the file's existing imports/setup first — it already imports `useEvaluatorStore` and sets up Pinia per existing tests; add a new top-level `describe` block at the end of the file):

```ts

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
    expect(store.perProjectFinancials!['P1'].vpn).toBeCloseTo(store.financialResults!.vpn / 2, 0)
    expect(store.perProjectFinancials!['P2'].vpn).toBeCloseTo(store.financialResults!.vpn / 2, 0)
  })
})
```

Check the top of `frontend/src/stores/__tests__/evaluatorStore.test.ts` for the exact existing import of `terrainService` (it should already be imported as `import * as terrainService from '@/services/terrainService'` or similar, since the file already spies on `terrainService.fetchTerrainData` per the codebase's existing test — reuse that same import, do not add a duplicate).

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/stores/__tests__/evaluatorStore.test.ts`

Expected: FAIL — `store.perProjectValues` is `undefined`, `setPilotesForProyecto` is not a function, `perProjectResults`/`perProjectFinancials` are undefined.

- [ ] **Step 3: Update `frontend/src/stores/evaluatorStore.ts`**

Find (line 1-11):

```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchTerrainData } from '@/services/terrainService'
import { loadCriteria, evaluateCriteria, aggregateCosts } from '@/engine/evaluatorEngine'
import { calcularFinanzas } from '@/engine/financialEngine'
import { useAuthStore } from '@/stores/authStore'
import type { TerrainData, CriterionValue, AggregatedResult, FinancialResults } from '@/types'

type CriterionValues = Record<string, CriterionValue>

const BASE_CAPEX_DEFAULT = 4_000_000_000
const KWP_DEFAULT = 1320
```

Replace with:

```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchTerrainData } from '@/services/terrainService'
import { loadCriteria, evaluateScoped, aggregateCosts } from '@/engine/evaluatorEngine'
import { calcularFinanzas } from '@/engine/financialEngine'
import { useAuthStore } from '@/stores/authStore'
import type { TerrainData, CriterionValue, CriterionResult, AggregatedResult, FinancialResults } from '@/types'

type CriterionValues = Record<string, CriterionValue>
type PerProjectValues = Record<string, Record<string, CriterionValue>>

const BASE_CAPEX_DEFAULT = 4_000_000_000
const KWP_DEFAULT = 1320
const PROYECTO_SCOPE_DB_FIELDS = ['distancia_via', 'distancia_red', 'aprovechamiento_forestal', 'numero_arboles', 'tipo_estructura']
```

Note: `evaluateCriteria` (plain, non-scope-aware) stays exported from `evaluatorEngine.ts` and untouched — this store simply stops importing it, switching to `evaluateScoped` instead. Other existing tests that call `evaluateCriteria` directly keep working unchanged.

Find (lines 14-24):

```ts
export const useEvaluatorStore = defineStore('evaluador', () => {
  const terrainData = ref<TerrainData | null>(null)
  const criterionValues = ref<CriterionValues>({})
  const baseCapex = ref(BASE_CAPEX_DEFAULT)
  const kWp = ref(KWP_DEFAULT)
  const kVA = ref(1000)
  const arriendoManual = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const context = computed(() => ({ baseCapex: baseCapex.value, kWp: kWp.value }))
```

Replace with:

```ts
export const useEvaluatorStore = defineStore('evaluador', () => {
  const terrainData = ref<TerrainData | null>(null)
  const criterionValues = ref<CriterionValues>({})
  const perProjectValues = ref<PerProjectValues>({})
  const baseCapex = ref(BASE_CAPEX_DEFAULT)
  const kWp = ref(KWP_DEFAULT)
  const kVA = ref(1000)
  const arriendoManual = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const proyectoNombres = computed(() => terrainData.value?.proyectos.map(p => p.nombre) ?? [])
  const projectCount = computed(() => Math.max(proyectoNombres.value.length, 1))

  const context = computed(() => ({ baseCapex: baseCapex.value, kWp: kWp.value, projectCount: projectCount.value }))
```

Find (lines 26-29, the `aggregated` computed):

```ts
  const aggregated = computed<AggregatedResult>(() => {
    const results = evaluateCriteria(criterionValues.value, context.value)
    return aggregateCosts(results, context.value)
  })
```

Replace with (both `aggregated` and the new `perProjectResults` are derived from the SAME `evaluateScoped` call, so the general total and the per-project breakdown can never drift apart from two independently-computed sources):

```ts
  const scopedEvaluation = computed(() => {
    return evaluateScoped(criterionValues.value, perProjectValues.value, proyectoNombres.value, context.value)
  })

  const aggregated = computed<AggregatedResult>(() => {
    return aggregateCosts(scopedEvaluation.value.general, context.value)
  })

  const perProjectResults = computed<Record<string, CriterionResult[]>>(() => {
    return scopedEvaluation.value.porProyecto
  })
```

Find (lines 31-42, the `financialResults` computed):

```ts
  const financialResults = computed<FinancialResults | null>(() => {
    const produccionEspecifica = terrainData.value?.produccion_especifica
    const arriendoAnual = arriendoManual.value ?? terrainData.value?.arriendo_anual
    if (!produccionEspecifica || !arriendoAnual) return null
    return calcularFinanzas({
      capex: aggregated.value.capexTotal,
      kWp: kWp.value,
      kVA: kVA.value,
      produccionEspecifica,
      arriendoAnual,
    })
  })
```

Immediately after it, insert:

```ts

  const perProjectFinancials = computed<Record<string, { vpn: number; vpnConBeneficios: number }> | null>(() => {
    const produccionEspecifica = terrainData.value?.produccion_especifica
    const arriendoAnual = arriendoManual.value ?? terrainData.value?.arriendo_anual
    if (!produccionEspecifica || !arriendoAnual) return null
    const n = projectCount.value
    // Divide el CAPEX GENERAL ya agregado (no reconstruir desde perProjectResults —
    // eso ya divide los criterios terreno_dividido dentro de evaluateScoped; volver
    // a dividir aquí dividiría dos veces esa porción, y baseCapex quedaría sin dividir).
    const capexPorProyecto = aggregated.value.capexTotal / n

    const resultado: Record<string, { vpn: number; vpnConBeneficios: number }> = {}
    for (const nombre of proyectoNombres.value) {
      const finanzas = calcularFinanzas({
        capex: capexPorProyecto,
        kWp: kWp.value / n,
        kVA: kVA.value / n,
        produccionEspecifica,
        arriendoAnual: arriendoAnual / n,
      })
      resultado[nombre] = { vpn: finanzas.vpn, vpnConBeneficios: finanzas.vpnConBeneficios }
    }
    return resultado
  })
```

Find (lines 44-66, `fetchTerrain`):

```ts
  async function fetchTerrain(code: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const auth = useAuthStore()
      const data = await fetchTerrainData(code, auth.accessToken ?? '')
      terrainData.value = data

      const criteria = loadCriteria()
      const dbValues: CriterionValues = {}
      for (const criterion of criteria) {
        if (criterion.dbField && data[criterion.dbField as keyof TerrainData] !== undefined) {
          dbValues[criterion.id] = data[criterion.dbField as keyof TerrainData] as CriterionValue
        }
      }
      criterionValues.value = { ...criterionValues.value, ...dbValues }
    } catch (e) {
      error.value = 'No se encontró el terreno o error de conexión.'
      terrainData.value = null
    } finally {
      loading.value = false
    }
  }
```

Replace with:

```ts
  async function fetchTerrain(code: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const auth = useAuthStore()
      const data = await fetchTerrainData(code, auth.accessToken ?? '')
      terrainData.value = data

      const criteria = loadCriteria()
      const dbValues: CriterionValues = {}
      for (const criterion of criteria) {
        if (criterion.scope === 'proyecto') continue
        if (criterion.dbField && data[criterion.dbField as keyof TerrainData] !== undefined) {
          dbValues[criterion.id] = data[criterion.dbField as keyof TerrainData] as CriterionValue
        }
      }
      criterionValues.value = { ...criterionValues.value, ...dbValues }

      const newPerProjectValues: PerProjectValues = {}
      for (const field of PROYECTO_SCOPE_DB_FIELDS) {
        newPerProjectValues[field] = {}
        for (const proyecto of data.proyectos) {
          newPerProjectValues[field][proyecto.nombre] = proyecto[field as keyof typeof proyecto] as CriterionValue
        }
      }
      perProjectValues.value = newPerProjectValues
    } catch (e) {
      error.value = 'No se encontró el terreno o error de conexión.'
      terrainData.value = null
    } finally {
      loading.value = false
    }
  }
```

Find (lines 68-70, `setCriterionValue`):

```ts
  function setCriterionValue(id: string, value: CriterionValue): void {
    criterionValues.value = { ...criterionValues.value, [id]: value }
  }
```

Immediately after it, insert:

```ts

  function setPilotesForProyecto(nombre: string, value: boolean): void {
    perProjectValues.value = {
      ...perProjectValues.value,
      pilotes: { ...perProjectValues.value.pilotes, [nombre]: value },
    }
  }
```

Find (lines 72-76, `reset`):

```ts
  function reset(): void {
    terrainData.value = null
    criterionValues.value = {}
    error.value = null
  }
```

Replace with:

```ts
  function reset(): void {
    terrainData.value = null
    criterionValues.value = {}
    perProjectValues.value = {}
    error.value = null
  }
```

Find (lines 78-81, the return statement):

```ts
  return {
    terrainData, criterionValues, baseCapex, kWp, kVA, arriendoManual,
    loading, error, aggregated, financialResults, fetchTerrain, setCriterionValue, reset,
  }
```

Replace with:

```ts
  return {
    terrainData, criterionValues, perProjectValues, baseCapex, kWp, kVA, arriendoManual,
    loading, error, aggregated, financialResults, perProjectResults, perProjectFinancials,
    proyectoNombres, fetchTerrain, setCriterionValue, setPilotesForProyecto, reset,
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `frontend/`): `npx vitest run src/stores/__tests__/evaluatorStore.test.ts`

Expected: PASS — all tests, including the new ones.

- [ ] **Step 5: Fix `frontend/src/components/SummaryPanel.vue`'s itemized breakdown filters**

`evaluateScoped` (Task 3) sets `value: null` for scope-`proyecto` criteria in the **general** result (there's no single representative value at the terrain level — only a summed `sobrecosto`, see Task 3's rationale). `SummaryPanel.vue`'s itemized lists currently require `r.value !== null` to show a line, which would silently hide distancia_via/distancia_red/numero_arboles/aprovechamiento_forestal/pilotes from the sidebar breakdown even though they now correctly contribute to the total shown below them. Since `sobrecosto !== 0` already excludes "nothing to show" criteria on its own, drop the redundant `value !== null` check.

Find:

```ts
const fijoBreakdown = computed(() =>
  store.aggregated.breakdown.filter(
    r => (r.category === 'fijo' || r.category === 'ambas') && r.formulaDefined && r.value !== null && r.sobrecosto !== 0,
  ),
)

const retrasoBreakdown = computed(() =>
  store.aggregated.breakdown.filter(
    r => r.category === 'probabilidad' && r.formulaDefined && r.value !== null && r.sobrecosto > 0,
  ),
)
```

Replace with:

```ts
const fijoBreakdown = computed(() =>
  store.aggregated.breakdown.filter(
    r => (r.category === 'fijo' || r.category === 'ambas') && r.formulaDefined && r.sobrecosto !== 0,
  ),
)

const retrasoBreakdown = computed(() =>
  store.aggregated.breakdown.filter(
    r => r.category === 'probabilidad' && r.formulaDefined && r.sobrecosto > 0,
  ),
)
```

- [ ] **Step 6: Run the full suite and type-check**

Run (from `frontend/`): `npx vitest run`

Expected: all pass.

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly the 2 pre-existing errors — any `TerrainData` field errors from earlier tasks should now be resolved by this task's rewrite of `fetchTerrain`, EXCEPT `CriterionCard.vue`'s references to the removed fields (`aprovechamiento_forestal_detalle`, `ocupacion_cauce_detalle` is still valid — only check for `distancia_via`/`numero_arboles`/`tipo_estructura`/`aprovechamiento_forestal` top-level reads), which Task 5 fixes. If `vue-tsc` shows errors in `CriterionCard.vue`, note them in your report as expected/deferred to Task 5 — do not fix `CriterionCard.vue` in this task.

- [ ] **Step 7: Manual verification against the running dev server**

This repo has no automated tests for `.vue` components — verify by code trace and, if a live browser is available, drive the app; otherwise state plainly in your report that this needs human verification.

1. Restart backend + frontend dev servers if running.
2. Search terrain `COLSANT5`.
3. Confirm the sidebar "Resumen de costos" now shows line items for "Número de árboles" (and any other scope-`proyecto` criteria with a non-zero total) with the correct SUMMED value (e.g. `2 árboles` worth `2 * 142_500` + `0 árboles` worth `0` from the other project = `$285.000` total), where before this task it would have shown `$0` or been silently missing.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/stores/evaluatorStore.ts frontend/src/stores/__tests__/evaluatorStore.test.ts frontend/src/components/SummaryPanel.vue
git commit -m "feat: add perProjectValues, perProjectResults, perProjectFinancials to evaluatorStore"
```

---

### Task 5: UI — `CriterionCard.vue` per-project rows for scope `proyecto`

**Files:**
- Modify: `frontend/src/components/CriterionCard.vue`

**Interfaces:**
- Consumes: `store.perProjectValues`, `store.proyectoNombres`, `store.perProjectResults` (Task 4), `store.setPilotesForProyecto` (Task 4), `loadCriteria()` (existing, now returns modules with `.scope`).

- [ ] **Step 1: Remove now-invalid detail blocks referencing deleted `TerrainData` fields**

Find the `aprovechamientoDetalle` computed (search for `result.id !== 'aprovechamiento_forestal'` in the file) and its corresponding template block (search for `result.id === 'aprovechamiento_forestal'` in the `<template>`). Delete both the computed and its template block — `aprovechamiento_forestal_detalle` no longer exists on `TerrainData`; this criterion's detail now comes from the new scope-`proyecto` row rendering added in Step 3.

- [ ] **Step 2: Fix `accentColor` for scope-`proyecto` criteria**

`evaluateScoped` (Task 3) always sets `value: null` on the general result for scope-`proyecto` criteria, even when real per-project data exists (there's no single representative value at the terrain level — see Task 3's rationale). Left unfixed, `accentColor`'s existing `props.result.value !== null` check would make these 6 cards always render as "empty" (gray border) even when their per-project rows have real data. Check `store.perProjectResults` instead for this branch.

Find:

```ts
const accentColor = computed(() => {
  if (!props.result.formulaDefined) return '#ea580c'
  if (props.result.value !== null) return 'var(--purple)'
  return 'var(--border)'
})
```

Replace with:

```ts
const accentColor = computed(() => {
  if (!props.result.formulaDefined) return '#ea580c'
  if (module.value?.scope === 'proyecto') {
    const results = store.perProjectResults
    const tieneDatos = store.proyectoNombres.some(
      nombre => results[nombre]?.find(r => r.id === props.result.id)?.value !== null,
    )
    return tieneDatos ? 'var(--purple)' : 'var(--border)'
  }
  if (props.result.value !== null) return 'var(--purple)'
  return 'var(--border)'
})
```

- [ ] **Step 3: Add per-project computeds and handlers**

Find the `checklistItem` function and the block right after it (the `checklistGroups` computed, ending right before `function handleChecklistToggle`). Immediately after `checklistGroups`'s closing `})`, insert:

```ts

const isProyectoScope = computed(() => module.value?.scope === 'proyecto')

const proyectoRows = computed(() => {
  if (!isProyectoScope.value) return []
  const results = store.perProjectResults
  return store.proyectoNombres.map(nombre => {
    const result = results[nombre]?.find(r => r.id === props.result.id)
    return {
      nombre,
      value: result?.value ?? null,
      sobrecosto: result?.sobrecosto ?? 0,
    }
  })
})

const proyectoTotal = computed(() => proyectoRows.value.reduce((acc, row) => acc + row.sobrecosto, 0))

function handlePilotesToggle(nombre: string, event: Event) {
  const target = event.target as HTMLInputElement
  store.setPilotesForProyecto(nombre, target.checked)
}
```

- [ ] **Step 4: Add the per-project template branch**

Find the `.card-input` closing `</div>` (the one right after the `checklist` `v-else-if` template block ends). Immediately before that closing `</div>`, insert a new `v-else-if` branch:

```html
      <template v-else-if="isProyectoScope && result.id !== 'pilotes'">
        <div class="proyecto-rows">
          <div v-for="row in proyectoRows" :key="row.nombre" class="proyecto-row">
            <span class="proyecto-row-nombre">{{ row.nombre }}</span>
            <span class="proyecto-row-valor">{{ row.value ?? '—' }}{{ module?.unit ? ` ${module.unit}` : '' }}</span>
            <span class="proyecto-row-sobrecosto">{{ formatCOP(row.sobrecosto) }}</span>
          </div>
          <div class="proyecto-row proyecto-row--total">
            <span class="proyecto-row-nombre">Total</span>
            <span class="proyecto-row-sobrecosto">{{ formatCOP(proyectoTotal) }}</span>
          </div>
        </div>
      </template>

      <template v-else-if="isProyectoScope && result.id === 'pilotes'">
        <div class="proyecto-rows">
          <div v-for="nombre in store.proyectoNombres" :key="nombre" class="proyecto-row">
            <label class="toggle-label">
              <input
                type="checkbox"
                :checked="store.perProjectValues.pilotes?.[nombre] === true"
                class="toggle-checkbox"
                @change="handlePilotesToggle(nombre, $event)"
              />
              <span>{{ nombre }}</span>
            </label>
          </div>
        </div>
      </template>
```

- [ ] **Step 5: Hide the generic bottom cost row for scope-`proyecto` criteria**

Find the `<!-- Criterio fijo: muestra COP -->` template block (the `<div class="card-cost" v-if="result.formulaDefined && result.category !== 'probabilidad'">`). Change its `v-if` to also exclude scope-`proyecto` criteria (their own total is already shown inside `proyecto-rows` from Step 3):

Find:

```html
    <div class="card-cost" v-if="result.formulaDefined && result.category !== 'probabilidad'">
```

Replace with:

```html
    <div class="card-cost" v-if="result.formulaDefined && result.category !== 'probabilidad' && !isProyectoScope">
```

- [ ] **Step 6: Add CSS for the per-project rows**

Find the closing `</style>` tag. Immediately before it, insert:

```css

.proyecto-rows { display: flex; flex-direction: column; gap: 0.4rem; width: 100%; }
.proyecto-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
}
.proyecto-row-nombre { color: var(--text-mid); flex: 1; }
.proyecto-row-valor { color: var(--text); font-weight: 600; white-space: nowrap; }
.proyecto-row-sobrecosto { color: var(--purple); font-weight: 700; white-space: nowrap; }
.proyecto-row--total {
  border-top: 1px dashed var(--border);
  padding-top: 0.4rem;
  margin-top: 0.2rem;
  font-weight: 700;
}
```

- [ ] **Step 7: Type-check**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly the 2 pre-existing errors — no new errors in `CriterionCard.vue`.

- [ ] **Step 8: Manual verification against the running dev server**

This repo has no automated tests for `.vue` components (see prior features' plans) and no browser-automation tool is available — verify by code trace and, if you have a live browser available to you, by driving the app; otherwise state plainly in your report that this step needs human verification.

1. Restart backend + frontend dev servers if not already running.
2. Search terrain `COLSANT5` (2 projects).
3. Confirm the "Número de árboles" card shows two rows (P1: 2 árboles, P2: 0 árboles) each with its own sobrecosto, plus a Total row.
4. Confirm "Pilotes" card shows two checkboxes (one per project name) instead of a single toggle.
5. Confirm "Corte"/"Lleno" cards are UNCHANGED (single input, single sobrecosto — scope `terreno_dividido` criteria don't touch `CriterionCard.vue` in this task).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/CriterionCard.vue
git commit -m "feat: render per-project rows for scope-proyecto criteria in CriterionCard"
```

---

### Task 6: UI — "Desglose por proyecto" section

**Files:**
- Create: `frontend/src/components/ProjectBreakdownPanel.vue`
- Modify: `frontend/src/views/EvaluadorView.vue`

**Interfaces:**
- Consumes: `store.proyectoNombres`, `store.perProjectResults`, `store.perProjectFinancials`, `store.financialResults`, `store.aggregated.breakdown` (all Task 4), `aggregateCosts` (existing, from `evaluatorEngine.ts`).

- [ ] **Step 1: Create `frontend/src/components/ProjectBreakdownPanel.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'
import { aggregateCosts } from '@/engine/evaluatorEngine'

const store = useEvaluatorStore()

function formatCOP(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000)
    return `${sign}$${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} B`
  if (abs >= 1_000_000)
    return `${sign}$${(abs / 1_000_000).toFixed(1).replace('.', ',')} M`
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatAnios(value: number): string {
  return `${value.toFixed(1)} años`
}

const proyectos = computed(() => {
  return store.proyectoNombres.map(nombre => {
    const results = store.perProjectResults[nombre] ?? []
    const aggregated = aggregateCosts(results, {
      baseCapex: store.baseCapex,
      kWp: store.kWp,
      projectCount: Math.max(store.proyectoNombres.length, 1),
    })
    return {
      nombre,
      costosFijos: aggregated.totalSobrecostoFijo,
      // Solo el monto en pesos, sin traducir a meses — servidumbre/amenazas (riskType
      // 'meses') divididos entre proyectos pueden dar meses fraccionarios (spec: mostrar
      // solo el monto en el desglose por proyecto).
      riesgoMonto: aggregated.totalRetraso + aggregated.totalRiesgoCosto,
      vpn: store.perProjectFinancials?.[nombre]?.vpn ?? null,
      vpnConBeneficios: store.perProjectFinancials?.[nombre]?.vpnConBeneficios ?? null,
    }
  })
})
</script>

<template>
  <section v-if="proyectos.length > 0" class="breakdown-section">
    <div class="section-title">Desglose por proyecto</div>

    <div v-if="store.financialResults" class="breakdown-financials-note">
      <span>TIR: {{ formatPct(store.financialResults.tir) }}</span>
      <span>Payback: {{ formatAnios(store.financialResults.paybackAnios) }}</span>
      <span class="breakdown-note-text">(igual para todos los proyectos del terreno)</span>
    </div>

    <div class="breakdown-grid">
      <div v-for="p in proyectos" :key="p.nombre" class="breakdown-card">
        <div class="breakdown-card-title">{{ p.nombre }}</div>
        <div class="breakdown-row">
          <span class="breakdown-label">Costos fijos</span>
          <span class="breakdown-value">{{ formatCOP(p.costosFijos) }}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-label">Riesgo</span>
          <span class="breakdown-value">{{ formatCOP(p.riesgoMonto) }}</span>
        </div>
        <div v-if="p.vpn !== null" class="breakdown-row">
          <span class="breakdown-label">VPN</span>
          <span class="breakdown-value">{{ formatCOP(p.vpn) }}</span>
        </div>
        <div v-if="p.vpnConBeneficios !== null" class="breakdown-row">
          <span class="breakdown-label">VPN c. beneficios</span>
          <span class="breakdown-value breakdown-value--highlight">{{ formatCOP(p.vpnConBeneficios) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.breakdown-section { padding-bottom: 1.5rem; }

.section-title {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--purple);
  margin: 1.75rem 0 1rem;
  padding-bottom: 0.6rem;
  border-bottom: 2px solid #13294B;
}

.breakdown-financials-note {
  display: flex;
  gap: 1rem;
  align-items: baseline;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 1rem;
}
.breakdown-note-text { font-size: 0.72rem; font-weight: 500; color: var(--muted); }

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.breakdown-card {
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 1rem 1.25rem;
  box-shadow: 0 2px 8px rgba(145, 91, 216, 0.07);
}
.breakdown-card-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.6rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
.breakdown-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.8rem;
  padding: 0.15rem 0;
}
.breakdown-label { color: var(--text-mid); font-weight: 500; }
.breakdown-value { color: var(--purple); font-weight: 700; }
.breakdown-value--highlight { color: var(--green); }
</style>
```

- [ ] **Step 2: Stop duplicating criteria evaluation in `EvaluadorView.vue`, and wire in the new panel**

`EvaluadorView.vue` currently recomputes its own `results` via a direct `evaluateCriteria(store.criterionValues, {...})` call — a second, independent evaluation path that (after Task 3/4) would be the OLD, non-scope-aware function, giving `$0`/`null` for scope-`proyecto` criteria in the cards it feeds (harmless today only because `CriterionCard.vue`'s scope-`proyecto` branch, added in Task 5, ignores its `result.value`/`result.sobrecosto` props entirely and reads `store.perProjectResults` directly instead — but this is fragile and duplicates logic that already lives correctly in the store). Switch to reading `store.aggregated.breakdown`, which is already `evaluateScoped(...).general` (Task 4) — the single source of truth.

Find:

```ts
import AppHeader from '@/components/AppHeader.vue'
import TerrainSearch from '@/components/TerrainSearch.vue'
import CriterionCard from '@/components/CriterionCard.vue'
import SummaryPanel from '@/components/SummaryPanel.vue'
import FinancialResultsPanel from '@/components/FinancialResultsPanel.vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'
import { evaluateCriteria } from '@/engine/evaluatorEngine'

const store = useEvaluatorStore()

const results = computed(() => evaluateCriteria(store.criterionValues, {
  baseCapex: store.baseCapex,
  kWp: store.kWp,
}))
```

Replace with:

```ts
import AppHeader from '@/components/AppHeader.vue'
import TerrainSearch from '@/components/TerrainSearch.vue'
import CriterionCard from '@/components/CriterionCard.vue'
import SummaryPanel from '@/components/SummaryPanel.vue'
import FinancialResultsPanel from '@/components/FinancialResultsPanel.vue'
import ProjectBreakdownPanel from '@/components/ProjectBreakdownPanel.vue'
import { useEvaluatorStore } from '@/stores/evaluatorStore'

const store = useEvaluatorStore()

const results = computed(() => store.aggregated.breakdown)
```

Find (the `<template>` section's `criteria-content` div, specifically right after the closing `</section>` of the "Factores de riesgo" section and before the closing `</div>` of `criteria-content`):

```html
          <section class="criteria-section">
            <div class="section-title section-title--probabilidad">Factores de riesgo</div>
            <div class="criteria-grid">
              <CriterionCard
                v-for="result in probabilidadResults"
                :key="result.id"
                :result="result"
              />
            </div>
          </section>
        </div>
      </main>
```

Replace with:

```html
          <section class="criteria-section">
            <div class="section-title section-title--probabilidad">Factores de riesgo</div>
            <div class="criteria-grid">
              <CriterionCard
                v-for="result in probabilidadResults"
                :key="result.id"
                :result="result"
              />
            </div>
          </section>

          <ProjectBreakdownPanel />
        </div>
      </main>
```

- [ ] **Step 3: Type-check**

Run (from `frontend/`): `npx vue-tsc -b`

Expected: exactly the 2 pre-existing errors — no new errors in `ProjectBreakdownPanel.vue` or `EvaluadorView.vue`.

- [ ] **Step 4: Run the full frontend suite**

Run (from `frontend/`): `npx vitest run`

Expected: all pass (this task adds no new `.test.ts` files — this is a regression check).

- [ ] **Step 5: Manual verification against the running dev server**

Same caveat as Task 5 — no automated component tests or browser-automation tool; verify by code trace and, if available, a live browser.

1. Search terrain `COLSANT5`.
2. Confirm a new "Desglose por proyecto" section appears below "Factores de riesgo", showing TIR/Payback once at the top with the "igual para todos los proyectos" note, followed by one card per project with Costos fijos / Riesgo / VPN.
3. Confirm the sum of both projects' "Costos fijos" cards is reasonably consistent with the general "Total sobrecostos fijos" in the sidebar `SummaryPanel` (exact equality isn't guaranteed to the cent given floating-point division, but should be within rounding).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ProjectBreakdownPanel.vue frontend/src/views/EvaluadorView.vue
git commit -m "feat: add Desglose por proyecto section with per-project fijo/riesgo/VPN totals"
```
