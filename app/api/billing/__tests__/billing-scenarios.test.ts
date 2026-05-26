/**
 * Tests de escenarios de facturación
 * Caso A: Pago exacto sobre cuota pendiente
 * Caso B: Pago sin cuotas → adelanto
 * Caso C: Auto-cover con múltiples adelantos
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de config
vi.mock("@/lib/config", () => ({
  STRAPI_BASE_URL: "http://localhost:1337",
  STRAPI_API_TOKEN: "test-token",
}));

// Mock de fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Importar funciones DESPUÉS del mock
import {
  createBillingRecordInStrapi,
  autoCoverPendingQuotas,
  applyAdvanceAsPartialPayment,
  applyAdvanceAmountToQuota,
  processPayment,
  findClosestParentRecord,
  type BillingRecordCreatePayload,
} from "@/lib/billing";
import { type FinancingCard } from "@/lib/financing";

describe("Escenarios de Facturación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper para crear respuestas mock
  const mockOk = (data: any) => ({
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(""),
  });

  const mockFinancing = (overrides: Partial<FinancingCard> = {}): FinancingCard => ({
    documentId: "fin-001",
    id: "1",
    financingNumber: "FIN-TEST-001",
    vehicleName: "Test Vehicle",
    vehiclePlaca: "TEST-123",
    clientName: "Cliente Test",
    clientPhone: "",
    clientEmail: "",
    clientIdentificationNumber: "",
    totalAmount: 85000,
    quotaAmount: 386.36,
    totalQuotas: 220,
    paidQuotas: 0,
    currentBalance: 85000,
    nextDueDate: "2026-06-01",
    startDate: "2026-06-01",
    financingMonths: 55,
    paymentFrequency: "semanal",
    status: "activo",
    lateFeePercentage: 10,
    totalLateFees: 0,
    partialPaymentCredit: 0,
    numericId: 1,
    ...overrides,
  });

  describe("Caso A: Pago exacto sobre cuota pendiente", () => {
    it("debe crear pago hijo de cuota y marcar cuota como pagado", async () => {
      const financing = mockFinancing();
      const payload: BillingRecordCreatePayload = {
        financing: "fin-001",
        amount: 386.36,
        quotaNumber: 1,
        dueDate: "2026-06-01",
        paymentDate: "2026-06-01",
        status: "pagado",
      };

      // Mock para obtener parentRecord numérico (no hay parent en este caso)
      // Mock para crear el billing record
      const createdRecord = {
        data: {
          id: 100,
          documentId: "pay-001",
          receiptNumber: "REC-202606-00001",
          amount: 386.36,
          currency: "PAB",
          status: "pagado",
          quotaNumber: 1,
          quotasCovered: 1,
          quotaAmountCovered: 386.36,
          advanceCredit: 0,
          remainingQuotaBalance: 0,
          lateFeeAmount: 0,
          daysLate: 0,
          dueDate: "2026-06-01",
          paymentDate: "2026-06-01",
          financing: { id: 1, documentId: "fin-001" },
          createdAt: "2026-06-01T10:00:00Z",
        },
      };

      mockFetch
        .mockResolvedValueOnce(mockOk({ data: [] })) // generateReceiptNumber busca último recibo
        .mockResolvedValueOnce(mockOk(createdRecord)) // POST create billing record
        .mockResolvedValueOnce(mockOk({ data: { id: 1, documentId: "fin-001" } })); // PUT update financing

      const result = await createBillingRecordInStrapi(payload, financing);

      expect(result.documentId).toBe("pay-001");
      expect(result.status).toBe("pagado");
      expect(result.amount).toBe(386.36);
    });
  });

  describe("Caso B: Pago sin cuotas pendientes → adelanto", () => {
    it("debe crear adelanto raíz con quotaNumber=0", async () => {
      const financing = mockFinancing();
      const payload: BillingRecordCreatePayload = {
        financing: "fin-001",
        amount: 100,
        quotaNumber: 1, // Frontend envía esto, pero backend debería forzar a 0
        dueDate: "2026-06-01",
        paymentDate: "2026-06-01",
        status: "adelanto",
      };

      const createdRecord = {
        data: {
          id: 101,
          documentId: "pay-002",
          receiptNumber: "REC-202606-00002",
          amount: 100,
          currency: "PAB",
          status: "adelanto",
          quotaNumber: 0,
          quotasCovered: 1,
          quotaAmountCovered: 100,
          advanceCredit: 0,
          remainingQuotaBalance: 0,
          lateFeeAmount: 0,
          daysLate: 0,
          dueDate: "2026-06-01",
          paymentDate: "2026-06-01",
          financing: { id: 1, documentId: "fin-001" },
          createdAt: "2026-06-01T10:00:00Z",
        },
      };

      mockFetch
        .mockResolvedValueOnce(mockOk({ data: [] }))
        .mockResolvedValueOnce(mockOk(createdRecord))
        .mockResolvedValueOnce(mockOk({ data: { id: 1, documentId: "fin-001" } })); // PUT update financing

      const result = await createBillingRecordInStrapi(payload, financing);

      expect(result.status).toBe("adelanto");
      expect(result.quotaNumber).toBe(0);
    });
  });

  describe("Caso C: Auto-cover con múltiples adelantos", () => {
    it("debe consumir todos los adelantos disponibles hasta cubrir la cuota", async () => {
      // Setup: 2 adelantos disponibles + 1 cuota pendiente
      const financingId = "fin-002";

      // Mock 1: Buscar adelantos
      const advancesResponse = {
        data: [
          {
            id: 10,
            documentId: "adv-001",
            amount: 50,
            childRecords: [],
          },
          {
            id: 11,
            documentId: "adv-002",
            amount: 100,
            childRecords: [],
          },
        ],
      };

      // Mock 2: Buscar cuotas pendientes
      const quotasResponse = {
        data: [
          {
            id: 20,
            documentId: "quota-001",
            amount: 386.36,
            quotaNumber: 1,
            dueDate: "2026-06-01",
            status: "pendiente",
            childRecords: [],
          },
        ],
      };

      // Mock 3: Obtener financing numericId
      const financingResponse = {
        data: { id: 2, documentId: financingId },
      };

      // Mock 4-6: Crear abonos (uno por cada adelanto aplicado)
      const abono1Response = {
        data: {
          id: 30,
          documentId: "abono-001",
          receiptNumber: "REC-202606-00010",
          amount: 50,
          status: "abonado",
        },
      };

      const abono2Response = {
        data: {
          id: 31,
          documentId: "abono-002",
          receiptNumber: "REC-202606-00011",
          amount: 100,
          status: "abonado",
        },
      };

      // Mock 7: Actualizar adelanto 1 (reducido a 0)
      const updateAdv1Response = {
        data: { id: 10, documentId: "adv-001", amount: 0, status: "pagado" },
      };

      // Mock 8: Actualizar adelanto 2 (reducido a 0)
      const updateAdv2Response = {
        data: { id: 11, documentId: "adv-002", amount: 0, status: "pagado" },
      };

      // Mock 9: Actualizar cuota a abonado (parcial)
      const updateQuotaResponse = {
        data: { id: 20, documentId: "quota-001", status: "abonado" },
      };

      // Mock 10-11: generateReceiptNumber para cada abono
      mockFetch
        .mockResolvedValueOnce(mockOk(advancesResponse))       // 1. buscar adelantos
        .mockResolvedValueOnce(mockOk(quotasResponse))           // 2. buscar cuotas
        .mockResolvedValueOnce(mockOk(financingResponse))      // 3. obtener financing id
        .mockResolvedValueOnce(mockOk({ data: [] }))            // 4. generateReceiptNumber abono1
        .mockResolvedValueOnce(mockOk(abono1Response))          // 5. crear abono1
        .mockResolvedValueOnce(mockOk(updateAdv1Response))      // 6. actualizar adelanto1
        .mockResolvedValueOnce(mockOk({ data: [] }))            // 7. generateReceiptNumber abono2
        .mockResolvedValueOnce(mockOk(abono2Response))          // 8. crear abono2
        .mockResolvedValueOnce(mockOk(updateAdv2Response))    // 9. actualizar adelanto2
        .mockResolvedValueOnce(mockOk({ data: { status: "pendiente" } })) // 10. GET status previo
        .mockResolvedValueOnce(mockOk(updateQuotaResponse));     // 11. PUT actualizar cuota

      const result = await autoCoverPendingQuotas(financingId);

      expect(result).toContain("quota-001");

      // Verificar que se crearon 2 abonos
      const createCalls = mockFetch.mock.calls.filter((call: any) => {
        const url = call[0] as string;
        return url.includes("/api/billing-records") && call[1]?.method === "POST";
      });
      expect(createCalls).toHaveLength(2);

      // Verificar que ambos adelantos fueron reducidos
      const updateAdvCalls = mockFetch.mock.calls.filter((call: any) => {
        const url = call[0] as string;
        return url.includes("adv-001") || url.includes("adv-002");
      });
      expect(updateAdvCalls.length).toBeGreaterThanOrEqual(2);
    });

    it("debe marcar cuota como pagado cuando múltiples adelantos cubren el total", async () => {
      const financingId = "fin-003";

      // 3 adelantos que suman más que la cuota
      const advancesResponse = {
        data: [
          { id: 12, documentId: "adv-003", amount: 200, childRecords: [] },
          { id: 13, documentId: "adv-004", amount: 150, childRecords: [] },
          { id: 14, documentId: "adv-005", amount: 50, childRecords: [] },
        ],
      };

      const quotasResponse = {
        data: [
          {
            id: 21,
            documentId: "quota-002",
            amount: 386.36,
            quotaNumber: 2,
            dueDate: "2026-06-08",
            status: "pendiente",
            childRecords: [],
          },
        ],
      };

      const financingResponse = {
        data: { id: 3, documentId: financingId },
      };

      // Sequencia de mocks completa
      mockFetch
        .mockResolvedValueOnce(mockOk(advancesResponse))
        .mockResolvedValueOnce(mockOk(quotasResponse))
        .mockResolvedValueOnce(mockOk(financingResponse))
        // Abono 1: 200
        .mockResolvedValueOnce(mockOk({ data: [] }))
        .mockResolvedValueOnce(mockOk({ data: { id: 40, documentId: "abono-003", amount: 200 } }))
        .mockResolvedValueOnce(mockOk({ data: { id: 12, documentId: "adv-003", amount: 0 } }))
        // Abono 2: 150
        .mockResolvedValueOnce(mockOk({ data: [] }))
        .mockResolvedValueOnce(mockOk({ data: { id: 41, documentId: "abono-004", amount: 150 } }))
        .mockResolvedValueOnce(mockOk({ data: { id: 13, documentId: "adv-004", amount: 0 } }))
        // Abono 3: 36.36 (resto)
        .mockResolvedValueOnce(mockOk({ data: [] }))
        .mockResolvedValueOnce(mockOk({ data: { id: 42, documentId: "abono-005", amount: 36.36 } }))
        .mockResolvedValueOnce(mockOk({ data: { id: 14, documentId: "adv-005", amount: 13.64 } }))
        // GET status previo + PUT update cuota a pagado
        .mockResolvedValueOnce(mockOk({ data: { status: "pendiente" } }))
        .mockResolvedValueOnce(mockOk({ data: { id: 21, documentId: "quota-002", status: "pagado" } }));

      const result = await autoCoverPendingQuotas(financingId);

      expect(result).toContain("quota-002");

      // La cuota debe haber sido marcada como pagado
      const updateQuotaCall = mockFetch.mock.calls.find((call: any) => {
        const url = call[0] as string;
        return url.includes("quota-002") && call[1]?.body?.includes("pagado");
      });
      expect(updateQuotaCall).toBeDefined();
    });
  });

  describe("findClosestParentRecord prioridad por antigüedad", () => {
    it("selecciona cuota abonado (más antigua) antes que pendiente (más nueva)", async () => {
      const financingId = "fin-antiguedad";
      const quotasResponse = {
        data: [
          {
            documentId: "quota-pendiente",
            quotaNumber: 6,
            status: "pendiente",
            amount: 386.36,
            dueDate: "2026-05-15",
            paymentDate: null,
            childRecords: [],
          },
          {
            documentId: "quota-abonada",
            quotaNumber: 5,
            status: "abonado",
            amount: 386.36,
            dueDate: "2026-05-08",
            paymentDate: null,
            childRecords: [{ amount: 336.36, status: "abonado" }],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(mockOk(quotasResponse));

      const result = await findClosestParentRecord(financingId, "2026-05-20");
      expect(result).toBe("quota-abonada");
    });
  });

  describe("processPayment logic", () => {
    it("pago exacto a cuota de 386.36 → quotasCovered=1, advanceCredit=0", () => {
      const result = processPayment(386.36, 386.36, 0);
      expect(result.quotasCovered).toBe(1);
      expect(result.advanceCredit).toBe(0);
      expect(result.isPartialPayment).toBe(false);
    });

    it("pago parcial de 100 a cuota de 386.36 → quotasCovered=0, advanceCredit=100", () => {
      const result = processPayment(100, 386.36, 0);
      expect(result.quotasCovered).toBe(0);
      expect(result.advanceCredit).toBe(100);
      expect(result.isPartialPayment).toBe(true);
    });

    it("pago de 433 a cuota de 386.36 → quotasCovered=1, advanceCredit=46.64", () => {
      const result = processPayment(433, 386.36, 0);
      expect(result.quotasCovered).toBe(1);
      expect(result.advanceCredit).toBe(46.64);
      expect(result.isPartialPayment).toBe(false);
    });
  });
});
