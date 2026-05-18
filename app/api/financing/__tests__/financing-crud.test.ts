/**
 * Tests de CRUD para el API de Financing
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
  fetchFinancingsFromStrapi,
  fetchFinancingByIdFromStrapi,
  createFinancingInStrapi,
  updateFinancingInStrapi,
  deleteFinancingFromStrapi,
  calculateTotalQuotas,
  calculateQuotaAmount,
  calculateNextDueDate,
  calculateLateFee,
  processPayment,
  type FinancingCreatePayload,
} from "@/lib/financing";

describe("Financing API CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchFinancingsFromStrapi", () => {
    it("debe obtener lista de financiamientos correctamente", async () => {
      const mockData = {
        data: [
          {
            id: 1,
            documentId: "fin-001",
            financingNumber: "FIN-2026-00001",
            totalAmount: 49500,
            financingMonths: 54,
            paymentFrequency: "semanal",
            quotaAmount: 211.54,
            totalQuotas: 234,
            paidQuotas: 10,
            startDate: "2026-01-25",
            nextDueDate: "2026-04-01",
            status: "activo",
            currentBalance: 47355.36,
            totalPaid: 2115.40,
            totalLateFees: 0,
            partialPaymentCredit: 0,
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
            payments: [],
            createdAt: "2026-01-25T10:00:00Z",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await fetchFinancingsFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].financingNumber).toBe("FIN-2026-00001");
      expect(result[0].totalAmount).toBe(49500);
      expect(result[0].vehicleName).toBe("Toyota Corolla");
      expect(result[0].clientName).toBe("Juan Pérez");
      expect(result[0].progressPercentage).toBeGreaterThanOrEqual(4);
      expect(result[0].progressPercentage).toBeLessThanOrEqual(5); // 10/234 * 100 ≈ 4.27
    });

    it("debe manejar error de fetch correctamente", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve("Internal Server Error"),
      });

      await expect(fetchFinancingsFromStrapi()).rejects.toThrow(
        "Error fetching financings"
      );
    });
  });

  describe("fetchFinancingByIdFromStrapi", () => {
    it("debe obtener un financiamiento por ID", async () => {
      const mockData = {
        data: {
          id: 1,
          documentId: "fin-001",
          financingNumber: "FIN-2026-00001",
          totalAmount: 49500,
          financingMonths: 54,
          paymentFrequency: "semanal",
          quotaAmount: 211.54,
          totalQuotas: 234,
          paidQuotas: 5,
          startDate: "2026-01-25",
          status: "activo",
          currentBalance: 48442.30,
          totalPaid: 1057.70,
          totalLateFees: 0,
          partialPaymentCredit: 0,
          lateFeePercentage: 10,
          maxLateQuotasAllowed: 4,
          createdAt: "2026-01-25T10:00:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await fetchFinancingByIdFromStrapi("fin-001");

      expect(result).not.toBeNull();
      expect(result?.documentId).toBe("fin-001");
      expect(result?.pendingQuotas).toBe(229); // 234 - 5
    });

    it("debe retornar null cuando no existe", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchFinancingByIdFromStrapi("no-existe");
      expect(result).toBeNull();
    });
  });

  describe("createFinancingInStrapi", () => {
    it("debe crear un financiamiento con cálculos automáticos", async () => {
      const payload: FinancingCreatePayload = {
        totalAmount: 49500,
        financingMonths: 54,
        paymentFrequency: "semanal",
        startDate: "2026-01-25",
        vehicle: 1,
        client: 2,
      };

      const mockResponse = {
        data: {
          id: 1,
          documentId: "fin-new",
          financingNumber: "FIN-2026-00001",
          totalAmount: 49500,
          financingMonths: 54,
          paymentFrequency: "semanal",
          quotaAmount: 211.54,
          totalQuotas: 234,
          paidQuotas: 0,
          startDate: "2026-01-25",
          nextDueDate: "2026-02-01",
          status: "activo",
          currentBalance: 49500,
          totalPaid: 0,
          totalLateFees: 0,
          partialPaymentCredit: 0,
          createdAt: "2026-01-25T10:00:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await createFinancingInStrapi(payload);

      expect(result.totalQuotas).toBe(234);
      expect(result.status).toBe("activo");
      expect(result.currentBalance).toBe(49500);
    });
  });

  describe("updateFinancingInStrapi", () => {
    it("debe actualizar el estado de un financiamiento", async () => {
      const mockResponse = {
        data: {
          id: 1,
          documentId: "fin-001",
          financingNumber: "FIN-2026-00001",
          totalAmount: 49500,
          status: "en_mora",
          paidQuotas: 5,
          totalQuotas: 234,
          currentBalance: 48000,
          createdAt: "2026-01-25T10:00:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await updateFinancingInStrapi("fin-001", {
        status: "en_mora",
      });

      expect(result.status).toBe("en_mora");
    });
  });

  describe("deleteFinancingFromStrapi", () => {
    it("debe eliminar un financiamiento correctamente", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await expect(
        deleteFinancingFromStrapi("fin-001")
      ).resolves.not.toThrow();
    });

    it("debe lanzar error si falla la eliminación", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve("Not found"),
      });

      await expect(deleteFinancingFromStrapi("fin-001")).rejects.toThrow();
    });
  });
});

describe("Funciones de Cálculo de Cuotas", () => {
  describe("calculateTotalQuotas", () => {
    it("debe calcular cuotas semanales correctamente (54 meses)", () => {
      const result = calculateTotalQuotas(54, "semanal");
      expect(result).toBe(234); // 54 * 4.33 ≈ 234
    });

    it("debe calcular cuotas quincenales correctamente (54 meses)", () => {
      const result = calculateTotalQuotas(54, "quincenal");
      expect(result).toBe(108); // 54 * 2
    });

    it("debe calcular cuotas mensuales correctamente (54 meses)", () => {
      const result = calculateTotalQuotas(54, "mensual");
      expect(result).toBe(54);
    });

    it("debe calcular cuotas para 12 meses semanales", () => {
      const result = calculateTotalQuotas(12, "semanal");
      expect(result).toBe(52); // 12 * 4.33 ≈ 52
    });
  });

  describe("calculateQuotaAmount", () => {
    it("debe calcular el monto de cuota correctamente", () => {
      const result = calculateQuotaAmount(49500, 234);
      expect(result).toBeCloseTo(211.54, 2);
    });

    it("debe manejar división por cero", () => {
      const result = calculateQuotaAmount(49500, 0);
      expect(result).toBe(0);
    });

    it("debe calcular cuota para pago quincenal", () => {
      const result = calculateQuotaAmount(49500, 108);
      expect(result).toBeCloseTo(458.33, 2);
    });
  });

  describe("calculateNextDueDate", () => {
    it("debe calcular fecha semanal (7 días)", () => {
      const result = calculateNextDueDate("2026-01-25", "semanal", 1);
      expect(result).toBe("2026-02-01");
    });

    it("debe calcular fecha quincenal (15 días)", () => {
      const result = calculateNextDueDate("2026-01-25", "quincenal", 1);
      expect(result).toBe("2026-02-09");
    });

    it("debe calcular fecha mensual (30 días)", () => {
      const result = calculateNextDueDate("2026-01-25", "mensual", 1);
      expect(result).toBe("2026-02-24");
    });

    it("debe calcular múltiples cuotas adelante", () => {
      const result = calculateNextDueDate("2026-01-25", "semanal", 4);
      expect(result).toBe("2026-02-22"); // 4 * 7 = 28 días
    });
  });
});

describe("Funciones de Cálculo de Multas", () => {
  describe("calculateLateFee", () => {
    it("debe calcular multa al 10% por 1 día de atraso", () => {
      // $225 de cuota, 1 día de atraso, 10%
      const result = calculateLateFee(225, 1, 10);
      expect(result).toBe(22.5);
    });

    it("debe calcular multa al 10% por 3 días de atraso", () => {
      // $225 de cuota, 3 días de atraso, 10%
      const result = calculateLateFee(225, 3, 10);
      expect(result).toBe(67.5); // 225 * 0.10 * 3
    });

    it("debe calcular multa sobre monto parcial", () => {
      // Si pagó $25, queda pendiente $200
      const result = calculateLateFee(200, 2, 10);
      expect(result).toBe(40); // 200 * 0.10 * 2
    });

    it("debe retornar 0 si no hay atraso", () => {
      const result = calculateLateFee(225, 0, 10);
      expect(result).toBe(0);
    });

    it("debe retornar 0 si monto pendiente es 0", () => {
      const result = calculateLateFee(0, 5, 10);
      expect(result).toBe(0);
    });

    it("debe manejar porcentaje diferente", () => {
      const result = calculateLateFee(225, 1, 5);
      expect(result).toBe(11.25); // 225 * 0.05 * 1
    });
  });
});

describe("Funciones de Procesamiento de Pagos", () => {
  describe("processPayment", () => {
    it("debe cubrir una cuota exacta", () => {
      const result = processPayment(225, 225, 0);
      expect(result.quotasCovered).toBe(1);
      expect(result.advanceCredit).toBe(0);
    });

    it("debe cubrir múltiples cuotas (4 cuotas)", () => {
      // Pago de $900 con cuotas de $225
      const result = processPayment(900, 225, 0);
      expect(result.quotasCovered).toBe(4);
      expect(result.advanceCredit).toBe(0);
    });

    it("debe generar crédito con pago parcial", () => {
      // Pago de $100 con cuota de $225
      const result = processPayment(100, 225, 0);
      expect(result.quotasCovered).toBe(0);
      expect(result.advanceCredit).toBe(100);
    });

    it("debe acumular crédito previo", () => {
      // Pago de $150 con crédito previo de $100, cuota de $225
      const result = processPayment(150, 225, 100);
      expect(result.quotasCovered).toBe(1); // 150 + 100 = 250 >= 225
      expect(result.advanceCredit).toBe(25); // 250 - 225 = 25
    });

    it("debe cubrir cuotas y generar crédito", () => {
      // Pago de $500 con cuotas de $225
      const result = processPayment(500, 225, 0);
      expect(result.quotasCovered).toBe(2); // 500 / 225 = 2.22
      expect(result.advanceCredit).toBe(50); // 500 - (225 * 2) = 50
    });

    it("debe manejar pago grande con crédito previo", () => {
      // Pago de $900 con crédito previo de $125, cuota de $225
      const result = processPayment(900, 225, 125);
      expect(result.quotasCovered).toBe(4); // (900 + 125) / 225 = 4.55
      expect(result.advanceCredit).toBe(125); // 1025 - (225 * 4) = 125
    });
  });
});
