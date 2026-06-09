import asyncio
import datetime
import logging
import random
import time
from typing import Optional

import cv2
import numpy as np

from config import settings
from ws_manager import manager

logger = logging.getLogger(__name__)

_DEMO_PLATES = ["ABC-123", "XYZ-456", "DEF-789", "GHI-012", "JKL-345"]


class CameraManager:
    def __init__(self) -> None:
        self.cap: Optional[cv2.VideoCapture] = None
        self.current_frame: Optional[np.ndarray] = None
        self.last_detection: Optional[dict] = None
        self.running: bool = False
        self._demo_mode: bool = False
        self._image_file: Optional[str] = None  # static image source

    # ------------------------------------------------------------------ #
    # Init                                                                 #
    # ------------------------------------------------------------------ #

    def _init_capture(self) -> bool:
        import os
        source = settings.camera_source
        if source.lower() == "demo":
            self._demo_mode = True
            return True
        # Static image file — reused every capture cycle
        if os.path.isfile(source) and source.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".webp")):
            self._image_file = source
            logger.info("Modo imagen estática: %s", source)
            return True
        try:
            idx = int(source)
            self.cap = cv2.VideoCapture(idx)
        except ValueError:
            self.cap = cv2.VideoCapture(source)
        return self.cap is not None and self.cap.isOpened()

    # ------------------------------------------------------------------ #
    # Frame generation                                                     #
    # ------------------------------------------------------------------ #

    def _make_demo_frame(self, plate: str) -> np.ndarray:
        frame = np.full((480, 640, 3), (55, 55, 55), dtype=np.uint8)
        cv2.line(frame, (0, 390), (640, 390), (180, 180, 180), 2)
        # Car body
        cv2.rectangle(frame, (120, 190), (520, 375), (90, 90, 110), -1)
        cv2.rectangle(frame, (180, 150), (460, 200), (70, 70, 90), -1)
        # Wheels
        cv2.circle(frame, (190, 375), 35, (30, 30, 30), -1)
        cv2.circle(frame, (450, 375), 35, (30, 30, 30), -1)
        # License plate (yellow background)
        cv2.rectangle(frame, (220, 330), (420, 378), (0, 215, 255), -1)
        cv2.rectangle(frame, (220, 330), (420, 378), (0, 0, 0), 2)
        cv2.putText(frame, plate, (230, 368), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 0, 0), 2, cv2.LINE_AA)
        # Overlay
        cv2.putText(frame, "MODO DEMO", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 230, 230), 2)
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        cv2.putText(frame, ts, (10, 465), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)
        return frame

    def read_frame(self) -> Optional[np.ndarray]:
        if self._demo_mode:
            plate = getattr(self, "_current_demo_plate", "ABC-123")
            return self._make_demo_frame(plate)
        if self._image_file:
            frame = cv2.imread(self._image_file)
            if frame is None:
                logger.error("No se pudo leer la imagen: %s", self._image_file)
            return frame
        if self.cap is None or not self.cap.isOpened():
            return None
        ret, frame = self.cap.read()
        return frame if ret else None

    def get_annotated_frame(self) -> np.ndarray:
        frame = self.read_frame()
        if frame is None:
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(frame, "Sin señal de cámara", (140, 240),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (128, 128, 128), 2)
            return frame

        self.current_frame = frame.copy()

        if self.last_detection:
            bbox = self.last_detection.get("bbox")
            plate = self.last_detection.get("plate")
            if bbox and not self._demo_mode:
                x, y, w, h = bbox
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            if plate:
                cv2.putText(frame, plate, (10, frame.shape[0] - 12),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2, cv2.LINE_AA)

        return frame

    # ------------------------------------------------------------------ #
    # Background capture loop                                              #
    # ------------------------------------------------------------------ #

    async def start_capture(self) -> None:
        self.running = True
        ok = self._init_capture()
        if not ok:
            logger.warning("Cámara no disponible — sistema en modo limitado")

        last_capture = 0.0

        while self.running:
            now = time.monotonic()
            if now - last_capture >= settings.capture_interval:
                last_capture = now
                if self._demo_mode:
                    await self._run_demo_detection()
                else:
                    await self._run_real_detection()
            await asyncio.sleep(0.05)

    async def _run_demo_detection(self) -> None:
        plate = random.choice(_DEMO_PLATES)
        self._current_demo_plate = plate  # type: ignore[attr-defined]
        frame = self._make_demo_frame(plate)
        self.current_frame = frame
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

    async def _run_real_detection(self) -> None:
        frame = self.read_frame()
        if frame is None:
            return
        self.current_frame = frame
        loop = asyncio.get_running_loop()
        try:
            from lpr.detector import detect_plate  # lazy import — avoids slow startup

            plate, conf, bbox = await loop.run_in_executor(None, detect_plate, frame)
            if plate:
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
        except Exception as exc:
            logger.error("Error en detección: %s", exc)

    def stop(self) -> None:
        self.running = False
        if self.cap:
            self.cap.release()


camera_manager = CameraManager()
