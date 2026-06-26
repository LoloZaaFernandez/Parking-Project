"""
Dependencias de autenticación JWT para FastAPI.

Usa python-jose para tokens y passlib[bcrypt] para hashing de contraseñas.
SECRET_KEY se lee de la variable de entorno SECRET_KEY; si no existe se usa
un valor de desarrollo (NO usar en producción sin setear la variable).
"""

import os
from datetime import datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db
from models import User

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

SECRET_KEY: str = os.getenv(
    "SECRET_KEY",
    "dev-secret-key-cambiar-en-produccion-f3b2a1c9d8e7f6a5b4c3d2e1f0a9b8c7",
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 horas

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ---------------------------------------------------------------------------
# Utilidades de contraseña
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    """Devuelve el hash bcrypt de la contraseña en texto plano."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Verifica si la contraseña en texto plano coincide con el hash."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# Utilidades JWT
# ---------------------------------------------------------------------------


def create_access_token(data: dict) -> str:
    """
    Crea un JWT firmado con los datos proporcionados.
    Agrega automáticamente `exp` con la expiración configurada.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ---------------------------------------------------------------------------
# Dependencias FastAPI
# ---------------------------------------------------------------------------


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependencia que decodifica el JWT del header Authorization y devuelve
    el usuario autenticado. Lanza 401 si el token es inválido o el usuario
    no existe.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o token inválido",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependencia que verifica que el usuario autenticado tenga rol 'admin'.
    Lanza 403 si el rol es distinto.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido a administradores",
        )
    return current_user
