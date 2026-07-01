from functools import wraps
from flask import Blueprint, jsonify, request
import jwt
from app.auth.jwt_validator import validate_token, _dev_mode
from app.services import terrain_service

bp = Blueprint('terrain', __name__, url_prefix='/api')


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if _dev_mode():
            return f(*args, **kwargs)
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
