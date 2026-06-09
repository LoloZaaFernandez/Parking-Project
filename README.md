# Sistema de Parqueo con LPR

Gestión de parqueo con detección automática de placas (License Plate Recognition) usando OpenCV + EasyOCR. Backend en Python/FastAPI, frontend en React/Vite/TailwindCSS.

---

## Instalación en 5 pasos

### Paso 1 — Clonar y configurar variables de entorno

```bash
cp .env.example backend/.env
```

Editar `backend/.env`:

```env
RATE_PER_HOUR=2.50
CAMERA_SOURCE=0        # 0 = webcam, "rtsp://..." para IP cam, "demo" para modo demo
CAPTURE_INTERVAL=3     # segundos entre detecciones automáticas
MIN_CONFIDENCE=0.6     # confianza mínima EasyOCR (0.0 – 1.0)
DATABASE_URL=sqlite:///./parking.db
```

> **Modo demo (sin cámara física):** setear `CAMERA_SOURCE=demo`. El sistema simula detecciones automáticas y genera frames de prueba.

---

### Paso 2 — Instalar dependencias del backend

Requiere Python 3.11+.

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

> **Nota torch:** EasyOCR instala PyTorch como dependencia. En CPU puro (sin GPU NVIDIA) puede tardar varios minutos la primera vez. Para forzar CPU: `pip install torch --index-url https://download.pytorch.org/whl/cpu`
>
> **Nota EasyOCR:** La primera ejecución descarga los modelos de OCR (~100MB). Se necesita conexión a internet.

---

### Paso 3 — Instalar dependencias del frontend

Requiere Node.js 18+.

```bash
cd frontend
npm install
```

---

### Paso 4 — Iniciar el backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API disponible en `http://localhost:8000` · Docs en `http://localhost:8000/docs`

---

### Paso 5 — Iniciar el frontend

```bash
cd frontend
npm run dev
```

Abrir `http://localhost:5173`

---

## Estructura del proyecto

```
parking-system/
├── backend/
│   ├── main.py              # FastAPI app, lifespan, CORS
│   ├── config.py            # Configuración desde .env
│   ├── database.py          # SQLAlchemy + SQLite
│   ├── models.py            # Modelo Ticket
│   ├── ws_manager.py        # WebSocket broadcast manager
│   ├── lpr/
│   │   ├── camera.py        # Captura OpenCV + loop de detección
│   │   ├── detector.py      # EasyOCR con fallback pytesseract
│   │   └── utils.py         # Normalización de placas peruanas
│   ├── routers/
│   │   ├── entry.py         # POST /entry, POST /entry/manual
│   │   ├── exit.py          # POST /exit
│   │   ├── tickets.py       # GET /tickets, /stats, /search
│   │   ├── ws.py            # WebSocket /ws/plates
│   │   └── camera_router.py # GET /camera/stream (MJPEG)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Monitor.jsx  # Feed en vivo + últimas detecciones
│       │   ├── Cashier.jsx  # Caja de cobro + impresión
│       │   └── History.jsx  # Historial paginado con filtros
│       ├── components/
│       │   ├── PlateDisplay.jsx
│       │   ├── TicketCard.jsx
│       │   └── CameraFeed.jsx
│       └── hooks/
│           └── usePlateSocket.js
└── .env.example
```

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/entry/` | Captura frame y registra ingreso |
| POST | `/entry/manual` | Registro manual `{ plate: "ABC-123" }` |
| POST | `/exit/` | Cobra y cierra ticket `{ plate: "ABC-123" }` |
| GET | `/tickets/` | Historial paginado con filtros |
| GET | `/tickets/stats` | Estadísticas del día |
| GET | `/tickets/search/{plate}` | Busca ticket abierto por placa |
| GET | `/camera/stream` | MJPEG stream con anotaciones |
| GET | `/camera/status` | Estado de la cámara |
| WS | `/ws/plates` | Stream de detecciones en tiempo real |

## Formato de placas (Perú)

El sistema valida y normaliza los dos formatos estándar:
- **ABC-123** — 3 letras + 3 dígitos (taxis, particulares)
- **AB-1234** — 2 letras + 4 dígitos (motos, anteriores)

Las correcciones automáticas de OCR: `O→0`, `I→1`, `S→5`, `B→8` en la parte numérica.
