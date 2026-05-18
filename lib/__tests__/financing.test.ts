/**
 * Tests para las funciones de cálculo de Financing
 */

import { describe, it, expect } from "vitest";
import {
  calculateTotalQuotas,
  calculateQuotaAmount,
  calculateNextDueDate,
  calculateLateFee,
  calculateDaysLate,
  processPayment,
  calculateFinancingSummary,
  getDaysInterval,
} from "@/lib/financing";

describe("Financing Library - Cálculos de Cuotas", () => {
  describe("calculateTotalQuotas", () => {
    describe("Frecuencia Semanal", () => {
      it("54 meses = 234 cuotas semanales", () => {
        expect(calculateTotalQuotas(54, "semanal")).toBe(234);
      });

      it("12 meses = 52 cuotas semanales", () => {
        expect(calculateTotalQuotas(12, "semanal")).toBe(52);
      });

      it("24 meses = 104 cuotas semanales", () => {
        expect(calculateTotalQuotas(24, "semanal")).toBe(104);
      });
    });

    describe("Frecuencia Quincenal", () => {
      it("54 meses = 108 cuotas quincenales", () => {
        expect(calculateTotalQuotas(54, "quincenal")).toBe(108);
      });

      it("12 meses = 24 cuotas quincenales", () => {
        expect(calculateTotalQuotas(12, "quincenal")).toBe(24);
      });
    });

    describe("Frecuencia Mensual", () => {
      it("54 meses = 54 cuotas mensuales", () => {
        expect(calculateTotalQuotas(54, "mensual")).toBe(54);
      });

      it("12 meses = 12 cuotas mensuales", () => {
        expect(calculateTotalQuotas(12, "mensual")).toBe(12);
      });
    });
  });

  describe("calculateQuotaAmount", () => {
    it("$49,500 en 234 cuotas = $211.54 por cuota", () => {
      const result = calculateQuotaAmount(49500, 234);
      expect(result).toBeCloseTo(211.54, 2);
    });

    it("$49,500 en 108 cuotas = $458.33 por cuota", () => {
      const result = calculateQuotaAmount(49500, 108);
      expect(result).toBeCloseTo(458.33, 2);
    });

    it("$49,500 en 54 cuotas = $916.67 por cuota", () => {
      const result = calculateQuotaAmount(49500, 54);
      expect(result).toBeCloseTo(916.67, 2);
    });

    it("$10,000 en 52 cuotas = $192.31 por cuota", () => {
      const result = calculateQuotaAmount(10000, 52);
      expect(result).toBeCloseTo(192.31, 2);
    });

    it("retorna 0 si totalQuotas es 0", () => {
      expect(calculateQuotaAmount(49500, 0)).toBe(0);
    });

    it("retorna 0 si totalQuotas es negativo", () => {
      expect(calculateQuotaAmount(49500, -1)).toBe(0);
    });
  });

  describe("getDaysInterval", () => {
    it("semanal = 7 días", () => {
      expect(getDaysInterval("semanal")).toBe(7);
    });

    it("quincenal = 15 días", () => {
      expect(getDaysInterval("quincenal")).toBe(15);
    });

    it("mensual = 30 días", () => {
      expect(getDaysInterval("mensual")).toBe(30);
    });
  });

  describe("calculateNextDueDate", () => {
    const startDate = "2026-01-25";

    describe("Frecuencia Semanal", () => {
      it("cuota 1 = 7 días después", () => {
        expect(calculateNextDueDate(startDate, "semanal", 1)).toBe("2026-02-01");
      });

      it("cuota 2 = 14 días después", () => {
        expect(calculateNextDueDate(startDate, "semanal", 2)).toBe("2026-02-08");
      });

      it("cuota 4 = 28 días después", () => {
        expect(calculateNextDueDate(startDate, "semanal", 4)).toBe("2026-02-22");
      });
    });

    describe("Frecuencia Quincenal", () => {
      it("cuota 1 = 15 días después", () => {
        expect(calculateNextDueDate(startDate, "quincenal", 1)).toBe("2026-02-09");
      });

      it("cuota 2 = 30 días después", () => {
        expect(calculateNextDueDate(startDate, "quincenal", 2)).toBe("2026-02-24");
      });
    });

    describe("Frecuencia Mensual", () => {
      it("cuota 1 = 30 días después", () => {
        expect(calculateNextDueDate(startDate, "mensual", 1)).toBe("2026-02-24");
      });

      it("cuota 2 = 60 días después", () => {
        expect(calculateNextDueDate(startDate, "mensual", 2)).toBe("2026-03-26");
      });
    });
  });

  describe("calculateFinancingSummary", () => {
    it("resumen para financiamiento semanal de 54 meses", () => {
      const result = calculateFinancingSummary(49500, 54, "semanal");
      
      expect(result.totalQuotas).toBe(234);
      expect(result.quotaAmount).toBeCloseTo(211.54, 2);
      expect(result.daysInterval).toBe(7);
    });

    it("resumen para financiamiento quincenal de 54 meses", () => {
      const result = calculateFinancingSummary(49500, 54, "quincenal");
      
      expect(result.totalQuotas).toBe(108);
      expect(result.quotaAmount).toBeCloseTo(458.33, 2);
      expect(result.daysInterval).toBe(15);
    });

    it("resumen para financiamiento mensual de 54 meses", () => {
      const result = calculateFinancingSummary(49500, 54, "mensual");
      
      expect(result.totalQuotas).toBe(54);
      expect(result.quotaAmount).toBeCloseTo(916.67, 2);
      expect(result.daysInterval).toBe(30);
    });
  });
});

describe("Financing Library - Cálculos de Multas", () => {
  describe("calculateDaysLate", () => {
    it("pago en fecha = 0 días", () => {
      expect(calculateDaysLate("2026-02-01", "2026-02-01")).toBe(0);
    });

    it("pago anticipado = 0 días", () => {
      expect(calculateDaysLate("2026-02-05", "2026-02-01")).toBe(0);
    });

    it("1 día de atraso", () => {
      expect(calculateDaysLate("2026-02-01", "2026-02-02")).toBe(1);
    });

    it("7 días de atraso", () => {
      expect(calculateDaysLate("2026-02-01", "2026-02-08")).toBe(7);
    });

    it("30 días de atraso", () => {
      expect(calculateDaysLate("2026-02-01", "2026-03-03")).toBe(30);
    });
  });

  describe("calculateLateFee", () => {
    describe("Multa al 10% diario", () => {
      it("$225 con 1 día = $22.50", () => {
        expect(calculateLateFee(225, 1, 10)).toBe(22.5);
      });

      it("$225 con 2 días = $45.00", () => {
        expect(calculateLateFee(225, 2, 10)).toBe(45);
      });

      it("$225 con 5 días = $112.50", () => {
        expect(calculateLateFee(225, 5, 10)).toBe(112.5);
      });

      it("$225 con 10 días = $225.00 (100% de multa)", () => {
        expect(calculateLateFee(225, 10, 10)).toBe(225);
      });

      it("$225 con 20 días = $450.00 (200% de multa)", () => {
        expect(calculateLateFee(225, 20, 10)).toBe(450);
      });
    });

    describe("Multa sobre monto parcial", () => {
      it("$200 pendiente con 2 días = $40.00", () => {
        expect(calculateLateFee(200, 2, 10)).toBe(40);
      });

      it("$100 pendiente con 3 días = $30.00", () => {
        expect(calculateLateFee(100, 3, 10)).toBe(30);
      });
    });

    describe("Casos límite", () => {
      it("0 días de atraso = $0", () => {
        expect(calculateLateFee(225, 0, 10)).toBe(0);
      });

      it("monto 0 = $0", () => {
        expect(calculateLateFee(0, 5, 10)).toBe(0);
      });

      it("porcentaje 0 = $0", () => {
        expect(calculateLateFee(225, 5, 0)).toBe(0);
      });
    });
  });
});

describe("Financing Library - Procesamiento de Pagos", () => {
  describe("processPayment", () => {
    const quotaAmount = 225;

    describe("Pago exacto de una cuota", () => {
      it("$225 cubre exactamente 1 cuota", () => {
        const result = processPayment(225, quotaAmount, 0);
        expect(result.quotasCovered).toBe(1);
        expect(result.advanceCredit).toBe(0);
        expect(result.totalApplied).toBe(225);
      });
    });

    describe("Pago de múltiples cuotas", () => {
      it("$450 cubre 2 cuotas", () => {
        const result = processPayment(450, quotaAmount, 0);
        expect(result.quotasCovered).toBe(2);
        expect(result.advanceCredit).toBe(0);
      });

      it("$675 cubre 3 cuotas", () => {
        const result = processPayment(675, quotaAmount, 0);
        expect(result.quotasCovered).toBe(3);
        expect(result.advanceCredit).toBe(0);
      });

      it("$900 cubre 4 cuotas", () => {
        const result = processPayment(900, quotaAmount, 0);
        expect(result.quotasCovered).toBe(4);
        expect(result.advanceCredit).toBe(0);
      });
    });

    describe("Pago con crédito restante", () => {
      it("$300 cubre 1 cuota + $75 de crédito", () => {
        const result = processPayment(300, quotaAmount, 0);
        expect(result.quotasCovered).toBe(1);
        expect(result.advanceCredit).toBe(75);
      });

      it("$500 cubre 2 cuotas + $50 de crédito", () => {
        const result = processPayment(500, quotaAmount, 0);
        expect(result.quotasCovered).toBe(2);
        expect(result.advanceCredit).toBe(50);
      });
    });

    describe("Pago parcial (menor a una cuota)", () => {
      it("$100 no cubre cuotas, genera $100 de crédito", () => {
        const result = processPayment(100, quotaAmount, 0);
        expect(result.quotasCovered).toBe(0);
        expect(result.advanceCredit).toBe(100);
      });

      it("$50 no cubre cuotas, genera $50 de crédito", () => {
        const result = processPayment(50, quotaAmount, 0);
        expect(result.quotasCovered).toBe(0);
        expect(result.advanceCredit).toBe(50);
      });
    });

    describe("Pago con crédito previo", () => {
      it("$200 + $25 crédito = cubre 1 cuota exacta", () => {
        const result = processPayment(200, quotaAmount, 25);
        expect(result.quotasCovered).toBe(1);
        expect(result.advanceCredit).toBe(0);
      });

      it("$200 + $100 crédito = cubre 1 cuota + $75 crédito", () => {
        const result = processPayment(200, quotaAmount, 100);
        expect(result.quotasCovered).toBe(1);
        expect(result.advanceCredit).toBe(75);
      });

      it("$150 + $100 crédito = cubre 1 cuota + $25 crédito", () => {
        const result = processPayment(150, quotaAmount, 100);
        expect(result.quotasCovered).toBe(1);
        expect(result.advanceCredit).toBe(25);
      });
    });

    describe("Escenarios del mundo real", () => {
      it("Depósito inicial de $300 con cuota de $140", () => {
        const result = processPayment(300, 140, 0);
        expect(result.quotasCovered).toBe(2);
        expect(result.advanceCredit).toBe(20);
      });

      it("Pago semanal normal de $140", () => {
        const result = processPayment(140, 140, 0);
        expect(result.quotasCovered).toBe(1);
        expect(result.advanceCredit).toBe(0);
      });

      it("Adelanto de 4 cuotas de $140 = $560", () => {
        const result = processPayment(560, 140, 0);
        expect(result.quotasCovered).toBe(4);
        expect(result.advanceCredit).toBe(0);
      });
    });
  });
});
