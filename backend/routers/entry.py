import asyncio
import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from lpr.camera import camera_manager
from models import Ticket
from ws_manager import manager

router = APIRouter(prefix="/entry", tags=["entry"])


async def _create_ticket(plate: str, db: Session) -> dict:
    entry_time = datetime.datetime.utcnow()
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
    })
    return {"ticket_id": ticket.id, "plate": plate, "entry_time": entry_time.isoformat()}


@router.post("/")
async def capture_and_register(db: Session = Depends(get_db)):
    """Capture frame from camera, run OCR, register entry ticket."""
    frame = camera_manager.read_frame()
    if frame is None:
        raise HTTPException(status_code=503, detail="Cámara no disponible")

    if camera_manager._demo_mode:
        plate = getattr(camera_manager, "_current_demo_plate", "ABC-123")
        return await _create_ticket(plate, db)

    loop = asyncio.get_running_loop()
    try:
        from lpr.detector import detect_plate  # lazy — avoids slow import at startup

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
async def manual_register(req: ManualEntryRequest, db: Session = Depends(get_db)):
    """Register entry with a manually typed plate (no camera required)."""
    from lpr.utils import normalize_plate

    plate = normalize_plate(req.plate)
    if not plate:
        raise HTTPException(status_code=422, detail=f"Formato de placa inválido: {req.plate}")

    return await _create_ticket(plate, db)
