import os
from typing import Optional
import psycopg2
import psycopg2.extras


def get_terrain_data(code: str) -> Optional[dict]:
    """Fetch terrain data from PostgreSQL. Returns None if terrain not found."""
    database_url = os.environ['DATABASE_URL']
    conn = psycopg2.connect(database_url, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    t.name                                  AS code,
                    p.name                                  AS name,
                    tc.name                                 AS municipality,
                    p.road_distance                         AS distancia_via,
                    p.network_distance                      AS distancia_red,
                    p.grid_operator_id                      AS "or",
                    (
                        SELECT sr.tension_level
                        FROM supplies_supplyrequest sr
                        WHERE sr.project = p.id
                        LIMIT 1
                    )                                       AS nivel_tension,
                    (
                        SELECT COUNT(*)
                        FROM minifarm_project mp2
                        WHERE mp2.terrain_id = t.id
                          AND mp2.stage NOT IN ('dead', 'paused', 'uci')
                    )                                       AS cluster,
                    (
                        SELECT vf.value FROM validation_field vf
                        WHERE vf.terrain_id = t.id AND vf.name = 'Tipo de arreglo'
                        LIMIT 1
                    )                                       AS tipo_estructura,
                    (
                        SELECT vf.value FROM validation_field vf
                        WHERE vf.terrain_id = t.id AND vf.name = 'Ocupación de cauce'
                        LIMIT 1
                    )                                       AS ocupacion_cauce_raw,
                    (
                        SELECT e.type FROM easements_easement e
                        WHERE e.terrain_id = t.id
                        LIMIT 1
                    )                                       AS servidumbre,
                    (
                        SELECT vf.value FROM validation_field vf
                        WHERE vf.terrain_id = t.id
                          AND vf.name = 'Licencia de aprovechamiento forestal'
                        LIMIT 1
                    )                                       AS aprovechamiento_forestal,
                    (
                        SELECT
                            CASE
                                WHEN vf.value ILIKE 'se registra%%' THEN TRUE
                                ELSE FALSE
                            END
                        FROM validation_field vf
                        WHERE vf.terrain_id = t.id
                          AND vf.name IN ('ANH', 'ANM')
                        LIMIT 1
                    )                                       AS coexistencias
                FROM termsheet_terrain t
                JOIN minifarm_project p ON p.terrain_id = t.id
                LEFT JOIN territorial_city tc ON tc.id = t.city_id
                WHERE UPPER(t.name) = UPPER(%s)
                LIMIT 1
            """, (code,))
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return None

    row_dict = dict(row)
    ocupacion_raw = row_dict.pop('ocupacion_cauce_raw', None)
    row_dict['ocupacion_cauce'] = ocupacion_raw is not None and ocupacion_raw.lower() not in ('no', 'false', '')

    tipo = row_dict.get('tipo_estructura', '') or ''
    if any(t in tipo.lower() for t in ('1p', '2p', 'tracker')):
        row_dict['tipo_estructura'] = 'tracker'
    else:
        row_dict['tipo_estructura'] = 'mesa_fija'

    if row_dict.get('nivel_tension'):
        row_dict['nivel_tension'] = row_dict['nivel_tension'].replace(' ', '')

    if row_dict.get('aprovechamiento_forestal'):
        row_dict['aprovechamiento_forestal'] = row_dict['aprovechamiento_forestal'].lower()

    return row_dict
