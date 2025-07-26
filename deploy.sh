#!/bin/bash

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
CONTAINER_NAME="checador"
IMAGE_NAME="checador"
PORT="4200"
APP_URL="https://sci.ddns.me:4200"

echo -e "${BLUE}🚀 Iniciando despliegue de Checador...${NC}"
echo "=================================="

# Función para manejar errores
handle_error() {
    echo -e "${RED}❌ Error: $1${NC}"
    exit 1
}

# Función para verificar si Docker está corriendo
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        handle_error "Docker no está corriendo. Inicia Docker Desktop."
    fi
}

# Verificar dependencias
echo -e "${YELLOW}🔍 Verificando dependencias...${NC}"
check_docker

if ! command -v ng &> /dev/null; then
    handle_error "Angular CLI no está instalado. Ejecuta: npm install -g @angular/cli"
fi

# Build de Angular
echo -e "${YELLOW}🏗️  Construyendo aplicación Angular...${NC}"
if ! ng build --configuration=production; then
    handle_error "Falló el build de Angular"
fi
echo -e "${GREEN}✅ Build de Angular completado${NC}"

# Construir imagen Docker
echo -e "${YELLOW}🐳 Construyendo imagen Docker...${NC}"
if ! docker build -t $IMAGE_NAME .; then
    handle_error "Falló la construcción de la imagen Docker"
fi
echo -e "${GREEN}✅ Imagen Docker construida${NC}"

# Detener contenedor existente
echo -e "${YELLOW}🛑 Deteniendo contenedor existente...${NC}"
if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    docker stop $CONTAINER_NAME
    echo -e "${GREEN}✅ Contenedor detenido${NC}"
else
    echo -e "${BLUE}ℹ️  No hay contenedor corriendo${NC}"
fi

# Remover contenedor existente
if docker ps -aq -f name=$CONTAINER_NAME | grep -q .; then
    docker rm $CONTAINER_NAME
    echo -e "${GREEN}✅ Contenedor removido${NC}"
fi

# Iniciar nuevo contenedor
echo -e "${YELLOW}🚀 Iniciando nuevo contenedor...${NC}"
if ! docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:$PORT \
    --restart=unless-stopped \
    --log-driver=json-file \
    --log-opt max-size=10m \
    --log-opt max-file=3 \
    $IMAGE_NAME; then
    handle_error "Falló al iniciar el contenedor"
fi

# Esperar a que el contenedor esté listo
echo -e "${YELLOW}⏳ Esperando que el contenedor esté listo...${NC}"
sleep 5

# Verificar que el contenedor está corriendo
if ! docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    handle_error "El contenedor no está corriendo"
fi

# Health check
echo -e "${YELLOW}🏥 Verificando health check...${NC}"
for i in {1..10}; do
    if docker exec $CONTAINER_NAME wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:4200/ 2>/dev/null; then
        echo -e "${GREEN}✅ Health check exitoso${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}⚠️  Health check falló, pero el contenedor está corriendo${NC}"
    else
        echo -e "${BLUE}⏳ Intento $i/10...${NC}"
        sleep 3
    fi
done

# Mostrar información del despliegue
echo ""
echo -e "${GREEN}🎉 ¡Despliegue completado exitosamente!${NC}"
echo "=================================="
echo -e "${BLUE}📱 Aplicación:${NC} $APP_URL"
echo -e "${BLUE}🐳 Contenedor:${NC} $CONTAINER_NAME"
echo -e "${BLUE}🔌 Puerto:${NC} $PORT"
echo -e "${BLUE}🔄 Reinicio automático:${NC} Activado"
echo ""
# Mostrar estado del contenedor
echo -e "${YELLOW}📊 Estado del contenedor:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep $CONTAINER_NAME

# Mostrar logs recientes
echo ""
echo -e "${YELLOW}📝 Logs recientes:${NC}"
docker logs $CONTAINER_NAME --tail 10

echo ""
echo -e "${GREEN}✨ Despliegue finalizado. La aplicación está lista para usar.${NC}"
