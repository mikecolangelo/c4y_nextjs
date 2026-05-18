# Configuración del Módulo de Calendario

## Requisitos

El módulo de calendario requiere que el API token de Strapi tenga permisos específicos.

## Configuración de Permisos en Strapi

### 1. Acceder a API Tokens

1. Ve al panel de administración de Strapi: `http://localhost:1337/admin`
2. Navega a **Settings** (engranaje en el menú lateral)
3. En la sección **Global Settings**, selecciona **API Tokens**

### 2. Crear o Editar Token

Si ya tienes un token:
1. Busca tu token en la lista
2. Haz clic en **Editar**

Si necesitas crear uno nuevo:
1. Haz clic en **Create new API Token**
2. Completa:
   - **Name**: Un nombre descriptivo (ej: "Frontend Calendar Access")
   - **Description**: (Opcional) Descripción del uso
   - **Token type**: Selecciona **Custom**
   - **Duration**: Selecciona la duración apropiada

### 3. Configurar Permisos

En la sección **Permissions**:

#### Appointment (Citas)
- ✅ `find` - Para listar citas en el calendario
- ✅ `findOne` - Para ver detalles de una cita
- ✅ `create` - Para crear nuevas citas
- ✅ `update` - Para actualizar citas existentes
- ✅ `delete` - Para eliminar citas

#### Client (Clientes) - Si usas relaciones
- ✅ `find`
- ✅ `findOne`

#### Fleet (Flota) - Para vehículos
- ✅ `find`
- ✅ `findOne`

#### Service (Servicios) - Para mantenimiento
- ✅ `find`
- ✅ `findOne`

#### Notification (Notificaciones) - Para activity feed
- ✅ `find`
- ✅ `findOne`
- ✅ `create` (si usas lifecycles)

### 4. Guardar y Copiar Token

1. Haz clic en **Save**
2. Copia el token generado (¡solo se muestra una vez!)
3. Pégalo en tu archivo `.env` del frontend:

```env
STRAPI_API_TOKEN=tu_token_aqui
```

## Verificación

Para verificar que todo funciona:

1. Reinicia el servidor de Next.js
2. Ve a `/calendar` en el frontend
3. El calendario debería cargar sin errores

## Solución de Problemas

### Error 403 Forbidden
El token no tiene los permisos necesarios. Sigue los pasos de configuración arriba.

### Error 401 Unauthorized
El token es inválido o ha expirado. Genera un nuevo token en Strapi.

### Error 404 Not Found
La colección `appointments` no existe en Strapi. Verifica que:
- El schema de appointments existe en `backend/src/api/appointment/`
- Has reiniciado Strapi después de crear la colección

### Error de conexión (ECONNREFUSED)
Strapi no está corriendo. Verifica que el backend esté activo en `http://localhost:1337`.

## Colecciones Relacionadas

El calendario utiliza las siguientes colecciones de Strapi:

- `appointment` - Citas principales
- `fleet` - Vehículos (para mantenimiento)
- `client` - Clientes (para ventas/pruebas)
- `service` - Servicios de mantenimiento
- `notification` - Notificaciones de actividad
- `user-profile` - Usuarios asignados
