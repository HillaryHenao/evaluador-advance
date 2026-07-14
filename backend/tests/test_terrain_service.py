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


def test_get_proyectos_activos_arboles_cero_cuando_forestal_resuelto_sin_dato():
    # COLBOYT147 (caso real): forestal viene 'Exonerado' (resuelto) pero el campo
    # 'Número de árboles' nunca se diligenció en origen (numero_arboles_raw=None) — se
    # asume 0 árboles en vez de dejarlo sin dato, ya que un forestal resuelto implica que
    # no queda pendiente ningún trámite por árboles. Si forestal NO está resuelto (P2,
    # 'Visita'), la ausencia de dato de árboles se mantiene como None (sin inferir nada).
    rows = [
        {
            'nombre': 'COLBOYT147P1_TUNJA_OCCIDENTE',
            'distancia_via': 20.0, 'distancia_red': 190.0,
            'tipo_raw': '1P TRACKER', 'numero_arboles_raw': None,
            'aprov_value': 'Exonerado', 'aprov_status': 'pending',
        },
        {
            'nombre': 'COLBOYT147P2_TUNJA_OCCIDENTE',
            'distancia_via': 20.0, 'distancia_red': 190.0,
            'tipo_raw': '1P TRACKER', 'numero_arboles_raw': None,
            'aprov_value': 'Visita', 'aprov_status': 'pending',
        },
    ]
    with patch.object(terrain_service, '_connect', return_value=_mock_conn(rows)):
        proyectos = terrain_service._get_proyectos_activos(287)

    assert proyectos[0]['numero_arboles'] == 0
    assert proyectos[0]['aprovechamiento_forestal'] is None
    assert proyectos[1]['numero_arboles'] is None
    assert proyectos[1]['aprovechamiento_forestal'] == 'visita'


def test_get_proyectos_activos_sin_proyectos():
    with patch.object(terrain_service, '_connect', return_value=_mock_conn([])):
        assert terrain_service._get_proyectos_activos(287) == []


def test_get_active_project_ids():
    rows = [{'id': 64}, {'id': 2606}]
    with patch.object(terrain_service, '_connect', return_value=_mock_conn(rows)):
        assert terrain_service._get_active_project_ids(287) == [64, 2606]
