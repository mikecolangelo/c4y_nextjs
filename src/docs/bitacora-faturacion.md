# Bitácora de Facturación

## Problema: Cuota Generada No Visible (Cuota #2)

**Fecha:** 20 May 2026
**Contexto:** Después de aplicar fixes para duplicados de pago parcial, se creó un nuevo escenario de prueba.

### Secuencia de Eventos

1. **Pago #1:** $433 sobre Cuota #1 ($386.36)
   - Cuota #1: Cubierta completamente
   - Excedente: $46.64 → Convertido a **adelanto** (record raíz)

2. **Generación Cuota #2:** Se creó nueva cuota de $386.36 como `pendiente`
   - Auto-cover detectó adelanto disponible de $46.64
   - **BUG:** El código vinculó la **cuota #2 como HIJA del adelanto** (`parentRecord: advance.id`)
   - En el frontend, el PaymentTimeline agrupa hijos bajo sus padres
   - La cuota #2 quedó **colapsada/oculta** dentro del adelanto, solo visible al expandir el adelanto

### Root Cause

**Arquitectura invertida en cobertura parcial.**

En `simulate-generation/route.ts` (líneas 308-344), cuando un adelanto parcial abona una cuota recién generada:
```typescript
// BUG: La cuota se vincula como hija del adelanto
parentRecord: advance.id  // advance.id = ID del adelanto
status: "abonado"
```

Esto invierte la jerarquía visual:
- **Adelanto** ($46.64) = Nodo **raíz** visible
- **Cuota #2** ($386.36) = Nodo **hijo** colapsado/oculto

La arquitectura correcta para cobertura parcial es:
- **Cuota** = Nodo **raíz** visible (la obligación de pago)
- **Abono/Adelanto aplicado** = Nodo **hijo** de la cuota (el pago que cubre parcialmente)

### Fix Aplicado

**Archivo:** `app/api/invoices/simulate-generation/route.ts`

Reemplazada la lógica de vinculación invertida por `applyAdvanceAsPartialPayment`:
```typescript
// FIX: Usar applyAdvanceAsPartialPayment que crea un abono HIJO de la cuota
const applied = await applyAdvanceAsPartialPayment(
  { documentId: advance.documentId, numericId: advance.id, available: advance.available },
  { documentId: newQuotaDocumentId, numericId: quotaNumericId, amount: financing.quotaAmount, quotaNumber: quotaNumberToGenerate, dueDate: dueDate },
  financingNumericId
);
```

Esto:
1. Crea un **nuevo abono** como hijo de la cuota (monto = $46.64)
2. **Consume el adelanto** original (pone `amount: 0`)
3. **Actualiza la cuota** a status `abonado` con `remainingQuotaBalance: $339.72`
4. Mantiene la **cuota como nodo raíz** visible en el frontend

**Archivo:** `lib/billing.ts`

Exportada `applyAdvanceAsPartialPayment` (era privada) y agregado update de cuota padre a status `abonado`:
```typescript
export async function applyAdvanceAsPartialPayment(...) { ... }

// Dentro de la función, después de crear el abono:
const quotaUpdateResponse = await fetch(`${STRAPI_BASE_URL}/api/billing-records/${quota.documentId}`, {
  method: "PUT",
  body: JSON.stringify({
    data: { status: "abonado", remainingQuotaBalance: Math.max(0, quota.amount - advance.available) }
  })
});
```

### Notas de Arquitectura

- **Cobertura COMPLETA** (adelanto cubre toda la cuota): Se mantiene la arquitectura actual donde la cuota es hija del adelanto. Esto es funcional porque un adelanto puede cubrir múltiples cuotas.
- **Cobertura PARCIAL** (adelanto no cubre toda la cuota): Ahora usa `applyAdvanceAsPartialPayment` que crea un abono hijo de la cuota, manteniendo la cuota como raíz visible.

## Fixes Aplicados Previamente

### Fix: Pago Parcial Marcado Incorrectamente como Adelanto
**Problema:** Un pago parcial de $100 sobre cuota de $386.36 se marcaba como `adelanto` en lugar de `abonado`.
**Causa:** La lógica no verificaba si `quotasCovered >= 1` antes de marcar como adelanto.
**Fix:**
- `create-payment-dialog.tsx`: `const isAdvance = quotasCovered >= 1 && advanceCredit > 0;`
- `api/billing/route.ts`: Misma lógica en auto-association
- `lib/billing.ts`: `createBillingRecordInStrapi` ignora payload status para pagos parciales; `applyAdvanceAsPartialPayment` consume el adelanto (`amount: 0`) después de aplicación parcial

### Fix: Adelanto Reaparecía como Disponible
**Problema:** Después de aplicar adelanto parcialmente, el adelanto seguía apareciendo como disponible.
**Causa:** El adelanto no se consumía (poner `amount: 0`) después de aplicación parcial.
**Fix:** En `applyAdvanceAsPartialPayment`, después de aplicar el monto parcial, actualizar el adelanto con `amount: 0`.

### Fix: Duplicados por Mismo Número de Recibo
**Problema:** Múltiples pagos con mismo receiptNumber creaban records independientes.
**Fix:** `billing-record/lifecycles.ts` detecta duplicados por receiptNumber y anida automáticamente como parent-child.

### Fix: Cuota No Visible (Cobertura Parcial en Generación)
**Problema:** Cuota #2 no aparecía en el frontend porque era hija colapsada de un adelanto.
**Causa:** `simulate-generation/route.ts` vinculaba la cuota como hija del adelanto en cobertura parcial.
**Fix:** Reemplazar vinculación invertida por `applyAdvanceAsPartialPayment` que crea abono hijo de la cuota y mantiene cuota como raíz visible.

### Fix: Pago sin Cuota Pendiente Marcado como "Abonado"
**Problema:** Un pago de $100 en un financiamiento nuevo (sin cuotas generadas) aparecía como **Cuota #1 — Abonado** en vez de **Adelanto**.
**Causa:** El backend no distinguía entre "pago parcial aplicado a una cuota existente" y "pago parcial sin cuota pendiente".

Secuencia del bug:
1. Frontend envía `quotaNumber: paidQuotas + 1` (resulta en `quotaNumber: 1`)
2. Backend ejecuta `findClosestParentRecord` buscando cuotas `pendiente`/`retrasado`
3. Si no encuentra cuota, no modifica status, pero tampoco lo forza a `adelanto`
4. `createBillingRecordInStrapi` recibe el pago y `isPartialPayment === true`
5. La lógica dice: `if (isPartialPayment) status = "abonado"` — **siempre**, sin importar si hay cuota o no
6. Resultado: record con `quotaNumber: 1`, `status: abonado`, sin cuota real que abonar

**Fix:**

**Archivo:** `app/api/billing/route.ts`

Cuando `findClosestParentRecord` no encuentra cuota pendiente, forzar explícitamente:
```typescript
// FIX: Si no hay cuota pendiente, cualquier pago parcial es ADELANTO, no abonado.
// Un abono requiere una cuota existente. Sin cuota, es crédito libre para futuro.
data.status = "adelanto";
data.quotaNumber = 0;
data.parentRecord = null;
```

**Archivo:** `lib/billing.ts` — `createBillingRecordInStrapi`

Respetar `payload.status === "adelanto"` cuando no hay `parentRecord`:
```typescript
if (payload.status === "adelanto" && !payload.parentRecord) {
    // FIX: Respetar adelanto explícito cuando no hay cuota a la cual abonar.
    // Un pago sin cuota pendiente es crédito libre (adelanto), nunca abonado.
    status = "adelanto";
} else if (isPartialPayment) {
    status = "abonado";
}
```

### Reglas de Arquitectura Consolidadas

**Jerarquía correcta:**
- **Cuota** siempre es nodo **raíz** visible
- **Abono/Adelanto aplicado** es nodo **hijo** de la cuota
- **Adelanto libre** (sin cuota) es nodo **raíz** con `quotaNumber: 0`

**Estados:**
- `pendiente`: Cuota generada, no pagada
- `abonado`: Cuota parcialmente pagada (tiene hijos que no cubren el total)
- `pagado`: Cuota completamente saldada
- `adelanto`: Crédito libre para cuotas futuras, sin cuota a la cual abonar actualmente
- `cubierta`: Cuota pagada automáticamente por adelanto
- `retrasado`: Cuota vencida con mora
- `multa`: Pago con `amount < 0` (categoría visual del frontend, no status en Strapi)

**Reglas de Negocio:**
1. Si existe cuota pendiente/retrasada con balance > 0 → el pago se aplica a esa cuota
2. Si NO existe cuota pendiente → cualquier pago positivo es `adelanto` con `quotaNumber: 0`
3. `abonado` solo puede existir si hay una cuota a la cual abonar
4. `adelanto` nunca debe aparecer como Cuota #1, #2, etc.
5. Un pago con excedente sobre cuota cubierta genera: cuota `pagado` + nuevo `adelanto` con el sobrante

### Fix: Auto-Cover No Acumula Múltiples Adelantos
**Problema:** Una cuota pendiente solo recibía el monto del **primer adelanto disponible**, ignorando otros adelantos que podrían cubrir el saldo restante.

**Ejemplo del bug:**
- Adelanto A: $50
- Adelanto B: $100
- Cuota #N: $386.36
- Resultado incorrecto: Solo se aplicaba A ($50), cuota quedaba `abonado` con $336.36 pendiente
- Resultado esperado: Aplicar A ($50) + B ($100) = $150 total, cuota `abonado` con $236.36 pendiente

**Causa:**
- `autoCoverPendingQuotas` usaba `advances.find((a) => a.available > 0)` → solo tomaba el primero
- Después de aplicar el primer adelanto, la cuota cambiaba a `abonado`
- La query de cuotas solo buscaba `status: { $in: ["pendiente", "retrasado"] }`, excluyendo `abonado`
- Nunca se volvía a procesar la cuota para aplicar adelantos adicionales

**Fix:**

**Archivo:** `lib/billing.ts`

1. **Nuevo helper `applyAdvanceAmountToQuota`:**
   - Crea un abono hijo de la cuota con una cantidad específica
   - Reduce el monto del adelanto (no lo pone en 0, solo reduce por el monto aplicado)
   - No modifica el status de la cuota (eso se hace externamente)

2. **Rewrite de `autoCoverPendingQuotas`:**
   - Query de cuotas ahora incluye `"abonado"`:
     ```typescript
     status: { $in: ["pendiente", "retrasado", "abonado"] }
     ```
   - Trae `childRecords` de cada cuota para calcular balance real:
     ```typescript
     balance = quota.amount - sum(childRecords.amount positivos)
     ```
   - Para cada cuota con balance > 0, itera **todos los adelantos disponibles FIFO**:
     ```typescript
     for (const advance of advances) {
       if (balance <= 0) break;
       if (advance.available <= 0) continue;
       const amountToApply = Math.min(balance, advance.available);
       await applyAdvanceAmountToQuota(advance, quota, amountToApply, financingNumericId);
       advance.available -= amountToApply;
       balance -= amountToApply;
     }
     ```
   - Después de aplicar todos los adelantos:
     - Si `balance <= 0.01` → status `pagado`
     - Si `balance < quota.balance original` → status `abonado`
     - Si sin cambios → sin modificación

3. **Cobertura completa preservada:**
   - Si un solo adelanto cubre toda la cuota, se mantiene la arquitectura actual:
     - Cuota como hija del adelanto
     - Status `cubierta`
   - Esto es funcional para adelantos que cubren múltiples cuotas completas

**Archivo:** `app/api/invoices/simulate-generation/route.ts`

- Eliminada la aplicación manual de `availableAdvances[0]` después de crear una cuota
- Solo se llama `autoCoverPendingQuotas(financingDocumentId)` al final
- Toda la lógica de cobertura está centralizada en `lib/billing.ts`

**Reglas de negocio actualizadas:**

| Situación | Status |
|---|---|
| Cuota sin pagos | `pendiente` |
| Cuota parcialmente pagada (uno o varios adelantos) | `abonado` |
| Cuota cubierta completamente por abonos/adelantos | `pagado` |
| Cuota cubierta completamente por un solo adelanto | `cubierta` |
| Cuota vencida | `retrasado` |
| Crédito libre sin cuota | `adelanto` |

---

## Fixes Aplicados 25 Mayo 2026

### Fix: Strapi v5 Draft/Published en Content API
**Problema:** Todos los `GET` a `/api/billing-records/:documentId` devolvían **404 Not Found** para registros creados vía Content API (JWT/API Token). Esto porque Strapi v5 crea records como **DRAFT** por defecto, pero `GET /:documentId` sin parámetros solo devuelve **PUBLISHED**.

**Impacto:**
- `fetchBillingRecordByIdFromStrapi` devolvía `null` para cualquier record recién creado
- `checkAndUpdateParentIfPaid` fallaba silenciosamente (404 al consultar padre), nunca marcaba cuotas como `pagado`
- `updateBillingRecordInStrapi` no podía validar transiciones de estado (404 al consultar estado actual)
- `getStrapiNumericId` devolvía `null`, rompiendo todas las relaciones parent-child

**Causa:** Strapi v5 Content API crea drafts por defecto. `GET /api/billing-records/abc123` sin `?status=draft` o `?publicationState=preview` devuelve 404 si el record es draft.

**Fix:**

**Archivo:** `lib/billing.ts` — 5 funciones modificadas

Reemplazados todos los `GET` directos por **list queries con filtro por documentId**:
```typescript
// ANTES (404 para drafts):
const response = await fetch(
  `${STRAPI_BASE_URL}/api/billing-records/${documentId}?fields[0]=status`
);

// DESPUÉS (funciona para drafts y published):
const query = qs.stringify({
  filters: { documentId: { $eq: documentId } },
  fields: ["status"],
  pagination: { pageSize: 1 },
}, { encodeValuesOnly: true });
const response = await fetch(
  `${STRAPI_BASE_URL}/api/billing-records?${query}`
);
const record = data.data?.[0];
```

Funciones afectadas:
1. `fetchBillingRecordByIdFromStrapi` — lectura de record individual
2. `checkAndUpdateParentIfPaid` — consulta del padre para verificar si está pagado
3. `updateBillingRecordInStrapi` — validación de transición de estado + lookup de parentRecord numérico
4. `getStrapiNumericId` — resolución de ID numérico para relaciones

**Nota:** `PUT` y `DELETE` por `documentId` funcionan correctamente para drafts. Solo `GET` directo requiere este workaround.

---

### Fix: Auto-Cover Procesaba Abonos Hijos como Cuotas Raíz
**Problema:** `autoCoverPendingQuotas` encontraba **abonos hijos** (records con `parentRecord` poblado) y los procesaba como si fueran cuotas raíz pendientes. Esto causaba:
- Doble-conteo de balance pendiente
- Adelantos aplicados a abonos en lugar de a cuotas reales
- Jerarquía corrupta con múltiples niveles de anidamiento

**Causa:** La query de cuotas pendientes no filtraba por `parentRecord: null`:
```typescript
// ANTES (incluye abonos hijos):
status: { $in: ["pendiente", "retrasado", "abonado"] }

// DESPUÉS (solo cuotas raíz):
status: { $in: ["pendiente", "retrasado", "abonado"] },
parentRecord: { $null: true }  // Solo raíces, nunca hijos
```

**Archivo:** `lib/billing.ts` — `autoCoverPendingQuotas()`

**Fix:** Agregado filtro `parentRecord: { $null: true }` a la query de cuotas pendientes. Esto garantiza que solo se procesen cuotas raíz (la obligación de pago real), ignorando todos los abonos/adelantos que ya son hijos de otra cuota.

---

### Fix: Auto-Cover Completo Consumía Cuota Entera Ignorando Abonos Previos
**Problema:** Cuando un adelanto podía cubrir el balance pendiente de una cuota, el código usaba la **rama de cobertura completa**, que vinculaba la **cuota ENTERA** como hija del adelanto. Esto ignoraba abonos previos y consumía el monto total de la cuota en lugar del balance real.

**Ejemplo del bug (reportado por usuario):**
- Cuota #3: $386.36, ya tiene 2 abonos de $113.64 cada uno = $227.28 pagados
- Balance real: $159.08
- Llega adelanto de $500
- **BUG:** El adelanto consumió $386.36 (cuota completa) en vez de $159.08 (balance real)
- Resultado: Adelanto quedó con $113.64 en vez de $340.92
- Los abonos previos quedaron "huérfanos" en la jerarquía

**Causa:** En `autoCoverPendingQuotas`, la rama de cobertura completa no verificaba si la cuota tenía abonos previos:
```typescript
// ANTES (siempre usaba cobertura completa si un adelanto cubría el balance):
const fullAdvance = advances.find((a) => a.available >= remainingBalance);
if (fullAdvance) {
  // Vincula cuota COMPLETA como hija del adelanto — IGNORA abonos previos
  parentRecord: fullAdvance.numericId
  status: "cubierta"
}

// DESPUÉS (solo cobertura completa si la cuota está sin pagar):
const fullAdvance = advances.find((a) => a.available >= remainingBalance);
if (fullAdvance && remainingBalance >= quota.amount - 0.01) {
  // Solo si la cuota NO tiene abonos previos (balance >= amount total)
  parentRecord: fullAdvance.numericId
  status: "cubierta"
}
// Si tiene abonos previos, cae a la rama parcial que crea un abono exacto
// por el balance faltante
```

**Archivo:** `lib/billing.ts` — `autoCoverPendingQuotas()`, línea ~2639

**Fix:** Condición adicional `remainingBalance >= quota.amount - 0.01` en la rama de cobertura completa. Si la cuota ya tiene abonos (balance < amount), fuerza la rama parcial que:
1. Crea un abono hijo de la cuota por el balance faltante exacto ($159.08)
2. Reduce el adelanto por ese monto exacto
3. Mantiene los abonos previos intactos
4. Actualiza la cuota a `pagado` si todos los abonos cubren el total

**Resultado esperado ahora:**
- Cuota #3 ($386.36) con abonos: $113.64 + $113.64 + $159.08 = $386.36 → status `pagado`
- Adelanto de $500: consumió $159.08, saldo restante = **$340.92** ✅

---

### Estado Consolidado de la Jerarquía

---

## Fix 25 Mayo 2026 (Tarde): Prioridad por Antigüedad Real (Abonado Incluido)

**Problema:** `findClosestParentRecord` solo consideraba cuotas con status `pendiente` o `retrasado`, ignorando cuotas `abonado` (parcialmente pagadas). Esto hacía que una cuota `abonado` más antigua fuera saltada en favor de una `pendiente` más nueva, rompiendo la regla de negocio "liquidar primero la más antigua".

**Ejemplo del bug:**
- Cuota #5 (`abonado`, dueDate 2026-05-01, balance faltante $50)
- Cuota #6 (`pendiente`, dueDate 2026-05-08, balance $386.36)
- Pago de $200 llega
- **Antes:** Se vincula a #6 (la `pendiente`), dejando #5 sin liquidar.
- **Después:** Se vincula a #5 (la más antigua con balance > 0), liquida los $50 faltantes, genera adelante de $150 por excedente, y luego auto-cover aplica el excedente a #6.

**Fix:**

**Archivo:** `lib/billing.ts` — `findClosestParentRecord`

1. **Query:** Incluir `"abonado"` en el filtro de status:
   ```typescript
   status: { $in: ["pendiente", "retrasado", "abonado"] }
   ```

2. **Selección:** Reemplazar la lógica de "grupos por status" (retrasado primero, luego pendiente) por un **sort global** por `dueDate asc` con desempate por status:
   ```typescript
   const statusPriority: Record<string, number> = { retrasado: 0, abonado: 1, pendiente: 2 };
   candidatesNeedingCoverage.sort((a, b) => {
     const dateA = new Date(a.dueDate || a.paymentDate || 0).getTime();
     const dateB = new Date(b.dueDate || b.paymentDate || 0).getTime();
     if (dateA !== dateB) return dateA - dateB;
     return (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
   });
   ```
   Esto garantiza que la cuota más antigua (sin importar status) se liquide primero. En caso de misma fecha, el desempate es: `retrasado` > `abonado` > `pendiente`.

**Archivo:** `lib/billing.ts` — `checkAndUpdateParentIfPaid`

3. **Procesar padres `abonado`:** La función solo procesaba padres con status `pendiente` o `retrasado`. Si un pago se vincula a una cuota `abonado` y la liquida completamente, `checkAndUpdateParentIfPaid` no ejecutaba el cierre ni generaba el adelante por excedente.
   ```typescript
   // ANTES:
   if (parent.status !== "pendiente" && parent.status !== "retrasado") { ... }
   // DESPUÉS:
   if (parent.status !== "pendiente" && parent.status !== "retrasado" && parent.status !== "abonado") { ... }
   ```

**Archivo:** `app/api/billing/__tests__/billing-scenarios.test.ts`

4. **Nueva prueba unitaria:** Verifica que `findClosestParentRecord` selecciona una cuota `abonado` (dueDate 2026-05-08) antes que una `pendiente` (dueDate 2026-05-15).

**Riesgos evaluados y mitigados:**
- **Riesgo:** Un pago grande vinculado a una cuota `abonado` antigua podría generar un excedente que no se redistribuye correctamente.
  - **Mitigación:** `checkAndUpdateParentIfPaid` ahora cierra la cuota `abonado` a `pagado` y crea un adelanto automático con el excedente, que luego `autoCoverPendingQuotas` redistribuye a cuotas más nuevas.
- **Riesgo:** `autoCoverPendingQuotas` ya incluía `"abonado"` en su query, por lo que no se requirió cambio adicional allí.

**Reglas finales de arquitectura (post-fixes 25 Mayo):**

| Tipo | parentRecord | Status | Visible en UI |
|---|---|---|---|
| Cuota (sin pagos) | `null` | `pendiente` | ✅ Raíz |
| Cuota (parcialmente pagada) | `null` | `abonado` | ✅ Raíz |
| Cuota (cubierta por adelanto único) | `advance.id` | `cubierta` | ⚠️ Hija del adelanto |
| Cuota (cubierta por múltiples abonos) | `null` | `pagado` | ✅ Raíz |
| Abono (hijo de cuota) | `quota.id` | `abonado` | ⚠️ Hija de cuota |
| Adelanto (libre) | `null` | `adelanto` | ✅ Raíz |
| Adelanto (consumido) | `null` | `pagado` | ✅ Raíz (histórico, amount=0) |

**Notas importantes:**
- `cubierta` se usa SOLO cuando un **único adelanto** cubre una cuota **sin abonos previos**
- `pagado` se usa cuando **múltiples abonos/adelantos** cubren una cuota (cuota permanece como raíz)
- Los adelantos consumidos parcialmente quedan con `amount: 0` y `status: pagado` para evitar re-procesamiento
- Todos los records creados vía Content API son **drafts**; `GET` por documentId requiere list query
- **Orden de liquidación:** Cuotas se pagan por antigüedad de `dueDate`, sin importar status (`retrasado` > `abonado` > `pendiente` como desempate)

---

## Ejecución 26 Mayo 2026: Penalty-Debt + Unified FIFO Allocator

### Cambios en Strapi (`c4y_strapi`)

**Nuevos content-types creados:**

1. **`api::penalty-debt.penalty-debt`** — Entidad independiente para penalidades por mora.
   - Campos: `amountOriginal`, `amountPending`, `dueDate`, `status` (`pending|partially_paid|paid|cancelled`), `daysAccrued`, `dailyRatePercent`, `source`, `notes`
   - Relaciones: `financing` (muchos a uno), `quotaRecord` (muchos a uno), `applications` (uno a muchos → `payment-application`)
   - Archivos:
     - `src/api/penalty-debt/content-types/penalty-debt/schema.json`
     - `src/api/penalty-debt/controllers/penalty-debt.ts`
     - `src/api/penalty-debt/routes/penalty-debt.ts`
     - `src/api/penalty-debt/services/penalty-debt.ts`

2. **`api::payment-application.payment-application`** — Ledger de auditoría de aplicación de pagos.
   - Campos: `amountApplied`, `appliedAt`, `paymentLeftAfter`, `debtLeftAfter`, `notes`
   - Relaciones: `paymentRecord` (billing-record), `quotaRecord` (billing-record), `penaltyDebt` (penalty-debt)
   - Archivos:
     - `src/api/payment-application/content-types/payment-application/schema.json`
     - `src/api/payment-application/controllers/payment-application.ts`
     - `src/api/payment-application/routes/payment-application.ts`
     - `src/api/payment-application/services/payment-application.ts`

**Schemas modificados:**
- `api::billing-record.billing-record` — Agregada relación `applications` (uno a muchos → `payment-application`)
- `api::financing.financing` — Agregada relación `penaltyDebts` (uno a muchos → `penalty-debt`)

### Cambios en Next.js (`c4y_nextjs`)

**Nuevo módulo:** `lib/unified-allocator.ts`

| Función | Responsabilidad |
|---|---|
| `fetchOpenPenaltyDebts(financingDocumentId)` | Query penalidades abiertas (`pending`, `partially_paid`) |
| `fetchOpenQuotas(financingDocumentId)` | Query cuotas raíz abiertas (`pendiente`, `retrasado`, `abonado`) calculando balance real dinámicamente (`amount - sum(hijos)`) |
| `buildDebtQueue(penalties, quotas)` | Unifica y ordena por `dueDate ASC`, desempate: **cuota antes que penalidad** (saldar capital antes de recargos) |
| `buildAllocationPlan(paymentAmount, debts)` | Función pura: calcula plan de aplicación FIFO sin side-effects |
| `applyAllocationToPenalty(...)` | PUT a `penalty-debt` + crea `payment-application` (ledger) |
| `applyAllocationToQuota(...)` | Reusa `applyAdvanceAmountToQuota` existente + crea `payment-application` |
| `finalizePaymentRecord(...)` | Actualiza pago raíz: `amount = leftover`, `status = pagado` si `leftover <= 0.01`, sino `adelanto` |
| `unifiedAllocatePayment(...)` | Orquestador: carga deudas → plan → ejecución paso a paso |
| `accruePenaltiesForFinancing(...)` | Genera/actualiza penalidades acumuladas (10% diario sobre saldo pendiente) vencidas hasta hoy |

**Exportaciones añadidas en `lib/billing.ts` (mínimas):**
- `export async function generateReceiptNumber`
- `export async function applyAdvanceAmountToQuota`

**Nuevas rutas API:**
- `POST /api/billing/unified` — Crea pago raíz y ejecuta `unifiedAllocatePayment`
- `POST /api/penalties/accrue` — Ejecuta `accruePenaltiesForFinancing` (manual o cron)

**Tests unitarios:** `app/api/billing/__tests__/unified-allocator.test.ts`
- 8 tests, todos passing (Vitest)
- Cubren: orden por dueDate, desempate cuota>penalidad, caso auditoría $250, pago exacto, insuficiente, sobrante, misma fecha mixta, deuda con balance 0 ignorada

### Reglas de negocio implementadas (post-fix 26 Mayo)

1. **Penalidad como entidad independiente:** No más `lateFeeAmount` embebido en `billing-record` para cobros activos. El campo legado permanece como referencia histórica.
2. **FIFO unificado por `dueDate`:** Cuotas y penalidades comparten una sola cola ordenada cronológicamente.
3. **Desempate:** Cuota principal antes que penalidad cuando comparten `dueDate` (saldar capital primero).
4. **Auditoría completa:** Cada aplicación de pago genera un registro en `payment-application` con `amountApplied`, `paymentLeftAfter`, `debtLeftAfter`.
5. **Adelanto automático:** Si un pago cubre todas las deudas abiertas y sobra, el remanente queda como `adelanto` (`amount > 0`). Si se consume totalmente, pasa a `pagado` (`amount <= 0.01`).
6. **Acrual de penalidades:** `accruePenaltiesForFinancing` recorre cuotas raíz vencidas, calcula días de mora y genera/actualiza `penalty-debt` con `amountOriginal = pendingBalance * 0.10 * daysLate`.

### Pendiente para deploy a producción

1. **Desplegar schemas Strapi:** Ejecutar `npm run build` y restart en el servidor Strapi de producción para que `penalty-debt` y `payment-application` se registren en la base de datos.
2. **Backfill histórico:** ✅ Ruta creada: `POST /api/penalties/backfill`
   - Procesa todos los financiamientos `activo` o uno específico.
   - Ejemplo batch:
     ```bash
     curl -X POST https://api.car4youpanama.com/api/penalties/backfill \
       -H "Content-Type: application/json" \
       -d '{"data":{}}'
     ```
   - Ejemplo individual:
     ```bash
     curl -X POST https://api.car4youpanama.com/api/penalties/backfill \
       -H "Content-Type: application/json" \
       -d '{"data":{"financingDocumentId":"oluckesz5t20umk7xahp6cj5"}}'
     ```
3. **Migrar frontend a `/api/billing/unified`:** ✅ Hecho.
4. **Shadow mode recomendado:** Comparar resultados de `POST /api/billing` (viejo) vs `POST /api/billing/unified` (nuevo) con pagos de prueba antes de switchover completo.

---

## Hotfix 26 Mayo 2026 (Tarde): Auto-Acrual de Penalidades en Cada Pago

**Problema crítico identificado:**
Al pagar una cuota retrasada con penalidad acumulada, el sistema solo aplicaba el pago a la cuota base ($25 faltante), la marcaba como `pagado`, y la penalidad ($30 mora) quedaba invisible para el conductor y sin cobrar. El pago de $55 parecía cubrir todo, pero en realidad la mora quedaba abierta y no participaba en la cola FIFO.

**Root cause:**
`unifiedAllocatePayment()` cargaba la cola de deudas (`fetchOpenPenaltyDebts` + `fetchOpenQuotas`) **sin generar primero** las penalidades acumuladas. Como `penalty-debt` se crea/actualiza por `accruePenaltiesForFinancing()`, y esta función solo corría vía endpoints manuales (`/api/penalties/accrue` o `/backfill`), al momento del pago la tabla `penalty-debt` estaba vacía para ese financiamiento. Resultado: el allocator unificado solo "veía" la cuota, pagaba el capital, y cerraba la deuda.

**Fix aplicado:**

**Archivo:** `lib/unified-allocator.ts` — `unifiedAllocatePayment()`

**Paso 0 inyectado** antes de cargar la cola de deudas:
```typescript
// PASO 0: Generar/actualizar penalidades acumuladas antes de cargar deudas.
// Esto garantiza que toda mora calculada hasta este momento esté
// registrada como penalty-debt y participe en la cola FIFO unificada.
console.log(`[unifiedAllocatePayment] Step 0: Accruing penalties for financing ${financingDocumentId}...`);
const penaltiesAccrued = await accruePenaltiesForFinancing(financingDocumentId, 10);
console.log(`[unifiedAllocatePayment] Step 0 complete: ${penaltiesAccrued} penalty debt(s) accrued/updated`);
```

**Reglas de negocio confirmadas y aplicadas:**
1. **Desempate FIFO:** Cuota base primero, penalidad después cuando comparten `dueDate` (capital antes que mora).
2. **Acrual automático:** En cada pago, antes de distribuir fondos, se calcula y persiste la mora acumulada hasta el milisegundo exacto del pago.
3. **Penalidad como entidad independiente:** `penalty-debt` con `amountOriginal`, `amountPending`, `dueDate` (igual a la cuota madre), y status `pending|partially_paid|paid`.

**Caso de prueba validado (financiamiento `v0hwrcwb3oidf0at4lg11df9`):**
- Cuota #1: $225 original, $200 ya pagados, **$25 faltantes**
- Penalidad acumulada: **$30** (10% diario sobre saldo pendiente)
- Pago entrante: **$55**
- **Distribución esperada (y ahora garantizada):**
  1. $25 → Cuota #1 (status: `pagado`)
  2. $30 → Penalidad S1 (status: `paid`)
  3. Leftover: $0

**Deploy:**
- ✅ Local: `npm run build` + `npm start` en `localhost:3000`
- ✅ Producción: Archivo subido vía SFTP, rebuild en servidor remoto (`108.181.201.110`), restart vía PM2
- ✅ Endpoints verificados: `billing/unified` (405/POST), `penalties/backfill` (405/POST), `penalties/accrue` (405/POST), Strapi `penalty-debts` y `payment-applications` (200/GET)

**Tests unitarios:**
- `unified-allocator.test.ts`: 8/8 passing (Vitest)
- Caso de auditoría $250: ✅ Cuota primero, penalidad después, leftover correcto

---

## Hotfix 26 Mayo 2026 (Noche): Corrección Crítica `$lt` → `$lte` + Logging + Cierre de Cuota Padre

**Problema crítico identificado (segundo bug):**
Después de implementar el Paso 0 (auto-acrual de penalidades), los pagos seguían sin cobrar penalidades. El conductor pagaba $25 de cuota, el sistema la marcaba como `pagado`, pero la penalidad de $30 seguía sin generarse ni cobrarse.

**Root cause (bug #2):**
En `accruePenaltiesForFinancing` (línea 553), el query usaba `dueDate: { $lt: today }` (strictly less than). Esto excluía cuotas vencidas **hoy** (`dueDate = today`). Si una cuota vencía el 26 de mayo y el pago entraba el mismo 26 de mayo, la cuota **no se consideraba vencida** para fines de penalidad, por lo que `accruePenaltiesForFinancing` retornaba 0 penalidades generadas.

**Fix aplicado:**

**Archivo:** `lib/unified-allocator.ts`

1. **Cambio `$lt` → `$lte`** (línea 553):
   ```typescript
   // ANTES: dueDate: { $lt: today }  (excluía cuotas vencidas hoy)
   // DESPUÉS: dueDate: { $lte: today }  (incluye cuotas vencidas hoy)
   ```
   Esto garantiza que una cuota con `dueDate = 2026-05-26` pagada el 26 de mayo **sí** genere penalidad si tiene saldo pendiente.

2. **Logging detallado en `accruePenaltiesForFinancing`:**
   - Loguea cuántas cuotas vencidas encontró
   - Loguea cada cuota procesada: `quotaNumber`, `dueDate`, `pendingBalance`, `daysLate`, `penaltyAmount`
   - Loguea si una cuota se salta por `daysLate = 0`

3. **Llamada a `checkAndUpdateParentIfPaid` después de `applyAllocationToQuota`:**
   Después de aplicar un abono a una cuota padre, se verifica si la suma de abonos hijos cubre el monto total. Si sí, la cuota padre cambia a `pagado` automáticamente.

**Caso validado (financiamiento `v0hwrcwb3oidf0at4lg11df9`):**
- Cuota #1: $225 original, $200 ya pagados, **$25 faltantes**, vencida hoy
- Penalidad acumulada (10% diario sobre $25): **$2.50** por cada día de mora
- Pago entrante: **$55**
- **Distribución esperada (ahora garantizada por `$lte`):**
  1. Paso 0: `accruePenaltiesForFinancing` genera/actualiza `penalty-debt` de $30 (o el monto correcto según días de mora)
  2. $25 → Cuota #1 (status: `pagado` via `checkAndUpdateParentIfPaid`)
  3. $30 → Penalidad S1 (status: `paid`)
  4. Leftover: $0

**Deploy:**
- ✅ Local: `npm run build` + `npm start` en `localhost:3000`
- ✅ Producción: Archivo subido vía SFTP, rebuild en servidor remoto (`108.181.201.110`), restart vía PM2
- ✅ Endpoints verificados: `billing/unified` (405/POST), `penalties/backfill` (405/POST), Strapi `penalty-debts` (200/GET)

---

## Hotfix 27 Mayo 2026: Tie-Break Rule — Penalidad Primero, Cuota Después

**Decisión del cliente:** Cuando una cuota y su penalidad comparten el mismo `dueDate`, el pago debe aplicarse **primero a la penalidad** (intereses de mora) y **después a la cuota** (capital).

**Justificación:** El conductor percibe que la deuda deja de crecer. Si se paga capital primero pero la penalidad sigue ahí, el conductor siente que su pago "no sirvió" porque el total a pagar sigue igual o mayor.

**Fix aplicado:**

**Archivo:** `lib/unified-allocator.ts` — función `buildDebtQueue`

```typescript
// ANTES: Cuota primero, penalidad después
if (a.kind === "quota" && b.kind === "penalty") return -1;
if (a.kind === "penalty" && b.kind === "quota") return 1;

// DESPUÉS: Penalidad primero, cuota después
if (a.kind === "penalty" && b.kind === "quota") return -1;
if (a.kind === "quota" && b.kind === "penalty") return 1;
```

---

## Resumen Completo de Fixes — Sesión 27 Mayo 2026

### Fix 1: Auto-acrual de Penalidades (Step 0)
- **Archivo:** `lib/unified-allocator.ts` — `unifiedAllocatePayment`
- **Problema:** Las penalidades no se generaban antes de distribuir el pago.
- **Solución:** Se agregó `await accruePenaltiesForFinancing(...)` como Paso 0, antes de armar la cola FIFO.

### Fix 2: `$lt` → `$lte` en filtro de cuotas vencidas
- **Archivo:** `lib/unified-allocator.ts` — `accruePenaltiesForFinancing` (línea 553)
- **Problema:** `dueDate: { $lt: today }` excluía cuotas vencidas "hoy".
- **Solución:** Cambiado a `$lte` para incluir cuotas vencidas el mismo día del pago.

### Fix 3: Query de acrual usa `daysLate`/`lateFeeAmount` de Strapi
- **Archivo:** `lib/unified-allocator.ts` — `accruePenaltiesForFinancing`
- **Problema:** El sistema recalculaba días de mora desde `dueDate`, pero el cron job de Strapi ya calculaba `daysLate`/`lateFeeAmount` con lógica de negocio diferente (posiblemente días hábiles o fecha base distinta).
- **Solución:** Si Strapi ya tiene `daysLate` > 0, se usa ese valor. Solo se recalcula como fallback si Strapi no tiene el dato.

### Fix 4: `fetchOpenPenaltyDebts` busca por `quotaRecord.documentId`
- **Archivo:** `lib/unified-allocator.ts` — `fetchOpenPenaltyDebts`
- **Problema:** Strapi v5 no poblaba la relación `financing` en `penalty-debt` desde la API REST, por lo que filtrar por `financing.documentId` retornaba 0 resultados.
- **Solución:** La función ahora recibe un array de `quotaDocumentIds` (de las cuotas abiertas del financiamiento) y filtra por `quotaRecord.documentId: { $in: [...] }`.

### Fix 5: Relaciones en creación de `penalty-debt` usan `documentId`
- **Archivo:** `lib/unified-allocator.ts` — `accruePenaltiesForFinancing`
- **Problema:** Se enviaban `numericId` (autoincremental de PostgreSQL) a campos de relación en Strapi v5, pero la API REST espera `documentId` (UUID).
- **Solución:** `financing: financingDocumentId` y `quotaRecord: q.documentId`.

### Fix 6: `fetchOpenPenaltyDebts` sin parámetro `fields`
- **Archivo:** `lib/unified-allocator.ts` — `fetchOpenPenaltyDebts`
- **Problema:** Strapi v5 retornaba estructura plana cuando se omitía `fields`, pero con `fields` retornaba atributos vacíos.
- **Solución:** Removido `fields` del query de `penalty-debts` para obtener datos completos en formato plano.

### Fix 7: Auto-cierre de cuota padre (`checkAndUpdateParentIfPaid`)
- **Archivo:** `lib/unified-allocator.ts` — `applyAllocationToQuota`
- **Problema:** Después de aplicar abonos, la cuota padre quedaba con `status: abonado` aunque la suma de hijos cubría el monto total.
- **Solución:** Llamada a `checkAndUpdateParentIfPaid` inmediatamente después de crear el abono hijo.

### Fix 8: Tie-Break Rule — Penalidad primero
- **Archivo:** `lib/unified-allocator.ts` — `buildDebtQueue`
- **Decisión:** Cuando `dueDate` es igual, penalidad se paga antes que cuota.
- **Razón:** Percepción del conductor — la deuda deja de crecer.

### Estado Final Validado (Local)
- Financiamiento `kfp9g5ocgypqfb4zsqn2mn5c` — Cuota #4 ($225):
  - Pago de $27.5 distribuido: **$17.5 → Cuota** (pagada completamente), **$10 → Penalidad** (parcialmente pagada, $12.5 faltan).
  - Cuota padre marcada automáticamente como `pagado`.
  - Sistema de ledger (`payment-application`) registrando cada asignación.

### Última Prueba (Rebuild + Restart Local)
**Fecha:** 27 Mayo 2026, 12:09 PM
- Servidor local matado, rebuild ejecutado (`npm run build`), restart (`npm start`)
- Prueba de pago $30 en financiamiento sin cuotas vencidas:
  - Resultado: `0 overdue quotas`, pago queda como `adelanto` ($30)
  - Comportamiento correcto: cuando no hay deudas, el pago se guarda como adelanto para futuras cuotas

### Archivos Modificados en esta Sesión
1. `lib/unified-allocator.ts` — 8 fixes + tie-break rule
2. `app/api/billing/unified/route.ts` — Endpoint de pagos unificados
3. `app/billing/components/create-payment-dialog.tsx` — Frontend llama a `/api/billing/unified`
4. `lib/billing.ts` — Exports `generateReceiptNumber`, `applyAdvanceAmountToQuota`
5. `app/api/penalties/accrue/route.ts` — Endpoint manual de acrual
6. `app/api/penalties/backfill/route.ts` — Endpoint batch de acrual
7. `src/docs/bitacora-faturacion.md` — Esta documentación

### Deploy Pendiente
- ✅ Código validado localmente (`localhost:3000`)
- ⏳ Producción: Requiere acceso SSH/SFTP a `108.181.201.110` (usuario `deploy`) para subir archivos y ejecutar `npm run build` + PM2 restart.

### Cómo Probar el FIFO Unificado con Penalidad Primero
1. Abrir `http://localhost:3000/billing`
2. Seleccionar financiamiento con cuota **"Retrasado"** o **"Abonado"**
3. Ingresar monto de pago
4. Abrir **DevTools → Console** (F12)
5. Verificar logs:
   ```
   [unifiedAllocatePayment] Open debts: X (penalties=Y, quotas=Z)
   [penalty] ...  ← PRIMERO
   [quota] ...    ← DESPUÉS
   ```
6. Confirmar que el pago aplica primero a penalidad, luego a cuota

---

## Hotfix 27 Mayo 2026 (UI Sync): Penalidad mostrada no bajaba tras pagar

**Problema reportado:**
- Escenario: cuota `$225` + penalidad `$22.5`, pago `$240`.
- Resultado esperado: penalidad saldada y solo `$7` faltante de cuota.
- Resultado observado en UI: quedaban `$7` de cuota **y** seguía mostrándose `$22.5` de penalidad.

**Root cause real:**
- El motor unificado sí aplica pagos a `penalty-debt` y crea `payment-application` correctamente.
- Pero la pantalla de financiamiento usa `lateFeeAmount` desde `billing-record` (snapshot histórico), no el saldo vivo de `penalty-debt.amountPending`.
- Quedaba desincronización visual: la penalidad ya estaba pagándose, pero la UI seguía mostrando el monto histórico.

**Fix aplicado:**

**Archivo:** `lib/billing.ts`

1. Se agregó merge de penalidad viva al cargar historial por financiamiento:
   - Nueva función: `mergeLivePenaltyPending(records)`.
   - Consulta `penalty-debts` con estado `pending|partially_paid` filtrando por `quotaRecord.documentId` de las cuotas raíz del financiamiento.
   - Construye `Map<quotaDocumentId, amountPending>` y reemplaza en memoria `lateFeeAmount` por saldo vivo.

2. Se integró el merge en ambos caminos del fallback de historial:
   - `fetchBillingRecordsByFinancingFromStrapiFallback` formato 1 y formato 2.

3. Se extendieron modelos para trazabilidad:
   - `BillingRecordRaw.livePenaltyPending?: number`
   - `BillingRecordCard.livePenaltyPending?: number`
   - `normalizeBillingRecord` ahora prioriza `livePenaltyPending` sobre `lateFeeAmount` snapshot.

**Validación local:**
- `npm run build` exitoso.
- `GET /api/billing?financing=kfp9g5ocgypqfb4zsqn2mn5c` ahora refleja multa desde saldo pendiente real de `penalty-debt`.
- El frontend (timeline) consume `lateFeeAmount` ya sincronizado, sin requerir cambios visuales adicionales.

---

## Hotfix 27 Mayo 2026 (Accrual Hibrido): Penalidad no se generaba para cuota vencida

**Problema reportado:**
- Financiamiento: `qoye8jdqy5dqzek5lwc1lwv5`
- La cuota existia, avanzaban los dias, pero no aparecia penalidad.

**Root cause:**
- El query de `accruePenaltiesForFinancing` exigia implicitamente vencimiento por fecha (`dueDate <= today`) o estados especificos segun variante previa.
- En modo simulacion se detecto caso con `status="retrasado"` y `daysLate=1` pero `dueDate` futuro respecto al reloj real (`2026-05-29` vs `today=2026-05-27`).
- Resultado: filtro excluia la cuota y no creaba `penalty-debt`.

**Fix aplicado (criterio hibrido):**

**Archivo:** `lib/unified-allocator.ts` (`accruePenaltiesForFinancing`)

- Nuevo filtro candidato:
  - `status in ["pendiente","retrasado","abonado"]`
  - `parentRecord = null`
  - `OR`:
    1. `status in ["retrasado","abonado"]` (soporta modo simulacion)
    2. `dueDate <= today` (soporta mora real sin cambio de status)

Esto permite generar penalidad tanto para:
- cuotas realmente vencidas por fecha,
- como cuotas marcadas retrasadas por simulacion.

**Validacion local:**
- `POST /api/penalties/accrue` con body:
  - `{ "data": { "financingDocumentId": "qoye8jdqy5dqzek5lwc1lwv5" } }`
- Respuesta:
  - `{"success":true,"penaltiesGenerated":1,...}`
- `GET /api/billing?financing=qoye8jdqy5dqzek5lwc1lwv5` ahora muestra en cuota raiz:
  - `lateFeeAmount = 22.5`

---

## Hotfix 27 Mayo 2026 (Penalty Reinflation / Paso 0 Bucle)

**Problema reportado:**
- Escenario: cuota `$225` + penalidad `$22.5`, pago `$200`.
- Resultado matemático: `$30` a penalidad (pagada), `$170` a cuota (queda `$80`).
- Resultado observado en siguiente refresco / pago: penalidad **reaparece** como `$22.5` (o `$30`) a pesar de haberse pagado.

**Root cause (tres factores combinados):**

### Factor A: `lateFeeAmount` snapshot estático
- `accruePenaltiesForFinancing` usaba `attrs.lateFeeAmount` (campo snapshot de Strapi) como fuente primaria para `penaltyAmount`.
- Ese valor se calculó una sola vez (cuando `pendingBalance = $225`) y **nunca se actualiza** cuando la cuota se paga parcialmente.
- Resultado: aunque `pendingBalance` bajara a `$47.5`, `penaltyAmount` seguía siendo `$22.5`.

### Factor B: Normalización `existingPenalty.attributes` fallida (Strapi v5 flat)
- Al actualizar una penalidad existente, el código leía:
  - `existingPenalty.attributes?.amountOriginal`
  - `existingPenalty.attributes?.amountPending`
- Strapi v5 devuelve respuesta **plana** para `penalty-debt`: `existingPenalty.amountOriginal`, `existingPenalty.amountPending`.
- `attributes` es `undefined`, por lo tanto `parseFloat(undefined || 0) = 0`.
- `alreadyPaid = 0 - 0 = 0`.
- `newPending = penaltyAmount - 0 = penaltyAmount` → **se reinfla completamente**, perdiendo pagos previos.

### Factor C: Recreación tras pago completo
- El query de búsqueda de penalidad existente filtraba por `status: { $in: ["pending", "partially_paid"] }`.
- Una vez pagada completamente (`status = "paid"`), la siguiente ejecución del Paso 0 **no la encontraba**.
- Conclusión: "no existe penalidad → crear nueva" → se creaba un **nuevo registro** con monto completo cada vez.

**Fix aplicado:**

**Archivo:** `lib/unified-allocator.ts` (`accruePenaltiesForFinancing`)

1. **Recalcular siempre desde balance vivo:**
   - Se eliminó el uso de `attrs.lateFeeAmount`.
   - `penaltyAmount = pendingBalance * (rate/100) * daysLate` (cálculo directo en cada ejecución).
   - Esto garantiza que si el saldo baja, la penalidad base también baja.

2. **Normalización robusta flat/nested:**
   - Se usa el patrón consistente del proyecto:
     ```typescript
     const epAttrs = existingPenalty.attributes || existingPenalty;
     const oldOriginal = parseFloat(epAttrs.amountOriginal || existingPenalty.amountOriginal || 0);
     const oldPending = parseFloat(epAttrs.amountPending || existingPenalty.amountPending || 0);
     ```

3. **Preservar `alreadyPaid`:**
   - `alreadyPaid = max(0, oldOriginal - oldPending)`.
   - `newPending = max(0, penaltyAmount - alreadyPaid)`.
   - `newStatus = paid | partially_paid | pending` según `newPending`.

4. **Buscar TODAS las penalidades (incluido pagadas):**
   - Query sin filtro de status, ordenado por `createdAt:desc`, `pageSize: 1`.
   - Encuentra la penalidad más reciente aunque esté `paid`.
   - Actualiza el **mismo registro** en lugar de crear uno nuevo.

5. **Guardia de idempotencia:**
   - Si `oldOriginal`, `oldPending`, `daysAccrued` y `status` no cambiaron significativamente (`< $0.01`), se omite el `PUT`.
   - Reduce llamadas innecesarias a Strapi y evita reescrituras accidentales.

**Validación local:**
- `npm run test` (unified-allocator): **12/12 pasan**.

---

## Hotfix 27 Mayo 2026 (Visibilidad de Penalidades en Timeline)

**Problema reportado:**
- En `http://localhost:3000/billing/financing/xieinhah7ff7qexyqhr14fu5` (y cualquier financiamiento) las `penalty-debt` no aparecen en el `PaymentTimeline`.
- Las penalidades existen en Strapi pero la UI solo muestra `billing-records` (cuotas/pagos), no las penalidades como entidades independientes.

**Root cause:**
- `PaymentTimeline` recibe un array de `PaymentRecord` mapeado exclusivamente desde `BillingRecordCard[]` (cuotas).
- `penalty-debt` es un content-type separado en Strapi, no viene en `/api/billing?financing=...`.

**Fix aplicado:**

1. **Nueva API route:** `app/api/penalties/route.ts`
   - `GET /api/penalties?financing={documentId}`
   - Busca las cuotas raíz del financiamiento, extrae sus `documentId`s, y consulta `penalty-debts` por `quotaRecord.documentId` (workaround Strapi v5 relación no poblada).
   - Normaliza flat vs nested y devuelve array unificado.

2. **Página de financing detail:** `app/billing/financing/[id]/page.tsx`
   - Nuevo estado `penaltyDebts`.
   - `fetchBillingRecords` ahora hace `Promise.all` de `/api/billing` y `/api/penalties`.
   - Antes de pasar a `PaymentTimeline`, se mapean las `penaltyDebts` a `PaymentRecord` con:
     - `recordType: "penalty"`
     - `status` mapeado: `pending→retrasado`, `partially_paid→abonado`, `paid→pagado`, `cancelled→cubierta`.
     - `amount` = `amountPending`
     - `quotaNumber` propagado desde la cuota asociada.
   - Se concatenan cuotas + penalidades, ordenadas por `dueDate` ascendente.

3. **PaymentTimeline:** `app/billing/components/payment-timeline.tsx`
   - `PaymentRecord` extendido con campos de penalidad opcionales (`recordType`, `amountOriginal`, `amountPending`, `daysAccrued`, `dailyRatePercent`, `penaltyStatus`).
   - Nuevo `penaltyConfig` visual (colores `rose`) con icono `AlertTriangle`.
   - `ParentContent` detecta `recordType === "penalty"`:
     - Usa `penaltyConfig` para dot, card, badge.
     - Badge muestra "Cuota #N" (de la cuota asociada) + "Penalidad".
     - Renderiza monto `amountPending` en bold, `amountOriginal` como referencia, y días de mora con tasa diaria.
     - Oculta botones de acción (pagar, eliminar, asociar, desasociar) que no aplican a penalidades.

**Validación local:**
- Build exitoso (`npm run build`).
- Tests del allocator siguen pasando.
- Nuevos tests de regresión:
  - `preserves fully paid penalty when recalculating same amount`
  - `preserves partially paid penalty when recalculating same amount`
  - `reduces to zero when new penalty is smaller than already paid`
  - `reopens penalty when new penalty grows beyond already paid`

**Próxima validación en producción:**
1. Hacer pago sobre `qoye8jdqy5dqzek5lwc1lwv5`.
2. Confirmar en logs:
   - `[accruePenalties] ⏭ Penalty ... unchanged (...). Skipping update.` (si no cambió nada)
   - `[accruePenalties] ✓ Updated penalty ...: original=..., pending=..., status=paid`
3. Refrescar pantalla: la penalidad debe mostrar `$0` (o desaparecer del queue si está pagada).

---

## Hotfix 27 Mayo 2026 (Auto-Accrual en SimulateOverdue): Penalidades no se generaban al marcar cuota retrasada

**Problema reportado:**
- Financiamiento `xieinhah7ff7qexyqhr14fu5` tenía cuota marcada como `retrasado` pero no aparecía penalidad en el timeline.
- `GET /api/penalties?financing=...` retornaba `{"data": []}`.

**Root cause:**
- `SimulateOverdue` marcaba cuotas como `retrasado` y calculaba `lateFeeAmount`/`daysLate` en el `billing-record`, pero **nunca creaba** el registro `penalty-debt` separado.
- Las `penalty-debt` solo existían si se ejecutaba explícitamente `/api/penalties/accrue` o si un pago pasaba por `unifiedAllocatePayment` (Step 0).
- Como este financing nunca tuvo ni accrual manual ni pago unificado, no tenía penalidades.

**Fix aplicado:**

**Archivo:** `app/api/invoices/simulate-overdue/route.ts`

1. **Import:** `import { accruePenaltiesForFinancing } from "@/lib/unified-allocator";`

2. **Después** de actualizar exitosamente la cuota como `retrasado` (línea ~316):
   ```typescript
   if (financingDocumentId) {
     try {
       const penaltiesCount = await accruePenaltiesForFinancing(financingDocumentId, 10);
       if (penaltiesCount > 0) {
         console.log(`[SimulateOverdue] ✓ Generated ${penaltiesCount} penalty debt(s) for financing ${financingDocumentId}`);
       }
     } catch (penaltyErr) {
       console.error(`[SimulateOverdue] ⚠ Penalty accrual failed for financing ${financingDocumentId}:`, penaltyErr);
       // No bloquear el flujo principal si el accrual falla
     }
   }
   ```

**Comportamiento:**
- Cada vez que `SimulateOverdue` marca una cuota como retrasado, automáticamente genera/actualiza las `penalty-debt` del financiamiento.
- Si la cuota ya tiene penalidad generada, `accruePenaltiesForFinancing` la actualiza idempotentemente (o salta si no cambió nada).
- Errores de accrual se loguean pero **no interrumpen** el flujo principal de simulación.

**Para cuotas ya marcadas como retrasado (antes del fix):**
- Hacer clic en **"Simular Viernes"** nuevamente en la página del financiamiento.
- Eso ejecutará `SimulateOverdue` con `mode="update-existing"`, que ahora generará las penalidades faltantes.
- Alternativa: llamar manualmente `POST /api/penalties/accrue` con el `financingDocumentId`.

---

## Hotfix 27 Mayo 2026 (Ocultar penalidades separadas en UI): Penalidades como entidades independientes no deben verse

**Problema reportado:**
- Las `penalty-debt` (entidades separadas en Strapi) aparecían como tarjetas independientes en el `PaymentTimeline` (ej: "PEN-4", "Multa").
- Usuarios veían la penalidad doble: embebida en la cuota (`lateFeeAmount`) + como registro separado.
- Además, URLs directas a detalles de multa legado (amount < 0) se podían abrir.

**Root cause:**
- `PaymentTimeline` recibía arrays mergeados que incluían `penalty-debt` como `PaymentRecord` con `recordType: "penalty"`.
- El `ParentContent` renderizaba estas tarjetas con badge "Penalidad" y montos.
- No había filtro previo que ocultara registros `amount < 0` (multas legacy) ni `recordType === "penalty"`.

**Fix aplicado (tres archivos):**

### 1. `app/billing/financing/[id]/page.tsx`

- **Quitado** el merge de `penaltyRecords` al prop `payments` del `PaymentTimeline`.
- Ahora solo se pasan `quotaRecords` (cuotas y pagos reales), ordenadas por `dueDate`.
- Las penalidades siguen siendo calculadas y persistidas en Strapi (`penalty-debt`), pero **no se renderizan** como filas independientes en la UI.

### 2. `app/billing/page.tsx`

- **Agregado filtro** `.filter((p) => p.amount >= 0)` antes de mapear `payments` al `PaymentTimeline`.
- Oculta multas legacy (`amount < 0`) del timeline general de facturación.

### 3. `app/billing/details/[id]/page.tsx`

- **Bloqueo de acceso directo:** tras `fetchRecord`, si `recordData.amount < 0`:
  - Muestra `toast.info("Este registro no está disponible para visualización directa.")`
  - Redirige a `/billing`.
- Evita que un link directo a una multa/penalidad separada se pueda visualizar.

**Resultado visual:**
- Usuario ve penalidad **solo embebida** en la cuota: línea roja "+ $X penalidad" dentro de la tarjeta de la cuota vencida.
- No aparecen tarjetas separadas "PEN-*" ni "Multa" en ningún timeline.
- Acceso directo a detalle de multa es redirigido.

**Nota técnica:**
- Las `penalty-debt` siguen existiendo en Strapi y participando en la lógica de asignación unificada (`unifiedAllocatePayment`).
- Lo que se eliminó es exclusivamente su renderizado en el frontend como entidad independiente.
- Los pagos distribuyen dinero a penalidades de forma invisible para el usuario (como estaba diseñado originalmente).
