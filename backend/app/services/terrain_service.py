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

                    -- Ocupación de cauce: valor + status de la MISMA fila
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
                          AND (vf.value IS NOT NULL OR vf.status = 'exonerated')
                        ORDER BY vf.id DESC LIMIT 1
                    )                                           AS ocupacion_status,

                    -- Servidumbre: primero validation_field (valor + status de la MISMA fila),
                    -- si no hay registro cae a easements_easement (tipo + su propio status)
                    (
                        SELECT vf.value FROM validation_field vf
                        WHERE (vf.project_id = p.id OR vf.terrain_id = t.id)
                          AND vf.name = 'Servidumbre'
                          AND vf.value IS NOT NULL
                        ORDER BY vf.id DESC LIMIT 1
                    )                                           AS servidumbre_vf_value,
                    (
                        SELECT vf.status FROM validation_field vf
                        WHERE (vf.project_id = p.id OR vf.terrain_id = t.id)
                          AND vf.name = 'Servidumbre'
                          AND vf.value IS NOT NULL
                        ORDER BY vf.id DESC LIMIT 1
                    )                                           AS servidumbre_vf_status,
                    (
                        SELECT e.type FROM easements_easement e
                        WHERE e.terrain_id = t.id AND e.character = 'electrical'
                        ORDER BY e.id DESC LIMIT 1
                    )                                           AS servidumbre_easement_type,
                    (
                        SELECT e.foreign_status FROM easements_easement e
                        WHERE e.terrain_id = t.id AND e.character = 'electrical'
                        ORDER BY e.id DESC LIMIT 1
                    )                                           AS servidumbre_easement_foreign_status,
                    (
                        SELECT e.public_status FROM easements_easement e
                        WHERE e.terrain_id = t.id AND e.character = 'electrical'
                        ORDER BY e.id DESC LIMIT 1
                    )                                           AS servidumbre_easement_public_status,

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

    # ocupacion_cauce: 'No Requiere' o 'Aprobado' -> False (sin sobrecosto).
    # Cualquier otro estado (Pendiente, Requiere, evidencia sin resolver, etc.) -> True (+100M)
    _OCUPACION_RESUELTO = {'no requiere', 'aprobado', 'exonerado'}
    ocupacion_raw = d.pop('ocupacion_raw', None)
    ocupacion_status = d.pop('ocupacion_status', None)
    raw = (ocupacion_raw or '').strip()
    if not raw and ocupacion_status == 'exonerated':
        raw = 'Exonerado'
    if raw.startswith('/media/') or raw.startswith('validation/'):
        raw = 'Evidencia sin resolver'
    d['ocupacion_cauce_detalle'] = raw or None
    if not raw:
        d['ocupacion_cauce'] = None
    else:
        d['ocupacion_cauce'] = raw.lower() not in _OCUPACION_RESUELTO

    # servidumbre: tipo + estado de resolución, tomados de la MISMA fuente para que no se
    # crucen datos de registros distintos. Primero validation_field ('Servidumbre'); si no
    # hay valor registrado ahí, cae a easements_easement (con su propio status por tipo).
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

    vf_value = (d.pop('servidumbre_vf_value', None) or '').lower()
    vf_status = d.pop('servidumbre_vf_status', None)
    easement_type = d.pop('servidumbre_easement_type', None)
    easement_foreign_status = d.pop('servidumbre_easement_foreign_status', None)
    easement_public_status = d.pop('servidumbre_easement_public_status', None)

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
    elif easement_type:
        tipo = easement_type
        if tipo == 'own':
            resuelto = True
            estado_label = 'N/A'
        elif tipo == 'foreign':
            resuelto = easement_foreign_status == 'signed'
            estado_label = _EASEMENT_STATUS_LABELS.get(easement_foreign_status, easement_foreign_status) if easement_foreign_status else 'Sin registro'
        else:  # public
            resuelto = easement_public_status == 'obtained_license'
            estado_label = _EASEMENT_STATUS_LABELS.get(easement_public_status, easement_public_status) if easement_public_status else 'Sin registro'
    else:
        tipo = None
        resuelto = False
        estado_label = None

    d['servidumbre'] = 0 if resuelto else None
    d['servidumbre_detalle'] = {'tipo': _TIPO_LABELS.get(tipo, tipo), 'estado': estado_label} if tipo else None

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
