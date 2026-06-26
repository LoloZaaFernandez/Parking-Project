@echo off
title Sistema de Parqueo
cd /d "%~dp0backend"

if not exist venv (
    echo ERROR: No se encontro el entorno virtual.
    echo Ejecuta install.bat primero.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo Iniciando Sistema de Parqueo...
echo Accede desde: http://localhost:8000
echo Para cerrar el sistema presiona Ctrl+C
echo.

REM Abrir el browser despues de 3 segundos
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8000"

uvicorn main:app --host 0.0.0.0 --port 8000
