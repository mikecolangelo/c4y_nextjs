import * as XLSX from "xlsx";

export interface WeeklyCollectionRaw {
  weekNumber?: number | null;
  receiptDate?: string | null;
  receiptNumber?: string | null;
  paymentDate?: string | null;
  confirmationNumber?: string | null;
  weeklyQuota?: number | null;
  initialDeposit?: number | null;
  lateFee?: number | null;
  amountPaid?: number | null;
  remainingBalance?: number | null;
  verifiedInBank?: boolean;
  clientIdentification?: string | null;
  clientName?: string | null;
  _rowIndex?: number;
  _errors?: string[];
}

const HEADER_MAP: Record<string, keyof WeeklyCollectionRaw> = {
  semana: "weekNumber",
  "no.": "weekNumber",
  no: "weekNumber",
  week: "weekNumber",
  "fecha de recibo": "receiptDate",
  "fecha recibo": "receiptDate",
  "recibo date": "receiptDate",
  receiptdate: "receiptDate",
  "# recibo": "receiptNumber",
  "nro recibo": "receiptNumber",
  "num recibo": "receiptNumber",
  "numero recibo": "receiptNumber",
  recibo: "receiptNumber",
  receiptnumber: "receiptNumber",
  "# de recibo": "receiptNumber",
  "fecha de pago": "paymentDate",
  "fecha pago": "paymentDate",
  paymentdate: "paymentDate",
  "# de confirmacion": "confirmationNumber",
  "# confirmacion": "confirmationNumber",
  confirmacion: "confirmationNumber",
  confirmation: "confirmationNumber",
  confirmationnumber: "confirmationNumber",
  "letra $225.00 semanal": "weeklyQuota",
  "letra semanal": "weeklyQuota",
  cuota: "weeklyQuota",
  "cuota semanal": "weeklyQuota",
  weeklyquota: "weeklyQuota",
  quota: "weeklyQuota",
  "arreglos de deposito inicial": "initialDeposit",
  "deposito inicial": "initialDeposit",
  deposito: "initialDeposit",
  initialdeposit: "initialDeposit",
  "multa por atraso": "lateFee",
  multa: "lateFee",
  latefee: "lateFee",
  penalty: "lateFee",
  pagos: "amountPaid",
  pago: "amountPaid",
  "pago realizado": "amountPaid",
  amountpaid: "amountPaid",
  payment: "amountPaid",
  saldo: "remainingBalance",
  "saldo restante": "remainingBalance",
  remainingbalance: "remainingBalance",
  balance: "remainingBalance",
  "verificado en banco": "verifiedInBank",
  verificado: "verifiedInBank",
  verifiedinbank: "verifiedInBank",
  bankverified: "verifiedInBank",
  cedula: "clientIdentification",
  "id cliente": "clientIdentification",
  "id client": "clientIdentification",
  cliente: "clientName",
  nombre: "clientName",
  "nombre cliente": "clientName",
  clientname: "clientName",
};

function normalizeHeader(header: string): string {
  return header
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function mapHeader(header: string): keyof WeeklyCollectionRaw | null {
  const norm = normalizeHeader(header);
  return HEADER_MAP[norm] || null;
}

function parseDate(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString().split("T")[0];
  }
  if (typeof value === "number") {
    // Excel serial date
    if (value > 30000 && value < 50000) {
      const epoch = new Date(1899, 11, 30);
      const d = new Date(epoch.getTime() + value * 24 * 60 * 60 * 1000);
      return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
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
  if (y < 100) y += 2000;
  if (m > 12 && d <= 12) {
    const tmp = d; d = m; m = tmp;
  }
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime()) || date.getDate() !== d || date.getMonth() !== m - 1) return null;
  return date.toISOString().split("T")[0];
}

function parseDecimal(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : Number(value.toFixed(2));
  const cleaned = String(value).replace(/[$,\s]/g, "").replace(/%/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : Number(parsed.toFixed(2));
}

function parseBoolean(value: any): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const str = String(value).trim().toLowerCase();
  return ["si", "sí", "yes", "true", "verificado", "1", "ok", "x"].includes(str);
}

const HEADER_SIGNATURES = ["# recibo", "nro recibo", "num recibo", "numero recibo", "recibo", "receiptnumber", "# de recibo", "semana", "no.", "fecha de pago", "fecha pago", "pagos", "saldo", "verificado en banco"];

function findHeaderRow(json: any[][]): { rowIndex: number; headers: string[] } {
  for (let i = 0; i < Math.min(json.length, 25); i++) {
    const row = json[i];
    if (!row || row.length === 0) continue;
    const normalized = row.map((h: any) => normalizeHeader(String(h)));
    const matches = normalized.filter((h: string) => HEADER_SIGNATURES.includes(h)).length;
    if (matches >= 3) {
      return { rowIndex: i, headers: row.map((h: any) => String(h).trim()) };
    }
  }
  // Fallback: primera fila no vacia
  for (let i = 0; i < json.length; i++) {
    if (json[i] && json[i].some((cell: any) => cell !== "" && cell !== null && cell !== undefined)) {
      return { rowIndex: i, headers: json[i].map((h: any) => String(h).trim()) };
    }
  }
  return { rowIndex: 0, headers: [] };
}

function isDepositRow(row: any[]): boolean {
  if (!row || row.length === 0) return false;
  const firstCell = String(row[0] ?? "").toLowerCase().trim();
  const hasDepositLabel = row.some((cell: any) => {
    const s = String(cell ?? "").toLowerCase().trim();
    return s === "deposito" || s.includes("deposito");
  });
  return hasDepositLabel && (firstCell === "" || firstCell === "deposito");
}

export function parseWeeklyCollectionFile(
  arrayBuffer: ArrayBuffer,
  fileName: string
): { headers: string[]; mappedHeaders: (keyof WeeklyCollectionRaw | null)[]; rows: WeeklyCollectionRaw[] } {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];

  if (json.length === 0) {
    throw new Error("El archivo esta vacio o no contiene datos");
  }

  const { rowIndex: headerRowIndex, headers } = findHeaderRow(json);
  const mappedHeaders = headers.map(mapHeader);

  const rows: WeeklyCollectionRaw[] = [];
  for (let i = headerRowIndex + 1; i < json.length; i++) {
    const rawRow = json[i];
    if (rawRow.every((cell) => cell === "" || cell === null || cell === undefined)) continue;

    // Saltar fila de deposito inicial (fondo amarillo en plantilla)
    if (isDepositRow(rawRow)) continue;

    const row: WeeklyCollectionRaw = { _rowIndex: i + 1, _errors: [] };
    for (let j = 0; j < headers.length; j++) {
      const mapped = mappedHeaders[j];
      if (!mapped) continue;
      const value = rawRow[j];

      switch (mapped) {
        case "weekNumber":
          row.weekNumber = parseInt(String(value), 10) || null;
          break;
        case "receiptDate":
        case "paymentDate":
          (row as any)[mapped] = parseDate(value);
          break;
        case "weeklyQuota":
        case "initialDeposit":
        case "lateFee":
        case "amountPaid":
        case "remainingBalance":
          (row as any)[mapped] = parseDecimal(value);
          break;
        case "verifiedInBank":
          row.verifiedInBank = parseBoolean(value);
          break;
        default:
          (row as any)[mapped] = value ? String(value).trim() : null;
      }
    }
    rows.push(row);
  }

  return { headers, mappedHeaders, rows };
}

export const REQUIRED_HEADERS: (keyof WeeklyCollectionRaw)[] = [
  "receiptNumber",
];

export function validateHeaders(
  mappedHeaders: (keyof WeeklyCollectionRaw | null)[]
): { valid: boolean; missing: (keyof WeeklyCollectionRaw)[]; detected: string[] } {
  const detected = mappedHeaders.filter(Boolean) as (keyof WeeklyCollectionRaw)[];
  const missing = REQUIRED_HEADERS.filter((h) => !detected.includes(h));
  return { valid: missing.length === 0, missing, detected };
}

export function validateRow(row: WeeklyCollectionRaw): string[] {
  const errors: string[] = [];
  if (!row.receiptNumber || row.receiptNumber.trim() === "") {
    errors.push("Numero de recibo es obligatorio");
  }
  if (row.receiptDate && !parseDate(row.receiptDate)) {
    errors.push("Fecha de recibo tiene formato invalido");
  }
  if (row.paymentDate && !parseDate(row.paymentDate)) {
    errors.push("Fecha de pago tiene formato invalido");
  }
  if (row.weeklyQuota !== null && row.weeklyQuota !== undefined && isNaN(row.weeklyQuota)) {
    errors.push("Cuota semanal no es un numero valido");
  }
  if (row.amountPaid !== null && row.amountPaid !== undefined && isNaN(row.amountPaid)) {
    errors.push("Pago realizado no es un numero valido");
  }
  if (row.remainingBalance !== null && row.remainingBalance !== undefined && isNaN(row.remainingBalance)) {
    errors.push("Saldo no es un numero valido");
  }
  return errors;
}

export function generateTemplateBuffer(): ArrayBuffer {
  const headers = [
    "No. / SEMANA",
    "FECHA DE RECIBO",
    "# RECIBO",
    "FECHA DE PAGO",
    "# DE CONFIRMACION",
    "LETRA $225.00 SEMANAL",
    "ARREGLOS DE DEPOSITO INICIAL",
    "MULTA POR ATRASO",
    "PAGOS",
    "SALDO",
    "VERIFICADO EN BANCO",
    "CEDULA",
    "NOMBRE CLIENTE",
  ];
  const sample = [
    [1, "01/01/2026", "REC-001", "02/01/2026", "CONF-123", 225.0, 0, 0, 225.0, 5000.0, "Si", "8-123-4567", "Juan Perez"],
    [2, "08/01/2026", "REC-002", "09/01/2026", "CONF-124", 225.0, 0, 15.0, 240.0, 4760.0, "Si", "8-123-4567", "Juan Perez"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

export function generateErrorLogBuffer(details: Array<{ index: number; receiptNumber: string | null; status: string; message?: string }>): ArrayBuffer {
  const headers = ["Fila", "Recibo", "Estado", "Mensaje"];
  const rows = details
    .filter((d) => d.status === "error" || d.status === "duplicate")
    .map((d) => [d.index, d.receiptNumber || "", d.status, d.message || ""]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Errores");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}
