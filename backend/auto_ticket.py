"""
Service called by the camera when a plate is detected.
Handles auto-entry registration and exit confirmation.
"""
from datetime import datetime, timedelta

from database import SessionLocal
from models import Abonado, Ticket
from config import settings
from ws_manager import manager

# Plates that recently confirmed exit → block re-entry for N seconds.
# Prevents ghost tickets when the camera keeps detecting a plate that just exited.
_exit_cooldown: dict[str, datetime] = {}
_COOLDOWN_SECONDS = 60


def _in_cooldown(plate: str) -> bool:
    expiry = _exit_cooldown.get(plate)
    if expiry is None:
        return False
    if datetime.utcnow() < expiry:
        return True
    del _exit_cooldown[plate]
    return False


def _set_cooldown(plate: str) -> None:
    _exit_cooldown[plate] = datetime.utcnow() + timedelta(seconds=_COOLDOWN_SECONDS)


async def handle_plate_detected(plate: str) -> dict:
    """
    Called every time the camera detects a valid plate.

    Logic:
    1. If plate is in exit cooldown → skip (prevents ghost re-entry after exit)
    2. If ticket is in 'waiting' status → confirm exit (set status='exited', exit_time=now)
    3. If ticket is 'open' or 'abono' → already inside, do nothing
    4. If no active ticket → auto-register entry (check if abonado first)

    Returns dict with 'action' key: 'exit_confirmed' | 'already_inside' | 'auto_entry' | 'cooldown'
    """
    plate_upper = plate.upper()

    if _in_cooldown(plate_upper):
        return {"action": "cooldown", "plate": plate_upper}

    with SessionLocal() as db:
        # Check for waiting ticket → confirm physical exit
        waiting = db.query(Ticket).filter(
            Ticket.plate == plate_upper,
            Ticket.status == "waiting",
        ).first()
        if waiting:
            waiting.exit_time = datetime.utcnow()
            waiting.status = "exited"
            db.commit()
            _set_cooldown(plate_upper)
            await manager.broadcast({
                "type": "exit_confirmed",
                "plate": plate_upper,
                "ticket_id": waiting.id,
                "amount": waiting.amount,
            })
            return {"action": "exit_confirmed", "ticket_id": waiting.id}

        # Check if already has open/abono ticket
        open_ticket = db.query(Ticket).filter(
            Ticket.plate == plate_upper,
            Ticket.status.in_(["open", "abono"]),
        ).first()
        if open_ticket:
            return {"action": "already_inside", "ticket_id": open_ticket.id}

        # Auto-register entry
        is_abonado = db.query(Abonado).filter(
            Abonado.plate == plate_upper,
            Abonado.active.is_(True),
        ).first()

        ticket = Ticket(
            plate=plate_upper,
            entry_time=datetime.utcnow(),
            rate_per_hour=0.0 if is_abonado else settings.rate_per_hour,
            status="abono" if is_abonado else "open",
            amount=0.0,
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        await manager.broadcast({
            "type": "auto_entry",
            "plate": plate_upper,
            "is_abonado": bool(is_abonado),
            "ticket_id": ticket.id,
        })
        return {"action": "auto_entry", "ticket_id": ticket.id}
