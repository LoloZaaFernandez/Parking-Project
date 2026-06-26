"""
Router de autenticación.

POST /auth/login  — recibe form data, devuelve JWT
GET  /auth/me     — devuelve el usuario autenticado (requiere token)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import get_db
from dependencies import create_access_token, get_current_user, verify_password
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Autentica al usuario y devuelve un JWT de acceso.

    - **username**: nombre de usuario
    - **password**: contraseña en texto plano
    """
    user: User | None = db.query(User).filter(User.username == form_data.username).first()

    if user is None or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": user.username})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
        },
    }


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    """Devuelve los datos del usuario autenticado."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
    }
