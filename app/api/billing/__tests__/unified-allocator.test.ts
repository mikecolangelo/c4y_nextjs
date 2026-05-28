/**
 * Tests del Unified FIFO Debt Allocator
 * Enfocado en validar la asignación correcta por dueDate y desempate penalty>quota.
 */

import { describe, it, expect } from "vitest";
import {
  buildDebtQueue,
  buildAllocationPlan,
  type UnifiedDebt,
} from "@/lib/unified-allocator";

describe("Unified Allocator - Pure Logic", () => {
  const makePenalty = (
    id: string,
    dueDate: string,
    amountPending: number
  ): UnifiedDebt => ({
    kind: "penalty",
    documentId: id,
    numericId: parseInt(id.replace("pen-", ""), 10),
    dueDate,
    amountPending,
    status: "pending",
  });

  const makeQuota = (
    id: string,
    dueDate: string,
    amountPending: number,
    originalAmount: number = amountPending
  ): UnifiedDebt => ({
    kind: "quota",
    documentId: id,
    numericId: parseInt(id.replace("q-", ""), 10),
    dueDate,
    amountPending,
    originalAmount,
    quotaNumber: parseInt(id.replace("q-", ""), 10),
    status: "pendiente",
  });

  describe("buildDebtQueue", () => {
    it("ordena por dueDate ascendente", () => {
      const debts = [
        makeQuota("q-2", "2026-06-15", 100),
        makeQuota("q-1", "2026-06-01", 100),
        makePenalty("pen-1", "2026-06-10", 50),
      ];
      const sorted = buildDebtQueue([], debts);
      expect(sorted.map((d) => d.documentId)).toEqual([
        "q-1",
        "pen-1",
        "q-2",
      ]);
    });

    it("desempata penalidad antes que cuota con misma dueDate", () => {
      const debts = [
        makeQuota("q-1", "2026-06-01", 100),
        makePenalty("pen-1", "2026-06-01", 32),
      ];
      const sorted = buildDebtQueue([], debts);
      expect(sorted.map((d) => d.documentId)).toEqual(["pen-1", "q-1"]);
    });
  });

  describe("buildAllocationPlan - Caso Auditoría $250", () => {
    /**
     * Caso real reportado:
     * S1 cuota faltante 20
     * S1 penalidad 32
     * S2 cuota 225
     * S2 penalidad 202.50
     * S3 cuota 225
     * S3 penalidad 45
     *
     * Pago = 250
     * Esperado: 32 -> S1 penalidad, 20 -> S1 cuota, 198 -> S2 penalidad
     * (deja S2 penalidad 4.50, S2 cuota 225 y todo S3 intacto)
     */
    it("asigna $250 en FIFO unificado respetando penalidades", () => {
      const penalties = [
        makePenalty("pen-s1", "2026-05-01", 32),
        makePenalty("pen-s2", "2026-05-08", 202.5),
        makePenalty("pen-s3", "2026-05-15", 45),
      ];
      const quotas = [
        makeQuota("q-s1", "2026-05-01", 20, 225),
        makeQuota("q-s2", "2026-05-08", 225, 225),
        makeQuota("q-s3", "2026-05-15", 225, 225),
      ];
      const debts = buildDebtQueue(penalties, quotas);
      const plan = buildAllocationPlan(250, debts);

      expect(plan.totalApplied).toBe(250);
      expect(plan.leftover).toBe(0);
      expect(plan.steps).toHaveLength(3);

      expect(plan.steps[0]).toMatchObject({
        kind: "penalty",
        targetDocumentId: "pen-s1",
        amountApplied: 32,
        debtAfter: 0,
      });

      expect(plan.steps[1]).toMatchObject({
        kind: "quota",
        targetDocumentId: "q-s1",
        amountApplied: 20,
        debtAfter: 0,
      });

      expect(plan.steps[2]).toMatchObject({
        kind: "penalty",
        targetDocumentId: "pen-s2",
        amountApplied: 198,
        debtAfter: 4.5,
      });
    });
  });

  describe("buildAllocationPlan - Edge Cases", () => {
    it("pago exacto a una sola deuda", () => {
      const debts = [makeQuota("q-1", "2026-06-01", 100, 100)];
      const plan = buildAllocationPlan(100, debts);
      expect(plan.totalApplied).toBe(100);
      expect(plan.leftover).toBe(0);
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].debtAfter).toBe(0);
    });

    it("pago insuficiente: solo alcanza para parte de la primera penalidad", () => {
      const debts = [
        makePenalty("pen-1", "2026-06-01", 50),
        makeQuota("q-1", "2026-06-01", 100),
      ];
      const plan = buildAllocationPlan(30, debts);
      expect(plan.totalApplied).toBe(30);
      expect(plan.leftover).toBe(0);
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0]).toMatchObject({
        kind: "penalty",
        amountApplied: 30,
        debtAfter: 20,
      });
    });

    it("sobrante genera leftover correcto", () => {
      const debts = [
        makeQuota("q-1", "2026-06-01", 100, 100),
      ];
      const plan = buildAllocationPlan(150, debts);
      expect(plan.totalApplied).toBe(100);
      expect(plan.leftover).toBe(50);
      expect(plan.steps).toHaveLength(1);
    });

    it("mismo dueDate con penalidad + cuota: pago cubre penalidad completa y parcial de cuota", () => {
      const debts = [
        makePenalty("pen-1", "2026-06-01", 25),
        makeQuota("q-1", "2026-06-01", 100, 100),
      ];
      const plan = buildAllocationPlan(50, debts);
      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0]).toMatchObject({
        kind: "penalty",
        amountApplied: 25,
        debtAfter: 0,
      });
      expect(plan.steps[1]).toMatchObject({
        kind: "quota",
        amountApplied: 25,
        debtAfter: 75,
      });
      expect(plan.leftover).toBe(0);
    });

    it("deuda con amountPending <= 0 es ignorada", () => {
      const debts = [
        makeQuota("q-1", "2026-06-01", 0, 100),
        makeQuota("q-2", "2026-06-02", 50, 50),
      ];
      const plan = buildAllocationPlan(50, debts);
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].targetDocumentId).toBe("q-2");
    });
  });

  describe("Penalty accrual idempotency math (HOTFIX regression)", () => {
    const calcNewPending = (oldOriginal: number, oldPending: number, newOriginal: number) => {
      const alreadyPaid = Math.max(0, parseFloat((oldOriginal - oldPending).toFixed(2)));
      return Math.max(0, parseFloat((newOriginal - alreadyPaid).toFixed(2)));
    };

    it("preserves fully paid penalty when recalculating same amount", () => {
      expect(calcNewPending(22.5, 0, 22.5)).toBe(0);
    });

    it("preserves partially paid penalty when recalculating same amount", () => {
      expect(calcNewPending(22.5, 12.5, 22.5)).toBe(12.5);
    });

    it("reduces to zero when new penalty is smaller than already paid", () => {
      expect(calcNewPending(22.5, 0, 4.75)).toBe(0);
    });

    it("reopens penalty when new penalty grows beyond already paid", () => {
      expect(calcNewPending(22.5, 0, 45.0)).toBe(22.5);
    });
  });
});
