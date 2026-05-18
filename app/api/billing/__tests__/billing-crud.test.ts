/**
 * Tests de CRUD para el API de Billing (Pagos)
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

// Importar funciones después del mock
import {
  fetchBillingRecordsFromStrapi,
  fetchBillingRecordByIdFromStrapi,
  updateBillingRecordInStrapi,
  deleteBillingRecordFromStrapi,
  verifyBillingRecordInStrapi,
  calculateLateFee,
  calculateDaysLate,
  processPayment,
} from "@/lib/billing";

describe("Billing API CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchBillingRecordsFromStrapi", () => {
    it("debe obtener lista de pagos correctamente", async () => {
      const mockData = {
        data: [
          {
            id: 1,
            documentId: "pay-001",
            receiptNumber: "REC-202601-00001",
            amount: 225,
            currency: "USD",
            status: "pagado",
            quotaNumber: 1,
            quotasCovered: 1,
            advanceCredit: 0,
            lateFeeAmount: 0,
            daysLate: 0,
            dueDate: "2026-02-01",
            paymentDate: "2026-02-01",
            confirmationNumber: "1820866090",
            verifiedInBank: true,
            financing: {
              id: 1,
              documentId: "fin-001",
              financingNumber: "FIN-2026-00001",
              quotaAmount: 225,
              totalQuotas: 234,
              paidQuotas: 1,
              vehicle: {
                id: 1,
                documentId: "veh-001",
                name: "Toyota Corolla",
                placa: "ABC-123",
              },
              client: {
                id: 1,
                documentId: "usr-001",
                displayName: "Juan Pérez",
              },
            },
            documents: [],
            createdAt: "2026-02-01T10:00:00Z",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await fetchBillingRecordsFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].receiptNumber).toBe("REC-202601-00001");
      expect(result[0].amount).toBe(225);
      expect(result[0].status).toBe("pagado");
      expect(result[0].vehicleName).toBe("Toyota Corolla");
      expect(result[0].clientName).toBe("Juan Pérez");
      expect(result[0].financingNumber).toBe("FIN-2026-00001");
    });

    it("debe manejar lista vacía", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const result = await fetchBillingRecordsFromStrapi();
      expect(result).toHaveLength(0);
    });
  });

  describe("fetchBillingRecordByIdFromStrapi", () => {
    it("debe obtener un pago por ID", async () => {
      const mockData = {
        data: {
          id: 1,
          documentId: "pay-001",
          receiptNumber: "REC-202601-00001",
          amount: 225,
          currency: "USD",
          status: "pagado",
          quotaNumber: 1,
          quotasCovered: 1,
          dueDate: "2026-02-01",
          paymentDate: "2026-02-01",
          verifiedInBank: false,
          createdAt: "2026-02-01T10:00:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await fetchBillingRecordByIdFromStrapi("pay-001");

      expect(result).not.toBeNull();
      expect(result?.documentId).toBe("pay-001");
      expect(result?.verifiedInBank).toBe(false);
    });

    it("debe retornar null cuando no existe", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchBillingRecordByIdFromStrapi("no-existe");
      expect(result).toBeNull();
    });
  });

  describe("updateBillingRecordInStrapi", () => {
    it("debe actualizar un pago correctamente", async () => {
      const mockResponse = {
        data: {
          id: 1,
          documentId: "pay-001",
          receiptNumber: "REC-202601-00001",
          amount: 225,
          status: "pagado",
          confirmationNumber: "NUEVO-123",
          verifiedInBank: false,
          createdAt: "2026-02-01T10:00:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await updateBillingRecordInStrapi("pay-001", {
        confirmationNumber: "NUEVO-123",
      });

      expect(result.confirmationNumber).toBe("NUEVO-123");
    });
  });

  describe("deleteBillingRecordFromStrapi", () => {
    it("debe eliminar un pago correctamente", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await expect(
        deleteBillingRecordFromStrapi("pay-001")
      ).resolves.not.toThrow();
    });
  });

  describe("verifyBillingRecordInStrapi", () => {
    it("debe verificar un pago correctamente", async () => {
      const mockResponse = {
        data: {
          id: 1,
          documentId: "pay-001",
          receiptNumber: "REC-202601-00001",
          verifiedInBank: true,
          verifiedAt: "2026-02-05T15:30:00Z",
          verifiedBy: {
            displayName: "Admin",
          },
          createdAt: "2026-02-01T10:00:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await verifyBillingRecordInStrapi("pay-001", "admin-001");

      expect(result.verifiedInBank).toBe(true);
    });
  });
});

describe("Cálculo de Días de Atraso", () => {
  describe("calculateDaysLate", () => {
    it("debe retornar 0 si pago es en fecha", () => {
      const result = calculateDaysLate("2026-02-01", "2026-02-01");
      expect(result).toBe(0);
    });

    it("debe retornar 0 si pago es antes de vencimiento", () => {
      const result = calculateDaysLate("2026-02-05", "2026-02-01");
      expect(result).toBe(0);
    });

    it("debe calcular 1 día de atraso", () => {
      const result = calculateDaysLate("2026-02-01", "2026-02-02");
      expect(result).toBe(1);
    });

    it("debe calcular 5 días de atraso", () => {
      const result = calculateDaysLate("2026-02-01", "2026-02-06");
      expect(result).toBe(5);
    });

    it("debe calcular atraso sin fecha de pago (usa fecha actual)", () => {
      // Este test puede variar según la fecha actual
      const today = new Date();
      const pastDate = new Date(today);
      pastDate.setDate(pastDate.getDate() - 3);
      const dueDateStr = pastDate.toISOString().split("T")[0];

      const result = calculateDaysLate(dueDateStr);
      expect(result).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("Procesamiento de Pagos con Estados", () => {
  describe("Determinación de estado según pago", () => {
    it("pago a tiempo debe ser 'pagado'", () => {
      const daysLate = calculateDaysLate("2026-02-01", "2026-02-01");
      const lateFee = calculateLateFee(225, daysLate);
      
      expect(daysLate).toBe(0);
      expect(lateFee).toBe(0);
      // El estado sería "pagado"
    });

    it("pago con atraso debe calcular multa", () => {
      const daysLate = calculateDaysLate("2026-02-01", "2026-02-03");
      const lateFee = calculateLateFee(225, daysLate, 10);
      
      expect(daysLate).toBe(2);
      expect(lateFee).toBe(45); // 225 * 0.10 * 2
      // El estado sería "retrasado"
    });

    it("pago adelantado debe cubrir múltiples cuotas", () => {
      const { quotasCovered, advanceCredit } = processPayment(900, 225, 0);
      
      expect(quotasCovered).toBe(4);
      expect(advanceCredit).toBe(0);
      // El estado sería "adelanto"
    });

    it("pago parcial debe generar crédito", () => {
      const { quotasCovered, advanceCredit } = processPayment(100, 225, 0);
      
      expect(quotasCovered).toBe(0);
      expect(advanceCredit).toBe(100);
      // El estado sería "adelanto" (abono parcial)
    });
  });
});

describe("Escenarios de Negocio", () => {
  describe("Escenario: Depósito inicial", () => {
    it("depósito de $300 con cuota de $225 cubre 1 cuota y genera crédito", () => {
      const { quotasCovered, advanceCredit } = processPayment(300, 225, 0);
      
      expect(quotasCovered).toBe(1);
      expect(advanceCredit).toBe(75);
    });
  });

  describe("Escenario: Pago con mora acumulada", () => {
    it("cliente con 5 días de atraso en cuota de $225", () => {
      const daysLate = 5;
      const pendingAmount = 225;
      const lateFee = calculateLateFee(pendingAmount, daysLate, 10);
      
      // Multa: $225 * 10% * 5 = $112.50
      expect(lateFee).toBe(112.5);
      
      // El cliente debe pagar: $225 + $112.50 = $337.50
      const totalToPay = pendingAmount + lateFee;
      expect(totalToPay).toBe(337.5);
    });
  });

  describe("Escenario: Pago parcial con mora", () => {
    it("cliente pagó $25 de $225, queda $200 con 2 días de atraso", () => {
      const paidAmount = 25;
      const quotaAmount = 225;
      const pendingAmount = quotaAmount - paidAmount;
      const daysLate = 2;
      
      const lateFee = calculateLateFee(pendingAmount, daysLate, 10);
      
      // Multa: $200 * 10% * 2 = $40
      expect(lateFee).toBe(40);
      
      // El cliente debe pagar: $200 + $40 = $240
      const totalToPay = pendingAmount + lateFee;
      expect(totalToPay).toBe(240);
    });
  });

  describe("Escenario: Pago de 4 cuotas adelantadas", () => {
    it("cliente paga $900 con cuotas de $225", () => {
      const { quotasCovered, advanceCredit, totalApplied } = processPayment(900, 225, 0);
      
      expect(quotasCovered).toBe(4);
      expect(advanceCredit).toBe(0);
      expect(totalApplied).toBe(900);
    });
  });

  describe("Escenario: Acumulación de créditos", () => {
    it("pagos parciales que se acumulan", () => {
      // Primer pago: $100
      const pago1 = processPayment(100, 225, 0);
      expect(pago1.quotasCovered).toBe(0);
      expect(pago1.advanceCredit).toBe(100);

      // Segundo pago: $100 con crédito de $100
      const pago2 = processPayment(100, 225, pago1.advanceCredit);
      expect(pago2.quotasCovered).toBe(0);
      expect(pago2.advanceCredit).toBe(200);

      // Tercer pago: $50 con crédito de $200 = $250, cubre 1 cuota
      const pago3 = processPayment(50, 225, pago2.advanceCredit);
      expect(pago3.quotasCovered).toBe(1);
      expect(pago3.advanceCredit).toBe(25); // 250 - 225 = 25
    });
  });
});
