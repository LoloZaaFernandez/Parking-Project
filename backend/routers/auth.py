"""
Router de autenticación.

POST /auth/login            — recibe form data, devuelve JWT
GET  /auth/me                — devuelve el usuario autenticado (requiere token)
POST /auth/change-password  — cambia la contraseña del usuario autenticado
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from dependencies import create_access_token, get_current_user, hash_password, verify_password
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


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


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cambia la contraseña del usuario autenticado.

    - **current_password**: contraseña actual, se verifica contra el hash guardado
    - **new_password**: nueva contraseña, mínimo 6 caracteres
    """
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La contraseña actual es incorrecta",
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 6 caracteres",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"detail": "Contraseña actualizada correctamente"}
