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


def get_terrain_data(code: str) -> Optional[dict]:
    """Fetch terrain data from PostgreSQL. Returns None if terrain not found."""
    database_url = os.environ['DATABASE_URL']
    conn = _connect(database_url)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
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

                    -- Aprovechamiento forestal: valor + status exonerado
                    (
                        SELECT vf.value FROM validation_field vf
                        WHERE (vf.project_id = p.id OR vf.terrain_id = t.id)
                          AND vf.name = 'Licencia de aprovechamiento forestal'
                          AND (vf.value IS NOT NULL OR vf.status = 'exonerated')
                        ORDER BY vf.id DESC LIMIT 1
                    )                                           AS aprovechamiento_raw,
                    (
                        SELECT vf.status FROM validation_field vf
                        WHERE (vf.project_id = p.id OR vf.terrain_id = t.id)
                          AND vf.name = 'Licencia de aprovechamiento forestal'
                        ORDER BY vf.id DESC LIMIT 1
                    )                                           AS aprovechamiento_status,
                    -- CAR: corporación para mapear nivel de restricción forestal
                    (
                        SELECT vf.value FROM validation_field vf
                        WHERE (vf.project_id = p.id OR vf.terrain_id = t.id)
                          AND vf.name = 'CAR'
                          AND vf.value IS NOT NULL
                        ORDER BY vf.id DESC LIMIT 1
                    )                                           AS car_raw

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

    # servidumbre: normalizar a valores del frontend (own, public, foreign, public_and_foreign)
    servidumbre_raw = (d.pop('servidumbre_raw', None) or '').lower()
    if 'pública y ajena' in servidumbre_raw or 'publica y ajena' in servidumbre_raw:
        d['servidumbre'] = 'public_and_foreign'
    elif 'propia' in servidumbre_raw:
        d['servidumbre'] = 'own'
    elif 'pública' in servidumbre_raw or 'publica' in servidumbre_raw:
        d['servidumbre'] = 'public'
    elif 'ajena' in servidumbre_raw:
        d['servidumbre'] = 'foreign'
    else:
        d['servidumbre'] = None

    # aprovechamiento_forestal: mapear CAR a niveles del frontend
    aprov_raw = (d.pop('aprovechamiento_raw', None) or '').lower()
    aprov_status = d.pop('aprovechamiento_status', None)
    car_raw = (d.pop('car_raw', None) or '').lower()
    _CAR_09 = {'corpocesar', 'cortolima', 'corpamag', 'cardique', 'car', 'carder', 'corantioquia'}
    _CAR_08 = {'corpoboyaca'}
    _CAR_06 = {'cas', 'csb', 'cvs', 'cam', 'cornare', 'cdmb'}
    if aprov_status == 'exonerated' or 'exonerado' in aprov_raw:
        d['aprovechamiento_forestal'] = 'exonerado'
    elif car_raw and any(c in car_raw for c in _CAR_09):
        d['aprovechamiento_forestal'] = 'car_0.9'
    elif car_raw and any(c in car_raw for c in _CAR_08):
        d['aprovechamiento_forestal'] = 'car_0.8'
    elif car_raw and any(c in car_raw for c in _CAR_06):
        d['aprovechamiento_forestal'] = 'car_0.6'
    elif car_raw:
        d['aprovechamiento_forestal'] = 'car_0.1'
    else:
        d['aprovechamiento_forestal'] = None

    # coexistencias: solicitudes en requestsdb (entities_coexistence).
    # Sin registro o todas resueltas/aprobadas → False; alguna en otro estado → True
    d['coexistencias'], d['coexistencias_detalle'] = _get_coexistencias(project_id)

    return d
