"""
Router de reportes mensuales (solo admin).

GET /reports/monthly               — resumen por mes del año indicado
GET /reports/monthly/{year}/{month} — detalle de tickets del mes, paginado
"""

import datetime
from calendar import month_name as _MONTH_NAMES_EN

from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_admin
from models import Ticket

router = APIRouter(prefix="/reports", tags=["reports"])

# Nombres de meses en español (índice 1–12)
_MESES_ES = [
    "",  # índice 0 sin uso
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


# ---------------------------------------------------------------------------
# GET /reports/monthly
# ---------------------------------------------------------------------------


@router.get("/monthly")
def monthly_summary(
    year: int = Query(default=None, description="Año a consultar (default: año actual)"),
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Devuelve un resumen por mes para el año indicado.
    Incluye meses con al menos un ticket.
    """
    if year is None:
        year = datetime.datetime.now().year

    # Todos los tickets del año que ya tienen exit_time (cerrados)
    tickets = (
        db.query(Ticket)
        .filter(
            extract("year", Ticket.entry_time) == year,
            Ticket.exit_time.isnot(None),
        )
        .all()
    )

    # Agrupar por mes
    months: dict[int, dict] = {}
    for ticket in tickets:
        m = ticket.entry_time.month
        if m not in months:
            months[m] = {
                "month": m,
                "month_name": _MESES_ES[m],
                "year": year,
                "total_vehicles": 0,
                "paying_vehicles": 0,
                "abonado_vehicles": 0,
                "total_income": 0.0,
                "total_duration_seconds": 0,
            }
        entry = months[m]
        entry["total_vehicles"] += 1
        if ticket.status == "abono":
            entry["abonado_vehicles"] += 1
        else:
            entry["paying_vehicles"] += 1
            entry["total_income"] += ticket.amount or 0.0

        duration = (ticket.exit_time - ticket.entry_time).total_seconds()
        entry["total_duration_seconds"] += duration

    result = []
    for m in sorted(months.keys()):
        entry = months[m]
        total = entry["total_vehicles"]
        avg_minutes = (
            round(entry["total_duration_seconds"] / total / 60)
            if total > 0
            else 0
        )
        result.append(
            {
                "month": entry["month"],
                "month_name": entry["month_name"],
                "year": entry["year"],
                "total_vehicles": total,
                "paying_vehicles": entry["paying_vehicles"],
                "abonado_vehicles": entry["abonado_vehicles"],
                "total_income": round(entry["total_income"], 2),
                "avg_duration_minutes": avg_minutes,
            }
        )

    return result


# ---------------------------------------------------------------------------
# GET /reports/monthly/{year}/{month}
# ---------------------------------------------------------------------------


@router.get("/monthly/{year}/{month}")
def monthly_detail(
    year: int,
    month: int,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Detalle paginado de todos los tickets del mes/año indicado.
    Incluye un resumen en la clave `summary`.
    """
    if month < 1 or month > 12:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="El mes debe ser entre 1 y 12")

    base_query = db.query(Ticket).filter(
        extract("year", Ticket.entry_time) == year,
        extract("month", Ticket.entry_time) == month,
    )

    total_count = base_query.count()
    offset = (page - 1) * limit
    tickets = base_query.order_by(Ticket.entry_time.desc()).offset(offset).limit(limit).all()

    # Calcular resumen sobre todos los tickets del mes (no solo la página)
    all_month = base_query.all()
    total_vehicles = len(all_month)
    paying_vehicles = sum(1 for t in all_month if t.status != "abono")
    abonado_vehicles = sum(1 for t in all_month if t.status == "abono")
    total_income = sum((t.amount or 0.0) for t in all_month if t.status != "abono")
    durations = [
        (t.exit_time - t.entry_time).total_seconds()
        for t in all_month
        if t.exit_time is not None
    ]
    avg_minutes = round(sum(durations) / len(durations) / 60) if durations else 0

    summary = {
        "month": month,
        "month_name": _MESES_ES[month],
        "year": year,
        "total_vehicles": total_vehicles,
        "paying_vehicles": paying_vehicles,
        "abonado_vehicles": abonado_vehicles,
        "total_income": round(total_income, 2),
        "avg_duration_minutes": avg_minutes,
    }

    ticket_list = [
        {
            "id": t.id,
            "plate": t.plate,
            "entry_time": t.entry_time.isoformat(),
            "exit_time": t.exit_time.isoformat() if t.exit_time else None,
            "amount": t.amount,
            "rate_per_hour": t.rate_per_hour,
            "status": t.status,
        }
        for t in tickets
    ]

    return {
        "summary": summary,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_count,
            "pages": -(-total_count // limit),  # ceil division
        },
        "tickets": ticket_list,
    }
