import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from lpr.camera import camera_manager
from routers.camera_router import router as camera_router
from routers.entry import router as entry_router
from routers.exit import router as exit_router
from routers.tickets import router as tickets_router
from routers.ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task = asyncio.create_task(camera_manager.start_capture())
    yield
    camera_manager.stop()
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Sistema de Parqueo LPR", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(entry_router)
app.include_router(exit_router)
app.include_router(tickets_router)
app.include_router(ws_router)
app.include_router(camera_router)
