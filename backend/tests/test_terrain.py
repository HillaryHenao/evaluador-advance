from unittest.mock import patch


def test_health(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.get_json() == {'status': 'ok'}


def test_terrain_requires_auth(client):
    response = client.get('/api/terrain/COLCEST5')
    assert response.status_code == 401


def test_terrain_not_found(client):
    with patch('app.routes.terrain.validate_token', return_value={'pk': 1}), \
         patch('app.services.terrain_service.get_terrain_data', return_value=None):
        response = client.get(
            '/api/terrain/NOEXISTE',
            headers={'Authorization': 'Bearer fake-token'}
        )
    assert response.status_code == 404


def test_terrain_returns_data(client):
    mock_data = {
        'code': 'COLCEST5', 'name': 'Test', 'municipality': 'Aguachica',
        'distancia_via': 120, 'distancia_red': 350, 'or': 'AFINIA',
        'nivel_tension': '34.5 kV', 'cluster': 2, 'tipo_estructura': 'Tracker',
        'ocupacion_cauce': False, 'servidumbre': 'own',
        'aprovechamiento_forestal': 'Exonerado', 'coexistencias': False,
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
