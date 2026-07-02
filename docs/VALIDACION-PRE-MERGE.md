# Validación pre-merge — rama `chore/servicios-cleanup-refactor`

Checklist para validar **antes de mergear los 2 PRs a `develop`**.
Marca cada casilla solo cuando la verificación pase. Rutas:

- Frontend: `/Users/ccsmiguelangel/code/2025Car4You/frontend`
- Backend: `/Users/ccsmiguelangel/code/2025Car4You/backend`

> Regla de oro: tú mergeas a `develop`. Nada se borra de la BD sin tu aprobación explícita.

---

## 0. Seguridad / entorno

- [ ] El **nuevo** `STRAPI_API_TOKEN` (ya rotado) está puesto en `frontend/.env.development`.
- [ ] `git status` en frontend **NO** lista `.env.development` (debe estar ignorado).
  ```bash
  cd frontend && git check-ignore .env.development && echo "OK: ignorado"
  ```
- [ ] El backend arranca y el `.env` está presente.
  ```bash
  cd backend && test -f .env && echo "OK: .env presente"
  ```

---

## 1. Tests verdes (ambos repos)

- [ ] Backend — 10 tests ✓
  ```bash
  cd backend && pnpm test     # o: npx vitest run
  ```
- [ ] Frontend — 325 tests ✓
  ```bash
  cd frontend && pnpm test
  ```

---

## 2. Build de producción (ambos repos)

- [ ] Frontend compila sin errores
  ```bash
  cd frontend && pnpm build
  ```
- [ ] Backend compila sin errores
  ```bash
  cd backend && pnpm build
  ```
- [ ] Spot-check: el bundle de prod del frontend **no** contiene `console.log`
      (la config `removeConsole` debe haberlos eliminado; `console.error/warn` se permiten).

---

## 3. Lint / formato

- [ ] Frontend sin errores de lint
  ```bash
  cd frontend && pnpm lint
  ```
- [ ] Backend sin errores de lint
  ```bash
  cd backend && pnpm lint
  ```

---

## 4. Pre-commit hooks (husky + lint-staged + commitlint)

- [ ] Un mensaje de commit **no convencional** es rechazado (prueba en una rama desechable):
  ```bash
  cd frontend && git commit --allow-empty -m "mensaje malo sin tipo"   # debe FALLAR
  ```
- [ ] Un mensaje **convencional** pasa:
  ```bash
  git commit --allow-empty -m "chore: prueba de hook"   # debe PASAR
  git reset --soft HEAD~1   # deshacer la prueba
  ```

---

## 5. Servicios — verificación funcional (el bug original)

Con backend **y** frontend corriendo:

- [ ] `/adm-services` lista los servicios **sin** el toast de error
      ("No pudimos cargar los servicios").
- [ ] El **calendario** de servicios carga.
- [ ] CRUD round-trip contra Strapi:
  - [ ] Crear un servicio → aparece en el listado.
  - [ ] Editar ese servicio → cambios persisten tras refresh.
  - [ ] Eliminar ese servicio → desaparece.

---

## 6. CONTACTOS — verificación funcional (cleanup #14)

Con ambos servidores corriendo:

- [ ] `/users` (CONTACTOS) carga el listado de contactos.
- [ ] Abrir el detalle de un contacto muestra todos los campos
      (linkedin, especialidades, billing\*, licencia, etc.).
- [ ] Convertir un **lead** a usuario (`/convert`) sigue funcionando.
- [ ] Importar leads por archivo (batch import) sigue funcionando.
- [ ] El campo `password` legacy ya **no** existe en `user_profiles`
      (eliminado con backup) y nada se rompió por ello.

---

## 7. Revisión de los PRs

- [ ] **Frontend PR #1** — _"Servicios fix + cleanup, standards & feature-based refactor"_:
      revisar diff, descripción y que CI (si aplica) esté verde.
- [ ] **Backend PR #1** — _"Servicios permission fix + cleanup & standards"_:
      ídem.
  ```bash
  gh pr view 1 --repo <frontend>   # y backend
  ```

---

## 8. Limpieza de BD — SOLO aprobar, NO ejecutar aún

Ver `backend/docs/CLEANUP-REPORT.md`. Decidir qué autorizas para una pasada futura
(con backup previo). **No borrar nada en este merge.**

- [ ] §3 — 5 borrables fuertes (`singin`, `signup`, `dashboard`, `dashboard-metric`,
      `stat-entry`): ¿confirmas que ningún cliente externo los consume? → aprobar / posponer.
- [ ] §4 — 19 candidatos a revisar (tablas vacías con scaffolding):
      confirmar uno por uno que ninguno sea feature WIP.
      ⚠️ `fleet-mileage-history` es WIP (integración km / ClickUp) → **NO tocar**.
- [ ] §6 — drafts duplicados en `services` (ids 1 y 3): ¿son ediciones pendientes
      o se pueden borrar? → aprobar / posponer.

---

## 9. Cierre

- [ ] Backup de BD confirmado antes de cualquier acción destructiva futura
      (`backend/backups/` — nunca commitear).
- [ ] Mergear **Frontend PR #1** → `develop`.
- [ ] Mergear **Backend PR #1** → `develop`.
- [ ] (Opcional) Borrar la rama remota tras el merge.
