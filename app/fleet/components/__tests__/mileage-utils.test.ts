import { describe, it, expect } from "vitest";
import { computeNewMileage, pickHistoryHighlightKey } from "../mileage-utils";

describe("computeNewMileage", () => {
  it("modo 'set': usa el valor absoluto cuando es >= al actual", () => {
    expect(computeNewMileage("set", 15000, 12000)).toBe(15000);
    expect(computeNewMileage("set", 12000, 12000)).toBe(12000);
  });

  it("modo 'set': rechaza un valor menor al actual", () => {
    expect(computeNewMileage("set", 9000, 12000)).toBeNull();
  });

  it("modo 'add': suma la cantidad al kilometraje actual", () => {
    expect(computeNewMileage("add", 500, 12000)).toBe(12500);
    expect(computeNewMileage("add", 1, 0)).toBe(1);
  });

  it("modo 'add': rechaza una cantidad no positiva", () => {
    expect(computeNewMileage("add", 0, 12000)).toBeNull();
    expect(computeNewMileage("add", -10, 12000)).toBeNull();
  });

  it("rechaza entradas inválidas (NaN o negativas)", () => {
    expect(computeNewMileage("set", NaN, 100)).toBeNull();
    expect(computeNewMileage("set", -5, 100)).toBeNull();
  });
});

describe("pickHistoryHighlightKey", () => {
  const history = [
    { id: 1, documentId: "docA", newMileage: 10000 },
    { id: 2, documentId: "docB", newMileage: 12500 },
    { id: 3, newMileage: 15000 },
  ];

  it("devuelve la clave del item con kilometraje exacto", () => {
    expect(pickHistoryHighlightKey(history, 12500)).toBe("docB");
  });

  it("devuelve la clave del item más cercano cuando no hay exacto", () => {
    expect(pickHistoryHighlightKey(history, 12400)).toBe("docB");
    expect(pickHistoryHighlightKey(history, 14000)).toBe("3"); // sin documentId → id
  });

  it("devuelve null sin target o con historial vacío", () => {
    expect(pickHistoryHighlightKey(history, null)).toBeNull();
    expect(pickHistoryHighlightKey([], 12000)).toBeNull();
  });
});
