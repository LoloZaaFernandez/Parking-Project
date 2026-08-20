import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)

from config import settings
from database import SessionLocal, engine, init_db
from lpr.camera import camera_manager
from waiting_manager import watch_waiting_tickets
from routers.abonados import router as abonados_router
from routers.auth import router as auth_router
from routers.camera_router import router as camera_router
from routers.entry import router as entry_router
from routers.exit import router as exit_router
from routers.reports import router as reports_router
from routers.settings import router as settings_router
from routers.tickets import router as tickets_router
from routers.ws import router as ws_router

logger = logging.getLogger(__name__)

_SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "settings.json")


def _load_persisted_settings() -> None:
    """
    Lee settings.json (si existe) y aplica los valores persistidos en memoria.
    Esto permite que los cambios del admin sobrevivan reinicios del servidor.
    """
    if not os.path.exists(_SETTINGS_FILE):
        return
    try:
        with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "rate_per_hour" in data:
            settings.rate_per_hour = float(data["rate_per_hour"])
            logger.info("Configuración cargada: rate_per_hour=%.2f", settings.rate_per_hour)
        if "camera_source" in data:
            settings.camera_source = data["camera_source"]
        if "camera_user" in data:
            settings.camera_user = data["camera_user"]
        if "camera_pass" in data:
            settings.camera_pass = data["camera_pass"]
        if any(k in data for k in ("camera_source", "camera_user", "camera_pass")):
            logger.info("Configuración de cámara cargada: %s", settings.camera_source)
        if "printer_name" in data:
            settings.printer_name = data["printer_name"]
            logger.info("Impresora configurada: %s", settings.printer_name or "(ninguna)")
    except Exception as exc:
        logger.warning("No se pudo cargar settings.json: %s", exc)


def _create_default_admin() -> None:
    """
    Crea el usuario admin por defecto si no existe ningún usuario en la DB.
    Credenciales iniciales: admin / admin123
    """
    from dependencies import hash_password
    from models import User

    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            admin = User(
                username="admin",
                password_hash=hash_password("admin123"),
                role="admin",
            )
            db.add(admin)
            db.commit()
            logger.info("Usuario admin por defecto creado (username=admin, password=admin123)")
        else:
            logger.info("Usuarios existentes encontrados — no se crea admin por defecto")
    except Exception as exc:
        logger.error("Error al crear usuario admin por defecto: %s", exc)
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Crear tablas
    init_db()
    # 2. Migración: agregar columna paid_at si no existe (para DBs existentes)
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE tickets ADD COLUMN paid_at DATETIME"))
            conn.commit()
            logger.info("Columna paid_at agregada a la tabla tickets")
        except Exception:
            pass  # columna ya existe
    # 3. Cargar configuración persistida
    _load_persisted_settings()
    # 4. Crear admin por defecto si no hay usuarios
    _create_default_admin()
    # 5. Iniciar captura de cámara y monitor de tickets en espera
    camera_task = asyncio.create_task(camera_manager.start_capture())
    waiting_task = asyncio.create_task(watch_waiting_tickets())
    yield
    logger.info("Iniciando apagado del servidor…")
    camera_manager.stop()
    camera_task.cancel()
    waiting_task.cancel()
    try:
        await asyncio.wait_for(camera_task, timeout=5.0)
    except (asyncio.CancelledError, asyncio.TimeoutError):
        pass
    try:
        await asyncio.wait_for(waiting_task, timeout=5.0)
    except (asyncio.CancelledError, asyncio.TimeoutError):
        pass
    logger.info("Servidor apagado correctamente")


app = FastAPI(title="Sistema de Parqueo LPR", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers existentes
app.include_router(entry_router)
app.include_router(exit_router)
app.include_router(tickets_router)
app.include_router(ws_router)
app.include_router(camera_router)

# Nuevos routers
app.include_router(auth_router)
app.include_router(abonados_router)
app.include_router(reports_router)
app.include_router(settings_router)

# ── Servir frontend (build de producción) ──────────────────────────────────────
_FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.isdir(_FRONTEND_DIST):
    _assets = os.path.join(_FRONTEND_DIST, "assets")
    if os.path.isdir(_assets):
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(_FRONTEND_DIST, "index.html"))
