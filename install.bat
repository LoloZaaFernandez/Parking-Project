@echo off
title Instalacion - Sistema de Parqueo
cd /d "%~dp0"

echo.
echo ============================================
echo   INSTALACION - SISTEMA DE PARQUEO
echo ============================================
echo.

REM ── 1. Entorno virtual Python ────────────────
echo [1/3] Configurando entorno Python...
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
echo [2/3] Construyendo interfaz...
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
echo ============================================
echo   INSTALACION COMPLETADA
echo ============================================
echo.
echo Para iniciar el sistema usa: start.bat
echo.
pause
