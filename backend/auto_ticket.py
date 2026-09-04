"""
Service called by the camera when a plate is detected.
Handles auto-entry registration and exit confirmation.
"""
import asyncio
from datetime import datetime, timedelta

from database import SessionLocal
from models import Abonado, Ticket
from config import settings
from parking_rules import EXIT_TOLERANCE_MINUTES
from ticket_printer import print_entry_ticket
from ws_manager import manager

# Plates that recently confirmed exit → block re-entry for N seconds.
# Prevents ghost tickets when the camera keeps detecting a plate that just exited.
_exit_cooldown: dict[str, datetime] = {}
_COOLDOWN_SECONDS = EXIT_TOLERANCE_MINUTES * 60


def _in_cooldown(plate: str) -> bool:
    expiry = _exit_cooldown.get(plate)
    if expiry is None:
        return False
    if datetime.utcnow() < expiry:
        return True
    del _exit_cooldown[plate]
    return False


def set_exit_cooldown(plate: str) -> None:
    """Mark `plate` as recently exited so the camera ignores it for
    EXIT_TOLERANCE_MINUTES. Called both from the automatic camera exit path
    (below) and from the manual cashier exit confirmation (routers/exit.py),
    so a manual close is protected from ghost re-entries just like an
    automatic one.
    """
    _exit_cooldown[plate] = datetime.utcnow() + timedelta(seconds=_COOLDOWN_SECONDS)


async def handle_plate_detected(plate: str) -> dict:
    """
    Called every time the camera detects a valid plate.

    Logic:
    0. If plate belongs to an active abonado → no trace at all: no Ticket,
       no print, no cooldown, no ticket-related logic whatsoever.
    1. If plate is in exit cooldown → skip (prevents ghost re-entry after exit)
    2. If ticket is in 'waiting' status → confirm exit (set status='exited', exit_time=now)
    3. If ticket is 'open' → already inside, do nothing
    4. If no active ticket → auto-register entry

    Returns dict with 'action' key:
    'abonado' | 'exit_confirmed' | 'already_inside' | 'auto_entry' | 'cooldown'
    """
    plate_upper = plate.upper()

    with SessionLocal() as db:
        is_abonado = db.query(Abonado).filter(
            Abonado.plate == plate_upper,
            Abonado.active.is_(True),
        ).first()
        if is_abonado:
            # Abonados don't leave any trace: no Ticket row, no print, no
            # cooldown bookkeeping. Only a transient (non-persisted) WS
            # notification so the live Monitor can flash "abonado reconocido".
            await manager.broadcast({
                "type": "abonado_pass",
                "plate": plate_upper,
            })
            return {"action": "abonado", "plate": plate_upper}

    if _in_cooldown(plate_upper):
        return {"action": "cooldown", "plate": plate_upper}

    with SessionLocal() as db:
        # Check for waiting ticket → confirm physical exit
        waiting = db.query(Ticket).filter(
            Ticket.plate == plate_upper,
            Ticket.status == "waiting",
        ).first()
        if waiting:
            waiting.exit_time = datetime.now()
            waiting.status = "exited"
            db.commit()
            set_exit_cooldown(plate_upper)
            await manager.broadcast({
                "type": "exit_confirmed",
                "plate": plate_upper,
                "ticket_id": waiting.id,
                "amount": waiting.amount,
            })
            return {"action": "exit_confirmed", "ticket_id": waiting.id}

        # Check if already has an open ticket
        open_ticket = db.query(Ticket).filter(
            Ticket.plate == plate_upper,
            Ticket.status.in_(["open", "abono"]),
        ).first()
        if open_ticket:
            return {"action": "already_inside", "ticket_id": open_ticket.id}

        # Auto-register entry (abonados were already filtered out above)
        ticket = Ticket(
            plate=plate_upper,
            entry_time=datetime.now(),
            rate_per_hour=settings.rate_per_hour,
            status="open",
            amount=0.0,
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        await manager.broadcast({
            "type": "auto_entry",
            "plate": plate_upper,
            "is_abonado": False,
            "ticket_id": ticket.id,
        })
        asyncio.create_task(asyncio.to_thread(print_entry_ticket, ticket))
        return {"action": "auto_entry", "ticket_id": ticket.id}
