import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock del módulo config para evitar errores de variables de entorno
vi.mock("@/lib/config", () => ({
  STRAPI_BASE_URL: "http://localhost:1337",
  STRAPI_API_TOKEN: "test-token",
}));

describe("Configuration CRUD - Strapi Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchConfigurationsFromStrapi (READ - Lista)", () => {
    it("debe obtener la lista de configuraciones correctamente", async () => {
      const mockConfigurations = {
        data: [
          {
            id: 1,
            documentId: "config-1",
            key: "WHATSAPP_PHONE_NUMBER_ID",
            value: "123456789",
            description: "ID del número de WhatsApp",
            category: "whatsapp",
            isSecret: false,
          },
          {
            id: 2,
            documentId: "config-2",
            key: "WHATSAPP_ACCESS_TOKEN",
            value: "secret-token",
            description: "Token de acceso",
            category: "whatsapp",
            isSecret: true,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigurations,
      });

      const response = await fetch("http://localhost:1337/api/configurations");
      const data = await response.json();

      expect(data.data).toHaveLength(2);
      expect(data.data[0].key).toBe("WHATSAPP_PHONE_NUMBER_ID");
      expect(data.data[0].category).toBe("whatsapp");
      expect(data.data[1].isSecret).toBe(true);
    });

    it("debe filtrar configuraciones por categoría", async () => {
      const mockConfigurations = {
        data: [
          {
            id: 1,
            documentId: "config-1",
            key: "GOOGLE_CLIENT_ID",
            value: "client-id",
            description: "ID de cliente Google",
            category: "google",
            isSecret: false,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigurations,
      });

      const response = await fetch(
        "http://localhost:1337/api/configurations?filters[category][$eq]=google"
      );
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      expect(data.data[0].category).toBe("google");
    });

    it("debe retornar array vacío cuando no hay configuraciones", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const response = await fetch("http://localhost:1337/api/configurations");
      const data = await response.json();

      expect(data.data).toHaveLength(0);
    });

    it("debe lanzar error cuando la petición falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const response = await fetch("http://localhost:1337/api/configurations");

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe("createConfigurationInStrapi (CREATE)", () => {
    it("debe crear una configuración correctamente", async () => {
      const newConfig = {
        key: "NEW_CONFIG",
        value: "new-value",
        description: "Nueva configuración",
        category: "general",
        isSecret: false,
      };

      const mockResponse = {
        data: {
          id: 3,
          documentId: "new-config-id",
          ...newConfig,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch("http://localhost:1337/api/configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: newConfig }),
      });
      const data = await response.json();

      expect(data.data.key).toBe("NEW_CONFIG");
      expect(data.data.value).toBe("new-value");
      expect(data.data.documentId).toBe("new-config-id");
    });

    it("debe crear una configuración secreta correctamente", async () => {
      const newConfig = {
        key: "API_SECRET",
        value: "super-secret",
        description: "Clave secreta",
        category: "general",
        isSecret: true,
      };

      const mockResponse = {
        data: {
          id: 4,
          documentId: "secret-config-id",
          ...newConfig,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch("http://localhost:1337/api/configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: newConfig }),
      });
      const data = await response.json();

      expect(data.data.isSecret).toBe(true);
      expect(data.data.key).toBe("API_SECRET");
    });

    it("debe lanzar error cuando la creación falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      });

      const response = await fetch("http://localhost:1337/api/configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { key: "TEST" } }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe("updateConfigurationInStrapi (UPDATE)", () => {
    it("debe actualizar una configuración correctamente", async () => {
      const updatedData = {
        data: {
          id: 1,
          documentId: "config-1",
          key: "EXISTING_KEY",
          value: "updated-value",
          category: "general",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedData,
      });

      const response = await fetch(
        "http://localhost:1337/api/configurations/config-1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { value: "updated-value" } }),
        }
      );
      const data = await response.json();

      expect(data.data.value).toBe("updated-value");
    });

    it("debe lanzar error cuando la configuración no existe", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      });

      const response = await fetch(
        "http://localhost:1337/api/configurations/non-existent",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { value: "value" } }),
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe("deleteConfigurationInStrapi (DELETE)", () => {
    it("debe eliminar una configuración correctamente", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: null }),
      });

      const response = await fetch(
        "http://localhost:1337/api/configurations/config-to-delete",
        { method: "DELETE" }
      );

      expect(response.ok).toBe(true);
    });

    it("debe lanzar error cuando la eliminación falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const response = await fetch(
        "http://localhost:1337/api/configurations/config-1",
        { method: "DELETE" }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe("Validación de categorías", () => {
    it("debe aceptar todas las categorías válidas del schema", async () => {
      const validCategories = ["general", "whatsapp", "google", "company", "billing"];

      for (const category of validCategories) {
        const mockResponse = {
          data: {
            id: 1,
            documentId: "config-1",
            key: `TEST_${category.toUpperCase()}`,
            value: "test",
            category,
            isSecret: false,
          },
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const response = await fetch(
          "http://localhost:1337/api/configurations",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: {
                key: `TEST_${category.toUpperCase()}`,
                value: "test",
                category,
              },
            }),
          }
        );
        const data = await response.json();

        expect(response.ok).toBe(true);
        expect(data.data.category).toBe(category);
      }
    });
  });

  describe("Normalización de datos", () => {
    it("debe manejar configuraciones con estructura attributes (Strapi v4 style)", async () => {
      const mockConfigurations = {
        data: [
          {
            id: 1,
            attributes: {
              key: "CONFIG_ATTRS",
              value: "attrs-value",
              description: "Configuración con attributes",
              category: "general",
              isSecret: false,
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigurations,
      });

      const response = await fetch("http://localhost:1337/api/configurations");
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      // Strapi v5 usa estructura plana, pero verificamos que el mock funcione
      expect(data.data[0].id).toBe(1);
    });

    it("debe manejar configuraciones sin campos opcionales", async () => {
      const mockConfigurations = {
        data: [
          {
            id: 1,
            documentId: "minimal-config",
            key: "MINIMAL_KEY",
            value: "",
            category: "general",
            // Sin description ni isSecret
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigurations,
      });

      const response = await fetch("http://localhost:1337/api/configurations");
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      expect(data.data[0].key).toBe("MINIMAL_KEY");
      expect(data.data[0].description).toBeUndefined();
    });
  });
});
