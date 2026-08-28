@echo off
setlocal EnableDelayedExpansion
title Sistema de Parqueo
cd /d "%~dp0backend"

REM ── Requisitos duros: si falta algo de esto, no arranca ──

set "VC_MISSING="
if not exist "%WINDIR%\System32\vcruntime140.dll" set "VC_MISSING=1"
if not exist "%WINDIR%\System32\vcruntime140_1.dll" set "VC_MISSING=1"

if defined VC_MISSING (
    set "VC_WINGET_OK="
    where winget >nul 2>nul
    if not errorlevel 1 set "VC_WINGET_OK=1"

    if defined VC_WINGET_OK (
        echo.
        echo No se encontro el Visual C++ Redistributable. Intentando instalar automaticamente con winget...
        winget install --id Microsoft.VCRedist.2015+.x64 -e --source winget --accept-package-agreements --accept-source-agreements
        if errorlevel 1 set "VC_WINGET_OK="
    )

    set "VC_STILL_MISSING=1"
    if defined VC_WINGET_OK (
        call :RefreshPath
        if exist "%WINDIR%\System32\vcruntime140.dll" if exist "%WINDIR%\System32\vcruntime140_1.dll" set "VC_STILL_MISSING="
    )

    if defined VC_STILL_MISSING (
        if defined VC_WINGET_OK (
            echo.
            echo El Visual C++ Redistributable se instalo, pero esta sesion de la
            echo terminal no lo detecta todavia. Cerra esta ventana, abri una
            echo terminal nueva y volve a correr start.bat.
            pause
            exit /b 1
        ) else (
            echo.
            echo ERROR: Falta el Visual C++ Redistributable ^(x64^) 2015-2022.
            echo Es una pieza del sistema que necesitan las librerias de deteccion
            echo de placas ^(camara/OCR^) para poder funcionar.
            echo Descargalo e instalalo desde:
            echo   https://aka.ms/vs/17/release/vc_redist.x64.exe
            pause
            exit /b 1
        )
    ) else (
        echo Visual C++ Redistributable instalado correctamente.
    )
)

if not exist .env (
    echo.
    echo ERROR: No se encontro backend\.env.
    echo Copia backend\.env.example a backend\.env y completa la configuracion
    echo antes de arrancar el sistema.
    pause
    exit /b 1
)

if not exist venv (
    echo ERROR: No se encontro el entorno virtual.
    echo Ejecuta install.bat primero.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

REM ── Chequeos informativos: nunca frenan el arranque ──
echo.
echo ============================================
echo   VERIFICACIONES INFORMATIVAS
echo ============================================

echo.
echo Impresoras instaladas en Windows ^(confirma si la tuya aparece^):
powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name" 2>nul
if errorlevel 1 echo   No se pudo listar impresoras.

REM Leer CAMERA_SOURCE desde .env (si existe la clave, toma todo lo que sigue
REM al primer "=" de esa linea; si la linea es "CAMERA_SOURCE=" sin nada mas,
REM queda vacia). NOTA: el script usa EnableDelayedExpansion (ver mas abajo),
REM asi que si la URL de la camara tiene un caracter "!" en el medio (ej. en
REM la contrasena), esa parte puede perderse al leerla o parsearla. Es un
REM caso raro y el efecto es solo que no se pinguea la camara (no bloquea
REM el arranque de ninguna forma).
set "CAMERA_SOURCE="
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /i "%%A"=="CAMERA_SOURCE" set "CAMERA_SOURCE=%%B"
)

echo.
if not defined CAMERA_SOURCE (
    echo Camara no configurada todavia ^(se configura desde el panel de Settings^).
) else (
    REM Heuristica simple para extraer el host de la URL de la camara.
    REM Asume el formato esquema://[usuario:contrasena@]HOST[:PUERTO][/resto]
    REM Ej: rtsp://user:pass@192.168.1.10:554/stream1  ->  host = 192.168.1.10
    REM Si la URL no tiene ese formato, simplemente no se pinguea (no bloquea
    REM el arranque). Ajustar aca si en el futuro se soportan otros formatos.
    REM NOTA: se usa "!variable!" (expansion diferida) en vez de "%variable%"
    REM porque estas variables se asignan y se leen dentro del mismo bloque
    REM if/else; con %variable% clasico, cmd.exe expande todo el bloque una
    REM sola vez al parsearlo y siempre veria el valor vacio (bug clasico de
    REM batch). Por el mismo motivo, si la contrasena de la camara contiene
    REM el caracter "!" el parseo puede fallar (se degrada a "no se pinguea").
    set "CAM_URL=!CAMERA_SOURCE!"
    set "CAM_IS_URL="
    if /i "!CAM_URL:~0,7!"=="rtsp://" set "CAM_IS_URL=1"
    if /i "!CAM_URL:~0,7!"=="http://" set "CAM_IS_URL=1"

    if not defined CAM_IS_URL (
        echo Camara configurada ^(!CAMERA_SOURCE!^) - formato no reconocido, no se pinguea.
    ) else (
        set "CAM_REST=!CAM_URL:rtsp://=!"
        set "CAM_REST=!CAM_REST:http://=!"

        set "CAM_AFTERAT=!CAM_REST!"
        echo !CAM_REST!| findstr /c:"@" >nul
        if not errorlevel 1 (
            for /f "tokens=1,* delims=@" %%i in ("!CAM_REST!") do set "CAM_AFTERAT=%%j"
        )

        set "CAM_HOSTPORT=!CAM_AFTERAT!"
        for /f "delims=/" %%h in ("!CAM_AFTERAT!") do set "CAM_HOSTPORT=%%h"

        set "CAM_HOST=!CAM_HOSTPORT!"
        for /f "delims=:" %%h in ("!CAM_HOSTPORT!") do set "CAM_HOST=%%h"

        if not defined CAM_HOST (
            echo Camara configurada ^(!CAMERA_SOURCE!^) - no se pudo determinar el host, no se pinguea.
        ) else (
            echo Verificando conectividad con la camara ^(!CAM_HOST!^)...
            ping -n 1 -w 2000 !CAM_HOST! >nul 2>nul
            if errorlevel 1 (
                echo   No respondio ^(puede estar apagada, mal configurada o fuera de red^).
            ) else (
                echo   Camara respondio correctamente.
            )
        )
    )
)

echo ============================================
echo.

echo Iniciando Sistema de Parqueo...
echo Accede desde: http://localhost:8000
echo Para cerrar el sistema presiona Ctrl+C
echo.

REM Abrir el browser despues de 3 segundos
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8000"

uvicorn main:app --host 0.0.0.0 --port 8000

goto :eof

REM :RefreshPath
REM   winget corre en otro proceso: cuando instala algo, actualiza el PATH
REM   en el registro (HKLM y/o HKCU), pero el cmd.exe que esta corriendo
REM   este script ya cargo su PATH al arrancar y no se entera solo. Esta
REM   subrutina relee el PATH desde el registro y lo vuelve a armar en la
REM   sesion actual, para poder detectar el programa recien instalado sin
REM   pedirle al usuario que abra una terminal nueva.
:RefreshPath
set "RP_SYSPATH="
for /f "tokens=2,*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "RP_SYSPATH=%%B"
set "RP_USERPATH="
for /f "tokens=2,*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "RP_USERPATH=%%B"
set "PATH=%RP_SYSPATH%"
if defined RP_USERPATH set "PATH=%PATH%;%RP_USERPATH%"
set "RP_SYSPATH="
set "RP_USERPATH="
exit /b 0
