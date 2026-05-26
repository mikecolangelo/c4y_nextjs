# Bitácora de Desarrollo — Módulo de Importación de Leads

> **Fecha de análisis:** 18 de mayo de 2026  
> **Proyecto:** Car4You (Strapi + Next.js)  
> **Archivos analizados:**
> - `C:\Users\Bernardo\trememdo\c4y_nextjs\lib\lead-import.ts` (597 líneas)
> - `C:\Users\Bernardo\trememdo\c4y_nextjs\app\users\import\page.tsx` (757 líneas)
> - `C:\Users\Bernardo\trememdo\c4y_strapi\src\api\user-profile\controllers\user-profile.ts` (líneas 220-398)

---

## 1. Resumen del Módulo

Permite importar leads (contactos/prospectos) masivamente desde archivos Excel (.xlsx, .xls, .csv) al sistema. El flujo completo:

1. **Frontend:** Usuario sube archivo → parsing → preview → confirmación → upload en batches
2. **Backend:** Recibe batches de hasta 50 registros → deduplicación contra DB → crea user-profiles con rol `lead`

### Estructura de archivos

```
c4y_nextjs/
├── lib/
│   └── lead-import.ts          # 597 líneas — lógica pura de parsing/validación
└── app/users/import/
    └── page.tsx                # 757 líneas — UI React

c4y_strapi/
└── src/api/user-profile/
    └── controllers/
        └── user-profile.ts    # batchImport (líneas 220-398)
```

---

## 2. Arquitectura — Capas

### 2.1 Frontend: Library (`lib/lead-import.ts`)

**Propósito:** parsing de Excel y validación — sin side effects, sin dependencias de red.

#### Mapeo de Headers

`HEADER_MAP` — diccionario exhaustivo de aliases en español e inglés por campo:

| Campo | Aliases ejemplos |
|-------|-----------------|
| `displayName` | nombre, name, nombres, full name, contacto, cliente... |
| `phone` | telefono, celular, movil, mobile, cel, telf, tlf, whatsapp... |
| `email` | correo, e-mail, mail, email address... |
| `department` | origen, fuente, canal, procedencia, campana... |
| `bio` | notas, notes, comentarios, observaciones... |
| `hireDate` | fecha de contacto, fecha registro, contact date... |
| `workSchedule` | empresa, company, compania... |
| `role` | rol, role, cargo, perfil... |

`PARTIAL_KEYWORDS` — matching parcial seguro (solo palabras ≥3 chars) para evitar falsos positivos.

`normalizeHeader()` — lowercases, strips accents (`NFD`), remove special chars, trim.

`findHeaderRow()` — detecta header row automáticamente (hasta fila 25), fallback a primera fila no vacía.

#### Normalización de Datos

| Función | Lógica |
|---------|--------|
| `parseDate(value)` | Date objects, Excel serial dates (>30000 <50000), DD/MM/YYYY, MM/DD/YYYY |
| `cleanPhone(value)` | number → string, strip non-digits except leading `+` |
| `cleanString(value)` | trim |
| `normalizeRole(value)` | mapea aliases español/inglés → `admin`, `seller`, `driver`, `lead` |
| `validateEmailFormat(email)` | regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| `validatePhoneFormat(phone)` | al menos 7 dígitos (strip non-digits) |

#### Validación

- `REQUIRED_FIELDS = []` — **sin campos obligatorios** (leads con datos faltantes se permiten)
- `validateRow()` — solo advierte de formato, **no bloquea** importación
- `checkIntraFileDuplicates()` — detecta duplicados intra-archivo por teléfono o email, muta las filas agregando `_errors`

#### Generación de Templates

`generateTemplateBuffer()` → Excel con headers: Nombre, Teléfono, Email, Origen del Lead, Notas, Fecha de contacto, Empresa, Rol. Incluye 2 filas de ejemplo.

### 2.2 Frontend: Page (`app/users/import/page.tsx`)

**Fases:** `idle` → `mapping` → `preview` → `uploading` → `success` | `error`

**Flujo UI:**
1. Drop zone para subir archivo (drag & drop o click)
2. `processFile()` → `parseLeadImportFile()` → preview automático
3. Panel de mapeo manual si hay columnas no detectadas
4. Preview de primeras 5 filas con estado de errores
5. Upload en batches de 50 → progress bar
6. Pantalla de resultados con log de errores descargable

**Endpoint:** `POST /api/user-profiles/batch-import` con batches de 50

**Manejo de errores:**
- HTTP errors → todos los rows del batch marcados como error
- intra-file duplicates → separados en `duplicated` vs `error`

### 2.3 Backend: Controller (`user-profile.ts:220-398`)

**Endpoint:** `POST /user-profiles/batch-import`

**Límites:**
- Máximo **50 registros por batch** (line 231)
- Autenticación requerida
- Solo admins pueden asignar roles distintos a `lead`

**Flujo:**
1. Verificar admin (`isAdmin`)
2. Pre-cargar todos los emails y teléfonos existentes en DB
3. Loop por cada row:
   - Deduplicación contra DB (email y phone normalizados)
   - Deduplicación intra-batch
   - Si es admin: permite rol solicitado; si no: fuerza `lead`
   - `strapi.entityService.create()`
4. Return con summary y details

**Normalización en backend:**
- Email: `toLowerCase().trim()`
- Phone: `replace(/\D/g, '')` (solo dígitos)

**Retorna:**
```json
{
  "data": {
    "importBatch": "leads-1747600000000",
    "summary": { "total": 50, "created": 45, "duplicated": 3, "errors": 2 },
    "details": [{ "index": 1, "displayName": "Juan", "status": "created" }]
  }
}
```

---

## 3. Anti-Patrones y Áreas de Mejora

### 3.1 Pre-carga de profiles existentes (líneas 243-251)

```typescript
const existingProfiles = await strapi.db.query('api::user-profile.user-profile').findMany({
  where: { $or: [{ email: { $notNull: true } }, { phone: { $notNull: true } }] },
  select: ['email', 'phone'],
});
```

**Problema:** Carga TODOS los profiles en memoria. Con 100k+ registros esto esproblemático.

**Alternativa sugerida:** Hacer la deduplicación via DB query por cada row, o paginar la pre-carga.

### 3.2 Límite de 50 por batch

**Problema:** Backend limita a 50 pero frontend también hardcodea 50. Si se quiere procesar 1000 leads, son 20 requests secuenciales.

**Sugerencia:** Aumentar a 200 por batch para reducir requests, o implementar paginación en el backend.

### 3.3 Secuencialidad del loop de creación (líneas 278-380)

```typescript
for (let i = 0; i < data.length; i++) {
  // await strapi.entityService.create(...) — secuencial
}
```

**Problema:** Cada INSERT es secuencial. 50 registros = 50 INSERTs en serie.

**Alternativa sugerida:** Usar `strapi.db.query().createMany()` o crear en chunks paralelos.

### 3.4 Verificación de admin hace query extra (líneas 236-239)

```typescript
const userProfile = await strapi.db.query('api::user-profile.user-profile').findOne({
  where: { email: user.email },
});
const isAdmin = ['admin', 'super-admin'].includes(userProfile?.role);
```

**Problema:** El rol del usuario ya viene en `ctx.state.user` del auth plugin. Este query adicional es innecesario.

**Alternativa sugerida:** Usar `user.role` directamente si está disponible en el JWT, o trust el token.

### 3.5 No hay índice de cobertura en phone/email

**Problema:** La deduplicación hace `WHERE email $notNull` y `WHERE phone $notNull` sin índices. En tablas grandes, full table scan.

**Recomendación:** Crear índices en `email` y `phone` en `user-profiles`.

### 3.6 Frontend permite elegir rol sin indicar restricción

**Problema:** El usuario puede seleccionar `admin`/`seller`/`driver` en el dropdown de la template, pero el backend lo convierte silenciosamente a `lead` si no es admin.

**UX:** No hay feedback visual de que el rol fue downgraded.

**Sugerencia:** Ocultar o deshabilitar roles superiores en el dropdown del template para no-admins, o mostrar toast informativo.

### 3.7 No hay rate limiting ni retry con backoff

**Problema:** Si el upload falla parcialmente, los batches retry sequentially sin delay, potencialmente sobrecargando el servidor.

**Sugerencia:** Implementar retry con exponential backoff en el frontend.

### 3.8 Missing indexes en producción

**Problema potencial:** Sin índices en `email` y `phone` de `user-profiles`, la deduplicación será lenta con muchos registros.

---

## 4. Dependencias del Módulo

### 4.1 Content Types Involucrados

| Content Type | Relación | Uso |
|--------------|----------|-----|
| `user-profile` | Target | Cada lead importado es un user-profile con role `lead` |

### 4.2 Dependencias NPM (Frontend)

| Paquete | Uso |
|---------|-----|
| `xlsx` (SheetJS) | Parsing de archivos Excel (.xlsx, .xls, .csv) |

### 4.3 Auth/Users Permissions

- El endpoint de import (`POST /user-profiles/batch-import`) requiere autenticación
- Solo usuarios con rol `admin` o `super-admin` pueden asignar roles distintos a `lead`
- Los usuarios `seller` y `driver` pueden importar pero todos sus registros serán `lead`

---

## 5. Permisos y Roles

### Rol para importados

| Rol | Puede importar | Rol asignado a sus leads |
|-----|----------------|--------------------------|
| admin | ✅ | El rol que elija (admin/seller/driver/lead) |
| super-admin | ✅ | El rol que elija |
| seller | ✅ | Solo `lead` |
| driver | ✅ | Solo `lead` |

---

## 6. Impacto en Otros Módulos

### 6.1 Módulos Afectados

| Módulo | Tipo de Impacto | Descripción |
|--------|-----------------|-------------|
| **User-profile** | Dependencia directa | Cada lead importado crea un user-profile |
| **Users-permissions plugin** | Auth subsistema | El endpoint usa auth del plugin para verificar admin |

### 6.2 Posibles Problemas Identificados

1. **Sin índices en `email` y `phone` de user-profile**
   - La query `WHERE email $notNull OR phone $notNull` hace full table scan
   - Con 10k+ leads, cada dedupe será lenta
   - **Recomendación:** Crear índices en esos campos

2. **Leads sin datos** — El sistema permite crear leads con solo nombre, o incluso sin nombre
   - Puede generar registros "vacíos" en la DB
   - `REQUIRED_FIELDS = []` es intencional por request del usuario

---

## 7. Cambios Aplicados (Histórico)

> Esta sección se actualiza con cada modificación al módulo.

### 2026-05-18 — Análisis Inicial del Módulo

**Analista:** opencode (Car4You Dev Team)

**Hallazgos:**

| Categoría | Hallazgo | Severidad |
|-----------|----------|-----------|
| Arquitectura | Library separada (lead-import.ts) bien estructurada — lógica pura, sin side effects | ✅ Bueno |
| Arquitectura | UI con fases claras (idle→mapping→preview→uploading→success) | ✅ Bueno |
| UX | Muestra columnas no mapeadas con valores de ejemplo | ✅ Bueno |
| UX | Genera template Excel con ejemplos | ✅ Bueno |
| Anti-patrón | Pre-carga TODOS los user-profiles para deduplicación (full table scan) | ⚠️ Medio |
| Anti-patrón | Loop secuencial de inserts en batchImport | ⚠️ Medio |
| Anti-patrón | Query innecesario para verificar admin (ya viene en JWT) | ⚠️ Bajo |
| Performance | Sin índices en `email` y `phone` — deduplicación lenta en escala | ⚠️ Alto |
| UX | Dropdown de rol permite seleccionar admin pero silenciosamente downgradea a lead | ⚠️ Medio |

### 2026-05-19 — Corrección de Bugs Post-Importación

**Analista:** opencode (Car4You Dev Team)

**Contexto:** Usuario reporta que "usuarios importados se crean pero no se guardan los datos" al editar.

#### Problema 1: Paginación oculta contactos importados

**Síntoma:** Contactos importados no aparecen en la lista de usuarios.

**Causa raíz:** Strapi REST API tiene paginación por defecto de **25 registros**. La lista de usuarios solo muestra los primeros 25 contactos, ocultando los recién importados.

**Archivo:** `app/api/user-profiles/route.ts`

**Cambio:** Agregar `pagination: { pageSize: 1000 }` al query de Strapi.

```typescript
// Antes (implícito, Strapi default = 25)
const query = qs.stringify({
  fields: [...],
  populate: {...},
  sort: ["displayName:asc"],
});

// Después (explicit pageSize = 1000)
const query = qs.stringify({
  fields: [...],
  populate: {...},
  sort: ["displayName:asc"],
  pagination: { pageSize: 1000 },
});
```

**Verificación:** Los contactos importados ahora aparecen en la lista.

---

#### Problema 2: Edición de usuario importado falla silenciosamente

**Síntoma:** Al editar un usuario importado y guardar, aparece error "Error al guardar contacto" sin detalles.

**Causa raíz:** Strapi rechaza strings vacíos (`""`) en campos como `email` (type: email). El formulario inicializa campos vacíos como `""` en vez de `null`. Al guardar, el PATCH envía `""` al backend y Strapi responde con error 400.

**Archivo:** `app/api/user-profiles/[id]/route.ts`

**Cambio:** Convertir TODOS los campos vacíos (`""` o `undefined`) a `null` antes de enviar a Strapi.

```typescript
// Antes: solo fechas
const dateFields = ['dateOfBirth', 'hireDate'];
const cleanedData = { ...body.data };
for (const field of dateFields) {
  if (cleanedData[field] === '' || cleanedData[field] === undefined) {
    cleanedData[field] = null;
  }
}

// Después: todos los campos
const cleanedData = { ...body.data };
for (const key of Object.keys(cleanedData)) {
  if (cleanedData[key] === '' || cleanedData[key] === undefined) {
    cleanedData[key] = null;
  }
}
```

**Verificación:** Los usuarios importados se pueden editar y guardar correctamente.

---

#### Problema 3: Login falla con contraseñas generadas por el sistema

**Síntoma:** Usuario promovido con contraseña "Miguel" (6 caracteres) no puede iniciar sesión. El formulario de login muestra el campo en rojo sin enviar la petición.

**Causa raíz:** Discrepancia entre frontend y backend:
- **Backend** (`user-profile.ts:43-51`): Valida contraseñas con mínimo **6 caracteres**
- **Frontend** (`validations/auth.ts:5`): Exige mínimo **8 caracteres** en el login

Las contraseñas generadas automáticamente (ej: "Miguel" = 6 chars) pasan la validación del backend pero son rechazadas por el formulario de login del frontend.

**Archivo:** `validations/auth.ts`

**Cambio:** Alinear validación de login con el backend (6 caracteres).

```typescript
// Antes
export const SignInFormSchema = z.object({
  identifier: z.string().min(3, "..."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

// Después
export const SignInFormSchema = z.object({
  identifier: z.string().min(3, "..."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
```

**Verificación:** Las contraseñas generadas por el backend (6-12 chars) ahora son aceptadas en el login.

---

#### Problema 4: Mensajes de error opacos

**Síntoma:** Todos los errores muestran mensaje genérico "Error al guardar contacto" sin detalles de Strapi.

**Causa raíz:** El catch block del `handleSave` en `page.tsx` no extrae el mensaje real del error.

**Archivo:** `app/users/details/[id]/page.tsx`

**Cambio:** Extraer mensaje de error del response body y mostrarlo en el toast.

```typescript
// Antes
if (!response.ok) {
  throw new Error("Error al guardar");
}
// ...
} catch (err) {
  toast.error("Error al guardar contacto");
}

// Después
if (!response.ok) {
  let errorMessage = "Error al guardar contacto";
  try {
    const errorData = await response.json();
    if (errorData?.error) {
      errorMessage = typeof errorData.error === 'string' 
        ? errorData.error 
        : JSON.stringify(errorData.error);
    }
  } catch {
    errorMessage = `Error al guardar contacto (HTTP ${response.status})`;
  }
  throw new Error(errorMessage);
}
// ...
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : "Error al guardar contacto";
  toast.error(errorMessage);
}
```

**Verificación:** Los errores de Strapi ahora se muestran con mensajes descriptivos.

---

#### Resumen de cambios

| Archivo | Cambio | Motivación |
|---------|--------|------------|
| `app/api/user-profiles/route.ts` | `pagination: { pageSize: 1000 }` | Mostrar todos los contactos, no solo 25 |
| `app/api/user-profiles/[id]/route.ts` | Convertir `""` → `null` para TODOS los campos | Strapi rechaza strings vacíos en campos email |
| `app/users/details/[id]/page.tsx` | Extraer error real del response | Diagnóstico transparente |
| `validations/auth.ts` | `password: min(6)` en vez de `min(8)` | Alinear con validación del backend |

---

**Próximos pasos sugeridos (actualizado):**
1. [x] ~~Aumentar paginación de user-profiles a 1000~~ ✅ 2026-05-19
2. [x] ~~Arreglar envío de campos vacíos como null~~ ✅ 2026-05-19
3. [x] ~~Alinear validación de login (6 chars) con backend~~ ✅ 2026-05-19
4. [ ] Crear índices en `email` y `phone` de `user-profiles`
5. [ ] Reemplazar pre-carga full table scan por query deduplicación por-row
6. [ ] Usar `user.role` del JWT para admin check en vez de query adicional
7. [ ] Implementar `createMany` o bulk insert para batches
8. [ ] Ocultar roles superiores en dropdown para no-admins
9. [ ] Aumentar límite de batch a 200

---

## 8. Anexos

### 8.1 Resumen de Archivos

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `lib/lead-import.ts` | 597 | Parsing Excel, normalización, validación, templates |
| `app/users/import/page.tsx` | 757 | UI de importación en React |
| `user-profile/controllers/user-profile.ts` (batchImport) | ~179 | Endpoint backend de importación |

### 8.2 Dependencias NPM Externas

- `xlsx` — Parsing de archivos Excel (.xlsx, .xls, .csv) en frontend

### 8.3 Campos de LeadImportRow

```typescript
interface LeadImportRow {
  displayName?: string | null;   // Nombre
  phone?: string | null;         // Teléfono
  email?: string | null;         // Email
  department?: string | null;    // Origen del Lead
  bio?: string | null;           // Notas
  hireDate?: string | null;      // Fecha de contacto
  workSchedule?: string | null;  // Empresa
  role?: string | null;          // Rol
  _rowIndex?: number;            // Índice de fila (interno)
  _errors?: string[];            // Errores detectados (interno)
}
```

### 8.4 Formato de Retour de batchImport

```json
{
  "data": {
    "importBatch": "leads-1747600000000",
    "summary": {
      "total": 50,
      "created": 45,
      "duplicated": 3,
      "errors": 2
    },
    "details": [
      {
        "index": 1,
        "displayName": "Juan Pérez",
        "status": "created" | "duplicate" | "error",
        "message": "Email 'juan@email.com' ya existe en la base de datos"
      }
    ]
  }
}
```