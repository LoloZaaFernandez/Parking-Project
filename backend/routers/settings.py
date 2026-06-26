"""
Router de configuración del sistema (solo admin).

GET /settings/  — devuelve la configuración actual
PUT /settings/  — actualiza rate_per_hour y lo persiste en settings.json
"""

import json
import os

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from config import settings
from dependencies import require_admin

router = APIRouter(prefix="/settings", tags=["settings"])

# Ruta del archivo de persistencia (relativa al directorio de trabajo del proceso)
_SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "settings.json")


class SettingsUpdate(BaseModel):
    rate_per_hour: float | None = None
    camera_url: str | None = None
    camera_user: str | None = None
    camera_pass: str | None = None


@router.get("/")
def get_settings(_admin=Depends(require_admin)):
    return {
        "rate_per_hour": settings.rate_per_hour,
        "camera_url": settings.camera_source,
        "camera_user": settings.camera_user,
        "camera_pass": settings.camera_pass,
    }


@router.put("/")
def update_settings(body: SettingsUpdate, _admin=Depends(require_admin)):
    from lpr.camera import camera_manager

    # ── Validaciones ────────────────────────────────────────────────────
    if body.rate_per_hour is not None and body.rate_per_hour < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La tarifa por hora no puede ser negativa",
        )

    # ── Aplicar en memoria ──────────────────────────────────────────────
    camera_changed = False
    if body.rate_per_hour is not None:
        settings.rate_per_hour = body.rate_per_hour
    if body.camera_url is not None:
        settings.camera_source = body.camera_url.strip()
        camera_changed = True
    if body.camera_user is not None:
        settings.camera_user = body.camera_user.strip()
        camera_changed = True
    if body.camera_pass is not None:
        settings.camera_pass = body.camera_pass
        camera_changed = True

    # ── Reconectar cámara si cambió ─────────────────────────────────────
    if camera_changed:
        camera_manager.reconfigure(
            settings.camera_source,
            settings.camera_user,
            settings.camera_pass,
        )

    # ── Persistir en disco ──────────────────────────────────────────────
    try:
        data: dict = {}
        if os.path.exists(_SETTINGS_FILE):
            with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        data["rate_per_hour"] = settings.rate_per_hour
        data["camera_source"] = settings.camera_source
        data["camera_user"] = settings.camera_user
        data["camera_pass"] = settings.camera_pass
        with open(_SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo guardar la configuración en disco: {exc}",
        ) from exc

    return {
        "rate_per_hour": settings.rate_per_hour,
        "camera_url": settings.camera_source,
        "camera_user": settings.camera_user,
        "camera_pass": settings.camera_pass,
    }
