import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Ticket

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _serialize(t: Ticket) -> dict:
    return {
        "id": t.id,
        "plate": t.plate,
        "entry_time": t.entry_time.isoformat(),
        "exit_time": t.exit_time.isoformat() if t.exit_time else None,
        "amount": t.amount,
        "rate_per_hour": t.rate_per_hour,
        "status": t.status,
    }


@router.get("/stats")
def daily_stats(db: Session = Depends(get_db)):
    today = datetime.date.today()
    start = datetime.datetime.combine(today, datetime.time.min)
    end = datetime.datetime.combine(today, datetime.time.max)

    tickets = db.query(Ticket).filter(Ticket.entry_time.between(start, end)).all()
    open_count = sum(1 for t in tickets if t.status == "open")
    paid_count = sum(1 for t in tickets if t.status == "paid")
    total_income = round(sum(t.amount or 0 for t in tickets if t.status == "paid"), 2)

    return {"date": today.isoformat(), "open": open_count, "paid": paid_count, "total_income": total_income}


@router.get("/search/{plate}")
def search_open(plate: str, db: Session = Depends(get_db)):
    ticket = (
        db.query(Ticket)
        .filter(Ticket.plate == plate.upper(), Ticket.status == "open")
        .order_by(Ticket.entry_time.desc())
        .first()
    )
    return _serialize(ticket) if ticket else None


@router.get("/")
def list_tickets(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    plate: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Ticket)
    if status:
        q = q.filter(Ticket.status == status)
    if plate:
        q = q.filter(Ticket.plate.contains(plate.upper()))
    if date_from:
        q = q.filter(Ticket.entry_time >= datetime.datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Ticket.entry_time <= datetime.datetime.fromisoformat(date_to))

    total = q.count()
    items = q.order_by(Ticket.entry_time.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {"total": total, "page": page, "per_page": per_page, "items": [_serialize(t) for t in items]}
