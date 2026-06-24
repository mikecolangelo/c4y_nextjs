# QA — Validación visual (rama `chore/servicios-cleanup-refactor`)

> **Cómo usar este documento:** levanta el frontend (`pnpm dev`) y el backend en
> watch. Recorre cada sección y marca `[x]` lo que pase. Si algo falla, anota
> qué viste en la columna **Notas** o al final, en _Incidencias_.
>
> | Campo        | Valor           |
> | ------------ | --------------- |
> | Validado por |                 |
> | Fecha        |                 |
> | Entorno      | local / staging |
> | Build / SHA  |                 |

---

## ⚠️ Pre-requisito (hacer una sola vez)

- [x] **Reiniciar el backend** una vez para que el bootstrap cree la columna
      `theme_preference` y aplique los permisos de `user-profile`.
      Sin esto fallan el dark mode persistente y parte del import.
- [x] Confirmar que el backend arrancó sin errores en consola.

---

## 1. 🌙 Dark mode persistente (crítico)

**Ruta:** cualquier pantalla, usar el toggle de tema en el header.

- [x] Cambiar a **dark** → recargar la página → sigue en **dark**.
- [x] Entrar con el **mismo usuario en otro navegador** → respeta el tema (vive
      en BD, no solo cookie).
- [x] Cambiar a **light** → recargar → sigue en **light**.
- [x] (Opcional, BD) `user_profiles.theme_preference` refleja el valor elegido.

**Notas:**

---

## 2. 🎨 Dark mode — sin colores rotos

Recorrer en **modo oscuro**: sin texto gris ilegible, tarjetas blancas ni bordes
invisibles.

- [x] **Contactos** (`/users`) — contadores de actividad (verde/azul/morado) y
      badges de rol legibles.
- [x] **Contacto detalle** (`/users/details/[id]`) — badges de estado del
      historial, timeline, textos de error/éxito.
- [x] **Billing** (`/billing`) — timeline de pagos, simulación, financiación.
- [x] **Calendario / notificaciones** (`/calendar`).
- [x] **Mantenimiento** (página de mantenimiento).

**Notas:**

---

## 3. ⬅️ Botón "volver" (solo en menú + atajo de teclado)

- [x] En los detalles (users, stock, fleet, deal, billing, adm-services,
      service-orders) el "volver" está **solo en el header**, NO dentro de la
      tarjeta.
- [x] Atajo **⌘ + ←** (Mac) / **Ctrl + ←** (Windows) navega hacia atrás.
- [x] El atajo **NO** se dispara mientras se escribe en un input/textarea.

**Notas:**

---

## 4. 🚗 Modal de Flota reescrito (tabs)

**Ruta:** `/fleet` → botón **+** (crear vehículo).

- [x] Tiene 3 tabs: **Básica / Especificaciones / Adicional** (igual que
      Contactos).
- [x] Alto natural (no fijo al 90%), scroll normal.
- [ ] Tab **Adicional**: el selector de **mantenimiento** (fecha + hora **AM/PM** + recurrencia) funciona.
- [x] Responsables / conductores / imagen cargan bien.
- [ ] Guardar crea el vehículo correctamente.

**Notas:**

---

## 5. 📥 Import de leads (campos nuevos)

**Ruta:** `/users` → **Importar**.

- [x] La **plantilla** descargada trae las 16 columnas (cédula, dirección, fecha
      de nacimiento, especialidades, contacto de emergencia, LinkedIn, licencia,
      etc.).
- [x] Subir un archivo con esos campos → se guardan **todos** en el contacto (no
      solo nombre/email).
- [x] **Fecha de nacimiento** NO se desplaza un día (fix de timezone).

**Notas:**

---

## 6. 📋 service-orders con layout admin

**Ruta:** `/service-orders/[id]`.

- [-] Tiene el **shell de admin** (header con título + botón volver), no suelto.

**Notas:**

---

## Resultado global

- [ ] Todas las secciones pasan → **listo para PR → develop**.

### Incidencias encontradas

| #   | Módulo | Qué se esperaba | Qué pasó | Severidad |
| --- | ------ | --------------- | -------- | --------- |
|     |        |                 |          |           |
|     |        |                 |          |           |
