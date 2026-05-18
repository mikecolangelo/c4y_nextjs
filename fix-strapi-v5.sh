#!/bin/bash
# Script para corregir las llamadas a Strapi v5 en los chunks compilados

CHUNKS_DIR="/home/deploy/frontend/.next/server/chunks"

# Función para reemplazar en un archivo
fix_chunk() {
    local file=$1
    local chunk_name=$2
    
    echo "Procesando $chunk_name..."
    
    # Backup
    cp "$file" "$file.bak"
    
    # Reemplazar el patrón de filtros por endpoint directo
    # El patrón típico es: api/fleets?${variable}
    # Lo cambiamos a: api/fleets/${id} (usando la variable que ya tiene el id)
    
    # Para el chunk 2984 (reminder) - usa variable 'e' para el id
    if [ "$chunk_name" = "2984" ]; then
        # Reemplazar: api/fleets?${l} por api/fleets/${e}
        # donde 'e' es el documentId del vehículo
        sed -i 's/`\${o\.Fw}\/api\/fleets?\${l}`/`\${o.Fw}\/api\/fleets\/${e}`/g' "$file"
        echo "  - Reemplazado api/fleets?\${l} por api/fleets/\${e}"
    fi
    
    # Para el chunk 8831 (status) - usa variable 't' para el id
    if [ "$chunk_name" = "8831" ]; then
        # Reemplazar: api/fleets?${a} por api/fleets/${t}
        sed -i 's/`\${s\.Fw}\/api\/fleets?\${a}`/`\${s.Fw}\/api\/fleets\/${t}`/g' "$file"
        echo "  - Reemplazado api/fleets?\${a} por api/fleets/\${t}"
    fi
    
    # También necesitamos ajustar el código que procesa la respuesta
    # ya que ahora viene un objeto directo en lugar de un array
}

# Procesar chunks
fix_chunk "$CHUNKS_DIR/2984.js" "2984"
fix_chunk "$CHUNKS_DIR/8831.js" "8831"
fix_chunk "$CHUNKS_DIR/5362.js" "5362"

echo "Correcciones aplicadas. Reinicia el servidor de Next.js."
