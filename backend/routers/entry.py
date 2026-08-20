import asyncio
import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from dependencies import get_current_user
from lpr.camera import camera_manager
from models import Abonado, Ticket, User
from ws_manager import manager

router = APIRouter(prefix="/entry", tags=["entry"])


def _is_active_abonado(plate: str, db: Session) -> tuple[bool, Abonado | None]:
    """Verifica si la placa corresponde a un abonado activo."""
    abonado = (
        db.query(Abonado)
        .filter(Abonado.plate == plate, Abonado.active.is_(True))
        .first()
    )
    return (abonado is not None, abonado)


async def _create_ticket(plate: str, db: Session) -> dict:
    entry_time = datetime.datetime.now()

    is_abonado, abonado = _is_active_abonado(plate, db)

    if is_abonado:
        ticket = Ticket(
            plate=plate,
            entry_time=entry_time,
            rate_per_hour=0.0,
            status="abono",
            amount=0.0,
        )
    else:
        ticket = Ticket(
            plate=plate,
            entry_time=entry_time,
            rate_per_hour=settings.rate_per_hour,
            status="open",
        )

    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    await manager.broadcast({
        "event": "plate_detected",
        "plate": plate,
        "entry_time": entry_time.isoformat(),
        "ticket_id": ticket.id,
        "is_abonado": is_abonado,
    })

    return {
        "ticket_id": ticket.id,
        "plate": plate,
        "entry_time": entry_time.isoformat(),
        "is_abonado": is_abonado,
        "abonado_name": abonado.name if abonado else None,
    }


@router.post("/")
async def capture_and_register(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Captura frame de la cámara, corre OCR y registra la entrada."""
    frame = camera_manager.current_frame
    if frame is None:
        raise HTTPException(status_code=503, detail="Cámara no disponible")

    loop = asyncio.get_running_loop()
    try:
        from lpr.detector import detect_plate  # lazy — evita import lento al inicio

        plate, confidence, _ = await loop.run_in_executor(None, detect_plate, frame)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error en OCR: {exc}") from exc

    if not plate:
        raise HTTPException(
            status_code=422,
            detail=(
                "No se detectó placa válida en el frame. "
                "Revisá los logs del backend para ver qué leyó EasyOCR. "
                "Si la imagen tiene baja resolución o la placa es muy pequeña, "
                "usá POST /entry/manual con la placa escrita a mano."
            ),
        )

    return await _create_ticket(plate, db)


class ManualEntryRequest(BaseModel):
    plate: str


@router.post("/manual")
async def manual_register(
    req: ManualEntryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra entrada con placa escrita manualmente (sin cámara)."""
    from lpr.utils import normalize_plate

    plate = normalize_plate(req.plate)
    if not plate:
        raise HTTPException(status_code=422, detail=f"Formato de placa inválido: {req.plate}")

    return await _create_ticket(plate, db)
