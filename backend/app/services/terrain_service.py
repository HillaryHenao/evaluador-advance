import os
from typing import Optional
import psycopg2
import psycopg2.extras


def _connect(url: str):
    return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)


def _get_nivel_tension(project_id: int) -> Optional[str]:
    """Consulta nivel de tensión en requestsdb. Cae a originabotdb si no hay DATABASE_URL2."""
    db2_url = os.environ.get('DATABASE_URL2') or os.environ.get('DATABASE_URL')
    try:
        conn = _connect(db2_url)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT tension_level FROM supplies_supplyrequest
                       WHERE project = %s AND tension_level IS NOT NULL
                       ORDER BY id DESC LIMIT 1""",
                    (project_id,),
                )
                row = cur.fetchone()
                return row['tension_level'] if row else None
        finally:
            conn.close()
    except Exception:
        return None


# Estados de validation_field.status (workflow de originabotdb)
_VALIDATION_STATUS_LABELS = {
    'approved': 'Aprobada',
    'preapproved': 'Pre-aprobada',
    'pending': 'Pendiente',
    'request': 'Solicitada',
    'exonerated': 'Exonerada',
}

# Estados de entities_coexistence.status que se consideran resueltos (sin sobrecosto)
_COEXISTENCIA_RESUELTA = {'approved', 'not_applicable'}

_ESTADO_LABELS = {
    'approved': 'Aprobado',
    'pending': 'Pendiente',
    'sent': 'Enviado',
    'communication': 'En comunicación',
    'not_applicable': 'No aplica',
}


def _get_coexistencias(project_id: int) -> tuple[bool, list[dict]]:
    """Consulta solicitudes de coexistencia en requestsdb (entities_coexistence + entities_operator).
    Retorna (aplica_sobrecosto, detalle) — aplica_sobrecosto es True si alguna solicitud
    está en un estado distinto de resuelto/aprobado."""
    db2_url = os.environ.get('DATABASE_URL2') or os.environ.get('DATABASE_URL')
    try:
        conn = _connect(db2_url)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT c.status, o.name AS operator_name
                       FROM entities_coexistence c
                       LEFT JOIN entities_operator o ON o.id = c.operator_id
                       WHERE c.project_id = %s
                       ORDER BY o.name""",
                    (str(project_id),),
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

# Severidad de estados no resueltos: mayor número = peor escenario
_APROV_NIVEL_RANK = {'visita': 1, 'solicitud radicada': 2}
_APROV_NIVEL_DEFAULT_RANK = 3  # cualquier otro estado no resuelto (Pausado, Programado, etc.)
_APROV_RANK_TO_NIVEL = {1: 'visita', 2: 'radicada', 3: 'otro'}


def _get_aprovechamiento_forestal(terrain_id: int) -> tuple[Optional[str], list[dict]]:
    """Consulta el estado de aprovechamiento forestal de TODOS los proyectos del terreno.
    El licenciamiento se hace por terreno, pero en la práctica puede haber proyectos con
    estados distintos entre sí (caso particular) — se reporta cada uno y se usa el peor
    estado encontrado para el cálculo del sobrecosto.
    Retorna (nivel, detalle) — nivel es None (resuelto/sin registro), 'visita', 'radicada' u 'otro'."""
    try:
        conn = _connect(os.environ['DATABASE_URL'])
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT p.name AS project_name, vf.value, vf.status
                       FROM minifarm_project p
                       LEFT JOIN validation_field vf
                           ON vf.project_id = p.id AND vf.name = 'Licencia de aprovechamiento forestal'
                       WHERE p.terrain_id = %s
                       ORDER BY p.id"""
                    ,
                    (terrain_id,),
                )
                rows = cur.fetchall()
        finally:
            conn.close()
    except Exception:
        return None, []

    detalle = []
    peor_rank = 0
    for r in rows:
        raw = (r['value'] or '').strip()
        if not raw and r['status'] == 'exonerated':
            raw = 'Exonerado'
        estado_label = raw or 'Sin registro'
        detalle.append({'proyecto': r['project_name'], 'estado': estado_label})

        low = raw.lower()
        if not raw or low in _APROV_RESUELTO:
            continue
        rank = _APROV_NIVEL_RANK.get(low, _APROV_NIVEL_DEFAULT_RANK)
        peor_rank = max(peor_rank, rank)

    nivel = _APROV_RANK_TO_NIVEL.get(peor_rank)
    return nivel, detalle


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
                    p.name                                      AS name,
                    tc.name                                     AS municipality,
                    p.id                                        AS project_id,
                    p.road_distance                             AS distancia_via,
                    p.network_distance                          AS distancia_red,
                    p.grid_operator_id                          AS "or",
                    (
                        SELECT COUNT(*)
                        FROM minifarm_project mp2
                        WHERE mp2.terrain_id = t.id
                          AND mp2.stage NOT IN ('dead', 'paused', 'uci')
                    )                                           AS cluster,

                    -- Tipo de estructura: busca en project_id Y terrain_id
                    (
                        SELECT vf.value FROM validation_field vf
                        WHERE (vf.project_id = p.id OR vf.terrain_id = t.id)
                          AND vf.name = 'Tipo de arreglo'
                          AND vf.value IS NOT NULL
                        ORDER BY vf.id DESC LIMIT 1
                    )                                           AS tipo_raw,

                    -- Ocupación de cauce: valor + status exonerado
                    (
                        SELECT vf.value FROM validation_field vf
                        WHERE (vf.project_id = p.id OR vf.terrain_id = t.id)
                          AND vf.name = 'Ocupación de cauce'
                          AND (vf.value IS NOT NULL OR vf.status = 'exonerated')
                        ORDER BY vf.id DESC LIMIT 1
                    )                                           AS ocupacion_raw,
                    (
                        SELECT vf.status FROM validation_field vf
                        WHERE (vf.project_id = p.id OR vf.terrain_id = t.id)
                          AND vf.name = 'Ocupación de cauce'
                        ORDER BY vf.id DESC LIMIT 1
                    )                                           AS ocupacion_status,

                    -- Servidumbre: primero validation_field, luego easements
                    COALESCE(
                        (
                            SELECT vf.value FROM validation_field vf
                            WHERE (vf.project_id = p.id OR vf.terrain_id = t.id)
                              AND vf.name = 'Servidumbre'
                              AND vf.value IS NOT NULL
                            ORDER BY vf.id DESC LIMIT 1
                        ),
                        (
                            SELECT
                                CASE e.type
                                    WHEN 'own'                THEN 'Propia'
                                    WHEN 'public'             THEN 'Pública'
                                    WHEN 'foreign'            THEN 'Ajena'
                                    WHEN 'public_and_foreign' THEN 'Pública y Ajena'
                                    ELSE e.type
                                END
                            FROM easements_easement e
                            WHERE e.terrain_id = t.id
                              AND e.character = 'electrical'
                            LIMIT 1
                        )
                    )                                           AS servidumbre_raw,
                    (
                        SELECT vf.status FROM validation_field vf
                        WHERE (vf.project_id = p.id OR vf.terrain_id = t.id)
                          AND vf.name = 'Servidumbre'
                        ORDER BY vf.id DESC LIMIT 1
                    )                                           AS servidumbre_status,

                    -- Número de árboles
                    (
                        SELECT vf.value FROM validation_field vf
                        WHERE (vf.project_id = p.id OR vf.terrain_id = t.id)
                          AND vf.name = 'Número de árboles'
                          AND vf.value IS NOT NULL
                        ORDER BY vf.id DESC LIMIT 1
                    )                                           AS numero_arboles_raw

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
    project_id: int = d.pop('project_id')
    terrain_id: int = d.pop('terrain_id')

    # municipio: derivado del nombre del proyecto "{CODIGO}_{MUNICIPIO}_{ZONA}"
    # (territorial_city.name puede estar mal asignado en el terreno). Cae a tc.name si no matchea el patrón.
    name_parts = (d.get('name') or '').split('_')
    if len(name_parts) >= 3:
        d['municipality'] = name_parts[-2].replace('-', ' ').title()

    # nivel_tension — viene de requestsdb; normalizar a '13.8kV', '34.5kV', '115kV'
    tension_raw = _get_nivel_tension(project_id) or ''
    tension_num = tension_raw.replace(' ', '').lower().replace('kv', '').strip()
    _TENSION_MAP = {'13.8': '13.8kV', '13.2': '13.8kV', '34.5': '34.5kV', '115': '115kV', '110': '115kV'}
    d['nivel_tension'] = _TENSION_MAP.get(tension_num) or (tension_raw.strip() or None)

    # operador de red: frontend usa mayúsculas (AFINIA, ESSA, EPM…)
    if d.get('or'):
        d['or'] = d['or'].upper()

    # tipo_estructura
    tipo_raw = (d.pop('tipo_raw', None) or '').upper()
    if '1P' in tipo_raw or '2P' in tipo_raw:
        d['tipo_estructura'] = 'tracker'
    elif 'MESA' in tipo_raw:
        d['tipo_estructura'] = 'mesa_fija'
    else:
        d['tipo_estructura'] = None

    # ocupacion_cauce: 'No Requiere' → False, 'Requiere' → True, exonerated → False
    ocupacion_raw = d.pop('ocupacion_raw', None)
    ocupacion_status = d.pop('ocupacion_status', None)
    if ocupacion_status == 'exonerated':
        d['ocupacion_cauce'] = False
    elif ocupacion_raw is not None:
        txt = ocupacion_raw.lower()
        d['ocupacion_cauce'] = 'requiere' in txt and 'no' not in txt
    else:
        d['ocupacion_cauce'] = None

    # servidumbre: tipo (own/public/foreign/public_and_foreign) + estado de resolución.
    # Propia, o Pública/Ajena ya aprobada -> 'bueno' (sin sobrecosto). Cualquier otro caso
    # requiere que el usuario elija manualmente 'medio' o 'malo' en el frontend.
    servidumbre_raw = (d.pop('servidumbre_raw', None) or '').lower()
    servidumbre_status = d.pop('servidumbre_status', None)
    _TIPO_LABELS = {'own': 'Propia', 'public': 'Pública', 'foreign': 'Ajena', 'public_and_foreign': 'Pública y Ajena'}
    if 'pública y ajena' in servidumbre_raw or 'publica y ajena' in servidumbre_raw:
        tipo = 'public_and_foreign'
    elif 'propia' in servidumbre_raw:
        tipo = 'own'
    elif 'pública' in servidumbre_raw or 'publica' in servidumbre_raw:
        tipo = 'public'
    elif 'ajena' in servidumbre_raw:
        tipo = 'foreign'
    else:
        tipo = None

    if tipo == 'own' or (tipo is not None and servidumbre_status == 'approved'):
        d['servidumbre'] = 'bueno'
    else:
        d['servidumbre'] = None

    d['servidumbre_detalle'] = (
        {
            'tipo': _TIPO_LABELS.get(tipo, tipo),
            'estado': _VALIDATION_STATUS_LABELS.get(servidumbre_status, servidumbre_status) if servidumbre_status else 'Sin registro',
        }
        if tipo else None
    )

    # aprovechamiento_forestal: estado por proyecto (el licenciamiento es por terreno pero
    # en la práctica puede haber proyectos con estados distintos — caso particular)
    d['aprovechamiento_forestal'], d['aprovechamiento_forestal_detalle'] = _get_aprovechamiento_forestal(terrain_id)

    # coexistencias: solicitudes en requestsdb (entities_coexistence).
    # Sin registro o todas resueltas/aprobadas → False; alguna en otro estado → True
    d['coexistencias'], d['coexistencias_detalle'] = _get_coexistencias(project_id)

    # numero_arboles: valor numérico del campo de validación
    arboles_raw = d.pop('numero_arboles_raw', None)
    d['numero_arboles'] = int(arboles_raw) if arboles_raw and arboles_raw.strip().isdigit() else None

    return d
