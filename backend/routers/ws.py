from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ws_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/plates")
async def ws_plates(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except (WebSocketDisconnect, Exception):
        manager.disconnect(ws)
