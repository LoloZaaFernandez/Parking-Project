import asyncio

import cv2
import numpy as np
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/camera", tags=["camera"])


async def _mjpeg_generator():
    from lpr.camera import camera_manager

    while True:
        frame = camera_manager.get_annotated_frame()

        ret, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if not ret:
            await asyncio.sleep(0.033)
            continue

        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n")
        await asyncio.sleep(0.033)  # ~30 fps


@router.get("/stream")
async def camera_stream():
    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/status")
def camera_status():
    from lpr.camera import camera_manager

    return {
        "active": camera_manager.running,
        "demo_mode": camera_manager._demo_mode,
        "image_file": camera_manager._image_file,
        "has_frame": camera_manager.current_frame is not None,
        "last_detection": camera_manager.last_detection,
    }
