import datetime
import math

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Ticket

router = APIRouter(prefix="/exit", tags=["exit"])


class ExitRequest(BaseModel):
    plate: str


@router.post("/")
def register_exit(req: ExitRequest, db: Session = Depends(get_db)):
    plate = req.plate.upper().strip()

    ticket: Ticket | None = (
        db.query(Ticket)
        .filter(Ticket.plate == plate, Ticket.status == "open")
        .order_by(Ticket.entry_time.desc())
        .first()
    )

    if ticket is None:
        raise HTTPException(status_code=404, detail=f"No hay ticket abierto para la placa {plate}")

    exit_time = datetime.datetime.utcnow()
    elapsed_seconds = (exit_time - ticket.entry_time).total_seconds()
    elapsed_hours = math.ceil(elapsed_seconds / 3600)
    amount = round(elapsed_hours * ticket.rate_per_hour, 2)

    ticket.exit_time = exit_time
    ticket.amount = amount
    ticket.status = "paid"
    db.commit()
    db.refresh(ticket)

    return {
        "ticket_id": ticket.id,
        "plate": ticket.plate,
        "entry_time": ticket.entry_time.isoformat(),
        "exit_time": exit_time.isoformat(),
        "elapsed_hours": elapsed_hours,
        "amount": amount,
        "rate_per_hour": ticket.rate_per_hour,
    }
