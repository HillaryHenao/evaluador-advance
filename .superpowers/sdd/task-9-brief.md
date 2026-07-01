# Task 9 Brief: Backend Flask

## Context
Task 9 of 10. Frontend (Tasks 1-8) is complete. Your job: scaffold the Flask backend with JWT auth middleware, a PostgreSQL terrain query service, and the two API endpoints. Include pytest tests.

## Global Constraints
- Work in `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\backend\`
- Python type hints everywhere
- Tests run with: `cd backend && pytest tests/ -v`
- All tests must PASS before committing
- Use PowerShell for commands
- Do NOT connect to a real database in tests — mock `terrain_service.get_terrain_data` and `jwt_validator.validate_token`

## Directory Structure to Create
```
backend/
├── app/
│   ├── __init__.py
│   ├── routes/
│   │   ├── __init__.py
│   │   └── terrain.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── terrain_service.py
│   └── auth/
│       ├── __init__.py
│       └── jwt_validator.py
├── tests/
│   ├── conftest.py
│   └── test_terrain.py
├── run.py
├── requirements.txt
└── .env.example
```

## File Contents

### requirements.txt
```
flask==3.1.0
flask-cors==5.0.0
psycopg2-binary==2.9.10
python-dotenv==1.0.1
pyjwt==2.10.1
gunicorn==23.0.0
pytest==8.3.5
pytest-flask==1.3.0
```

### .env.example
```
DATABASE_URL=postgresql://user:password@host:5432/originabotdb
FLASK_ENV=development
JWT_SECRET=your-jwt-secret-or-public-key
```

### app/__init__.py
```python
import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()


def create_app(testing: bool = False) -> Flask:
    app = Flask(__name__)
    app.config['TESTING'] = testing

    CORS(app, resources={r'/api/*': {'origins': '*'}})

    from app.routes.terrain import bp
    app.register_blueprint(bp)

    return app
```

### app/auth/__init__.py
```python
```
(empty file)

### app/auth/jwt_validator.py
```python
import os
from typing import Any
import jwt
from flask import request
from functools import wraps


def validate_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT token. Raises jwt.InvalidTokenError on failure."""
    secret = os.environ.get('JWT_SECRET', '')
    return jwt.decode(token, secret, algorithms=['HS256'])


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return {'error': 'Token requerido'}, 401
        token = auth_header.removeprefix('Bearer ')
        try:
            validate_token(token)
        except jwt.InvalidTokenError:
            return {'error': 'Token inválido o expirado'}, 401
        return f(*args, **kwargs)
    return decorated
```

### app/services/__init__.py
```python
```
(empty file)

### app/services/terrain_service.py
```python
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

    return row_dict
```

### app/routes/__init__.py
```python
```
(empty file)

### app/routes/terrain.py
```python
from flask import Blueprint, jsonify
from app.auth.jwt_validator import require_auth, validate_token
from app.services import terrain_service

bp = Blueprint('terrain', __name__, url_prefix='/api')


@bp.get('/health')
def health():
    return jsonify({'status': 'ok'})


@bp.get('/terrain/<string:code>')
@require_auth
def get_terrain(code: str):
    data = terrain_service.get_terrain_data(code)
    if data is None:
        return jsonify({'error': f'Terreno {code} no encontrado'}), 404
    return jsonify(data)
```

### run.py
```python
from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

### tests/conftest.py
```python
import pytest
from app import create_app

@pytest.fixture
def app():
    app = create_app(testing=True)
    return app

@pytest.fixture
def client(app):
    return app.test_client()
```

### tests/test_terrain.py
```python
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
```

## Steps
1. Create the `backend/` directory structure (all dirs and __init__.py files)
2. Create `requirements.txt`
3. Create a Python virtual environment and install deps:
   ```powershell
   cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\backend"
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
4. Write all Python files (exact content above)
5. Run tests:
   ```powershell
   cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance\backend"
   .\venv\Scripts\Activate.ps1
   pytest tests/ -v
   ```
6. Fix any failures
7. Deactivate venv: `deactivate`
8. Commit from repo root:
   ```powershell
   cd "C:\Users\EQUIPO\Documents\Claude\evaluador-advance"
   git add backend/
   git commit -m "feat: add Flask backend with terrain endpoint and JWT auth middleware"
   ```

## Important Notes
- The `validate_token` in `require_auth` decorator calls it, but the test patches `app.routes.terrain.validate_token` — this works because `terrain.py` imports `validate_token` with `from app.auth.jwt_validator import require_auth, validate_token`. The patch targets the name in the routes module's namespace.
- If psycopg2-binary fails to install, try `pip install psycopg2` instead
- Do NOT create a .env file (only .env.example) — tests don't need the real DB

## Report Contract
Write report to: `C:\Users\EQUIPO\Documents\Claude\evaluador-advance\.superpowers\sdd\task-9-report.md`

Return ONLY: status, commit hash(es), test summary (X/Y passing), concerns.
