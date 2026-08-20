import os

import cv2
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from dependencies import get_current_user
from models import User

router = APIRouter(prefix="/camera", tags=["camera"])


@router.get("/status")
def camera_status(current_user: User = Depends(get_current_user)):
    from lpr.camera import camera_manager
    return {
        "active": camera_manager.running,
        "has_frame": camera_manager.current_frame is not None,
        "last_detection": camera_manager.last_detection,
        "configured": camera_manager.is_configured,
    }


@router.get("/save-frame")
def save_frame(current_user: User = Depends(get_current_user)):
    """Guarda el frame actual a disco y devuelve metadatos. Solo para debug."""
    from lpr.camera import camera_manager
    frame = camera_manager.current_frame
    if frame is None:
        return {"error": "Sin frame disponible"}
    path = os.path.join(os.path.dirname(__file__), "..", "debug_frame.jpg")
    path = os.path.abspath(path)
    cv2.imwrite(path, frame)
    h, w = frame.shape[:2]
    return {"saved": path, "width": w, "height": h, "channels": frame.shape[2]}


@router.get("/frame.jpg")
def get_frame_jpg(current_user: User = Depends(get_current_user)):
    """Devuelve el frame actual como imagen JPEG. Solo para debug."""
    from lpr.camera import camera_manager
    import tempfile
    frame = camera_manager.current_frame
    if frame is None:
        return {"error": "Sin frame disponible"}
    path = os.path.join(tempfile.gettempdir(), "parking_debug_frame.jpg")
    cv2.imwrite(path, frame)
    return FileResponse(path, media_type="image/jpeg")


@router.get("/detect-now")
def detect_now(current_user: User = Depends(get_current_user)):
    """Corre detección sincrónicamente sobre el frame actual. Solo para debug."""
    from lpr.camera import camera_manager
    from lpr.detector import detect_plate
    frame = camera_manager.current_frame
    if frame is None:
        return {"error": "Sin frame disponible"}
    h, w = frame.shape[:2]
    plate, conf, bbox = detect_plate(frame)
    return {
        "frame_size": {"width": w, "height": h},
        "plate": plate,
        "confidence": round(conf, 4) if conf else None,
        "bbox": bbox,
    }
