"""
Router de abonados (pases de vehículos con acceso sin cobro).

Todos los endpoints excepto /check/{plate} requieren rol 'admin'.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_admin
from models import Abonado

router = APIRouter(prefix="/abonados", tags=["abonados"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class AbonadoCreate(BaseModel):
    plate: str
    name: str


class AbonadoUpdate(BaseModel):
    plate: Optional[str] = None
    name: Optional[str] = None
    active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/")
def list_abonados(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Lista todos los abonados. Con `active_only=true` filtra solo los activos."""
    query = db.query(Abonado)
    if active_only:
        query = query.filter(Abonado.active.is_(True))
    abonados = query.order_by(Abonado.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "plate": a.plate,
            "name": a.name,
            "active": a.active,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in abonados
    ]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_abonado(
    body: AbonadoCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Registra un nuevo abonado. La placa se normaliza a mayúsculas."""
    plate = body.plate.upper().strip()

    existing = db.query(Abonado).filter(Abonado.plate == plate).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un abonado con la placa {plate}",
        )

    abonado = Abonado(plate=plate, name=body.name.strip())
    db.add(abonado)
    db.commit()
    db.refresh(abonado)

    return {
        "id": abonado.id,
        "plate": abonado.plate,
        "name": abonado.name,
        "active": abonado.active,
        "created_at": abonado.created_at.isoformat() if abonado.created_at else None,
    }


@router.put("/{abonado_id}")
def update_abonado(
    abonado_id: int,
    body: AbonadoUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Actualiza los datos de un abonado existente."""
    abonado: Abonado | None = db.query(Abonado).filter(Abonado.id == abonado_id).first()
    if abonado is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Abonado con id {abonado_id} no encontrado",
        )

    if body.plate is not None:
        new_plate = body.plate.upper().strip()
        # Verificar que la nueva placa no esté en uso por otro abonado
        conflict = (
            db.query(Abonado)
            .filter(Abonado.plate == new_plate, Abonado.id != abonado_id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"La placa {new_plate} ya pertenece a otro abonado",
            )
        abonado.plate = new_plate

    if body.name is not None:
        abonado.name = body.name.strip()

    if body.active is not None:
        abonado.active = body.active

    db.commit()
    db.refresh(abonado)

    return {
        "id": abonado.id,
        "plate": abonado.plate,
        "name": abonado.name,
        "active": abonado.active,
        "created_at": abonado.created_at.isoformat() if abonado.created_at else None,
    }


@router.delete("/{abonado_id}")
def delete_abonado(
    abonado_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Desactiva un abonado (soft delete). No elimina el registro de la DB."""
    abonado: Abonado | None = db.query(Abonado).filter(Abonado.id == abonado_id).first()
    if abonado is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Abonado con id {abonado_id} no encontrado",
        )

    abonado.active = False
    db.commit()

    return {"detail": f"Abonado {abonado.plate} desactivado correctamente"}


@router.get("/check/{plate}")
def check_abonado(plate: str, db: Session = Depends(get_db)):
    """
    Verifica si una placa corresponde a un abonado activo.
    No requiere autenticación — es usada internamente por entry/exit.
    """
    normalized = plate.upper().strip()
    abonado: Abonado | None = (
        db.query(Abonado)
        .filter(Abonado.plate == normalized, Abonado.active.is_(True))
        .first()
    )

    if abonado is None:
        return {"is_abonado": False, "abonado": None}

    return {
        "is_abonado": True,
        "abonado": {
            "id": abonado.id,
            "plate": abonado.plate,
            "name": abonado.name,
            "active": abonado.active,
        },
    }
