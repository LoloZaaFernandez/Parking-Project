# Sistema de Parqueo con LPR

Gestión de parqueo con detección automática de placas (License Plate Recognition) usando **fast-alpr** (YOLOv9 para detección + MobileViT OCR, ambos corriendo vía ONNX Runtime). Backend en Python/FastAPI con autenticación por roles (admin/cajero) e impresión de tickets ESC/POS, frontend en React/Vite/TailwindCSS. Pensado para correr en una sola PC Windows del local, con cámara IP (RTSP o MJPEG) apuntando a la entrada.

> Para el detalle de requisitos de hardware/software (cámara, impresora, versiones exactas, modelos descargados en el primer arranque) ver [`DEPENDENCIES.md`](./DEPENDENCIES.md).

---

## Instalación en 5 pasos

### Paso 1 — Clonar y configurar variables de entorno

```bash
cp .env.example backend/.env
```

Editar `backend/.env`:

```env
RATE_PER_HOUR=2.50
CAMERA_SOURCE=rtsp://usuario:pass@192.168.1.50:554/stream   # o "0" para webcam, "demo" para modo demo
CAMERA_USER=
CAMERA_PASS=
CAPTURE_INTERVAL=2     # segundos entre detecciones automáticas
MIN_CONFIDENCE=0.45    # confianza mínima de fast-alpr (0.0 – 1.0)
DATABASE_URL=sqlite:///./parking.db
PRINTER_NAME=          # nombre exacto de la impresora en "Dispositivos e impresoras" de Windows
```

> **Cámara IP (caso principal):** `CAMERA_SOURCE` acepta una URL RTSP (usada directamente por OpenCV) o una URL MJPEG sobre HTTP (`http://...`). También soporta `CAMERA_USER`/`CAMERA_PASS` para autenticación básica en el stream MJPEG. Todo esto también se puede reconfigurar en caliente desde el panel de administración (**Configuración**) sin reiniciar el backend.
>
> **Modo demo (sin cámara física):** setear `CAMERA_SOURCE=demo`. El sistema simula detecciones automáticas para probar el flujo completo sin hardware.

---

### Paso 2 — Instalar dependencias del backend

Requiere Python 3.10+ y **Windows** (la impresión ESC/POS usa `pywin32`/`Win32Raw`, que no corre en Linux/macOS).

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

> **Nota fast-alpr:** la primera ejecución descarga los modelos ONNX (detector YOLOv9 + OCR MobileViT, ~12MB en total) a la caché del usuario. Se necesita conexión a internet una vez; si no la hay, la detección de placas queda deshabilitada silenciosamente (ver `DEPENDENCIES.md`).
>
> **Nota impresora:** requiere el driver de la impresora térmica instalado en Windows y visible en "Dispositivos e impresoras". El nombre exacto se configura en `PRINTER_NAME` o desde el panel de Configuración.

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

Abrir `http://localhost:5173`. Al primer arranque del backend se crea automáticamente un usuario administrador (`admin` / `admin123`) si no hay ningún usuario en la base — cambiar la contraseña desde **Mi cuenta** apenas se entra.

---

## Estructura del proyecto

```
parking-system/
├── backend/
│   ├── main.py               # FastAPI app, lifespan, CORS, registro de routers
│   ├── config.py             # Configuración desde .env (pydantic-settings)
│   ├── database.py           # SQLAlchemy + SQLite
│   ├── models.py             # Modelos Ticket, User, Abonado
│   ├── dependencies.py       # JWT, hash de contraseñas, require_admin/get_current_user
│   ├── auto_ticket.py        # Lógica de entrada/salida automática al detectar placa
│   ├── waiting_manager.py    # Monitorea tickets en estado 'waiting' (período de gracia)
│   ├── ticket_printer.py     # Impresión ESC/POS (python-escpos + pywin32)
│   ├── ws_manager.py         # WebSocket broadcast manager
│   ├── lpr/
│   │   ├── camera.py         # Captura (RTSP/MJPEG/webcam/demo) + loop de detección
│   │   ├── detector.py       # fast-alpr (YOLOv9 + MobileViT OCR vía ONNX Runtime)
│   │   └── utils.py          # Normalización de placas peruanas
│   ├── routers/
│   │   ├── entry.py          # POST /entry, POST /entry/manual
│   │   ├── exit.py           # POST /exit, POST /exit/confirm
│   │   ├── tickets.py        # GET /tickets, /stats, /search, /status
│   │   ├── ws.py             # WebSocket /ws/plates
│   │   ├── camera_router.py  # GET /camera/status, /camera/frame.jpg
│   │   ├── auth.py           # POST /auth/login, GET /auth/me, /auth/change-password
│   │   ├── abonados.py       # CRUD de abonados (mensualidades)
│   │   ├── reports.py        # GET /reports/monthly (solo admin)
│   │   └── settings.py       # GET/PUT /settings, /settings/test-print (solo admin)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx           # Navegación por tabs según rol (admin/cajero)
│       ├── api.js            # Fetch helper con JWT
│       ├── context/
│       │   └── AuthContext.jsx  # Sesión, login/logout, token en localStorage
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Monitor.jsx   # Feed en vivo + últimas detecciones
│       │   ├── Cashier.jsx   # Caja de cobro + impresión
│       │   ├── History.jsx   # Historial paginado con filtros
│       │   ├── Account.jsx   # Cambio de contraseña
│       │   └── admin/
│       │       ├── Abonados.jsx  # Gestión de vehículos con mensualidad
│       │       ├── Reports.jsx   # Reportes mensuales
│       │       └── Settings.jsx  # Tarifa, cámara e impresora
│       ├── components/
│       │   ├── PlateDisplay.jsx
│       │   └── TicketCard.jsx
│       └── hooks/
│           └── usePlateSocket.js
└── .env.example
```

## Flujo del sistema

Ciclo de vida completo de un ticket, desde que el auto entra hasta que sale y se libera el lugar.

### 1. Detección automática de placa

`CameraManager._detection_loop` (`backend/lpr/camera.py`) corre en un hilo dedicado y ejecuta `fast-alpr` sobre el frame actual cada `CAPTURE_INTERVAL` segundos (constante `settings.capture_interval`). Para evitar falsos positivos por ruido del OCR, no confirma una placa apenas la lee una vez: acumula las últimas `_VOTE_WINDOW = 5` lecturas en una ventana deslizante y recién la da por confirmada cuando la misma placa aparece en al menos `_MIN_VOTES = 3` de esas 5 lecturas. Además hay un cooldown interno de `_PLATE_COOLDOWN = 10` segundos para no re-confirmar la misma placa en detecciones consecutivas. Una vez confirmada, se llama a `handle_plate_detected(plate)` en `backend/auto_ticket.py`.

### 2. `auto_ticket.handle_plate_detected(plate)` decide la acción

Según el estado actual de esa placa en la base:

- **En cooldown de salida** (60 segundos tras una salida confirmada, constante `_COOLDOWN_SECONDS = 60`) → se ignora la detección, para evitar que la cámara vuelva a "ver" el auto saliendo y genere una re-entrada fantasma.
- **Tiene un ticket en estado `waiting`** (ya pagó en caja, está esperando salir físicamente) → se confirma la salida: `status='exited'`, `exit_time=ahora`, se activa el cooldown de 60s y se notifica por WebSocket (`exit_confirmed`).
- **Ya tiene un ticket `open` o `abono`** (ya está adentro) → no hace nada (acción `already_inside`).
- **No tiene ticket activo** → se auto-registra la entrada: se chequea si la placa pertenece a un abonado activo (tarifa $0, `status='abono'`) o no (tarifa `settings.rate_per_hour`, `status='open'`), se crea el `Ticket`, se imprime el ticket de entrada en la térmica en segundo plano (`print_entry_ticket`, vía `asyncio.to_thread` — no bloquea el hilo de detección) y se notifica por WebSocket (`auto_entry`).

### 3. Entrada manual (sin cámara)

`POST /entry/manual` (`backend/routers/entry.py`) permite tipear la placa a mano cuando no hay cámara disponible o el OCR falla. Usa la misma lógica de creación de ticket (`_create_ticket`) que el flujo automático, solo que sin pasar por la detección de la cámara.

### 4. Cobro en caja

`POST /exit/` (`backend/routers/exit.py`, función `register_exit`):

- **Abonado** (`status='abono'`) → sale gratis e inmediato: `status='exited'` directo, sin período de espera.
- **Ticket normal** → calcula el monto (horas transcurridas redondeadas hacia arriba con `math.ceil`, multiplicadas por `rate_per_hour`), pero **no cierra el ticket todavía**: pasa a `status='waiting'` con `paid_at=ahora`. El vehículo ya pagó pero sigue "adentro" en el sistema hasta que la cámara confirme que salió físicamente.

### 5. Confirmación de salida física

Dos caminos posibles:

- **Automático**: la cámara vuelve a detectar la placa al pasar por la salida — mismo mecanismo del punto 2 (`handle_plate_detected`).
- **Manual**: `POST /exit/confirm` (`backend/routers/exit.py`, función `confirm_exit_manual`), para cuando la cámara no llega a captar la salida.

### 6. Período de gracia

`watch_waiting_tickets()` (`backend/waiting_manager.py`) corre en background cada 30 segundos. Si un ticket en `waiting` lleva más de `GRACE_PERIOD_MINUTES = 15` minutos desde `paid_at` sin que la cámara confirme la salida, el ticket **vuelve a `open`**: se borran `amount` y `paid_at`, como si no hubiera pagado. Esto evita que un pago quede "reservado" indefinidamente si el vehículo tarda mucho en salir del predio.

---

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/entry/` | Captura frame y registra ingreso |
| POST | `/entry/manual` | Registro manual `{ plate: "ABC-123" }` |
| POST | `/exit/` | Cobra y marca ticket en espera de salida física `{ plate: "ABC-123" }` |
| POST | `/exit/confirm` | Confirma salida manual de un ticket en estado 'waiting' |
| GET | `/tickets/` | Historial paginado con filtros |
| GET | `/tickets/stats` | Estadísticas del día |
| GET | `/tickets/search/{plate}` | Busca ticket abierto por placa |
| GET | `/tickets/status/{plate}` | Ticket activo más reciente de una placa (open/abono/waiting) |
| GET | `/camera/status` | Estado de la cámara (activa, último frame, última detección) |
| GET | `/camera/frame.jpg` | Frame actual como JPEG (debug) |
| WS | `/ws/plates` | Stream de detecciones en tiempo real |
| POST | `/auth/login` | Login, devuelve JWT (form data `username`/`password`) |
| GET | `/auth/me` | Datos del usuario autenticado |
| POST | `/auth/change-password` | Cambia la contraseña del usuario autenticado |
| GET/POST/PUT/DELETE | `/abonados/` | CRUD de abonados (solo admin) |
| GET | `/abonados/check/{plate}` | Verifica si una placa es abonado activo |
| GET | `/reports/monthly` | Resumen de ingresos/vehículos por mes (solo admin) |
| GET | `/reports/monthly/{year}/{month}` | Detalle paginado de tickets del mes (solo admin) |
| GET | `/settings/` | Configuración actual: tarifa, cámara, impresora (solo admin) |
| PUT | `/settings/` | Actualiza tarifa/cámara/impresora, persiste en `settings.json` (solo admin) |
| POST | `/settings/test-print` | Imprime un ticket de prueba (solo admin) |

## Formato de placas (Perú)

El sistema valida y normaliza los dos formatos estándar:
- **ABC-123** — 3 letras + 3 dígitos (taxis, particulares)
- **AB-1234** — 2 letras + 4 dígitos (motos, anteriores)

Las correcciones automáticas de OCR: `O→0`, `I→1`, `S→5`, `B→8` en la parte numérica.
