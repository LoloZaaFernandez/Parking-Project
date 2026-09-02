"""
Impresión de tickets en impresora térmica ESC/POS instalada en Windows.

Usa el backend Win32Raw de python-escpos: manda los comandos ESC/POS
directo al spooler de Windows, contra la impresora tal como aparece
en "Dispositivos e impresoras" (sin necesidad de driver USB raw / Zadig).
"""
import logging

from config import settings
from models import Ticket

logger = logging.getLogger(__name__)


def _open_printer():
    from escpos.printer import Win32Raw

    if not settings.printer_name:
        raise RuntimeError("No hay impresora configurada (printer_name vacío)")
    return Win32Raw(settings.printer_name)


def _write_entry_ticket(p, plate: str, entry_time_str: str, ticket_id: int) -> None:
    p.set(align="center", bold=True, width=2, height=2)
    p.text("SISTEMA DE PARQUEO\n")
    p.set(align="center", bold=False, width=1, height=1)
    p.text("-" * 32 + "\n")
    p.set(align="left")
    p.text(f"Patente:    {plate}\n")
    p.text(f"Ingreso:    {entry_time_str}\n")
    p.text(f"Ticket N.:  {ticket_id}\n")
    p.text("-" * 32 + "\n")
    p.set(align="center")
    p.text("Conserve este ticket\n\n")
    p.cut()


def print_entry_ticket(ticket: Ticket) -> None:
    """
    Imprime el ticket de ingreso. Cualquier error queda registrado en el log
    pero nunca se propaga — una impresora offline no puede tumbar el flujo
    de detección de patentes.
    """
    try:
        p = _open_printer()
        try:
            _write_entry_ticket(
                p,
                plate=ticket.plate,
                entry_time_str=ticket.entry_time.strftime("%d/%m/%Y %H:%M"),
                ticket_id=ticket.id,
            )
        finally:
            p.close()
        logger.info("Ticket #%s impreso (%s)", ticket.id, ticket.plate)
    except Exception as exc:
        logger.warning("No se pudo imprimir el ticket #%s: %s", ticket.id, exc)


def _write_exit_ticket(
    p,
    plate: str,
    entry_time_str: str,
    paid_at_str: str,
    amount: float,
    rate_per_hour: float,
    ticket_id: int,
) -> None:
    p.set(align="center", bold=True, width=2, height=2)
    p.text("SISTEMA DE PARQUEO\n")
    p.set(align="center", bold=False, width=1, height=1)
    p.text("-" * 32 + "\n")
    p.set(align="left")
    p.text(f"Patente:    {plate}\n")
    p.text(f"Ingreso:    {entry_time_str}\n")
    p.text(f"Ticket N.:  {ticket_id}\n")
    p.text("-" * 32 + "\n")
    p.set(align="center", bold=True)
    p.text("PAGADO\n")
    p.set(align="left", bold=False)
    p.text(f"Hora de pago: {paid_at_str}\n")
    p.text(f"Tarifa/hora:  ${rate_per_hour:.2f}\n")
    p.set(align="left", bold=True)
    p.text(f"Monto pagado: ${amount:.2f}\n")
    p.set(align="center", bold=False)
    p.text("-" * 32 + "\n")
    p.text("Conserve este comprobante\n\n")
    p.cut()


def print_exit_ticket(ticket: Ticket) -> None:
    """
    Imprime el voucher de pago en el cobro. Cualquier error queda registrado
    en el log pero nunca se propaga — una impresora offline no puede tumbar
    el flujo de cobro.
    """
    try:
        paid_at = ticket.paid_at
        p = _open_printer()
        try:
            _write_exit_ticket(
                p,
                plate=ticket.plate,
                entry_time_str=ticket.entry_time.strftime("%d/%m/%Y %H:%M"),
                paid_at_str=paid_at.strftime("%d/%m/%Y %H:%M") if paid_at else "-",
                amount=ticket.amount,
                rate_per_hour=ticket.rate_per_hour,
                ticket_id=ticket.id,
            )
        finally:
            p.close()
        logger.info("Voucher de pago #%s impreso (%s)", ticket.id, ticket.plate)
    except Exception as exc:
        logger.warning("No se pudo imprimir el voucher de pago #%s: %s", ticket.id, exc)


def test_print() -> None:
    """Imprime un ticket de prueba. Deja que la excepción suba — la usa
    el endpoint de settings para informarle al admin si falló y por qué."""
    p = _open_printer()
    try:
        p.set(align="center", bold=True, width=2, height=2)
        p.text("PRUEBA DE IMPRESION\n")
        p.set(align="center", bold=False, width=1, height=1)
        p.text("-" * 32 + "\n")
        p.text("Sistema de Parqueo\n")
        p.text("Si ves esto, la impresora\n")
        p.text("esta bien configurada.\n")
        p.cut()
    finally:
        p.close()
