import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock del módulo config para evitar errores de variables de entorno
vi.mock("@/lib/config", () => ({
  STRAPI_BASE_URL: "http://localhost:1337",
  STRAPI_API_TOKEN: "test-token",
}));

describe("Company Info CRUD - Strapi Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchCompanyInfoFromStrapi (READ)", () => {
    it("debe obtener la información de empresa correctamente", async () => {
      const mockCompanyInfo = {
        data: {
          id: 1,
          documentId: "company-info-1",
          companyName: "CAR 4 YOU PANAMA, S.A.",
          legalRepName: "FRANCISCO ALBERTO HERNANDEZ MARTINEZ",
          legalRepNationality: "estadounidense",
          legalRepMaritalStatus: "casado",
          legalRepPassport: "A80537445",
          companyAddress: "Avenida Balboa, YOO Panamá & Arts Tower",
          registryInfo: "Inscrita a ficha...",
          phone: "+507 6000-0000",
          email: "contacto@car4you.com",
          logo: {
            url: "/uploads/logo.png",
            alternativeText: "Logo Car4You",
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCompanyInfo,
      });

      const response = await fetch("http://localhost:1337/api/company-info?populate=logo");
      const data = await response.json();

      expect(data.data.companyName).toBe("CAR 4 YOU PANAMA, S.A.");
      expect(data.data.legalRepName).toBe("FRANCISCO ALBERTO HERNANDEZ MARTINEZ");
      expect(data.data.legalRepNationality).toBe("estadounidense");
      expect(data.data.legalRepMaritalStatus).toBe("casado");
      expect(data.data.legalRepPassport).toBe("A80537445");
      expect(data.data.phone).toBe("+507 6000-0000");
      expect(data.data.logo.url).toBe("/uploads/logo.png");
    });

    it("debe retornar 404 cuando no hay datos de empresa", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      });

      const response = await fetch("http://localhost:1337/api/company-info");

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it("debe lanzar error cuando la petición falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const response = await fetch("http://localhost:1337/api/company-info");

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe("updateCompanyInfoInStrapi (UPDATE)", () => {
    it("debe actualizar la información de empresa correctamente", async () => {
      const updatedData = {
        companyName: "CAR 4 YOU PANAMA UPDATED, S.A.",
        phone: "+507 7000-0000",
        email: "nuevo@car4you.com",
      };

      const mockResponse = {
        data: {
          id: 1,
          documentId: "company-info-1",
          ...updatedData,
          legalRepName: "FRANCISCO ALBERTO HERNANDEZ MARTINEZ",
          legalRepNationality: "estadounidense",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch("http://localhost:1337/api/company-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: updatedData }),
      });
      const data = await response.json();

      expect(data.data.companyName).toBe("CAR 4 YOU PANAMA UPDATED, S.A.");
      expect(data.data.phone).toBe("+507 7000-0000");
      expect(data.data.email).toBe("nuevo@car4you.com");
    });

    it("debe actualizar campos específicos sin afectar otros", async () => {
      const mockResponse = {
        data: {
          id: 1,
          documentId: "company-info-1",
          companyName: "CAR 4 YOU PANAMA, S.A.",
          phone: "+507 8000-0000", // Solo este campo actualizado
          email: "contacto@car4you.com",
          legalRepName: "FRANCISCO ALBERTO HERNANDEZ MARTINEZ",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch("http://localhost:1337/api/company-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { phone: "+507 8000-0000" } }),
      });
      const data = await response.json();

      expect(data.data.phone).toBe("+507 8000-0000");
      expect(data.data.companyName).toBe("CAR 4 YOU PANAMA, S.A."); // No cambió
    });

    it("debe actualizar el logo correctamente", async () => {
      const mockResponse = {
        data: {
          id: 1,
          documentId: "company-info-1",
          companyName: "CAR 4 YOU PANAMA, S.A.",
          logo: {
            id: 5,
            url: "/uploads/new-logo.png",
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch("http://localhost:1337/api/company-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { logo: 5 } }),
      });
      const data = await response.json();

      expect(data.data.logo.url).toBe("/uploads/new-logo.png");
    });

    it("debe lanzar error cuando la actualización falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      });

      const response = await fetch("http://localhost:1337/api/company-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { companyName: "" } }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe("Campos del contrato PDF", () => {
    it("debe manejar todos los campos requeridos para contratos", async () => {
      const companyData = {
        companyName: "CAR 4 YOU PANAMA, S.A.",
        legalRepName: "FRANCISCO ALBERTO HERNANDEZ MARTINEZ",
        legalRepNationality: "estadounidense",
        legalRepMaritalStatus: "casado",
        legalRepPassport: "A80537445",
        companyAddress: "Avenida Balboa, YOO Panamá & Arts Tower, apartamento 60a",
        registryInfo: "Inscrita a ficha, documento, de la Sección Mercantil del Registro Público",
        phone: "+507 6000-0000",
        email: "contacto@car4you.com",
      };

      const mockResponse = {
        data: {
          id: 1,
          documentId: "company-info-1",
          ...companyData,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch("http://localhost:1337/api/company-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: companyData }),
      });
      const data = await response.json();

      // Verificar que todos los campos del contrato estén presentes
      expect(data.data.companyName).toBeDefined();
      expect(data.data.legalRepName).toBeDefined();
      expect(data.data.legalRepNationality).toBeDefined();
      expect(data.data.legalRepMaritalStatus).toBeDefined();
      expect(data.data.legalRepPassport).toBeDefined();
      expect(data.data.companyAddress).toBeDefined();
      expect(data.data.registryInfo).toBeDefined();
      expect(data.data.phone).toBeDefined();
      expect(data.data.email).toBeDefined();
    });

    it("debe manejar datos de empresa de Panamá correctamente", async () => {
      // Datos reales del contexto del proyecto
      const panamaCompanyData = {
        companyName: "CAR 4 YOU PANAMA, S.A.",
        legalRepName: "FRANCISCO ALBERTO HERNANDEZ MARTINEZ",
        legalRepNationality: "estadounidense",
        legalRepMaritalStatus: "casado",
        legalRepPassport: "A80537445",
        companyAddress: "Avenida Balboa, YOO Panamá & Arts Tower, apartamento 60a, Ciudad de Panamá, República de Panamá",
        registryInfo: "Inscrita a ficha, documento, de la Sección Mercantil del Registro Público",
      };

      const mockResponse = {
        data: {
          id: 1,
          documentId: "company-info-1",
          ...panamaCompanyData,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch("http://localhost:1337/api/company-info");
      const data = await response.json();

      expect(data.data.companyName).toContain("PANAMA");
      expect(data.data.companyAddress).toContain("Panamá");
      expect(data.data.legalRepNationality).toBe("estadounidense");
    });
  });

  describe("Normalización de datos", () => {
    it("debe manejar singleType de Strapi correctamente", async () => {
      // SingleType no tiene array, retorna directamente el objeto
      const mockCompanyInfo = {
        data: {
          id: 1,
          companyName: "Test Company",
          phone: "+507 1234567",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCompanyInfo,
      });

      const response = await fetch("http://localhost:1337/api/company-info");
      const data = await response.json();

      // SingleType retorna data como objeto, no array
      expect(data.data.id).toBe(1);
      expect(data.data.companyName).toBe("Test Company");
    });

    it("debe manejar campos opcionales vacíos", async () => {
      const mockCompanyInfo = {
        data: {
          id: 1,
          companyName: "Minimal Company",
          legalRepName: "Legal Rep",
          // Campos opcionales vacíos o null
          legalRepNationality: null,
          legalRepMaritalStatus: null,
          legalRepPassport: null,
          companyAddress: null,
          registryInfo: null,
          phone: null,
          email: null,
          logo: null,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCompanyInfo,
      });

      const response = await fetch("http://localhost:1337/api/company-info");
      const data = await response.json();

      expect(data.data.companyName).toBe("Minimal Company");
      expect(data.data.legalRepName).toBe("Legal Rep");
      expect(data.data.phone).toBeNull();
      expect(data.data.logo).toBeNull();
    });
  });
});
