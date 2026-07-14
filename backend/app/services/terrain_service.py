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

        aprov_raw = (r['aprov_value'] or '').strip()
        if not aprov_raw and r['aprov_status'] == 'exonerated':
            aprov_raw = 'Exonerado'

        # Un forestal resuelto (Exonerado/Solicitud aprobada) no deja trámite de árboles
        # pendiente — si nadie diligenció el conteo en ese caso, se asume 0 en vez de
        # dejarlo sin dato (ver caso real COLBOYT147). Si el forestal NO está resuelto,
        # la ausencia de conteo se mantiene como "sin dato" (None).
        arboles_raw = (r['numero_arboles_raw'] or '').strip()
        if arboles_raw.isdigit():
            numero_arboles = int(arboles_raw)
        elif aprov_raw.lower() in _APROV_RESUELTO:
            numero_arboles = 0
        else:
            numero_arboles = None

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
