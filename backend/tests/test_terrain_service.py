from unittest.mock import patch, MagicMock

from app.services import terrain_service


def _mock_conn(rows):
    cur = MagicMock()
    cur.fetchall.return_value = rows
    cur.__enter__.return_value = cur
    cur.__exit__.return_value = False
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn


def test_get_numero_arboles_suma_todos_los_proyectos_del_terreno():
    # COLSANT5: P1 tiene 2 árboles registrados, P2 tiene 0 — el total del terreno es 2.
    rows = [{'value': '2'}, {'value': '0'}]
    with patch.object(terrain_service, '_connect', return_value=_mock_conn(rows)):
        assert terrain_service._get_numero_arboles(287) == 2


def test_get_numero_arboles_retorna_none_sin_registros():
    with patch.object(terrain_service, '_connect', return_value=_mock_conn([])):
        assert terrain_service._get_numero_arboles(287) is None


def test_get_numero_arboles_ignora_valores_no_numericos():
    rows = [{'value': 'N/A'}, {'value': '5'}]
    with patch.object(terrain_service, '_connect', return_value=_mock_conn(rows)):
        assert terrain_service._get_numero_arboles(287) == 5
