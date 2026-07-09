import asyncio
import datetime
import logging
import random
import threading
import time
import urllib.request
from typing import Optional

import cv2
import numpy as np

from auto_ticket import handle_plate_detected
from config import settings
from ws_manager import manager

logger = logging.getLogger(__name__)

_DEMO_PLATES = ["ABC-123", "XYZ-456", "DEF-789", "GHI-012", "JKL-345"]


class MJPEGCapture:
    """Lector MJPEG sobre HTTP para cámaras IP."""

    CHUNK = 65536

    def __init__(self, url: str, user: str = "", password: str = "", timeout: int = 5) -> None:
        self.url = url
        self.user = user
        self.password = password
        self.timeout = timeout
        self._stream = None
        self._opener = self._build_opener()
        self._buf = b""

    def _build_opener(self):
        if self.user:
            mgr = urllib.request.HTTPPasswordMgrWithDefaultRealm()
            mgr.add_password(None, self.url, self.user, self.password)
            auth = urllib.request.HTTPBasicAuthHandler(mgr)
            return urllib.request.build_opener(auth)
        return urllib.request.build_opener()

    def open(self) -> bool:
        try:
            self._stream = self._opener.open(self.url, timeout=self.timeout)
            self._buf = b""
            return True
        except Exception as exc:
            logger.error("MJPEGCapture: no se pudo abrir %s — %s", self.url, exc)
            return False

    def read(self) -> Optional[np.ndarray]:
        if self._stream is None:
            return None
        try:
            while True:
                chunk = self._stream.read(self.CHUNK)
                if not chunk:
                    raise ConnectionResetError("Stream cerrado por la cámara")
                self._buf += chunk
                if len(self._buf) > self.CHUNK * 20:
                    self._buf = self._buf[-self.CHUNK * 4:]
                s = self._buf.find(b"\xff\xd8")
                e = self._buf.find(b"\xff\xd9")
                if s != -1 and e != -1 and e > s:
                    jpg = self._buf[s:e + 2]
                    self._buf = self._buf[e + 2:]
                    arr = np.frombuffer(jpg, dtype=np.uint8)
                    return cv2.imdecode(arr, cv2.IMREAD_COLOR)
        except Exception as exc:
            logger.warning("MJPEGCapture: error leyendo frame — %s", exc)
            self._stream = None
            return None

    def release(self) -> None:
        if self._stream:
            try:
                self._stream.close()
            except Exception:
                pass
            self._stream = None


class CameraManager:
    def __init__(self) -> None:
        self.cap: Optional[cv2.VideoCapture] = None
        self._mjpeg: Optional[MJPEGCapture] = None
        self.last_detection: Optional[dict] = None
        self.running: bool = False
        self._demo_mode: bool = False
        self._image_file: Optional[str] = None

        self._frame_lock = threading.Lock()
        self._current_frame: Optional[np.ndarray] = None
        self._capture_thread: Optional[threading.Thread] = None
        self._detection_thread: Optional[threading.Thread] = None

    # ------------------------------------------------------------------ #
    # Frame access (thread-safe)                                           #
    # ------------------------------------------------------------------ #

    @property
    def current_frame(self) -> Optional[np.ndarray]:
        with self._frame_lock:
            return self._current_frame

    @current_frame.setter
    def current_frame(self, frame: Optional[np.ndarray]) -> None:
        with self._frame_lock:
            self._current_frame = frame

    # ------------------------------------------------------------------ #
    # Init                                                                 #
    # ------------------------------------------------------------------ #

    def _is_mjpeg_url(self, source: str) -> bool:
        return source.startswith("http://") or source.startswith("https://")

    def _init_capture(self) -> bool:
        import os
        source = settings.camera_source
        if source.lower() == "demo":
            self._demo_mode = True
            return True
        if os.path.isfile(source) and source.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".webp")):
            self._image_file = source
            logger.info("Modo imagen estática: %s", source)
            return True
        if self._is_mjpeg_url(source):
            self._mjpeg = MJPEGCapture(source, user=settings.camera_user, password=settings.camera_pass)
            ok = self._mjpeg.open()
            if ok:
                logger.info("Cámara IP MJPEG conectada: %s", source)
            else:
                logger.warning("No se pudo conectar a la cámara IP — verificá IP, usuario y contraseña")
            return ok
        try:
            idx = int(source)
            self.cap = cv2.VideoCapture(idx)
        except ValueError:
            self.cap = cv2.VideoCapture(source)
        return self.cap is not None and self.cap.isOpened()

    # ------------------------------------------------------------------ #
    # Frame reading                                                        #
    # ------------------------------------------------------------------ #

    def _read_raw_frame(self) -> Optional[np.ndarray]:
        if self._demo_mode:
            plate = getattr(self, "_current_demo_plate", "ABC-123")
            return self._make_demo_frame(plate)
        if self._image_file:
            return cv2.imread(self._image_file)
        if self._mjpeg is not None:
            frame = self._mjpeg.read()
            if frame is None:
                logger.info("Stream MJPEG perdido — reconectando...")
                self._mjpeg.release()
                time.sleep(1.0)
                self._mjpeg.open()
            return frame
        if self.cap is None or not self.cap.isOpened():
            return None
        ret, frame = self.cap.read()
        return frame if ret else None

    # ------------------------------------------------------------------ #
    # Background capture thread                                            #
    # ------------------------------------------------------------------ #

    def _capture_loop(self) -> None:
        """Hilo dedicado: lee frames de la cámara sin parar."""
        logger.info("Hilo de captura iniciado")
        consecutive_errors = 0
        while self.running:
            try:
                frame = self._read_raw_frame()
                if frame is not None:
                    self.current_frame = frame
                    consecutive_errors = 0
                else:
                    consecutive_errors += 1
                    if consecutive_errors > 5:
                        time.sleep(1.0)
            except Exception as exc:
                logger.error("_capture_loop error: %s", exc)
                consecutive_errors += 1
                time.sleep(0.5)
        logger.info("Hilo de captura detenido")

    # ------------------------------------------------------------------ #
    # Detection thread                                                     #
    # ------------------------------------------------------------------ #

    _PLATE_COOLDOWN = 10.0  # segundos entre detecciones de la misma placa
    _VOTE_WINDOW = 5        # últimas N detecciones a considerar
    _MIN_VOTES = 3          # votos mínimos para confirmar una placa

    def _detection_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Hilo dedicado: corre fast-alpr en un thread real de Python."""
        from collections import Counter, deque
        from lpr.detector import detect_plate

        logger.info("Hilo de detección iniciado")
        last_run = 0.0
        plate_seen_at: dict[str, float] = {}
        recent: deque = deque(maxlen=self._VOTE_WINDOW)

        while self.running:
            now = time.monotonic()
            if now - last_run >= settings.capture_interval:
                last_run = now
                frame = self.current_frame
                if frame is not None:
                    try:
                        plate, conf, bbox = detect_plate(frame)
                    except Exception as exc:
                        logger.error("detect_plate error: %s", exc)
                        time.sleep(0.5)
                        continue

                    # C: filtrar por confianza mínima
                    if plate and conf >= settings.min_confidence:
                        recent.append(plate)
                        logger.debug("Voto: %s (conf=%.2f)", plate, conf)
                    else:
                        recent.append(None)

                    # A: votación — confirmar solo si hay consenso
                    votes = Counter(p for p in recent if p is not None)
                    if votes:
                        winner, count = votes.most_common(1)[0]
                        if count >= self._MIN_VOTES:
                            last_seen = plate_seen_at.get(winner, 0.0)
                            if now - last_seen >= self._PLATE_COOLDOWN:
                                plate_seen_at[winner] = now
                                recent.clear()
                                logger.info(">>> PLACA CONFIRMADA: %s (%d/%d votos) <<<",
                                            winner, count, self._VOTE_WINDOW)
                                asyncio.run_coroutine_threadsafe(
                                    self._on_plate_detected(winner, conf, bbox), loop
                                )
            time.sleep(0.1)
        logger.info("Hilo de detección detenido")

    async def _on_plate_detected(self, plate: str, conf: float, bbox) -> None:
        detection = {
            "plate": plate,
            "confidence": conf,
            "bbox": bbox,
            "timestamp": datetime.datetime.utcnow().isoformat(),
        }
        self.last_detection = detection
        await manager.broadcast({
            "event": "plate_detected",
            "plate": plate,
            "confidence": conf,
            "timestamp": detection["timestamp"],
        })
        await handle_plate_detected(plate)

    # ------------------------------------------------------------------ #
    # Async lifecycle                                                      #
    # ------------------------------------------------------------------ #

    async def start_capture(self) -> None:
        self.running = True
        ok = self._init_capture()
        if not ok:
            logger.warning("Cámara no disponible — sistema en modo limitado")

        loop = asyncio.get_running_loop()

        if self._demo_mode:
            try:
                while self.running:
                    await self._run_demo_detection()
                    await asyncio.sleep(settings.capture_interval)
            except asyncio.CancelledError:
                pass
            finally:
                self.stop()
            return

        self._capture_thread = threading.Thread(
            target=self._capture_loop, daemon=True, name="camera-capture"
        )
        self._capture_thread.start()

        self._detection_thread = threading.Thread(
            target=self._detection_loop, args=(loop,), daemon=True, name="camera-detection"
        )
        self._detection_thread.start()

        try:
            while self.running:
                await asyncio.sleep(1.0)
        except asyncio.CancelledError:
            pass
        finally:
            self.stop()
            logger.info("Cámara detenida correctamente")

    # ------------------------------------------------------------------ #
    # Demo detection                                                       #
    # ------------------------------------------------------------------ #

    async def _run_demo_detection(self) -> None:
        plate = random.choice(_DEMO_PLATES)
        detection = {
            "plate": plate,
            "confidence": round(random.uniform(0.88, 0.99), 2),
            "bbox": (220, 330, 200, 48),
            "timestamp": datetime.datetime.utcnow().isoformat(),
        }
        self.last_detection = detection
        await manager.broadcast({
            "event": "plate_detected",
            "plate": plate,
            "confidence": detection["confidence"],
            "timestamp": detection["timestamp"],
        })
        await handle_plate_detected(plate)

    # ------------------------------------------------------------------ #
    # Stop                                                                 #
    # ------------------------------------------------------------------ #

    def reconfigure(self, source: str, user: str = "", password: str = "") -> None:
        """Reconecta la cámara con nueva URL/credenciales sin detener la detección.

        settings.camera_source/user/pass ya vienen actualizados por el caller
        (ver routers/settings.py), así que delegamos en _init_capture() para
        cubrir todas las fuentes soportadas (MJPEG, RTSP/device vía OpenCV,
        imagen estática, demo) con la misma lógica que el arranque inicial.
        """
        logger.info("Reconfigurando cámara → %s", source)
        if self._mjpeg:
            self._mjpeg.release()
            self._mjpeg = None
        if self.cap:
            self.cap.release()
            self.cap = None
        self._demo_mode = False
        self._image_file = None
        ok = self._init_capture()
        logger.info("Cámara reconectada: %s", "OK" if ok else "FALLO")

    def stop(self) -> None:
        self.running = False
        if self._capture_thread and self._capture_thread.is_alive():
            self._capture_thread.join(timeout=3.0)
        if hasattr(self, '_detection_thread') and self._detection_thread and self._detection_thread.is_alive():
            self._detection_thread.join(timeout=3.0)
        if self.cap:
            self.cap.release()
        if self._mjpeg:
            self._mjpeg.release()


camera_manager = CameraManager()
