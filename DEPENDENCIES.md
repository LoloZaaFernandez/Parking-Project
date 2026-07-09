# Dependencias del Sistema de Parqueo

Todo lo que necesita una PC para correr este sistema desde cero. Mientras no esté
empaquetado (ver sección final), esto hay que instalarlo/configurarlo a mano en
cada máquina nueva.

## Sistema operativo

- **Windows 10/11.** No es multiplataforma: `pywin32` (impresión ESC/POS vía
  `Win32Raw`) depende de APIs nativas de Windows y no corre en Linux/macOS.

## Runtimes

| Runtime | Versión mínima | Para qué |
|---|---|---|
| Python | 3.10+ (probado en 3.12) | Backend FastAPI |
| Node.js | 18+ | Compilar el frontend (`npm run build`) — no hace falta en runtime, solo para generar `frontend/dist/` |

## Dependencias Python (`backend/requirements.txt`)

| Paquete | Para qué |
|---|---|
| fastapi | Framework del backend / API |
| uvicorn[standard] | Servidor ASGI que corre FastAPI |
| sqlalchemy | ORM sobre la base SQLite |
| pydantic / pydantic-settings | Validación y carga de `.env` |
| python-dotenv | Carga de variables de entorno |
| opencv-python-headless | Captura y decodificación de video (RTSP/MJPEG) |
| numpy | Manipulación de frames |
| python-multipart | Parseo de formularios/uploads en FastAPI |
| websockets | Notificaciones en tiempo real al frontend |
| Pillow | Procesamiento de imágenes |
| python-jose[cryptography] | JWT para autenticación |
| bcrypt | Hash de contraseñas |
| fast-alpr | Motor de detección de placas (YOLOv9 + MobileViT OCR) |
| onnxruntime | Runtime de inferencia para los modelos de fast-alpr |
| python-escpos | Comandos ESC/POS para la impresora térmica |
| pywin32 | Acceso al spooler de impresión de Windows (`Win32Raw`) |

## Dependencias frontend (`frontend/package.json`)

React 18, Vite 5, TailwindCSS 3. Sin dependencias runtime pesadas — el build final
es HTML/CSS/JS estático servido directamente por FastAPI.

## Descargas automáticas en el primer arranque (⚠️ requiere internet una vez)

`fast-alpr` descarga sus modelos ONNX la primera vez que se importa, no están
en el repo:

| Modelo | Ubicación | Tamaño |
|---|---|---|
| `yolo-v9-t-384-license-plate-end2end` | `~/.cache/open-image-models/` | ~7.5 MB |
| `global-plates-mobile-vit-v2-model` | `~/.cache/fast-plate-ocr/` | ~4.8 MB |

**Si la PC no tiene internet en ese primer arranque, la detección de placas
queda deshabilitada silenciosamente** (no tira error visible, solo deja de
detectar). Ver sección de empaquetado para cómo evitarlo.

## Hardware

### Cámara
- IP con **RTSP** (estándar ONVIF) o **MJPEG sobre HTTP**
- Debe estar en la misma red/subred que la PC, puerto 554 (RTSP) accesible sin
  firewall de por medio
- IP fija o reserva DHCP — si la cámara cambia de IP, se corta la detección

### Impresora
- Térmica ESC/POS por USB (validado con Epson TM-T20II)
- Requiere el **driver instalado en Windows** y aparecer en
  "Dispositivos e impresoras" — el sistema le manda los comandos por su
  nombre exacto de Windows, configurable desde el panel de Settings

## Configuración por máquina (no viaja con el repo — está en `.gitignore`)

| Archivo | Contenido |
|---|---|
| `backend/.env` | `CAMERA_SOURCE`, `RATE_PER_HOUR`, `CAPTURE_INTERVAL`, `MIN_CONFIDENCE`, `PRINTER_NAME` |
| `backend/settings.json` | Overrides guardados desde el panel de admin (se genera solo) |
| `backend/parking.db` | Base SQLite (se crea sola al arrancar, usuario admin por defecto `admin/admin123`) |

## Red

- Backend sirve todo (API + frontend compilado) en el puerto **8000**
- Si otras PCs de la garita necesitan acceder (ej. una tablet de caja), hay que
  permitir el puerto 8000 en el firewall de Windows de la PC que corre el backend

---

## Por qué esto NO alcanza para "solo cambiar la IP de la cámara"

Hoy, llevar el sistema a otra PC significa repetir todo lo de arriba a mano.
Para que de verdad sea "instalás y configurás la cámara", falta empaquetarlo
— ver el plan de PyInstaller + Inno Setup que dejamos definido en esta misma
conversación.
