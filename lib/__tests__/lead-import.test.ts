import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  mapHeader,
  parseLeadImportFile,
  normalizeRole,
  validateEmailFormat,
  validatePhoneFormat,
  generateTemplateBuffer,
  FIELD_LABELS,
  type LeadImportRow,
} from "../lead-import";

/** Build an .xlsx ArrayBuffer from an array-of-arrays so we can parse it back. */
function buildWorkbook(rows: (string | number)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

describe("mapHeader", () => {
  it("maps the core lead headers", () => {
    expect(mapHeader("Nombre")).toBe("displayName");
    expect(mapHeader("Teléfono")).toBe("phone");
    expect(mapHeader("Correo Electrónico")).toBe("email");
    expect(mapHeader("Origen del Lead")).toBe("department");
  });

  it("maps the full contact headers added for parity with the create modal", () => {
    expect(mapHeader("Cédula / Identificación")).toBe("identificationNumber");
    expect(mapHeader("Dirección")).toBe("address");
    expect(mapHeader("Fecha de nacimiento")).toBe("dateOfBirth");
    expect(mapHeader("Especialidades")).toBe("specialties");
    expect(mapHeader("Contacto de emergencia")).toBe("emergencyContactName");
    expect(mapHeader("Teléfono de emergencia")).toBe("emergencyContactPhone");
    expect(mapHeader("LinkedIn")).toBe("linkedin");
    expect(mapHeader("Licencia de conducir")).toBe("driverLicense");
  });

  it("returns null for unknown headers", () => {
    expect(mapHeader("Columna Rara XYZ")).toBeNull();
  });
});

describe("parseLeadImportFile", () => {
  it("parses every contact field from a fully-populated sheet", () => {
    const buffer = buildWorkbook([
      [
        "Nombre",
        "Teléfono",
        "Email",
        "Cédula / Identificación",
        "Dirección",
        "Fecha de nacimiento",
        "Especialidades",
        "Contacto de emergencia",
        "Teléfono de emergencia",
        "LinkedIn",
        "Licencia de conducir",
        "Rol",
      ],
      [
        "Juan Pérez",
        "+507 6123-4567",
        "JUAN@Email.com",
        "8-123-4567",
        "Calle 50",
        "12/05/1990",
        "Ventas",
        "María Pérez",
        "+507 6987-6543",
        "https://linkedin.com/in/juanperez",
        "B-12345678",
        "conductor",
      ],
    ]);

    const { rows } = parseLeadImportFile(buffer, "leads.xlsx");
    expect(rows).toHaveLength(1);
    const row = rows[0] as LeadImportRow;

    expect(row.displayName).toBe("Juan Pérez");
    expect(row.phone).toBe("+50761234567"); // cleaned
    expect(row.email).toBe("juan@email.com"); // lowercased
    expect(row.identificationNumber).toBe("8-123-4567");
    expect(row.address).toBe("Calle 50");
    expect(row.dateOfBirth).toBe("1990-05-12"); // ISO
    expect(row.specialties).toBe("Ventas");
    expect(row.emergencyContactName).toBe("María Pérez");
    expect(row.emergencyContactPhone).toBe("+50769876543"); // cleaned
    expect(row.linkedin).toBe("https://linkedin.com/in/juanperez");
    expect(row.driverLicense).toBe("B-12345678");
    expect(row.role).toBe("driver"); // normalized from "conductor"
  });

  it("leaves unmapped contact fields as null without failing", () => {
    const buffer = buildWorkbook([
      ["Nombre", "Email"],
      ["Ana", "ana@email.com"],
    ]);
    const { rows } = parseLeadImportFile(buffer, "leads.xlsx");
    expect(rows[0].displayName).toBe("Ana");
    expect(rows[0].identificationNumber ?? null).toBeNull();
    expect(rows[0].driverLicense ?? null).toBeNull();
  });
});

describe("template", () => {
  it("includes every contact column header in the downloadable template", () => {
    const buffer = generateTemplateBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const [headerRow] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    for (const label of [
      FIELD_LABELS.identificationNumber,
      FIELD_LABELS.address,
      FIELD_LABELS.dateOfBirth,
      FIELD_LABELS.specialties,
      FIELD_LABELS.emergencyContactName,
      FIELD_LABELS.emergencyContactPhone,
      FIELD_LABELS.linkedin,
      FIELD_LABELS.driverLicense,
    ]) {
      expect(headerRow).toContain(label);
    }
  });
});

describe("normalizeRole", () => {
  it("normalizes Spanish role aliases", () => {
    expect(normalizeRole("Administrador")).toBe("admin");
    expect(normalizeRole("conductor")).toBe("driver");
    expect(normalizeRole("prospecto")).toBe("lead");
    expect(normalizeRole("desconocido")).toBeNull();
  });
});

describe("format validators", () => {
  it("validates emails", () => {
    expect(validateEmailFormat("a@b.com")).toBe(true);
    expect(validateEmailFormat("nope")).toBe(false);
  });

  it("validates phones with at least 7 digits", () => {
    expect(validatePhoneFormat("+507 6123-4567")).toBe(true);
    expect(validatePhoneFormat("123")).toBe(false);
  });
});
