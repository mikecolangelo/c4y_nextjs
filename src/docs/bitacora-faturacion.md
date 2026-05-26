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
