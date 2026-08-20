import datetime
import math

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import Ticket, User

router = APIRouter(prefix="/exit", tags=["exit"])


class ExitRequest(BaseModel):
    plate: str


@router.post("/confirm")
def confirm_exit_manual(
    req: ExitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirmación manual de salida para vehículos en estado 'waiting'."""
    plate = req.plate.upper().strip()

    ticket: Ticket | None = (
        db.query(Ticket)
        .filter(Ticket.plate == plate, Ticket.status == "waiting")
        .order_by(Ticket.entry_time.desc())
        .first()
    )
    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail=f"No hay ticket en espera para la placa {plate}",
        )

    ticket.exit_time = datetime.datetime.now()
    ticket.status = "exited"
    db.commit()
    db.refresh(ticket)

    return {
        "ticket_id": ticket.id,
        "plate": ticket.plate,
        "entry_time": ticket.entry_time.isoformat(),
        "exit_time": ticket.exit_time.isoformat(),
        "amount": ticket.amount,
        "status": "exited",
        "manual": True,
    }


@router.post("/")
def register_exit(
    req: ExitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plate = req.plate.upper().strip()

    # Verificar si ya está en estado 'waiting' (pagado, esperando salida física)
    waiting_ticket: Ticket | None = (
        db.query(Ticket)
        .filter(
            Ticket.plate == plate,
            Ticket.status == "waiting",
        )
        .order_by(Ticket.entry_time.desc())
        .first()
    )
    if waiting_ticket is not None:
        return {
            "ticket_id": waiting_ticket.id,
            "plate": waiting_ticket.plate,
            "status": "waiting",
            "paid_at": waiting_ticket.paid_at.isoformat() if waiting_ticket.paid_at else None,
            "amount": waiting_ticket.amount,
            "message": "Ticket ya pagado, esperando confirmación de salida física.",
        }

    # Buscar ticket abierto (status 'open') O ticket de abonado (status 'abono')
    ticket: Ticket | None = (
        db.query(Ticket)
        .filter(
            Ticket.plate == plate,
            Ticket.status.in_(["open", "abono"]),
        )
        .order_by(Ticket.entry_time.desc())
        .first()
    )

    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail=f"No hay ticket abierto para la placa {plate}",
        )

    now = datetime.datetime.now()
    elapsed_seconds = (now - ticket.entry_time).total_seconds()
    elapsed_hours = math.ceil(elapsed_seconds / 3600)

    is_abonado = ticket.status == "abono"

    if is_abonado:
        # Abonado: registrar salida inmediata como 'exited', sin cobro, sin período de espera
        ticket.exit_time = now
        ticket.amount = 0.0
        ticket.status = "exited"
        db.commit()
        db.refresh(ticket)
        return {
            "ticket_id": ticket.id,
            "plate": ticket.plate,
            "entry_time": ticket.entry_time.isoformat(),
            "exit_time": ticket.exit_time.isoformat(),
            "elapsed_hours": elapsed_hours,
            "amount": ticket.amount,
            "rate_per_hour": ticket.rate_per_hour,
            "is_abonado": True,
            "status": "exited",
        }

    # Ticket normal: calcular monto, marcar como 'waiting' (pagado, esperando salida física)
    amount = round(elapsed_hours * ticket.rate_per_hour, 2)
    ticket.amount = amount
    ticket.paid_at = now
    ticket.status = "waiting"
    # exit_time permanece None hasta que la cámara confirme la salida física

    db.commit()
    db.refresh(ticket)

    return {
        "ticket_id": ticket.id,
        "plate": ticket.plate,
        "entry_time": ticket.entry_time.isoformat(),
        "exit_time": None,
        "elapsed_hours": elapsed_hours,
        "amount": ticket.amount,
        "rate_per_hour": ticket.rate_per_hour,
        "is_abonado": False,
        "status": "waiting",
        "paid_at": ticket.paid_at.isoformat(),
    }
