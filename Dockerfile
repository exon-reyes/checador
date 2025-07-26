# syntax=docker/dockerfile:1

# ===== ETAPA 1: Build Angular =====
FROM node:22.14-alpine AS build

# Eliminado: 'git' no es necesario para un 'npm ci' o 'npm run build' estándar.
# Si tu proyecto tiene dependencias npm que se resuelven desde repositorios git privados,
# entonces deberías volver a añadir esta línea.
# RUN apk add --no-cache git

WORKDIR /app

# Copiar solo archivos de dependencias primero (mejor cache)
COPY package*.json ./

# Cache mount para npm - INSTALAR TODAS LAS DEPENDENCIAS
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Copiar código fuente
COPY . .

# Build con optimizaciones adicionales
RUN npm run build -- --configuration=production && \
    # Limpiar archivos innecesarios después del build
    rm -rf node_modules .angular/cache src

# ===== ETAPA 2: Servir con NGINX =====
FROM nginx:1.29.0-alpine

# Copiar build Angular
COPY --from=build /app/dist/checador/browser /usr/share/nginx/html

# Copiar configuración NGINX (reemplaza el nginx.conf por defecto)
# Esta es tu preferencia de ubicación y es válida.
COPY ./nginx.conf /etc/nginx/nginx.conf

# Copiar certificados SSL con permisos seguros (chmod en COPY solo aplica a archivos)
# Los permisos del directorio serán los predeterminados de Docker, que suelen ser adecuados.
COPY --chmod=644 ./ssl /etc/nginx/ssl

# Crear directorio de uploads
RUN mkdir -p /usr/share/nginx/html/uploads && \
    chmod 755 /usr/share/nginx/html/uploads

# Exponer puertos
EXPOSE 4200

# Health check menos frecuente para reducir carga
HEALTHCHECK --interval=60s --timeout=15s --start-period=30s --retries=2 \
    CMD wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:4200/ || exit 1

# Iniciar NGINX
CMD ["nginx", "-g", "daemon off;"]
