#!/bin/bash
set -euo pipefail

# =============================================================================
# Script de build seguro para VPS con RAM limitada (3.8 GB)
# =============================================================================
# Este script:
#   1. Libera memoria deteniendo temporalmente Strapi y el emergency-server
#   2. Limpia cachés pesadas de Next.js
#   3. Ejecuta el build con flags de Node optimizados para baja memoria
#   4. Restaura los servicios al terminar (éxito o fallo)
# =============================================================================

FRONTEND_DIR="/home/deploy/frontend"
# .next-prod-deploy es un symlink a .next — trabajamos con el real
BUILD_DIR="$FRONTEND_DIR/.next"
BACKUP_DIR="$FRONTEND_DIR/.next.backup.$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$FRONTEND_DIR/build-$(date +%Y%m%d_%H%M%S).log"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[BUILD]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

cd "$FRONTEND_DIR"

# =============================================================================
# 0. Pre-chequeos
# =============================================================================
log "Iniciando build seguro..."
log "Log completo: $LOG_FILE"

# Verificar swap
SWAP_TOTAL=$(free -m | awk '/^Swap:/{print $2}')
if [ "$SWAP_TOTAL" -eq 0 ]; then
  warn "⚠️  NO HAY SWAP ACTIVO"
  warn "El build probablemente falle por OOM."
  warn "Ejecutá como root: sudo bash /home/deploy/activate-swap.sh"
  warn ""
  read -p "¿Querés continuar igual? (s/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    log "Build cancelado por el usuario."
    exit 1
  fi
else
  log "✅ Swap detectado: ${SWAP_TOTAL}MB"
fi

# Verificar espacio en disco
DISK_AVAIL=$(df -m / | awk 'NR==2{print $4}')
if [ "$DISK_AVAIL" -lt 2048 ]; then
  error "Espacio en disco insuficiente: ${DISK_AVAIL}MB libres (se necesitan ~2GB)"
  exit 1
fi
log "✅ Espacio en disco: ${DISK_AVAIL}MB libres"

# =============================================================================
# 1. Backup del build anterior
# =============================================================================
if [ -d "$BUILD_DIR" ]; then
  log "Creando backup del build anterior en $BACKUP_DIR ..."
  # Copiar el CONTENIDO real (no el symlink)
  cp -aL "$BUILD_DIR" "$BACKUP_DIR"
  log "✅ Backup completado"
fi

# =============================================================================
# 2. Detener servicios para liberar memoria
# =============================================================================
log "Deteniendo servicios para liberar RAM (~500MB)..."
pm2 stop strapi 2>/dev/null || true
pm2 stop next   2>/dev/null || true
sleep 3

# Intentar limpiar caché de pagecache (requiere root, ignorar si falla)
sync && echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null 2>&1 || true

FREE_MEM=$(free -m | awk '/^Mem:/{print $7}')
log "Memoria libre después de detener servicios: ${FREE_MEM}MB"

# =============================================================================
# 3. Limpiar cachés pesadas de Next.js y npm
# =============================================================================
log "Limpiando cachés temporales..."
rm -rf "$BUILD_DIR/cache" 2>/dev/null || true
rm -rf "$FRONTEND_DIR/node_modules/.cache" 2>/dev/null || true
rm -rf "$FRONTEND_DIR/.turbo" 2>/dev/null || true
# Limpiar core dumps que pueden ocupar GBs
find /home/deploy -name "core.*" -delete 2>/dev/null || true
log "✅ Cachés limpiadas"

# =============================================================================
# 4. Configurar variables de entorno para build de baja memoria
# =============================================================================
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

# Node heap limit: dejar 600MB para el sistema y otros procesos
# Si hay swap, 3072 es seguro. Si no hay swap, 2560 es más conservador.
if [ "$SWAP_TOTAL" -gt 0 ]; then
  export NODE_OPTIONS="--max-old-space-size=3072"
else
  export NODE_OPTIONS="--max-old-space-size=2560"
fi

# Webpack / Next.js: limitar workers
export NEXT_WEBPACK_WORKERS=1
export UV_THREADPOOL_SIZE=4

log "NODE_OPTIONS=$NODE_OPTIONS"
log "NEXT_WEBPACK_WORKERS=$NEXT_WEBPACK_WORKERS"

# =============================================================================
# 5. Ejecutar build
# =============================================================================
BUILD_OK=false
log "Iniciando next build (esto puede tardar 5-15 minutos)..."

if npx next build 2>&1 | tee -a "$LOG_FILE"; then
  BUILD_OK=true
  log "✅ BUILD EXITOSO"
else
  error "❌ BUILD FALLIDO"
fi

# =============================================================================
# 6. Restaurar servicios SIEMPRE (éxito o fallo)
# =============================================================================
log "Restaurando servicios..."
pm2 start strapi 2>/dev/null || pm2 restart strapi 2>/dev/null || true
pm2 start next   2>/dev/null || pm2 restart next   2>/dev/null || true
sleep 2
pm2 save 2>/dev/null || true
log "✅ Servicios restaurados"

# =============================================================================
# 7. Post-build: resultado
# =============================================================================
if [ "$BUILD_OK" = true ]; then
  # Limpiar backup si todo salió bien
  if [ -d "$BACKUP_DIR" ]; then
    rm -rf "$BACKUP_DIR"
    log "Backup intermedio eliminado (build exitoso)"
  fi

  # Reporte de tamaño
  BUILD_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
  log "📦 Tamaño del build: $BUILD_SIZE"
  log "🚀 Listo. El sitio debería actualizarse en PM2 automáticamente."
  exit 0
else
  # Restaurar backup anterior
  if [ -d "$BACKUP_DIR" ]; then
    warn "Restaurando build anterior desde backup..."
    rm -rf "$BUILD_DIR"
    cp -aL "$BACKUP_DIR" "$BUILD_DIR"
    log "✅ Build anterior restaurado"
  fi

  error "El build falló. Revisá el log: $LOG_FILE"
  exit 1
fi
