# Checador - Sistema de Control de Asistencia

Sistema de control de asistencia desarrollado con Angular 20, Docker y NGINX, optimizado para Windows 11 con alta disponibilidad 24/7.

## 📋 Tabla de Contenidos

- [🚀 Despliegue Rápido](#-despliegue-rápido)
- [📦 Comandos Manuales](#-comandos-manuales)
- [🔄 Exportar a Otro Equipo](#-exportar-a-otro-equipo)
- [⚙️ Configuración](#️-configuración)
- [🛠️ Scripts Disponibles](#️-scripts-disponibles)
- [🔍 Troubleshooting](#-troubleshooting)
- [📱 Acceso a la Aplicación](#-acceso-a-la-aplicación)

## 🚀 Despliegue Rápido

### Scripts Automatizados (Windows 11)

#### **Opción 1: CMD Nativo (Recomendado - Sin Git)**
```cmd
# Ejecutar directamente en CMD de Windows
deploy-import.bat
```
**✅ Ventajas:**
- No requiere instalación de Git
- Funciona en cualquier Windows
- Scripts nativos .bat
- Colores y formato optimizado para CMD

#### **Opción 2: Git Bash**
```bash
# Click derecho en carpeta → "Git Bash Here"
./deploy-import.sh
```
**✅ Ventajas:**
- Comandos Unix familiares
- Mejor manejo de scripts complejos
- Compatible con desarrollo multiplataforma

#### **Opción 3: CMD/PowerShell con Git**
```cmd
# En CMD o PowerShell (requiere Git instalado)
bash deploy-import.sh
```

### Scripts Automatizados (Linux/macOS)
```bash
# Hacer ejecutables (solo primera vez)
chmod +x deploy.sh deploy-export.sh deploy-cleanup.sh deploy-import.sh

# Ejecutar despliegue
./deploy.sh           # Build completo desde código fuente
./deploy-import.sh    # Importar imagen pre-construida
./deploy-export.sh    # Exportar imagen para otro equipo
./deploy-cleanup.sh   # Limpiar recursos Docker
```

## 📦 Comandos Manuales

### Build y Despliegue Completo
```bash
# 1. Build de producción Angular
ng build --configuration=production

# 2. Construir imagen Docker
docker build -t checador .

# 3. Ejecutar contenedor con alta disponibilidad
docker run -d \
  --name checador \
  -p 4200:4200 \
  --restart=unless-stopped \
  --memory=512m \
  --health-cmd="wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:4200/ || exit 1" \
  --health-interval=30s \
  checador
```

### Gestión de Contenedores
```bash
# Ver contenedores activos
docker ps

# Ver logs en tiempo real
docker logs checador -f

# Ver estadísticas de recursos
docker stats checador --no-stream

# Reinicio manual
docker restart checador

# Detener y remover
docker stop checador
docker rm checador

# Ver estado de salud
docker inspect checador --format="{{.State.Health.Status}}"
```

## 🔄 Exportar a Otro Equipo

### 1. En el Equipo Origen
```bash
# Listar imágenes disponibles
docker images

# Exportar imagen como archivo .tar (automático)
./deploy-export.sh

# O manualmente
docker save -o checador.tar checador
```

### 2. En el Equipo Destino
```bash
# Copiar el archivo checador.tar al equipo destino

# Cargar imagen desde archivo
docker load -i checador.tar

# Ejecutar contenedor (Windows)
deploy-import.bat

# O ejecutar contenedor (Linux/macOS)
./deploy-import.sh
```

## ⚙️ Configuración

### URLs y Endpoints
- **URL Principal**: `https://sci.ddns.me:4200`
- **API Backend**: `http://sci.ddns.me:4002/comialex/api/v1/worktime/asistencia`
- **Proxy NGINX**: `https://sci.ddns.me:4200/comialex/api/v1/worktime/asistencia`

### Puertos y Servicios
- **Aplicación Web**: `4200` (HTTPS)
- **API Backend**: `4002` (HTTP)
- **Redirección HTTP**: `80` → `443:4200`

### Especificaciones Docker
- **Imagen Base**: `nginx:1.26-alpine`
- **Node.js Build**: `node:22.14-alpine`
- **Límite de Memoria**: `512MB`
- **Límite de CPU**: `1.0 core`
- **Política de Reinicio**: `unless-stopped`
- **Health Check**: Cada 30 segundos

### Requisitos del Sistema

#### Windows 11
- **Docker Desktop**: v4.28.0+ (instalado y corriendo)
- **Node.js**: v18+ con npm (solo para desarrollo)
- **Angular CLI**: `npm install -g @angular/cli` (solo para desarrollo)
- **Terminal**: CMD, PowerShell o Git Bash

#### Linux/macOS
- **Docker**: v20.10+
- **Node.js**: v18+ con npm (solo para desarrollo)
- **Bash**: v4.0+

## 🛠️ Scripts Disponibles

### `deploy-import.bat` / `deploy-import.sh`
**Sistema de Alta Disponibilidad 24/7**
- ✅ Verificaciones automáticas de dependencias
- ✅ Carga inteligente de imagen (evita recargas innecesarias)
- ✅ Gestión avanzada de contenedores existentes
- ✅ Configuración de reinicio automático nocturno
- ✅ Health checks avanzados (interno y externo)
- ✅ Monitoreo de recursos y logs
- ✅ Política de reinicio `unless-stopped`
- ✅ Límites de memoria y CPU
- ✅ Output colorizado y manejo de errores
- ✅ Compatibilidad Windows/Linux/macOS

### `deploy.sh`
**Build Completo desde Código Fuente**
- ✅ Build automático de Angular en producción
- ✅ Construcción optimizada de imagen Docker
- ✅ Verificaciones de dependencias (Node.js, Angular CLI)
- ✅ Gestión de contenedores existentes
- ✅ Health checks básicos
- ✅ Output colorizado

### `deploy-export.sh`
**Exportación para Distribución**
- ✅ Verificación de imagen existente
- ✅ Exportación automática a archivo .tar
- ✅ Instrucciones detalladas para equipo destino
- ✅ Información del archivo generado (tamaño, ubicación)
- ✅ Validación de integridad

### `deploy-cleanup.sh`
**Limpieza Completa de Recursos**
- ✅ Detención segura de contenedores
- ✅ Remoción de contenedores e imágenes
- ✅ Limpieza de imágenes huérfanas
- ✅ Limpieza de build cache
- ✅ Liberación de espacio en disco
- ✅ Preparación para nuevo despliegue

## 🔍 Troubleshooting

### Verificar Estado del Sistema
```bash
# Estado general del contenedor
docker ps | grep checador

# Estado de salud detallado
docker inspect checador --format="{{.State.Health.Status}}"

# Logs en tiempo real
docker logs checador -f

# Estadísticas de recursos
docker stats checador --no-stream

# Conectividad externa
curl -k https://sci.ddns.me:4200/

# Conectividad interna
docker exec checador wget --spider --no-check-certificate https://localhost:4200/
```

### Reiniciar Aplicación

#### Reinicio Rápido
```bash
# Reinicio simple del contenedor
docker restart checador
```

#### Reinicio Completo
```bash
# Windows
deploy-cleanup.bat
deploy-import.bat

# Linux/macOS
./deploy-cleanup.sh
./deploy-import.sh
```

#### Forzar Recarga de Imagen
```cmd
# Windows CMD
del .image_loaded & deploy-import.bat

# Git Bash / Linux / macOS
rm -f .image_loaded && ./deploy-import.sh
```

### Problemas Comunes

#### Windows 11
```cmd
# Docker Desktop no está corriendo
# Solución: Abrir Docker Desktop desde el menú inicio

# Problemas con permisos
# Solución: Ejecutar CMD como Administrador

# No encuentra 'ng' command (solo desarrollo)
npm install -g @angular/cli

# Error "bash no se reconoce"
# Solución: Usar deploy-import.bat en lugar de .sh

# Aplicación no responde externamente
# El sistema incluye reinicio automático nocturno
deploy-import.bat  # Reinicia automáticamente

# Contenedor consume mucha memoria
# El sistema tiene límites configurados (512MB)
docker stats checador --no-stream
```

#### Linux/macOS
```bash
# Permisos de ejecución
chmod +x *.sh

# Docker no está corriendo
sudo systemctl start docker  # Linux
brew services start docker   # macOS

# Puerto 4200 ocupado
sudo lsof -i :4200
# Cambiar puerto en scripts si es necesario
```

### Logs y Monitoreo

#### Ver Logs del Sistema
```bash
# Logs del contenedor
docker logs checador --tail 50

# Logs de reinicio programado (Windows)
type restart.log

# Logs de reinicio programado (Linux/macOS)
cat restart.log

# Logs de NGINX (dentro del contenedor)
docker exec checador tail -f /var/log/nginx/access.log
docker exec checador tail -f /var/log/nginx/error.log
```

#### Monitoreo en Tiempo Real
```bash
# Estadísticas de recursos
docker stats checador

# Logs en tiempo real
docker logs checador -f

# Health checks manuales
docker exec checador wget --spider --no-check-certificate https://localhost:4200/
```

### Reinicio Automático Nocturno

#### Configurar Tarea Programada (Windows)
```cmd
# Opción 1: Automático (ejecutar como Administrador)
schtasks /create /tn "Reinicio Checador" /tr "C:\checador\schedule_restart.bat" /sc daily /st 03:00 /f

# Opción 2: Manual (GUI)
# 1. Win+R → taskschd.msc
# 2. Crear tarea básica
# 3. Nombre: "Reinicio Checador"
# 4. Frecuencia: Diariamente a las 3:00 AM
# 5. Programa: C:\checador\schedule_restart.bat

# Ver tareas programadas
schtasks /query /tn "Reinicio Checador"

# Eliminar tarea
schtasks /delete /tn "Reinicio Checador" /f
```

#### Configurar Cron (Linux/macOS)
```bash
# Editar crontab
crontab -e

# Agregar línea para reinicio a las 3:00 AM
0 3 * * * /ruta/al/proyecto/restart_checador.sh >> /ruta/al/proyecto/restart.log 2>&1

# Ver tareas programadas
crontab -l
```

## 📱 Acceso a la Aplicación

### URL Principal
**https://sci.ddns.me:4200**

### Características de la Aplicación
- ✅ **Interfaz Responsiva**: Optimizada para móviles y escritorio
- ✅ **Captura de Webcam**: Para registro fotográfico de asistencia
- ✅ **Autenticación por NIP**: Sistema seguro de identificación
- ✅ **Control de Jornadas**: Inicio/fin de jornada laboral
- ✅ **Gestión de Pausas**: Control de diferentes tipos de pausas
- ✅ **Tiempo Real**: Reloj sincronizado y actualización automática
- ✅ **Offline Ready**: Funciona sin conexión temporal
- ✅ **SSL/HTTPS**: Conexión segura con certificados válidos

### Funcionalidades
1. **Registro de Entrada/Salida**: Control de horarios laborales
2. **Pausas Categorizadas**: Diferentes tipos de pausas (almuerzo, descanso, etc.)
3. **Captura Fotográfica**: Verificación visual del empleado
4. **Interfaz Intuitiva**: Diseño simple y fácil de usar
5. **Reportes en Tiempo Real**: Visualización inmediata de registros

---

## 📊 Información Técnica

### Stack Tecnológico
- **Frontend**: Angular 20 + TypeScript + TailwindCSS
- **Backend Proxy**: NGINX 1.26
- **Containerización**: Docker + Docker Compose
- **SSL/TLS**: Certificados Let's Encrypt
- **Webcam**: ngx-webcam library
- **HTTP Client**: Angular HttpClient con RxJS

### Arquitectura
```
[Cliente Web] → [NGINX Proxy] → [API Backend]
     ↓              ↓              ↓
[Angular SPA]  [SSL/HTTPS]   [Worktime API]
     ↓              ↓              ↓
[Webcam API]   [Static Files] [Database]
```

### Optimizaciones Implementadas
- ✅ **Build Multi-stage**: Reducción del tamaño de imagen
- ✅ **Gzip Compression**: Compresión automática de assets
- ✅ **Cache Headers**: Optimización de carga de recursos
- ✅ **Health Checks**: Monitoreo automático de salud
- ✅ **Resource Limits**: Control de memoria y CPU
- ✅ **Log Rotation**: Gestión automática de logs
- ✅ **Security Headers**: Protección contra vulnerabilidades web

---

*Sistema desarrollado con Angular 20 + Docker + NGINX*  
*Optimizado para Windows 11 + Docker Desktop*  
*Versión: 2024.1 - Alta Disponibilidad 24/7*
-----


cd C:\checador
deploy-import.bat

# Ver estado
docker ps | findstr checador

# Ver logs
docker logs checador -f

# Forzar recarga
del .image_loaded & deploy-import.bat

# Programar reinicio automático (como Administrador)
schtasks /create /tn "Reinicio Checador" /tr "C:\checador\schedule_restart.bat" /sc daily /st 03:00 /f

# Permitir puerto 4200 en Windows Firewall
netsh advfirewall firewall add rule name="Checador-4200" dir=in action=allow protocol=TCP localport=4200

# Verificar que Docker expone el puerto correctamente
docker port checador
# Debe mostrar: 4200/tcp -> 0.0.0.0:4200

# Verificar que tu DDNS apunta a tu IP pública
nslookup sci.ddns.me
ping sci.ddns.me

# 1. Verificar contenedor
docker ps | findstr checador

# 2. Verificar puerto local
netstat -an | findstr :4200

# 3. Probar acceso local
curl -k https://localhost:4200/

# 1. Verificar DNS
nslookup sci.ddns.me

# 2. Verificar conectividad
telnet sci.ddns.me 4200

# 3. Probar HTTPS
curl -k https://sci.ddns.me:4200/
