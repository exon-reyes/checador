@echo off
setlocal enabledelayedexpansion

:: Colores para CMD (se usan secuencias de escape ANSI)
set "RED=\x1b[91m"
set "GREEN=\x1b[92m"
set "YELLOW=\x1b[93m"
set "BLUE=\x1b[94m"
set "NC=\x1b[0m"

:: Configuración
set CONTAINER_NAME=checador
set IMAGE_NAME=checador
set PORT=4200
set TAR_FILE=checador.tar
set APP_URL=https://sci.ddns.me:4200

echo.
echo %BLUE%🚀 Iniciando despliegue de Checador en Windows 11...%NC%
echo ==================================

:: Saltamos a la función principal para definir las funciones primero
goto :main

:handle_error
echo %RED%❌ Error: %~1%NC%
exit /b 1

:check_docker
echo %YELLOW%🔍 Verificando Docker...%NC%
:: Verificación más robusta: Comprueba si el demonio de Docker está accesible.
docker info >nul 2>&1
if errorlevel 1 (
    call :handle_error "Docker no está corriendo o no es accesible. Asegúrate de que Docker Desktop esté iniciado."
)
echo %GREEN%✅ Docker está corriendo%NC%
goto :eof

:check_tar_file
echo %YELLOW%🔍 Verificando archivo de imagen...%NC%
if not exist "%TAR_FILE%" (
    call :handle_error "No se encontró el archivo %TAR_FILE% en el directorio actual"
)
for %%A in ("%TAR_FILE%") do set FILE_SIZE=%%~zA
set /a FILE_SIZE_MB=!FILE_SIZE!/1024/1024
echo %GREEN%✅ Archivo encontrado: %TAR_FILE% (!FILE_SIZE_MB! MB)%NC%
goto :eof

:load_image
echo %YELLOW%📥 Cargando imagen Docker...%NC%
docker load -i "%TAR_FILE%" >nul
if errorlevel 1 (
    call :handle_error "Falló la carga de la imagen Docker. Asegúrate de que el .tar sea válido y la imagen exista."
)
echo %GREEN%✅ Imagen Docker cargada%NC%
goto :eof

:cleanup_container
echo %YELLOW%🧹 Limpiando contenedor existente...%NC%

:: Detener contenedor si está corriendo
docker ps -q -f name=%CONTAINER_NAME% | findstr . >nul 2>&1
if not errorlevel 1 (
    echo %YELLOW%🛑 Deteniendo contenedor existente '%CONTAINER_NAME%'...%NC%
    docker stop %CONTAINER_NAME% >nul
    if errorlevel 1 (
        echo %RED%⚠️  No se pudo detener el contenedor. Puede que ya esté detenido o haya un problema. Continuando con el intento de remoción.%NC%
    ) else (
        echo %GREEN%✅ Contenedor detenido%NC%
    )
) else (
    echo %BLUE%ℹ️  No hay contenedor '%CONTAINER_NAME%' corriendo%NC%
)

:: Remover contenedor si existe (sin importar si estaba corriendo o no)
docker ps -aq -f name=%CONTAINER_NAME% | findstr . >nul 2>&1
if not errorlevel 1 (
    echo %YELLOW%🗑️ Removiendo contenedor existente '%CONTAINER_NAME%'...%NC%
    docker rm %CONTAINER_NAME% >nul
    if errorlevel 1 (
        echo %RED%⚠️  No se pudo remover el contenedor. Puede que no exista o haya un problema. Continuar puede causar conflictos.%NC%
    ) else (
        echo %GREEN%✅ Contenedor removido%NC%
    )
) else (
    echo %BLUE%ℹ️  No hay contenedor '%CONTAINER_NAME%' para remover%NC%
)
goto :eof

:start_container
echo %YELLOW%🚀 Iniciando nuevo contenedor '%CONTAINER_NAME%'...%NC%
docker run -d ^
    --name %CONTAINER_NAME% ^
    -p %PORT%:%PORT% ^
    --restart=unless-stopped ^
    --log-driver=json-file ^
    --log-opt max-size=10m ^
    --log-opt max-file=3 ^
    %IMAGE_NAME% >nul
if errorlevel 1 (
    call :handle_error "Falló al iniciar el contenedor '%CONTAINER_NAME%'. Verifica los logs de Docker para más detalles."
)
echo %GREEN%✅ Contenedor iniciado%NC%
goto :eof

:health_check
echo %YELLOW%⏳ Esperando que el contenedor esté listo...%NC%
timeout /t 5 /nobreak >nul

:: Verificar que el contenedor está corriendo
docker ps -q -f name=%CONTAINER_NAME% | findstr . >nul 2>&1
if errorlevel 1 (
    call :handle_error "El contenedor '%CONTAINER_NAME%' no está corriendo después de iniciarse. Algo salió mal."
)

:: Health check loop
echo %YELLOW%🏥 Verificando health check...%NC%
for /l %%i in (1,1,10) do (
    docker exec %CONTAINER_NAME% wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:4200/ >nul 2>&1
    if not errorlevel 1 (
        echo %GREEN%✅ Health check exitoso%NC%
        goto :health_done
    )
    :: Solo muestra el intento si el health check falló
    if not %%i==10 (
        echo %BLUE%⏳ Intento %%i/10...%NC%
        timeout /t 3 /nobreak >nul
    )
)
echo %RED%⚠️  Health check falló después de múltiples intentos, pero el contenedor está corriendo. Revisa los logs para posibles problemas.%NC%
:health_done
goto :eof

:show_info
echo.
echo %GREEN%🎉 ¡Despliegue completado exitosamente!%NC%
echo ==================================
echo %BLUE%📱 Aplicación:%NC% %APP_URL%
echo %BLUE%🐳 Contenedor:%NC% %CONTAINER_NAME%
echo %BLUE%🔌 Puerto:%NC% %PORT%
echo %BLUE%🔄 Reinicio automático:%NC% Activado
echo.

echo %YELLOW%📊 Estado del contenedor:%NC%
:: Usamos findstr para filtrar el encabezado y la fila del contenedor específico
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | findstr /C:"NAMES" /C:"%CONTAINER_NAME%"

echo.
echo %YELLOW%📝 Logs recientes del contenedor:%NC%
docker logs %CONTAINER_NAME% --tail 10

echo.
echo %GREEN%✨ Despliegue finalizado. La aplicación está lista para usar.%NC%
echo %BLUE%🌐 Puedes acceder a tu aplicación en: %APP_URL%%NC%
goto :eof

:: EJECUCIÓN PRINCIPAL
:main
call :check_docker
call :check_tar_file
call :load_image
call :cleanup_container
call :start_container
call :health_check
call :show_info

echo.
echo %YELLOW%💡 Comandos útiles para gestionar tu contenedor:%NC%
echo   Ver logs en tiempo real: docker logs %CONTAINER_NAME% -f
echo   Reiniciar el contenedor: docker restart %CONTAINER_NAME%
echo   Detener el contenedor: docker stop %CONTAINER_NAME%
echo   Acceder a la shell del contenedor: docker exec -it %CONTAINER_NAME% sh

pause
