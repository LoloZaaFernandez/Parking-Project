import asyncio
import logging
from datetime import datetime, timedelta

from database import SessionLocal
from models import Ticket
from ws_manager import manager

logger = logging.getLogger(__name__)

GRACE_PERIOD_MINUTES = 15


async def watch_waiting_tickets():
    """
    Background task: every 30 seconds, find 'waiting' tickets where
    paid_at + 10 minutes < now, and revert them to 'open'.
    """
    while True:
        await asyncio.sleep(30)
        try:
            with SessionLocal() as db:
                cutoff = datetime.utcnow() - timedelta(minutes=GRACE_PERIOD_MINUTES)
                expired = db.query(Ticket).filter(
                    Ticket.status == "waiting",
                    Ticket.paid_at < cutoff,
                ).all()

                if expired:
                    for ticket in expired:
                        logger.info(
                            "Ticket %d expiró período de espera, revirtiendo a 'open'",
                            ticket.id,
                        )
                        ticket.status = "open"
                        ticket.paid_at = None
                        ticket.amount = None
                    db.commit()

                    for ticket in expired:
                        await manager.broadcast({
                            "type": "payment_expired",
                            "plate": ticket.plate,
                            "ticket_id": ticket.id,
                        })
        except Exception as exc:
            logger.error("Error en watch_waiting_tickets: %s", exc)
