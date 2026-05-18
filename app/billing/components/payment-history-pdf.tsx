"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components_shadcn/ui/button";
import { Download, Loader2, FileText } from "lucide-react";
import type { PaymentRecord, PaymentStatusFilter } from "./payment-timeline";

const ROWS_PER_PAGE = 10; // Reducido para evitar cortes en el footer

// Estilos para el PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  header: {
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: "#D4AF37",
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#1a1a1a",
  },
  meta: {
    fontSize: 10,
    color: "#666",
    marginBottom: 4,
  },
  filters: {
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
    fontSize: 9,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottomWidth: 2,
    borderBottomColor: "#ddd",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    flexDirection: "row",
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  colIndex: { width: "4%", textAlign: "center" },
  colReceipt: { width: "18%" },
  colQuota: { width: "7%", textAlign: "center" },
  colStatus: { width: "10%", textAlign: "center" },
  colDueDate: { width: "12%", textAlign: "center" },
  colPayDate: { width: "12%", textAlign: "center" },
  colAmount: { width: "12%", textAlign: "right" },
  colLateFee: { width: "12%", textAlign: "right" },
  colTotal: { width: "13%", textAlign: "right" },
  headerCell: {
    fontWeight: "bold",
    fontSize: 8,
    color: "#333",
  },
  cell: {
    fontSize: 8,
    color: "#333",
  },
  statusPagado: { color: "#16a34a" },
  statusPendiente: { color: "#ca8a04" },
  statusAdelanto: { color: "#2563eb" },
  statusRetrasado: { color: "#dc2626" },
  statusAbonado: { color: "#9333ea" },
  summary: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    fontWeight: "bold",
    fontSize: 12,
  },
  summaryContainer: {
    marginTop: 60,
    padding: 30,
    backgroundColor: "#f9f9f9",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  infoBox: {
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoColumn: {
    flex: 1,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: "#ddd",
  },
  infoColumnLast: {
    flex: 1,
    paddingHorizontal: 8,
  },
  infoLabel: {
    fontSize: 7,
    color: "#666",
    marginBottom: 2,
    fontWeight: "bold",
  },
  infoValue: {
    fontSize: 10,
    color: "#1a1a1a",
    fontWeight: "bold",
  },
  infoSub: {
    fontSize: 8,
    color: "#888",
    marginTop: 2,
  },
  footer: {
    marginTop: 20,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
  summaryPageFooter: {
    marginTop: 30,
    fontSize: 9,
    color: "#666",
    textAlign: "center",
  },
});

// Helpers
const formatCurrency = (amount: number, currency: string = "PAB") => {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: es });
  } catch {
    return dateString;
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pagado: "Pagado",
    pendiente: "Pendiente",
    adelanto: "Adelanto",
    retrasado: "Retrasado",
    abonado: "Abonado",
  };
  return labels[status] || status;
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case "pagado":
      return styles.statusPagado;
    case "pendiente":
      return styles.statusPendiente;
    case "adelanto":
      return styles.statusAdelanto;
    case "retrasado":
      return styles.statusRetrasado;
    case "abonado":
      return styles.statusAbonado;
    default:
      return {};
  }
};

// Helper: generar identificador corto para recibos SIM
const getShortIdentifier = (payment: PaymentRecord): string => {
  // Si es una cuota SIM, mostrar formato corto: SIM-YYYYMMDD-#N
  if (payment.invoiceNumber?.startsWith("SIM-")) {
    const parts = payment.invoiceNumber.split("-");
    if (parts.length >= 4) {
      // parts[0] = SIM, parts[1] = fecha, parts[2] = documentId (omitir), parts[3] = cuota
      const date = parts[1];
      const quota = parts[parts.length - 1];
      return `SIM-${date}-#${quota}`;
    }
  }
  // Para otros formatos, truncar si es muy largo
  if (payment.invoiceNumber && payment.invoiceNumber.length > 25) {
    return payment.invoiceNumber.substring(0, 22) + "...";
  }
  // Default: devolver el invoiceNumber completo o un identificador basado en cuota
  return payment.invoiceNumber || `Cuota #${payment.quotaNumber || "?"}`;
};

// Componente de tabla reutilizable
function TableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerCell, styles.colIndex]}>#</Text>
      <Text style={[styles.headerCell, styles.colReceipt]}>Recibo</Text>
      <Text style={[styles.headerCell, styles.colQuota]}>Cuota</Text>
      <Text style={[styles.headerCell, styles.colStatus]}>Estado</Text>
      <Text style={[styles.headerCell, styles.colDueDate]}>Vencimiento</Text>
      <Text style={[styles.headerCell, styles.colPayDate]}>Fecha Pago</Text>
      <Text style={[styles.headerCell, styles.colAmount]}>Monto</Text>
      <Text style={[styles.headerCell, styles.colLateFee]}>Multa</Text>
      <Text style={[styles.headerCell, styles.colTotal]}>Total</Text>
    </View>
  );
}

function TableRow({ payment, index }: { payment: PaymentRecord; index: number }) {
  return (
    <View style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
      <Text style={[styles.cell, styles.colIndex]}>{index + 1}</Text>
      <Text style={[styles.cell, styles.colReceipt]}>{getShortIdentifier(payment)}</Text>
      <Text style={[styles.cell, styles.colQuota]}>{payment.quotaNumber || "—"}</Text>
      <Text style={[styles.cell, styles.colStatus, getStatusStyle(payment.status)]}>
        {getStatusLabel(payment.status)}
      </Text>
      <Text style={[styles.cell, styles.colDueDate]}>{formatDate(payment.dueDate)}</Text>
      <Text style={[styles.cell, styles.colPayDate]}>{formatDate(payment.paymentDate)}</Text>
      <Text style={[styles.cell, styles.colAmount]}>
        {formatCurrency(payment.amount, payment.currency)}
      </Text>
      <Text style={[styles.cell, styles.colLateFee]}>
        {payment.lateFeeAmount
          ? formatCurrency(payment.lateFeeAmount, payment.currency)
          : "—"}
      </Text>
      <Text style={[styles.cell, styles.colTotal]}>
        {formatCurrency(payment.amount + (payment.lateFeeAmount || 0), payment.currency)}
      </Text>
    </View>
  );
}

// Componente del documento PDF
interface PaymentHistoryPDFDocumentProps {
  payments: PaymentRecord[];
  selectedStatuses: PaymentStatusFilter[];
  financingNumber?: string;
  financingId?: string;
  clientName?: string;
  vehicleName?: string;
  totalAmount?: number;
  currentBalance?: number;
}

function PaymentHistoryPDFDocument({
  payments,
  selectedStatuses,
  financingNumber,
  financingId,
  clientName,
  vehicleName,
  totalAmount: financingTotalAmount,
  currentBalance: financingCurrentBalance,
}: PaymentHistoryPDFDocumentProps) {
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalLateFees = payments.reduce((sum, p) => sum + (p.lateFeeAmount || 0), 0);
  const total = totalAmount + totalLateFees;
  const currentDate = format(new Date(), "dd 'de' MMMM, yyyy HH:mm", { locale: es });

  // Dividir pagos en chunks para paginación
  const chunks: PaymentRecord[][] = [];
  for (let i = 0; i < payments.length; i += ROWS_PER_PAGE) {
    chunks.push(payments.slice(i, i + ROWS_PER_PAGE));
  }

  // Páginas de datos (sin resumen)
  const dataPages = chunks;
  const totalDataPages = dataPages.length;

  return (
    <Document>
      {/* Páginas con la tabla de pagos */}
      {dataPages.map((chunk, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const pageNumber = pageIndex + 1;

        return (
          <Page key={`data-${pageIndex}`} size="A4" orientation="landscape" style={styles.page}>
            {/* Header solo en primera página */}
            {isFirstPage && (
              <View style={styles.header}>
                <Text style={styles.title}>Reporte de Historial de Pagos</Text>
                
                {/* Info Box - Cliente y Vehículo */}
                <View style={styles.infoBox}>
                  <View style={styles.infoRow}>
                    <View style={styles.infoColumn}>
                      <Text style={styles.infoLabel}>CLIENTE</Text>
                      <Text style={styles.infoValue}>{clientName || (payments[0]?.clientName) || "—"}</Text>
                      {payments[0]?.clientPhone && (
                        <Text style={styles.infoSub}>Tel: {payments[0].clientPhone}</Text>
                      )}
                    </View>
                    <View style={styles.infoColumnLast}>
                      <Text style={styles.infoLabel}>VEHÍCULO</Text>
                      <Text style={styles.infoValue}>{vehicleName || (payments[0]?.vehicleName) || "—"}</Text>
                      {payments[0]?.vehiclePlate && (
                        <Text style={styles.infoSub}>Placa: {payments[0].vehiclePlate}</Text>
                      )}
                    </View>
                  </View>
                </View>
                
                <Text style={styles.meta}>Generado el: {currentDate}</Text>
              </View>
            )}

            {/* Filtros solo en primera página */}
            {isFirstPage && selectedStatuses.length > 0 && (
              <View style={styles.filters}>
                <Text>
                  Filtros aplicados:{" "}
                  {selectedStatuses
                    .map((s) => (s === "multa" ? "Multas" : getStatusLabel(s)))
                    .join(", ")}
                </Text>
              </View>
            )}

            {/* Tabla */}
            <View style={styles.table}>
              <TableHeader />
              {chunk.map((payment, idx) => (
                <TableRow
                  key={payment.id}
                  payment={payment}
                  index={pageIndex * ROWS_PER_PAGE + idx}
                />
              ))}
            </View>

            {/* Footer con número de página */}
            <Text style={styles.footer}>
              Página {pageNumber} de {totalDataPages + 1} • Generado el {currentDate} • Car4You
            </Text>
          </Page>
        );
      })}

      {/* Página final dedicada al resumen (nunca se corta) */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 40 }}>
          <View style={styles.summaryContainer}>
            <Text style={[styles.title, { marginBottom: 25, textAlign: "center" }]}>Resumen del Reporte</Text>
            
            {/* Info del cliente y vehículo en el resumen */}
            <View style={[styles.infoBox, { marginBottom: 20 }]}>
              <View style={styles.infoRow}>
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>CLIENTE</Text>
                  <Text style={styles.infoValue}>{clientName || (payments[0]?.clientName) || "—"}</Text>
                  {payments[0]?.clientPhone && (
                    <Text style={styles.infoSub}>Tel: {payments[0].clientPhone}</Text>
                  )}
                </View>
                <View style={styles.infoColumnLast}>
                  <Text style={styles.infoLabel}>VEHÍCULO</Text>
                  <Text style={styles.infoValue}>{vehicleName || (payments[0]?.vehicleName) || "—"}</Text>
                  {payments[0]?.vehiclePlate && (
                    <Text style={styles.infoSub}>Placa: {payments[0].vehiclePlate}</Text>
                  )}
                </View>
              </View>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={{ fontSize: 11 }}>Total de pagos registrados:</Text>
              <Text style={{ fontSize: 11 }}>{payments.length}</Text>
            </View>
            
            <View style={[styles.summaryRow, { marginTop: 12 }]}>
              <Text style={{ fontSize: 11 }}>Total en pagos:</Text>
              <Text style={{ fontSize: 11 }}>{formatCurrency(totalAmount)}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={{ fontSize: 11 }}>Total en multas:</Text>
              <Text style={{ fontSize: 11 }}>{formatCurrency(totalLateFees)}</Text>
            </View>
            
            <View style={[styles.summaryTotal, { marginTop: 20, paddingTop: 15 }]}>
              <Text>TOTAL GENERAL:</Text>
              <Text>{formatCurrency(total)}</Text>
            </View>

            {selectedStatuses.length > 0 && (
              <View style={{ marginTop: 25, paddingTop: 15, borderTopWidth: 1, borderTopColor: "#ddd" }}>
                <Text style={{ fontSize: 9, color: "#666", marginBottom: 5 }}>Filtros aplicados:</Text>
                <Text style={{ fontSize: 9 }}>
                  {selectedStatuses.map((s) => (s === "multa" ? "Multas" : getStatusLabel(s))).join(", ")}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.summaryPageFooter}>
          Página {totalDataPages + 1} de {totalDataPages + 1} • Generado el {currentDate} • Car4You
        </Text>
      </Page>
    </Document>
  );
}

// Componente con botón de descarga
interface PaymentHistoryPDFProps {
  payments: PaymentRecord[];
  selectedStatuses: PaymentStatusFilter[];
  financingNumber?: string;
  financingId?: string;
  clientName?: string;
  vehicleName?: string;
  totalAmount?: number;
  currentBalance?: number;
  className?: string;
}

export function PaymentHistoryPDF({
  payments,
  selectedStatuses,
  financingNumber,
  financingId,
  clientName,
  vehicleName,
  totalAmount,
  currentBalance,
  className,
}: PaymentHistoryPDFProps) {
  if (payments.length === 0) {
    return (
      <Button variant="outline" size="sm" className={className} disabled>
        <Download className="h-4 w-4 mr-2" />
        Reporte (PDF)
      </Button>
    );
  }

  const timestamp = format(new Date(), "yyyyMMdd-HHmm");
  const prefix = financingNumber ? `reporte-pagos-${financingNumber}` : "reporte-pagos";
  const filename = `${prefix}-${timestamp}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <PaymentHistoryPDFDocument
          payments={payments}
          selectedStatuses={selectedStatuses}
          financingNumber={financingNumber}
          financingId={financingId}
          clientName={clientName}
          vehicleName={vehicleName}
          totalAmount={totalAmount}
          currentBalance={currentBalance}
        />
      }
      fileName={filename}
      className={className}
    >
      {({ loading }) => (
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 w-full justify-start px-2 h-8 font-normal text-sm hover:bg-accent"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-red-600" />
              <span>Generando PDF...</span>
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 text-red-600" />
              <span>Reporte (PDF)</span>
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
