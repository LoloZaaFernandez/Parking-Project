"""
Router de autenticación.

POST   /auth/login            — recibe form data, devuelve JWT
GET    /auth/me                — devuelve el usuario autenticado (requiere token)
POST   /auth/change-password  — cambia la contraseña del usuario autenticado
POST   /auth/users            — crea un usuario (admin-only)
GET    /auth/users            — lista usuarios (admin-only)
DELETE /auth/users/{user_id}  — elimina un usuario (admin-only)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from dependencies import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])

VALID_ROLES = ("admin", "cashier")


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str


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


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Crea un nuevo usuario (cajero o administrador). Solo accesible por admins.

    - **username**: nombre de usuario, debe ser único
    - **password**: contraseña en texto plano, mínimo 6 caracteres
    - **role**: 'admin' o 'cashier'
    """
    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rol debe ser 'admin' o 'cashier'",
        )

    if len(body.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 6 caracteres",
        )

    username = body.username.strip()
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un usuario con el nombre '{username}'",
        )

    user = User(username=username, password_hash=hash_password(body.password), role=body.role)
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"id": user.id, "username": user.username, "role": user.role}


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Lista todos los usuarios del sistema. Nunca incluye el hash de contraseña."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Elimina un usuario (hard delete). Solo accesible por admins.

    Protecciones:
    - Un admin no puede eliminar su propia cuenta mientras está logueado con ella.
    - No se puede eliminar el único administrador que queda en el sistema.
    """
    target: User | None = db.query(User).filter(User.id == user_id).first()
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con id {user_id} no encontrado",
        )

    if target.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No podés eliminar tu propia cuenta mientras estás logueado con ella",
        )

    if target.role == "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede eliminar el único administrador del sistema",
            )

    db.delete(target)
    db.commit()

    return {"detail": f"Usuario '{target.username}' eliminado correctamente"}
