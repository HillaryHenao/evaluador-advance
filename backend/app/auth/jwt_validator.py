import os
from typing import Any
import jwt
from flask import request
from functools import wraps


def _dev_mode() -> bool:
    """En desarrollo sin JWT_SECRET configurado, omite validación para pruebas locales."""
    return os.environ.get('FLASK_ENV') == 'development' and not os.environ.get('JWT_SECRET', '').strip()


def validate_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT token. Raises jwt.InvalidTokenError on failure."""
    if _dev_mode():
        return {}
    secret = os.environ.get('JWT_SECRET', '')
    return jwt.decode(token, secret, algorithms=['HS256'])


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
