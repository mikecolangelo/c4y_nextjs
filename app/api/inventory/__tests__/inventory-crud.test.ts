import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock del módulo config para evitar errores de variables de entorno
vi.mock("@/lib/config", () => ({
  STRAPI_BASE_URL: "http://localhost:1337",
  STRAPI_API_TOKEN: "test-token",
}));

// Importar después de los mocks
import {
  fetchInventoryItemsFromStrapi,
  fetchInventoryItemByIdFromStrapi,
  createInventoryItemInStrapi,
  updateInventoryItemInStrapi,
  deleteInventoryItemInStrapi,
} from "@/lib/inventory";

describe("Inventory CRUD - Strapi Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchInventoryItemsFromStrapi (READ - Lista)", () => {
    it("debe obtener la lista de items de inventario correctamente", async () => {
      const mockItems = {
        data: [
          {
            id: 1,
            documentId: "inv-1",
            code: "FLTR-001",
            description: "Filtro de aceite motor 1.6L",
            stock: 50,
            assignedTo: "Taller Mecánico",
            minStock: 20,
            maxStock: 100,
            unit: "unidades",
            location: "Almacén A",
            icon: "filter",
          },
          {
            id: 2,
            documentId: "inv-2",
            code: "BRK-PAD-012",
            description: "Pastillas de freno delanteras",
            stock: 12,
            minStock: 15,
            icon: "disc",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      });

      const result = await fetchInventoryItemsFromStrapi();

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe("FLTR-001");
      expect(result[0].stock).toBe(50);
      expect(result[0].stockStatus).toBe("high");
      expect(result[0].icon).toBe("filter");
      expect(result[1].code).toBe("BRK-PAD-012");
      expect(result[1].stockStatus).toBe("low"); // stock 12 < minStock 15
    });

    it("debe calcular correctamente el stockStatus", async () => {
      const mockItems = {
        data: [
          { id: 1, documentId: "inv-1", code: "LOW", description: "Test", stock: 5, minStock: 10 },
          { id: 2, documentId: "inv-2", code: "MED", description: "Test", stock: 15, minStock: 10 },
          { id: 3, documentId: "inv-3", code: "HIGH", description: "Test", stock: 25, minStock: 10 },
          { id: 4, documentId: "inv-4", code: "NO-MIN", description: "Test", stock: 1 }, // Sin minStock
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      });

      const result = await fetchInventoryItemsFromStrapi();

      expect(result[0].stockStatus).toBe("low");    // 5 < 10
      expect(result[1].stockStatus).toBe("medium"); // 10 <= 15 < 20
      expect(result[2].stockStatus).toBe("high");   // 25 >= 20
      expect(result[3].stockStatus).toBe("high");   // Sin minStock = high por defecto
    });

    it("debe retornar array vacío cuando no hay items", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await fetchInventoryItemsFromStrapi();

      expect(result).toHaveLength(0);
    });

    it("debe lanzar error cuando la petición falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(fetchInventoryItemsFromStrapi()).rejects.toThrow(
        "Strapi Inventory request failed with status 500"
      );
    });
  });

  describe("fetchInventoryItemByIdFromStrapi (READ - Individual)", () => {
    it("debe obtener un item por ID correctamente", async () => {
      const mockItem = {
        data: [
          {
            id: 1,
            documentId: "inv-1",
            code: "FLTR-001",
            description: "Filtro de aceite motor 1.6L",
            stock: 50,
            minStock: 20,
            icon: "filter",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItem,
      });

      const result = await fetchInventoryItemByIdFromStrapi("inv-1");

      expect(result).not.toBeNull();
      expect(result?.code).toBe("FLTR-001");
      expect(result?.documentId).toBe("inv-1");
    });

    it("debe retornar null cuando el item no existe", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await fetchInventoryItemByIdFromStrapi("non-existent");

      expect(result).toBeNull();
    });

    it("debe retornar null cuando recibe 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchInventoryItemByIdFromStrapi("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("createInventoryItemInStrapi (CREATE)", () => {
    it("debe crear un item correctamente", async () => {
      const newItem = {
        code: "NEW-001",
        description: "Nuevo item de prueba",
        stock: 100,
        minStock: 20,
        icon: "bolt" as const,
      };

      const mockResponse = {
        data: {
          id: 3,
          documentId: "new-item-id",
          ...newItem,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createInventoryItemInStrapi(newItem);

      expect(result.code).toBe("NEW-001");
      expect(result.stock).toBe(100);
      expect(result.documentId).toBe("new-item-id");
      expect(result.icon).toBe("bolt");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/inventory-items"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("debe asignar icono por defecto cuando no se proporciona", async () => {
      const newItem = {
        code: "NO-ICON",
        description: "Item sin icono",
        stock: 50,
      };

      const mockResponse = {
        data: {
          id: 4,
          documentId: "no-icon-id",
          ...newItem,
          // Sin icon en la respuesta
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createInventoryItemInStrapi(newItem);

      expect(result.icon).toBe("filter"); // Valor por defecto
    });

    it("debe lanzar error cuando la creación falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      });

      await expect(
        createInventoryItemInStrapi({
          code: "TEST",
          description: "Test",
          stock: 10,
        })
      ).rejects.toThrow("Strapi Inventory create failed");
    });
  });

  describe("updateInventoryItemInStrapi (UPDATE)", () => {
    it("debe actualizar un item correctamente usando documentId", async () => {
      const updatedData = {
        data: {
          id: 1,
          documentId: "inv-1",
          code: "FLTR-001",
          description: "Filtro actualizado",
          stock: 75,
          minStock: 20,
          icon: "filter",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedData,
      });

      const result = await updateInventoryItemInStrapi("inv-1", {
        description: "Filtro actualizado",
        stock: 75,
      });

      expect(result.description).toBe("Filtro actualizado");
      expect(result.stock).toBe(75);
    });

    it("debe actualizar un item usando ID numérico", async () => {
      // Para IDs numéricos, primero se busca el documentId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 1,
              documentId: "inv-doc-1",
              code: "FLTR-001",
              description: "Original",
              stock: 50,
              icon: "filter",
            },
          ],
        }),
      });

      // Luego se hace la actualización
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 1,
            documentId: "inv-doc-1",
            code: "FLTR-001",
            description: "Actualizado",
            stock: 60,
            icon: "filter",
          },
        }),
      });

      const result = await updateInventoryItemInStrapi(1, {
        description: "Actualizado",
        stock: 60,
      });

      expect(result.description).toBe("Actualizado");
      expect(result.stock).toBe(60);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("debe lanzar error cuando el item no existe (ID numérico)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await expect(
        updateInventoryItemInStrapi(999, { stock: 100 })
      ).rejects.toThrow("No pudimos encontrar el item de inventario");
    });
  });

  describe("deleteInventoryItemInStrapi (DELETE)", () => {
    it("debe eliminar un item correctamente usando documentId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      });

      await expect(
        deleteInventoryItemInStrapi("inv-to-delete")
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/inventory-items/inv-to-delete"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("debe eliminar un item usando ID numérico", async () => {
      // Para IDs numéricos, primero se resuelve el documentId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 1,
              documentId: "inv-doc-1",
              code: "FLTR-001",
              description: "Test",
              stock: 50,
              icon: "filter",
            },
          ],
        }),
      });

      // Luego se hace el DELETE
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      });

      await expect(deleteInventoryItemInStrapi(1)).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("debe lanzar error cuando el item no existe (ID numérico)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await expect(deleteInventoryItemInStrapi(999)).rejects.toThrow(
        "No pudimos encontrar el item de inventario"
      );
    });

    it("debe lanzar error cuando la eliminación falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(deleteInventoryItemInStrapi("inv-1")).rejects.toThrow(
        "Strapi Inventory delete failed"
      );
    });
  });

  describe("Normalización de datos", () => {
    it("debe normalizar correctamente items con estructura attributes", async () => {
      const mockItems = {
        data: [
          {
            id: 1,
            attributes: {
              documentId: "inv-attrs",
              code: "ATTR-001",
              description: "Item con Attributes",
              stock: 75,
              minStock: 30,
              icon: "disc",
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      });

      const result = await fetchInventoryItemsFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("ATTR-001");
      expect(result[0].stock).toBe(75);
      expect(result[0].icon).toBe("disc");
    });

    it("debe manejar items sin campos opcionales", async () => {
      const mockItems = {
        data: [
          {
            id: 1,
            documentId: "minimal-inv",
            code: "MIN-001",
            description: "Item mínimo",
            stock: 10,
            // Sin minStock, maxStock, unit, location, supplier, lastRestocked, icon
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      });

      const result = await fetchInventoryItemsFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].minStock).toBeUndefined();
      expect(result[0].maxStock).toBeUndefined();
      expect(result[0].unit).toBeUndefined();
      expect(result[0].location).toBeUndefined();
      expect(result[0].supplier).toBeUndefined();
      expect(result[0].lastRestocked).toBeUndefined();
      expect(result[0].icon).toBe("filter"); // Valor por defecto
    });

    it("debe filtrar items sin código", async () => {
      const mockItems = {
        data: [
          {
            id: 1,
            documentId: "valid-inv",
            code: "VALID-001",
            description: "Item válido",
            stock: 50,
          },
          {
            id: 2,
            documentId: "invalid-inv",
            code: "", // Código vacío
            description: "Item inválido",
            stock: 60,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      });

      const result = await fetchInventoryItemsFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("VALID-001");
    });
  });
});
