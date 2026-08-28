@echo off
title Instalacion - Sistema de Parqueo
cd /d "%~dp0"

echo.
echo ============================================
echo   INSTALACION - SISTEMA DE PARQUEO
echo ============================================
echo.

REM ── 0. Requisitos del sistema ─────────────────
echo [1/4] Verificando requisitos del sistema...

where python >nul 2>nul
if errorlevel 1 (
    call :CheckOrInstall "Python" python Python.Python.3.12
    if errorlevel 2 (
        pause
        exit /b 1
    )
    if errorlevel 1 (
        echo.
        echo ERROR: No se encontro Python en el sistema.
        echo Instalalo desde https://www.python.org/downloads/ ^(version 3.11 o superior^)
        echo marcando la opcion "Add python.exe to PATH" durante la instalacion.
        echo Despues volve a correr install.bat.
        pause
        exit /b 1
    )
)

where node >nul 2>nul
if errorlevel 1 (
    call :CheckOrInstall "Node.js" node OpenJS.NodeJS.LTS
    if errorlevel 2 (
        pause
        exit /b 1
    )
    if errorlevel 1 (
        echo.
        echo ERROR: No se encontro Node.js en el sistema.
        echo Instalalo desde https://nodejs.org/ ^(version LTS, 18 o superior^).
        echo Despues volve a correr install.bat.
        pause
        exit /b 1
    )
)

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
            echo terminal nueva y volve a correr install.bat.
            pause
            exit /b 1
        ) else (
            echo.
            echo ERROR: Falta el Visual C++ Redistributable ^(x64^) 2015-2022.
            echo Es una pieza del sistema que necesitan las librerias de deteccion
            echo de placas ^(camara/OCR^) para poder funcionar.
            echo Descargalo e instalalo desde:
            echo   https://aka.ms/vs/17/release/vc_redist.x64.exe
            echo Despues volve a correr install.bat.
            pause
            exit /b 1
        )
    ) else (
        echo Visual C++ Redistributable instalado correctamente.
    )
)

echo Requisitos del sistema OK.
echo.

REM ── 1. Entorno virtual Python ────────────────
echo [2/4] Configurando entorno Python...
cd backend
if not exist venv (
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: No se pudo crear el entorno virtual.
        echo Asegurate de tener Python 3.10+ instalado.
        pause
        exit /b 1
    )
)
call venv\Scripts\activate.bat
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias Python.
    pause
    exit /b 1
)
cd ..

REM ── 2. Dependencias y build del frontend ─────
echo.
echo [3/4] Construyendo interfaz...
cd frontend
call npm install
if errorlevel 1 (
    echo ERROR: Fallo npm install.
    echo Asegurate de tener Node.js instalado.
    pause
    exit /b 1
)
call npm run build
if errorlevel 1 (
    echo ERROR: Fallo el build del frontend.
    pause
    exit /b 1
)
cd ..

REM ── 3. Listo ──────────────────────────────────
echo.
echo [4/4] Instalacion completada.
echo ============================================
echo   INSTALACION COMPLETADA
echo ============================================
echo.
echo Para iniciar el sistema usa: start.bat
echo.
pause

goto :eof

REM ── Subrutinas ────────────────────────────────
REM :CheckOrInstall NOMBRE COMANDO ID_WINGET
REM   Se llama solo cuando ya se detecto que el comando falta.
REM   Devuelve por errorlevel:
REM     0 = se instalo con winget y ya se detecta en esta sesion
REM     1 = no hay winget disponible, o "winget install" fallo
REM         (el llamador debe mostrar el mensaje manual + link)
REM     2 = "winget install" funciono pero esta sesion de cmd.exe
REM         todavia no detecta el comando (falta reiniciar terminal)
:CheckOrInstall
set "CHK_NAME=%~1"
set "CHK_CMD=%~2"
set "CHK_WINGETID=%~3"

where winget >nul 2>nul
if errorlevel 1 exit /b 1

echo.
echo No se encontro %CHK_NAME%. Intentando instalar automaticamente con winget...
winget install --id %CHK_WINGETID% -e --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 exit /b 1

call :RefreshPath

where %CHK_CMD% >nul 2>nul
if errorlevel 1 (
    echo.
    echo %CHK_NAME% se instalo, pero esta sesion de la terminal no lo detecta todavia.
    echo Cerra esta ventana, abri una terminal nueva y volve a correr install.bat.
    exit /b 2
)

echo %CHK_NAME% instalado correctamente.
exit /b 0

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
