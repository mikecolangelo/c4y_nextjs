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
  fetchDealsFromStrapi,
  fetchDealByIdFromStrapi,
  createDealInStrapi,
  updateDealInStrapi,
  deleteDealInStrapi,
  createDealClauseInStrapi,
  deleteDealClauseInStrapi,
  createDealDiscountInStrapi,
  deleteDealDiscountInStrapi,
} from "@/lib/deal";

describe("Deal CRUD - Strapi Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchDealsFromStrapi (READ - Lista)", () => {
    it("debe obtener la lista de contratos correctamente", async () => {
      const mockDeals = {
        data: [
          {
            id: 1,
            documentId: "deal-1",
            title: "Contrato Test 1",
            type: "conduccion",
            status: "pendiente",
            generatedAt: "2024-06-05",
            price: 25000,
            paymentAgreement: "semanal",
            client: {
              id: 1,
              documentId: "client-1",
              fullName: "Ana López",
              email: "ana@example.com",
            },
            vehicle: {
              id: 1,
              documentId: "vehicle-1",
              name: "Toyota Camry 2023",
              placa: "ABC123",
            },
            clauses: [],
            discounts: [],
          },
          {
            id: 2,
            documentId: "deal-2",
            type: "arrendamiento",
            status: "firmado",
            generatedAt: "2024-06-02",
            signedAt: "2024-06-03",
            price: 30000,
            paymentAgreement: "quincenal",
            client: {
              id: 2,
              documentId: "client-2",
              fullName: "Jorge Martinez",
              email: "jorge@example.com",
            },
            clauses: [],
            discounts: [],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeals,
      });

      const result = await fetchDealsFromStrapi();

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("conduccion");
      expect(result[0].typeLabel).toBe("Contrato de Conducción");
      expect(result[0].status).toBe("pendiente");
      expect(result[0].statusLabel).toBe("Pendiente de Firma");
      expect(result[0].clientName).toBe("Ana López");
      expect(result[0].vehicleName).toBe("Toyota Camry 2023");
      expect(result[1].type).toBe("arrendamiento");
      expect(result[1].typeLabel).toBe("Contrato de Arrendamiento");
      expect(result[1].status).toBe("firmado");
    });

    it("debe formatear correctamente las fechas", async () => {
      const mockDeals = {
        data: [
          {
            id: 1,
            documentId: "deal-1",
            type: "servicio",
            status: "pendiente",
            generatedAt: "2024-06-15",
            signedAt: "2024-06-20",
            price: 15000,
            clauses: [],
            discounts: [],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeals,
      });

      const result = await fetchDealsFromStrapi();

      expect(result[0].generatedAtLabel).toMatch(/^\d{2}\/06\/2024$/);
      expect(result[0].signedAtLabel).toMatch(/^\d{2}\/06\/2024$/);
    });

    it("debe retornar array vacío cuando no hay contratos", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await fetchDealsFromStrapi();

      expect(result).toHaveLength(0);
    });

    it("debe lanzar error cuando la petición falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(fetchDealsFromStrapi()).rejects.toThrow(
        "Strapi Deals request failed with status 500"
      );
    });
  });

  describe("fetchDealByIdFromStrapi (READ - Individual)", () => {
    it("debe obtener un contrato por ID correctamente", async () => {
      const mockDeal = {
        data: [
          {
            id: 1,
            documentId: "deal-1",
            title: "Contrato Test",
            type: "conduccion",
            status: "pendiente",
            generatedAt: "2024-06-05",
            price: 25000,
            paymentAgreement: "semanal",
            client: {
              id: 1,
              documentId: "client-1",
              fullName: "Ana López",
            },
            clauses: [
              {
                id: 1,
                documentId: "clause-1",
                title: "Cláusula de prueba",
                description: "Descripción de la cláusula",
              },
            ],
            discounts: [
              {
                id: 1,
                documentId: "discount-1",
                title: "Descuento de prueba",
                description: "Descripción del descuento",
                amount: 500,
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeal,
      });

      const result = await fetchDealByIdFromStrapi("deal-1");

      expect(result).not.toBeNull();
      expect(result?.type).toBe("conduccion");
      expect(result?.documentId).toBe("deal-1");
      expect(result?.clientName).toBe("Ana López");
      expect(result?.clauses).toHaveLength(1);
      expect(result?.clauses[0].title).toBe("Cláusula de prueba");
      expect(result?.discounts).toHaveLength(1);
      expect(result?.discounts[0].title).toBe("Descuento de prueba");
      expect(result?.discounts[0].amount).toBe(500);
    });

    it("debe retornar null cuando el contrato no existe", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await fetchDealByIdFromStrapi("non-existent");

      expect(result).toBeNull();
    });

    it("debe retornar null cuando recibe 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchDealByIdFromStrapi("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("createDealInStrapi (CREATE)", () => {
    it("debe crear un contrato correctamente", async () => {
      const newDeal = {
        type: "conduccion" as const,
        status: "pendiente" as const,
        price: 25000,
        paymentAgreement: "semanal" as const,
      };

      const mockResponse = {
        data: {
          id: 3,
          documentId: "new-deal-id",
          ...newDeal,
          clauses: [],
          discounts: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createDealInStrapi(newDeal);

      expect(result.type).toBe("conduccion");
      expect(result.typeLabel).toBe("Contrato de Conducción");
      expect(result.documentId).toBe("new-deal-id");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/deals"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("debe lanzar error cuando la creación falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      });

      await expect(
        createDealInStrapi({
          type: "conduccion",
        })
      ).rejects.toThrow("Strapi Deal create failed");
    });
  });

  describe("updateDealInStrapi (UPDATE)", () => {
    it("debe actualizar un contrato correctamente usando documentId", async () => {
      const updatedData = {
        data: {
          id: 1,
          documentId: "deal-1",
          type: "conduccion",
          status: "firmado",
          price: 26000,
          paymentAgreement: "semanal",
          clauses: [],
          discounts: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedData,
      });

      const result = await updateDealInStrapi("deal-1", {
        status: "firmado",
        price: 26000,
      });

      expect(result.status).toBe("firmado");
      expect(result.price).toBe(26000);
    });

    it("debe actualizar un contrato usando ID numérico", async () => {
      // Para IDs numéricos, primero se busca el documentId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 1,
              documentId: "deal-doc-1",
              type: "conduccion",
              status: "pendiente",
              price: 25000,
              clauses: [],
              discounts: [],
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
            documentId: "deal-doc-1",
            type: "conduccion",
            status: "firmado",
            price: 25000,
            paymentAgreement: "semanal",
            clauses: [],
            discounts: [],
          },
        }),
      });

      const result = await updateDealInStrapi(1, {
        status: "firmado",
      });

      expect(result.status).toBe("firmado");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("debe lanzar error cuando el contrato no existe (ID numérico)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await expect(
        updateDealInStrapi(999, { status: "firmado" })
      ).rejects.toThrow("No pudimos encontrar el contrato");
    });
  });

  describe("deleteDealInStrapi (DELETE)", () => {
    it("debe eliminar un contrato correctamente usando documentId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      });

      await expect(
        deleteDealInStrapi("deal-to-delete")
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/deals/deal-to-delete"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("debe eliminar un contrato usando ID numérico", async () => {
      // Para IDs numéricos, primero se resuelve el documentId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 1,
              documentId: "deal-doc-1",
              type: "conduccion",
              status: "pendiente",
              clauses: [],
              discounts: [],
            },
          ],
        }),
      });

      // Luego se hace el DELETE
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      });

      await expect(deleteDealInStrapi(1)).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("debe lanzar error cuando el contrato no existe (ID numérico)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await expect(deleteDealInStrapi(999)).rejects.toThrow(
        "No pudimos encontrar el contrato"
      );
    });

    it("debe lanzar error cuando la eliminación falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(deleteDealInStrapi("deal-1")).rejects.toThrow(
        "Strapi Deal delete failed"
      );
    });
  });

  describe("Deal Clauses CRUD", () => {
    it("debe crear una cláusula correctamente", async () => {
      const mockResponse = {
        data: {
          id: 1,
          documentId: "clause-1",
          title: "Nueva Cláusula",
          description: "Descripción de la cláusula",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createDealClauseInStrapi({
        title: "Nueva Cláusula",
        description: "Descripción de la cláusula",
        deal: "deal-1",
      });

      expect(result.title).toBe("Nueva Cláusula");
      expect(result.documentId).toBe("clause-1");
    });

    it("debe eliminar una cláusula correctamente", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      });

      await expect(
        deleteDealClauseInStrapi("clause-to-delete")
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/deal-clauses/clause-to-delete"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  describe("Deal Discounts CRUD", () => {
    it("debe crear un descuento correctamente", async () => {
      const mockResponse = {
        data: {
          id: 1,
          documentId: "discount-1",
          title: "Descuento de Prueba",
          description: "Descuento por promoción",
          amount: 500,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createDealDiscountInStrapi({
        title: "Descuento de Prueba",
        description: "Descuento por promoción",
        amount: 500,
        deal: "deal-1",
      });

      expect(result.title).toBe("Descuento de Prueba");
      expect(result.amount).toBe(500);
      expect(result.documentId).toBe("discount-1");
    });

    it("debe eliminar un descuento correctamente", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      });

      await expect(
        deleteDealDiscountInStrapi("discount-to-delete")
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/deal-discounts/discount-to-delete"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  describe("Normalización de datos", () => {
    it("debe normalizar correctamente contratos con estructura attributes", async () => {
      const mockDeals = {
        data: [
          {
            id: 1,
            attributes: {
              documentId: "deal-attrs",
              type: "servicio",
              status: "archivado",
              price: 50000,
              paymentAgreement: "quincenal",
              client: {
                data: {
                  id: 1,
                  documentId: "client-1",
                  attributes: {
                    fullName: "Cliente Attrs",
                    email: "attrs@test.com",
                  },
                },
              },
              clauses: {
                data: [],
              },
              discounts: {
                data: [],
              },
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeals,
      });

      const result = await fetchDealsFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("servicio");
      expect(result[0].typeLabel).toBe("Contrato de Servicio");
      expect(result[0].status).toBe("archivado");
      expect(result[0].statusLabel).toBe("Archivado");
      expect(result[0].clientName).toBe("Cliente Attrs");
    });

    it("debe manejar contratos sin campos opcionales", async () => {
      const mockDeals = {
        data: [
          {
            id: 1,
            documentId: "minimal-deal",
            type: "conduccion",
            status: "pendiente",
            // Sin client, vehicle, generatedAt, signedAt, price, summary, clauses, discounts
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeals,
      });

      const result = await fetchDealsFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].clientName).toBeUndefined();
      expect(result[0].vehicleName).toBeUndefined();
      expect(result[0].generatedAt).toBeUndefined();
      expect(result[0].price).toBeUndefined();
      expect(result[0].clauses).toEqual([]);
      expect(result[0].discounts).toEqual([]);
      expect(result[0].paymentAgreement).toBe("semanal"); // Valor por defecto
    });

    it("debe filtrar contratos sin tipo", async () => {
      const mockDeals = {
        data: [
          {
            id: 1,
            documentId: "valid-deal",
            type: "conduccion",
            status: "pendiente",
          },
          {
            id: 2,
            documentId: "invalid-deal",
            type: "", // Tipo vacío
            status: "pendiente",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeals,
      });

      const result = await fetchDealsFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("conduccion");
    });

    it("debe normalizar cláusulas y descuentos correctamente", async () => {
      const mockDeals = {
        data: [
          {
            id: 1,
            documentId: "deal-with-relations",
            type: "arrendamiento",
            status: "pendiente",
            clauses: [
              {
                id: 1,
                documentId: "clause-1",
                title: "Cláusula 1",
                description: "Descripción 1",
              },
              {
                id: 2,
                documentId: "clause-2",
                title: "Cláusula 2",
              },
            ],
            discounts: [
              {
                id: 1,
                documentId: "discount-1",
                title: "Descuento 1",
                description: "Desc descuento 1",
                amount: 1000,
              },
              {
                id: 2,
                documentId: "discount-2",
                title: "Descuento 2",
                amount: 500,
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeals,
      });

      const result = await fetchDealsFromStrapi();

      expect(result[0].clauses).toHaveLength(2);
      expect(result[0].clauses[0].title).toBe("Cláusula 1");
      expect(result[0].clauses[1].title).toBe("Cláusula 2");
      expect(result[0].discounts).toHaveLength(2);
      expect(result[0].discounts[0].title).toBe("Descuento 1");
      expect(result[0].discounts[0].amount).toBe(1000);
      expect(result[0].discounts[1].amount).toBe(500);
    });
  });
});
