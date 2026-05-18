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
  fetchServicesFromStrapi,
  fetchServiceByIdFromStrapi,
  createServiceInStrapi,
  updateServiceInStrapi,
  deleteServiceInStrapi,
} from "@/lib/services";

describe("Services CRUD - Strapi Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchServicesFromStrapi (READ - Lista)", () => {
    it("debe obtener la lista de servicios correctamente", async () => {
      const mockServices = {
        data: [
          {
            id: 1,
            documentId: "service-1",
            name: "Cambio de Aceite",
            price: 80,
            coverage: "cliente",
            description: "Cambio de aceite completo",
            category: "Mantenimiento",
          },
          {
            id: 2,
            documentId: "service-2",
            name: "Revisión de Frenos",
            price: 120,
            coverage: "cliente",
            description: "Inspección completa de frenos",
            category: "Reparación",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockServices,
      });

      const result = await fetchServicesFromStrapi();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Cambio de Aceite");
      expect(result[0].price).toBe(80);
      expect(result[0].coverage).toBe("cliente");
      expect(result[0].coverageLabel).toBe("Pagado por el cliente");
      expect(result[0].isFree).toBe(false);
      expect(result[1].name).toBe("Revisión de Frenos");
    });

    it("debe manejar servicios gratuitos correctamente", async () => {
      const mockServices = {
        data: [
          {
            id: 1,
            documentId: "service-free",
            name: "Mantenimiento 50.000km",
            price: 0,
            coverage: "empresa",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockServices,
      });

      const result = await fetchServicesFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].isFree).toBe(true);
      expect(result[0].priceLabel).toBe("Gratuito");
      expect(result[0].coverage).toBe("empresa");
      expect(result[0].coverageLabel).toBe("Cubierto por la empresa");
    });

    it("debe retornar array vacío cuando no hay servicios", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await fetchServicesFromStrapi();

      expect(result).toHaveLength(0);
    });

    it("debe lanzar error cuando la petición falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(fetchServicesFromStrapi()).rejects.toThrow(
        "Strapi Services request failed with status 500"
      );
    });
  });

  describe("fetchServiceByIdFromStrapi (READ - Individual)", () => {
    it("debe obtener un servicio por ID correctamente", async () => {
      const mockService = {
        data: [
          {
            id: 1,
            documentId: "service-1",
            name: "Cambio de Aceite",
            price: 80,
            coverage: "cliente",
            description: "Cambio de aceite completo",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockService,
      });

      const result = await fetchServiceByIdFromStrapi("service-1");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Cambio de Aceite");
      expect(result?.documentId).toBe("service-1");
    });

    it("debe retornar null cuando el servicio no existe", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await fetchServiceByIdFromStrapi("non-existent");

      expect(result).toBeNull();
    });

    it("debe retornar null cuando recibe 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchServiceByIdFromStrapi("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("createServiceInStrapi (CREATE)", () => {
    it("debe crear un servicio correctamente", async () => {
      const newService = {
        name: "Nuevo Servicio",
        price: 100,
        coverage: "cliente" as const,
        description: "Descripción del servicio",
      };

      const mockResponse = {
        data: {
          id: 3,
          documentId: "new-service-id",
          ...newService,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createServiceInStrapi(newService);

      expect(result.name).toBe("Nuevo Servicio");
      expect(result.price).toBe(100);
      expect(result.documentId).toBe("new-service-id");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/services"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("debe crear un servicio gratuito correctamente", async () => {
      const freeService = {
        name: "Servicio Gratuito",
        price: 0,
        coverage: "empresa" as const,
      };

      const mockResponse = {
        data: {
          id: 4,
          documentId: "free-service-id",
          ...freeService,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createServiceInStrapi(freeService);

      expect(result.isFree).toBe(true);
      expect(result.priceLabel).toBe("Gratuito");
    });

    it("debe lanzar error cuando la creación falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      });

      await expect(
        createServiceInStrapi({
          name: "Test",
          price: 100,
          coverage: "cliente",
        })
      ).rejects.toThrow("Strapi Service create failed");
    });
  });

  describe("updateServiceInStrapi (UPDATE)", () => {
    it("debe actualizar un servicio correctamente usando documentId", async () => {
      // Cuando el ID no es numérico, resolveServiceDocumentId retorna directamente el ID
      // así que solo necesitamos mockear la llamada PUT
      const updatedData = {
        data: {
          id: 1,
          documentId: "service-1",
          name: "Servicio Actualizado",
          price: 90,
          coverage: "cliente",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedData,
      });

      const result = await updateServiceInStrapi("service-1", {
        name: "Servicio Actualizado",
        price: 90,
      });

      expect(result.name).toBe("Servicio Actualizado");
      expect(result.price).toBe(90);
    });

    it("debe actualizar un servicio usando ID numérico", async () => {
      // Para IDs numéricos, primero se busca el documentId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 1,
              documentId: "service-doc-1",
              name: "Servicio Original",
              price: 80,
              coverage: "cliente",
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
            documentId: "service-doc-1",
            name: "Servicio Actualizado",
            price: 90,
            coverage: "cliente",
          },
        }),
      });

      const result = await updateServiceInStrapi(1, {
        name: "Servicio Actualizado",
        price: 90,
      });

      expect(result.name).toBe("Servicio Actualizado");
      expect(result.price).toBe(90);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("debe lanzar error cuando el servicio no existe (ID numérico)", async () => {
      // Para IDs numéricos que no existen
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await expect(
        updateServiceInStrapi(999, { name: "Test" })
      ).rejects.toThrow("No pudimos encontrar el servicio");
    });
  });

  describe("deleteServiceInStrapi (DELETE)", () => {
    it("debe eliminar un servicio correctamente usando documentId", async () => {
      // Cuando el ID no es numérico, se hace DELETE directamente
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      });

      await expect(
        deleteServiceInStrapi("service-to-delete")
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/services/service-to-delete"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("debe eliminar un servicio usando ID numérico", async () => {
      // Para IDs numéricos, primero se resuelve el documentId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 1,
              documentId: "service-doc-1",
              name: "Servicio",
              price: 50,
              coverage: "cliente",
            },
          ],
        }),
      });

      // Luego se hace el DELETE
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      });

      await expect(deleteServiceInStrapi(1)).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("debe lanzar error cuando el servicio no existe (ID numérico)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await expect(deleteServiceInStrapi(999)).rejects.toThrow(
        "No pudimos encontrar el servicio"
      );
    });

    it("debe lanzar error cuando la eliminación falla", async () => {
      // Mock para la eliminación fallida (usando documentId string)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(deleteServiceInStrapi("service-1")).rejects.toThrow(
        "Strapi Service delete failed"
      );
    });
  });

  describe("Normalización de datos", () => {
    it("debe normalizar correctamente servicios con estructura attributes", async () => {
      const mockServices = {
        data: [
          {
            id: 1,
            attributes: {
              documentId: "service-attrs",
              name: "Servicio con Attributes",
              price: 75,
              coverage: "cliente",
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockServices,
      });

      const result = await fetchServicesFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Servicio con Attributes");
      expect(result[0].price).toBe(75);
    });

    it("debe manejar servicios sin campos opcionales", async () => {
      const mockServices = {
        data: [
          {
            id: 1,
            documentId: "minimal-service",
            name: "Servicio Mínimo",
            price: 50,
            coverage: "cliente",
            // Sin description, category
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockServices,
      });

      const result = await fetchServicesFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].description).toBeUndefined();
      expect(result[0].category).toBeUndefined();
    });

    it("debe filtrar servicios sin nombre", async () => {
      const mockServices = {
        data: [
          {
            id: 1,
            documentId: "valid-service",
            name: "Servicio Válido",
            price: 50,
            coverage: "cliente",
          },
          {
            id: 2,
            documentId: "invalid-service",
            name: "", // Nombre vacío
            price: 60,
            coverage: "cliente",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockServices,
      });

      const result = await fetchServicesFromStrapi();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Servicio Válido");
    });
  });
});
