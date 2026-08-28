<#
.SYNOPSIS
    Instalador automatico del Sistema de Parqueo (LPR) para la PC fisica del local.

.DESCRIPTION
    Pensado para correrse UNA sola vez en una PC Windows 10/11 nueva, con minima
    intervencion manual. Deja el sistema clonado, instalado, configurado con .env
    y con dos tareas programadas: arranque automatico al bootear Windows y backup
    diario de la base de datos.

    Es idempotente: se puede volver a correr sin romper una instalacion existente
    (hace git pull en vez de clonar de nuevo, no pisa un .env ya creado, y
    reemplaza las tareas programadas si ya existian en vez de duplicarlas).

.PARAMETER InstallPath
    Carpeta destino donde se clona/actualiza el repositorio. Default: C:\Parqueo

.EXAMPLE
    .\deploy-pc.ps1
    .\deploy-pc.ps1 -InstallPath "D:\Sistemas\Parqueo"
#>

param(
    [string]$InstallPath = "C:\Parqueo"
)

# ── Configuracion editable ───────────────────────────────────────────────
$RepoUrl         = "https://github.com/LoloZaaFernandez/Parking-Project.git"
$RepoBranch      = "main"
$BackupHour      = 4              # hora del dia (0-23) para el backup diario, horario de baja demanda
$StartupTaskName = "ParkingSystemStartup"
$BackupTaskName  = "ParkingSystemBackup"

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [ERROR] $msg" -ForegroundColor Red }

try {

# ── 1. Verificar que corre como Administrador ───────────────────────────
# Hace falta para poder registrar las tareas programadas (Register-ScheduledTask).
Write-Step "1/8 Verificando permisos de Administrador"
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Err "Este script necesita permisos de Administrador."
    Write-Host "Cerra esta ventana, abri PowerShell con 'Ejecutar como administrador' y corre el script de nuevo." -ForegroundColor Yellow
    exit 1
}
Write-Ok "Corriendo como Administrador."

# ── 2. Prerequisitos: git, python, node ──────────────────────────────────
Write-Step "2/8 Verificando prerequisitos (git, python, node.js)"

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Err "winget no esta disponible en esta PC (hace falta Windows 10 2004+ o Windows 11)."
    Write-Host "Instala manualmente:"
    Write-Host "  - Git:      https://git-scm.com/download/win"
    Write-Host "  - Python:   https://www.python.org/downloads/  (3.11 o superior)"
    Write-Host "  - Node.js:  https://nodejs.org/  (version LTS)"
    Write-Host "Despues volve a correr este script."
    exit 1
}

function Update-SessionPath {
    # winget instala en PATH de Machine/User pero esta sesion de PowerShell no se entera sola;
    # refrescamos el PATH actual para poder usar git/python/node sin reabrir la terminal.
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user    = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Install-Prerequisite {
    param([string]$Name, [string]$Command, [string]$WingetId)

    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        Write-Ok "$Name ya esta instalado."
        return
    }
    Write-Host "  Instalando $Name via winget (id: $WingetId)..."
    winget install --id $WingetId -e --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Err "No se pudo instalar $Name automaticamente (winget devolvio codigo $LASTEXITCODE)."
        Write-Host "Instalalo manualmente y volve a correr el script." -ForegroundColor Yellow
        exit 1
    }
    Update-SessionPath
    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        Write-Ok "$Name instalado correctamente."
    } else {
        Write-Warn "$Name se instalo pero no se detecta todavia en el PATH de esta sesion."
        Write-Warn "Cerra esta terminal, abri una nueva como Administrador y volve a correr el script para continuar."
        exit 1
    }
}

Install-Prerequisite -Name "Git"     -Command "git"    -WingetId "Git.Git"
Install-Prerequisite -Name "Python"  -Command "python" -WingetId "Python.Python.3.12"
Install-Prerequisite -Name "Node.js" -Command "node"   -WingetId "OpenJS.NodeJS.LTS"

# ── 3. Clonar o actualizar el repo ───────────────────────────────────────
Write-Step "3/8 Obteniendo el codigo del repositorio"

if (Test-Path $InstallPath) {
    if (Test-Path (Join-Path $InstallPath ".git")) {
        Write-Host "  La carpeta ya existe y es un repo git. Actualizando (git pull)..."
        Push-Location $InstallPath
        git pull
        $pullExit = $LASTEXITCODE
        Pop-Location
        if ($pullExit -ne 0) {
            Write-Err "git pull fallo (codigo $pullExit). Revisa el estado del repo en $InstallPath manualmente."
            exit 1
        }
        Write-Ok "Repositorio actualizado."
    } else {
        # No pisamos una carpeta que el usuario pudo haber creado por otro motivo.
        Write-Err "La carpeta '$InstallPath' ya existe pero no es un repositorio git."
        Write-Host "Elegi otra carpeta con -InstallPath, o vacia/renombra esa carpeta manualmente." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "  Clonando repositorio en $InstallPath..."
    git clone --branch $RepoBranch $RepoUrl $InstallPath
    if ($LASTEXITCODE -ne 0) {
        Write-Err "git clone fallo (codigo $LASTEXITCODE)."
        exit 1
    }
    Write-Ok "Repositorio clonado."
}

# ── 4. Instalar dependencias con install.bat ─────────────────────────────
Write-Step "4/8 Instalando dependencias (backend + frontend)"
Write-Host "  Esto puede tardar varios minutos (pip install + npm install + npm run build)..."

Push-Location $InstallPath
# install.bat termina con 'pause' esperando una tecla; le mandamos un Enter por stdin
# para que la instalacion no quede colgada esperando que alguien la toque.
"" | & .\install.bat
$installExit = $LASTEXITCODE
Pop-Location

if ($installExit -ne 0) {
    Write-Err "install.bat termino con errores (codigo $installExit). Revisa el detalle mas arriba."
    exit 1
}
Write-Ok "install.bat completado (venv + dependencias Python + build del frontend)."

# ── 5. Crear backend\.env (solo si no existe) ────────────────────────────
Write-Step "5/8 Configurando backend\.env"

$envPath        = Join-Path $InstallPath "backend\.env"
$envExamplePath = Join-Path $InstallPath ".env.example"
$envAlreadyExisted = Test-Path $envPath

if ($envAlreadyExisted) {
    # Si ya existe puede tener SECRET_KEY generada, camara configurada, etc. de una corrida
    # anterior del script (es idempotente) -> nunca lo pisamos.
    Write-Warn "backend\.env ya existe. Se deja intacto, se saltea este paso."
} else {
    Write-Host "  Enter sin escribir nada = usar el valor por defecto entre [corchetes]."

    $rateInput = Read-Host "  Tarifa por hora en pesos [2.50]"
    if ([string]::IsNullOrWhiteSpace($rateInput)) { $rateInput = "2.50" }

    Write-Host "  Fuente de camara: dejala vacia para configurarla despues desde el panel Settings de la app,"
    Write-Host "  o pega ahora la URL RTSP completa (con usuario:contrasena incluidos si aplica,"
    Write-Host "  ej: rtsp://usuario:clave@192.168.1.10/stream1)."
    $cameraInput = Read-Host "  CAMERA_SOURCE (vacio = configurar despues)"
    # Nada de lo que se tipea aca queda en el script: se escribe directo al .env de esta PC.

    $lines = Get-Content $envExamplePath -Encoding UTF8
    $newLines = foreach ($line in $lines) {
        if ($line -match '^RATE_PER_HOUR=') {
            "RATE_PER_HOUR=$rateInput"
        } elseif ($line -match '^CAMERA_SOURCE=') {
            "CAMERA_SOURCE=$cameraInput"
        } else {
            $line
        }
    }
    Set-Content -Path $envPath -Value $newLines -Encoding UTF8
    Write-Ok "backend\.env creado (SECRET_KEY se autogenera sola al primer arranque del backend)."
}

# ── 6. Tarea programada: arranque automatico ─────────────────────────────
Write-Step "6/8 Registrando tarea de inicio automatico"

$startBatPath = Join-Path $InstallPath "start.bat"

$startupAction    = New-ScheduledTaskAction -Execute $startBatPath -WorkingDirectory $InstallPath
$startupTrigger   = New-ScheduledTaskTrigger -AtStartup
# Cuenta SYSTEM + LogonType ServiceAccount: arranca haya o no un usuario con sesion iniciada,
# y no requiere guardar ninguna contrasena de Windows en este script ni en el Task Scheduler.
$startupPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$startupSettings  = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew `
    -Priority 4   # prioridad alta razonable sin llegar a Realtime (evita interferir con el resto del sistema)

if (Get-ScheduledTask -TaskName $StartupTaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $StartupTaskName -Confirm:$false
}
Register-ScheduledTask -TaskName $StartupTaskName -Action $startupAction -Trigger $startupTrigger `
    -Principal $startupPrincipal -Settings $startupSettings `
    -Description "Inicia el Sistema de Parqueo al arrancar Windows" | Out-Null

Write-Ok "Tarea '$StartupTaskName' registrada."

# ── 7. Tarea programada: backup diario ───────────────────────────────────
Write-Step "7/8 Registrando tarea de backup diario"

# Se genera un script auxiliar dentro de backend\ en vez de armar el comando inline:
# evita quilombos de escapado de comillas en el Argument de la tarea programada.
$backupScriptPath = Join-Path $InstallPath "backend\backup-db.ps1"
$backupScriptBody = @'
# Generado por deploy-pc.ps1. Backup diario de la base de datos.
# Si parking.db todavia no existe (primera corrida, antes de que arranque la app
# y la cree), no hace nada: no tiene que fallar la tarea programada por esto.
$dbPath = Join-Path $PSScriptRoot "parking.db"
if (-not (Test-Path $dbPath)) { exit 0 }

$backupDir = Join-Path $PSScriptRoot "backups"
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

$dest = Join-Path $backupDir ("parking_{0}.db" -f (Get-Date -Format "yyyyMMdd"))
Copy-Item -Path $dbPath -Destination $dest -Force
'@
Set-Content -Path $backupScriptPath -Value $backupScriptBody -Encoding UTF8

$backupAction    = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$backupScriptPath`""
$backupTrigger   = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours($BackupHour))
$backupPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

if (Get-ScheduledTask -TaskName $BackupTaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $BackupTaskName -Confirm:$false
}
Register-ScheduledTask -TaskName $BackupTaskName -Action $backupAction -Trigger $backupTrigger `
    -Principal $backupPrincipal `
    -Description "Backup diario de backend\parking.db a backend\backups\" | Out-Null

Write-Ok "Tarea '$BackupTaskName' registrada (corre todos los dias a las $($BackupHour):00)."

# ── 8. Resumen final ──────────────────────────────────────────────────────
Write-Step "8/8 Resumen"
Write-Host ""
Write-Host "  INSTALACION COMPLETADA" -ForegroundColor Green
Write-Host "  -------------------------------------------------------------"
Write-Host "  Carpeta de instalacion   : $InstallPath"
Write-Host "  Prerequisitos            : git, python, node.js (verificados/instalados via winget)"
Write-Host "  Backend + frontend       : instalados/actualizados via install.bat"
if ($envAlreadyExisted) {
    Write-Host "  backend\.env             : YA EXISTIA -> no se toco"
} else {
    Write-Host "  backend\.env             : creado ahora (RATE_PER_HOUR y CAMERA_SOURCE segun lo ingresado)"
}
Write-Host "  Tarea de inicio          : $StartupTaskName -> corre start.bat al bootear Windows (con o sin sesion iniciada)"
Write-Host "  Tarea de backup diario   : $BackupTaskName -> copia backend\parking.db a backend\backups\ todos los dias a las $($BackupHour):00"
Write-Host ""
Write-Host "  PENDIENTE A MANO:" -ForegroundColor Yellow
Write-Host "   [ ] Instalar el driver de la impresora termica"
Write-Host "   [ ] Si no cargaste la camara en el paso 5, configurarla desde el panel Settings de la app"
Write-Host "   [ ] Iniciar sesion con admin / admin123 y cambiar la contrasena desde 'Mi cuenta'"
Write-Host "   [ ] Probar el flujo completo: entrada, deteccion de patente, cobro, salida e impresion de ticket"
Write-Host ""
Write-Host "  Podes reiniciar la PC para probar el arranque automatico, o correr start.bat manualmente para probar ya."
Write-Host ""

} catch {
    Write-Err "Fallo inesperado: $($_.Exception.Message)"
    Write-Host $_.ScriptStackTrace
    exit 1
}
