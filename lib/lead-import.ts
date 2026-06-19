import * as XLSX from "xlsx";

export interface LeadImportRow {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null; // Origen del Lead
  bio?: string | null; // Notas
  hireDate?: string | null; // Fecha de contacto
  workSchedule?: string | null; // Empresa
  role?: string | null; // Rol del contacto
  // Campos de contacto completos (paridad con el modal "Crear Contacto").
  // Son opcionales: un lead puede importarse sin ellos.
  identificationNumber?: string | null; // Cédula / Identificación
  address?: string | null; // Dirección
  dateOfBirth?: string | null; // Fecha de nacimiento
  specialties?: string | null; // Especialidades
  emergencyContactName?: string | null; // Contacto de emergencia (nombre)
  emergencyContactPhone?: string | null; // Contacto de emergencia (teléfono)
  linkedin?: string | null; // LinkedIn
  driverLicense?: string | null; // Licencia de conducir
  _rowIndex?: number;
  _errors?: string[];
}

// Mapeo flexible de headers del Excel a campos del sistema
export const HEADER_MAP: Record<string, keyof LeadImportRow> = {
  // Nombre
  nombre: "displayName",
  name: "displayName",
  nombres: "displayName",
  "nombre completo": "displayName",
  "full name": "displayName",
  contacto: "displayName",
  cliente: "displayName",
  "nombre del contacto": "displayName",
  "nombre contacto": "displayName",
  "nombre del cliente": "displayName",
  "nombre cliente": "displayName",
  // Teléfono — aliases exhaustivos
  telefono: "phone",
  tel: "phone",
  telf: "phone",
  tlf: "phone",
  celular: "phone",
  cel: "phone",
  movil: "phone",
  mov: "phone",
  mobile: "phone",
  cell: "phone",
  phone: "phone",
  "número de teléfono": "phone",
  "numero de telefono": "phone",
  "numero de celular": "phone",
  "numero celular": "phone",
  "numero de movil": "phone",
  "numero movil": "phone",
  "numero de contacto": "phone",
  "numero contacto": "phone",
  "no telefono": "phone",
  "no celular": "phone",
  "no movil": "phone",
  "nro telefono": "phone",
  "nro celular": "phone",
  "nro movil": "phone",
  nro: "phone",
  "telefono celular": "phone",
  "telefono movil": "phone",
  "telefono fijo": "phone",
  "telefono contacto": "phone",
  "telefono trabajo": "phone",
  "tel contacto": "phone",
  "phone number": "phone",
  "mobile phone": "phone",
  "cell phone": "phone",
  "work phone": "phone",
  "direct phone": "phone",
  "phone contact": "phone",
  contact: "phone",
  whatsapp: "phone",
  wa: "phone",
  numero: "phone",
  num: "phone",
  // Email
  email: "email",
  correo: "email",
  "correo electrónico": "email",
  "correo electronico": "email",
  "e-mail": "email",
  mail: "email",
  "email address": "email",
  "correo corporativo": "email",
  // Origen del Lead
  origen: "department",
  "origen del lead": "department",
  "origen lead": "department",
  fuente: "department",
  source: "department",
  canal: "department",
  procedencia: "department",
  campana: "department",
  campaña: "department",
  medio: "department",
  // Notas
  notas: "bio",
  notes: "bio",
  comentarios: "bio",
  observaciones: "bio",
  descripcion: "bio",
  descripción: "bio",
  // Fecha de contacto
  "fecha de contacto": "hireDate",
  "fecha contacto": "hireDate",
  "fecha de registro": "hireDate",
  "fecha registro": "hireDate",
  "fecha de creacion": "hireDate",
  "fecha creacion": "hireDate",
  "fecha de creación": "hireDate",
  contactdate: "hireDate",
  "contact date": "hireDate",
  "fecha de importacion": "hireDate",
  "fecha importacion": "hireDate",
  // Empresa
  empresa: "workSchedule",
  company: "workSchedule",
  compania: "workSchedule",
  compañia: "workSchedule",
  negocio: "workSchedule",
  organizacion: "workSchedule",
  organización: "workSchedule",
  // Rol
  rol: "role",
  role: "role",
  cargo: "role",
  perfil: "role",
  tipo: "role",
  "tipo de usuario": "role",
  "tipo de contacto": "role",
  categoria: "role",
  categoría: "role",
  // Cédula / Identificación
  cedula: "identificationNumber",
  cédula: "identificationNumber",
  identificacion: "identificationNumber",
  identificación: "identificationNumber",
  "cedula identificacion": "identificationNumber",
  "cedula id": "identificationNumber",
  "documento de identidad": "identificationNumber",
  documento: "identificationNumber",
  dni: "identificationNumber",
  "id number": "identificationNumber",
  "national id": "identificationNumber",
  // Dirección
  direccion: "address",
  dirección: "address",
  address: "address",
  domicilio: "address",
  ubicacion: "address",
  ubicación: "address",
  // Fecha de nacimiento
  "fecha de nacimiento": "dateOfBirth",
  "fecha nacimiento": "dateOfBirth",
  nacimiento: "dateOfBirth",
  cumpleanos: "dateOfBirth",
  cumpleaños: "dateOfBirth",
  birthdate: "dateOfBirth",
  "date of birth": "dateOfBirth",
  dob: "dateOfBirth",
  // Especialidades
  especialidades: "specialties",
  especialidad: "specialties",
  specialties: "specialties",
  skills: "specialties",
  habilidades: "specialties",
  // Contacto de emergencia (nombre)
  "contacto de emergencia": "emergencyContactName",
  "contacto emergencia": "emergencyContactName",
  "nombre de emergencia": "emergencyContactName",
  "emergency contact": "emergencyContactName",
  "emergency contact name": "emergencyContactName",
  // Contacto de emergencia (teléfono)
  "telefono de emergencia": "emergencyContactPhone",
  "teléfono de emergencia": "emergencyContactPhone",
  "telefono emergencia": "emergencyContactPhone",
  "emergency phone": "emergencyContactPhone",
  "emergency contact phone": "emergencyContactPhone",
  // LinkedIn
  linkedin: "linkedin",
  "perfil de linkedin": "linkedin",
  "linkedin url": "linkedin",
  // Licencia de conducir
  "licencia de conducir": "driverLicense",
  "licencia conducir": "driverLicense",
  licencia: "driverLicense",
  "driver license": "driverLicense",
  "drivers license": "driverLicense",
  "driving license": "driverLicense",
};

// Headers que se usan para la firma de detección automática
const HEADER_SIGNATURES = [
  "nombre",
  "name",
  "nombres",
  "nombre completo",
  "full name",
  "contacto",
  "cliente",
  "telefono",
  "tel",
  "celular",
  "movil",
  "phone",
  "numero de telefono",
  "email",
  "correo",
  "correo electronico",
  "e-mail",
  "mail",
  "origen",
  "origen del lead",
  "fuente",
  "source",
  "canal",
  "procedencia",
];

// Campos obligatorios — relajados a peticion del usuario:
// se permiten leads con datos faltantes.
export const REQUIRED_FIELDS: (keyof LeadImportRow)[] = [];

// Labels amigables para mostrar en la UI
export const FIELD_LABELS: Record<keyof LeadImportRow, string> = {
  displayName: "Nombre",
  phone: "Teléfono",
  email: "Email",
  department: "Origen del Lead",
  bio: "Notas",
  hireDate: "Fecha de contacto",
  workSchedule: "Empresa",
  role: "Rol",
  identificationNumber: "Cédula / Identificación",
  address: "Dirección",
  dateOfBirth: "Fecha de nacimiento",
  specialties: "Especialidades",
  emergencyContactName: "Contacto de emergencia",
  emergencyContactPhone: "Teléfono de emergencia",
  linkedin: "LinkedIn",
  driverLicense: "Licencia de conducir",
  _rowIndex: "Fila",
  _errors: "Errores",
};

function normalizeHeader(header: string): string {
  return header
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ") // colapsa espacios (p.ej. "cedula / id" -> "cedula id")
    .trim();
}

// Palabras clave por campo para matching parcial seguro (evita falsos positivos)
const PARTIAL_KEYWORDS: Record<string, keyof LeadImportRow> = {
  // Teléfono — muy específicos
  telefono: "phone",
  celular: "phone",
  movil: "phone",
  mobile: "phone",
  phone: "phone",
  cell: "phone",
  cel: "phone",
  mov: "phone",
  telf: "phone",
  tlf: "phone",
  whatsapp: "phone",
  wa: "phone",
  // Email — muy específicos
  email: "email",
  correo: "email",
  mail: "email",
  // Nombre — muy específicos
  nombre: "displayName",
  name: "displayName",
  cliente: "displayName",
  // Rol
  rol: "role",
  role: "role",
  cargo: "role",
  perfil: "role",
};

export function mapHeader(header: string): keyof LeadImportRow | null {
  const norm = normalizeHeader(header);

  // 1. Coincidencia exacta (prioridad máxima)
  const exact = HEADER_MAP[norm];
  if (exact) return exact;

  // 2. Coincidencia parcial por palabras individuales
  // Solo palabras de 3+ caracteres para evitar falsos positivos
  const words = norm.split(/\s+/).filter((w) => w.length >= 3);
  for (const word of words) {
    const mapped = PARTIAL_KEYWORDS[word];
    if (mapped) return mapped;
  }

  return null;
}

/** Format a Y/M/D triple as an ISO date (YYYY-MM-DD) with no timezone drift. */
function toIsoDate(y: number, m: number, d: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseDate(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    // Use UTC parts: XLSX builds dates at UTC midnight, so local getters could
    // roll the day back in timezones east of UTC.
    return toIsoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === "number") {
    // Excel serial date — anchor the epoch in UTC to avoid an off-by-one day.
    if (value > 30000 && value < 50000) {
      const ms = Date.UTC(1899, 11, 30) + value * 24 * 60 * 60 * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime())
        ? null
        : toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    return null;
  }
  const str = String(value).trim();
  const sep = str.includes("/") ? "/" : str.includes("-") ? "-" : null;
  if (!sep) return null;
  const parts = str.split(sep);
  if (parts.length !== 3) return null;
  let d = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  let y = parseInt(parts[2], 10);
  if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return null;
  if (y < 100) y += 2000;
  if (m > 12 && d <= 12) {
    const tmp = d;
    d = m;
    m = tmp;
  }
  // Validate against a UTC date so the calendar check never drifts by TZ.
  const date = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(date.getTime()) || date.getUTCDate() !== d || date.getUTCMonth() !== m - 1) {
    return null;
  }
  return toIsoDate(y, m, d);
}

function cleanPhone(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  // Si es un número (caso común en Excel cuando no hay +), convertir a string
  if (typeof value === "number") {
    const str = String(Math.floor(value));
    return str.length > 0 ? str : null;
  }
  const str = String(value).trim();
  // Remover todo excepto dígitos y el signo + al inicio
  const cleaned = str.replace(/[^\d+]/g, "");
  // Asegurar que solo haya un + al inicio (si existe)
  const hasPlus = cleaned.startsWith("+");
  const digitsAndPlus = cleaned.replace(/\+/g, "");
  const result = hasPlus ? "+" + digitsAndPlus : digitsAndPlus;
  return result.length > 0 ? result : null;
}

function cleanString(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

const ROLE_ALIASES: Record<string, string> = {
  // admin
  admin: "admin",
  administrador: "admin",
  administradora: "admin",
  "super-admin": "admin",
  "super admin": "admin",
  superadmin: "admin",
  // driver
  driver: "driver",
  conductor: "driver",
  conductora: "driver",
  chofer: "driver",
  // lead
  lead: "lead",
  prospecto: "lead",
  "cliente potencial": "lead",
};

export function normalizeRole(value: any): string | null {
  const raw = cleanString(value);
  if (!raw) return null;
  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return ROLE_ALIASES[key] || null;
}

export function validateEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhoneFormat(phone: string): boolean {
  // Al menos 7 dígitos, permitiendo + al inicio
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.length >= 7;
}

function findHeaderRow(json: any[][]): { rowIndex: number; headers: string[] } {
  for (let i = 0; i < Math.min(json.length, 25); i++) {
    const row = json[i];
    if (!row || row.length === 0) continue;
    const normalized = row.map((h: any) => normalizeHeader(String(h)));
    const matches = normalized.filter((h: string) => HEADER_SIGNATURES.includes(h)).length;
    if (matches >= 1) {
      return { rowIndex: i, headers: row.map((h: any) => String(h).trim()) };
    }
  }
  // Fallback: primera fila no vacía
  for (let i = 0; i < json.length; i++) {
    if (
      json[i] &&
      json[i].some((cell: any) => cell !== "" && cell !== null && cell !== undefined)
    ) {
      return { rowIndex: i, headers: json[i].map((h: any) => String(h).trim()) };
    }
  }
  return { rowIndex: 0, headers: [] };
}

export interface UnmappedColumn {
  header: string;
  index: number;
  sampleValues: (string | number | null)[];
}

export interface ParseResult {
  headers: string[];
  mappedHeaders: (keyof LeadImportRow | null)[];
  rows: LeadImportRow[];
  headerRowIndex: number;
  unmappedColumns: UnmappedColumn[];
}

export function parseLeadImportFile(arrayBuffer: ArrayBuffer, fileName: string): ParseResult {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];

  if (json.length === 0) {
    throw new Error("El archivo está vacío o no contiene datos");
  }

  const { rowIndex: headerRowIndex, headers } = findHeaderRow(json);
  const mappedHeaders = headers.map(mapHeader);

  // Debug: mostrar en consola qué se detectó
  // eslint-disable-next-line no-console
  console.log("[LeadImport] Headers detectados:", headers);
  // eslint-disable-next-line no-console
  console.log("[LeadImport] Headers mapeados:", mappedHeaders);

  // Detectar columnas no mapeadas para mostrar advertencia al usuario
  const unmappedColumns: UnmappedColumn[] = [];
  headers.forEach((header, idx) => {
    if (!mappedHeaders[idx]) {
      // Recolectar hasta 3 valores de muestra de filas no vacías
      const sampleValues: (string | number | null)[] = [];
      for (let i = headerRowIndex + 1; i < Math.min(json.length, headerRowIndex + 6); i++) {
        const val = json[i]?.[idx];
        if (val !== "" && val !== null && val !== undefined) {
          sampleValues.push(val);
        }
      }
      unmappedColumns.push({ header, index: idx, sampleValues });
      // eslint-disable-next-line no-console
      console.warn(
        `[LeadImport] Columna NO mapeada: "${header}" (índice ${idx}) — muestras:`,
        sampleValues
      );
    }
  });

  const rows: LeadImportRow[] = [];
  for (let i = headerRowIndex + 1; i < json.length; i++) {
    const rawRow = json[i];
    if (!rawRow || rawRow.every((cell) => cell === "" || cell === null || cell === undefined)) {
      continue;
    }

    const row: LeadImportRow = { _rowIndex: i + 1, _errors: [] };
    for (let j = 0; j < headers.length; j++) {
      const mapped = mappedHeaders[j];
      if (!mapped) continue;
      const rawValue = rawRow[j];

      switch (mapped) {
        case "displayName":
        case "department":
        case "bio":
        case "workSchedule":
        case "identificationNumber":
        case "address":
        case "specialties":
        case "emergencyContactName":
        case "linkedin":
        case "driverLicense":
          row[mapped] = cleanString(rawValue);
          break;
        case "phone":
          row.phone = cleanPhone(rawValue);
          break;
        case "emergencyContactPhone":
          row.emergencyContactPhone = cleanPhone(rawValue);
          break;
        case "email":
          row.email = cleanString(rawValue)?.toLowerCase() || null;
          break;
        case "hireDate":
          row.hireDate = parseDate(rawValue);
          break;
        case "dateOfBirth":
          row.dateOfBirth = parseDate(rawValue);
          break;
        case "role":
          row.role = normalizeRole(rawValue);
          break;
      }
    }
    rows.push(row);
  }

  // eslint-disable-next-line no-console
  console.log("[LeadImport] Total filas parseadas:", rows.length);
  if (unmappedColumns.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[LeadImport] Columnas no mapeadas:",
      unmappedColumns.map((c) => c.header)
    );
  }

  return { headers, mappedHeaders, rows, headerRowIndex, unmappedColumns };
}

export interface ValidationResult {
  valid: boolean;
  missing: (keyof LeadImportRow)[];
  detected: (keyof LeadImportRow)[];
  mappedCount: number;
  unmappedHeaders: string[];
}

export function validateHeaders(mappedHeaders: (keyof LeadImportRow | null)[]): ValidationResult {
  const detected = mappedHeaders.filter((h): h is keyof LeadImportRow => h !== null);
  const mappedCount = detected.length;
  const missing = REQUIRED_FIELDS.filter((req) => !detected.includes(req));
  const unmappedHeaders: string[] = [];

  return {
    valid: missing.length === 0,
    missing,
    detected,
    mappedCount,
    unmappedHeaders,
  };
}

export function validateRow(row: LeadImportRow): string[] {
  const errors: string[] = [];

  // Validaciones de formato opcionales (no bloquean la importacion).
  // Se permiten leads con cualquier dato faltante.

  if (row.phone && row.phone.trim().length > 0 && !validatePhoneFormat(row.phone)) {
    errors.push("El teléfono debe contener al menos 7 dígitos");
  }

  if (row.email && row.email.trim().length > 0 && !validateEmailFormat(row.email)) {
    errors.push("El formato del email es inválido");
  }

  return errors;
}

/**
 * Verifica duplicados intra-archivo por teléfono o email.
 * Mut las filas para agregar errores de duplicado.
 */
export function checkIntraFileDuplicates(rows: LeadImportRow[]): void {
  const phoneMap = new Map<string, number[]>(); // phone -> row indices
  const emailMap = new Map<string, number[]>(); // email -> row indices

  rows.forEach((row, idx) => {
    if (row.phone) {
      const normalizedPhone = row.phone.replace(/\D/g, "");
      if (!phoneMap.has(normalizedPhone)) phoneMap.set(normalizedPhone, []);
      phoneMap.get(normalizedPhone)!.push(idx);
    }
    if (row.email) {
      const normalizedEmail = row.email.toLowerCase().trim();
      if (!emailMap.has(normalizedEmail)) emailMap.set(normalizedEmail, []);
      emailMap.get(normalizedEmail)!.push(idx);
    }
  });

  phoneMap.forEach((indices, phone) => {
    if (indices.length > 1) {
      indices.forEach((idx) => {
        const row = rows[idx];
        if (!row._errors) row._errors = [];
        row._errors.push(
          `Teléfono duplicado dentro del archivo (fila ${indices.map((i) => rows[i]._rowIndex).join(", ")})`
        );
      });
    }
  });

  emailMap.forEach((indices, email) => {
    if (indices.length > 1) {
      indices.forEach((idx) => {
        const row = rows[idx];
        if (!row._errors) row._errors = [];
        row._errors.push(
          `Email duplicado dentro del archivo (fila ${indices.map((i) => rows[i]._rowIndex).join(", ")})`
        );
      });
    }
  });
}

export function generateTemplateBuffer(): ArrayBuffer {
  const headers = [
    "Nombre",
    "Teléfono",
    "Email",
    "Origen del Lead",
    "Notas",
    "Fecha de contacto",
    "Empresa",
    "Rol",
    "Cédula / Identificación",
    "Dirección",
    "Fecha de nacimiento",
    "Especialidades",
    "Contacto de emergencia",
    "Teléfono de emergencia",
    "LinkedIn",
    "Licencia de conducir",
  ];

  const exampleRows = [
    [
      "Juan Pérez",
      "+50761234567",
      "juan.perez@email.com",
      "Facebook",
      "Interesado en SUV",
      "15/04/2026",
      "Constructora ABC",
      "lead",
      "8-123-4567",
      "Calle 50, Ciudad de Panamá",
      "12/05/1990",
      "Ventas",
      "María Pérez",
      "+50769876543",
      "https://linkedin.com/in/juanperez",
      "B-12345678",
    ],
    [
      "María González",
      "+50762345678",
      "maria.g@email.com",
      "Referido",
      "Llamar después de las 6pm",
      "20/04/2026",
      "",
      "driver",
      "8-765-4321",
      "Vía España, Ciudad de Panamá",
      "03/11/1988",
      "Atención al cliente",
      "Pedro González",
      "+50761112233",
      "",
      "C-87654321",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
  ws["!cols"] = [
    { wch: 25 },
    { wch: 18 },
    { wch: 28 },
    { wch: 20 },
    { wch: 30 },
    { wch: 18 },
    { wch: 25 },
    { wch: 15 },
    { wch: 20 },
    { wch: 28 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 },
    { wch: 18 },
    { wch: 30 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

export function generateErrorLogBuffer(
  details: Array<{
    index: number;
    displayName?: string | null;
    status: "created" | "duplicate" | "error";
    message?: string;
  }>
): ArrayBuffer {
  const headers = ["Fila", "Nombre", "Estado", "Motivo"];
  const rows = details.map((d) => [
    d.index,
    d.displayName || "—",
    d.status === "created" ? "Creado" : d.status === "duplicate" ? "Duplicado" : "Error",
    d.message || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Errores");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}
