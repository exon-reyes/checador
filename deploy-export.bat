@echo off
setlocal enabledelayedexpansion

:: Colores para CMD (usando códigos ANSI)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

:: Configuración
set IMAGE_NAME=checador
set EXPORT_FILE=checador.tar

echo.
echo %BLUE%📦 Exportando imagen Docker para otro equipo...%NC%
echo ==================================

:: Función para manejar errores
goto :main

:handle_error
echo %RED%❌ Error: %~1%NC%
exit /b 1

:check_docker
if not exist "%PROGRAMFILES%\Docker\Docker\Docker Desktop.exe" (
    call :handle_error "Docker Desktop no está instalado"
)
docker info >nul 2>&1
if errorlevel 1 (
    call :handle_error "Docker no está corriendo. Inicia Docker Desktop."
)
goto :eof

:main
:: Verificar Docker
echo %YELLOW%🔍 Verificando Docker...%NC%
call :check_docker

:: Verificar que la imagen existe
echo %YELLOW%🔍 Verificando imagen...%NC%
docker images -q %IMAGE_NAME% | findstr . >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Error: La imagen '%IMAGE_NAME%' no existe.%NC%
    echo %YELLOW%💡 Ejecuta primero: deploy.bat%NC%
    exit /b 1
)
echo %GREEN%✅ Imagen encontrada%NC%

:: Exportar imagen
echo %YELLOW%💾 Exportando imagen...%NC%
docker save -o %EXPORT_FILE% %IMAGE_NAME%
if errorlevel 1 (
    call :handle_error "Falló la exportación de la imagen"
)
echo %GREEN%✅ Imagen exportada exitosamente%NC%

:: Mostrar información del archivo
for %%A in (%EXPORT_FILE%) do set FILE_SIZE=%%~zA
set /a FILE_SIZE_MB=!FILE_SIZE!/1024/1024

echo.
echo %GREEN%🎉 Exportación completada%NC%
echo ==================================
echo %BLUE%📁 Archivo:%NC% %EXPORT_FILE%
echo %BLUE%📏 Tamaño:%NC% !FILE_SIZE_MB! MB
echo %BLUE%📍 Ubicación:%NC% %CD%\%EXPORT_FILE%
echo.

echo %YELLOW%📋 Instrucciones para el equipo destino:%NC%
echo 1. Copiar el archivo %EXPORT_FILE% al equipo destino
echo 2. Ejecutar: deploy-import.bat
echo 3. La aplicación estará disponible en: https://sci.ddns.me:4200
echo.
echo %GREEN%✨ Listo para transferir%NC%

pause