"use client";

import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Image,
  PDFDownloadLink,
  Font
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components_shadcn/ui/button";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Interfaces
export interface CompanyInfo {
  name: string;
  legalRepName?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

export interface ClientInfo {
  fullName: string;
  identificationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface VehicleInfo {
  name: string;
  brand?: string;
  year?: number;
  placa?: string;
  vin?: string;
  color?: string;
}

export interface InvoiceData {
  invoiceNumber?: string;
  receiptNumber?: string; // Nuevo campo para el modelo v2
  date: string;
  dueDate?: string;
  paymentDate?: string;
  status: "pagado" | "pendiente" | "adelanto" | "retrasado" | "abonado";
  quotaNumber?: number;
  totalQuotas?: number;
  amount: number;
  weeklyQuotaAmount?: number;
  lateFeeAmount?: number;
  advancePayment?: number;
  remainingBalance?: number;
  currency?: string;
  notes?: string;
}

interface InvoicePDFProps {
  company: CompanyInfo;
  client: ClientInfo;
  vehicle?: VehicleInfo;
  invoice: InvoiceData;
}

// Estilos para el PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#D4AF37",
    paddingBottom: 20,
  },
  logo: {
    width: 120,
    height: 60,
    objectFit: "contain",
  },
  logoPlaceholder: {
    width: 120,
    height: 60,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  companyInfo: {
    textAlign: "right",
  },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  companyDetail: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 2,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#D4AF37",
    textAlign: "center",
    marginBottom: 20,
  },
  invoiceInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  invoiceInfoBox: {
    backgroundColor: "#F8F8F8",
    padding: 10,
    borderRadius: 4,
    width: "48%",
  },
  infoLabel: {
    fontSize: 8,
    color: "#888888",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 11,
    color: "#1a1a1a",
    fontWeight: "bold",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: "40%",
    fontSize: 9,
    color: "#666666",
  },
  value: {
    width: "60%",
    fontSize: 9,
    color: "#1a1a1a",
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#D4AF37",
    padding: 8,
    borderRadius: 4,
  },
  tableHeaderText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  tableCell: {
    fontSize: 9,
    color: "#1a1a1a",
  },
  col1: { width: "40%" },
  col2: { width: "15%", textAlign: "center" },
  colUnitPrice: { width: "20%", textAlign: "right" },
  col3: { width: "25%", textAlign: "right" },
  totalsSection: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: "#D4AF37",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 10,
    color: "#666666",
    marginRight: 20,
  },
  totalValue: {
    fontSize: 10,
    color: "#1a1a1a",
    width: 100,
    textAlign: "right",
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginRight: 20,
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#D4AF37",
    width: 100,
    textAlign: "right",
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusPagado: {
    backgroundColor: "#DCFCE7",
  },
  statusPendiente: {
    backgroundColor: "#FEF9C3",
  },
  statusAdelanto: {
    backgroundColor: "#DBEAFE",
  },
  statusRetrasado: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  statusTextPagado: {
    color: "#166534",
  },
  statusTextPendiente: {
    color: "#854D0E",
  },
  statusTextAdelanto: {
    color: "#1E40AF",
  },
  statusTextRetrasado: {
    color: "#991B1B",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#888888",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingTop: 10,
  },
  notes: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#D4AF37",
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#92400E",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8,
    color: "#78350F",
  },
});

// Componente del documento PDF
const InvoiceDocument = ({ company, client, vehicle, invoice }: InvoicePDFProps) => {
  // Soportar tanto invoiceNumber (v1) como receiptNumber (v2)
  const invoiceNumber = invoice.receiptNumber || invoice.invoiceNumber || "SIN_NUMERO";

  const formatCurrency = (value: number, currency = "PAB"): string => {
    return new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const getStatusStyle = () => {
    switch (invoice.status) {
      case "pagado":
        return { badge: styles.statusPagado, text: styles.statusTextPagado };
      case "pendiente":
        return { badge: styles.statusPendiente, text: styles.statusTextPendiente };
      case "adelanto":
        return { badge: styles.statusAdelanto, text: styles.statusTextAdelanto };
      case "retrasado":
        return { badge: styles.statusRetrasado, text: styles.statusTextRetrasado };
      default:
        return { badge: styles.statusPendiente, text: styles.statusTextPendiente };
    }
  };

  const statusStyle = getStatusStyle();
  const totalAmount = invoice.amount + (invoice.lateFeeAmount || 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            {company.logoUrl ? (
              <Image src={company.logoUrl} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={{ fontSize: 10, color: "#888" }}>{company.name}</Text>
              </View>
            )}
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.address && <Text style={styles.companyDetail}>{company.address}</Text>}
            {company.phone && <Text style={styles.companyDetail}>Tel: {company.phone}</Text>}
            {company.email && <Text style={styles.companyDetail}>{company.email}</Text>}
          </View>
        </View>

        {/* Invoice Title */}
        <Text style={styles.invoiceTitle}>RECIBO DE PAGO</Text>

        {/* Invoice Info */}
        <View style={styles.invoiceInfo}>
          <View style={styles.invoiceInfoBox}>
            <Text style={styles.infoLabel}>Número de Recibo</Text>
            <Text style={styles.infoValue}>{invoiceNumber}</Text>
            <Text style={[styles.infoLabel, { marginTop: 8 }]}>Fecha de Emisión</Text>
            <Text style={styles.infoValue}>{formatDate(invoice.date)}</Text>
            {invoice.dueDate && (
              <Text style={[styles.infoLabel, { marginTop: 8 }]}>Fecha de Vencimiento</Text>
            )}
            {invoice.dueDate && (
              <Text style={styles.infoValue}>{formatDate(invoice.dueDate)}</Text>
            )}
          </View>
          <View style={styles.invoiceInfoBox}>
            <Text style={styles.infoLabel}>Estado</Text>
            <View style={[styles.statusBadge, statusStyle.badge]}>
              <Text style={[styles.statusText, statusStyle.text]}>
                {invoice.status.toUpperCase()}
              </Text>
            </View>
            {invoice.quotaNumber && invoice.totalQuotas && (
              <Text style={[styles.infoLabel, { marginTop: 8 }]}>Cuota</Text>
            )}
            {invoice.quotaNumber && invoice.totalQuotas && (
              <Text style={styles.infoValue}>
                {invoice.quotaNumber} de {invoice.totalQuotas}
              </Text>
            )}
            {invoice.paymentDate && (
              <Text style={[styles.infoLabel, { marginTop: 8 }]}>Fecha de Pago</Text>
            )}
            {invoice.paymentDate && (
              <Text style={styles.infoValue}>{formatDate(invoice.paymentDate)}</Text>
            )}
          </View>
        </View>

        {/* Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Cliente</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nombre Completo:</Text>
            <Text style={styles.value}>{client.fullName}</Text>
          </View>
          {client.identificationNumber && (
            <View style={styles.row}>
              <Text style={styles.label}>Cédula:</Text>
              <Text style={styles.value}>{client.identificationNumber}</Text>
            </View>
          )}
          {client.phone && (
            <View style={styles.row}>
              <Text style={styles.label}>Teléfono:</Text>
              <Text style={styles.value}>{client.phone}</Text>
            </View>
          )}
          {client.email && (
            <View style={styles.row}>
              <Text style={styles.label}>Correo Electrónico:</Text>
              <Text style={styles.value}>{client.email}</Text>
            </View>
          )}
          {client.address && (
            <View style={styles.row}>
              <Text style={styles.label}>Dirección:</Text>
              <Text style={styles.value}>{client.address}</Text>
            </View>
          )}
        </View>

        {/* Vehicle Info */}
        {vehicle && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Datos del Vehículo</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Vehículo:</Text>
              <Text style={styles.value}>{vehicle.name}</Text>
            </View>
            {vehicle.brand && (
              <View style={styles.row}>
                <Text style={styles.label}>Marca:</Text>
                <Text style={styles.value}>{vehicle.brand}</Text>
              </View>
            )}
            {vehicle.year && (
              <View style={styles.row}>
                <Text style={styles.label}>Año:</Text>
                <Text style={styles.value}>{vehicle.year}</Text>
              </View>
            )}
            {vehicle.placa && (
              <View style={styles.row}>
                <Text style={styles.label}>Placa:</Text>
                <Text style={styles.value}>{vehicle.placa}</Text>
              </View>
            )}
            {vehicle.vin && (
              <View style={styles.row}>
                <Text style={styles.label}>VIN:</Text>
                <Text style={styles.value}>{vehicle.vin}</Text>
              </View>
            )}
            {vehicle.color && (
              <View style={styles.row}>
                <Text style={styles.label}>Color:</Text>
                <Text style={styles.value}>{vehicle.color}</Text>
              </View>
            )}
          </View>
        )}

        {/* Payment Details Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalle del Pago</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.col1]}>Concepto</Text>
              <Text style={[styles.tableHeaderText, styles.col2]}>Cantidad</Text>
              <Text style={[styles.tableHeaderText, styles.colUnitPrice]}>Precio Unit.</Text>
              <Text style={[styles.tableHeaderText, styles.col3]}>Total</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.col1]}>
                Cuota Semanal {invoice.quotaNumber ? `#${invoice.quotaNumber}` : ""}
              </Text>
              <Text style={[styles.tableCell, styles.col2]}>1</Text>
              <Text style={[styles.tableCell, styles.colUnitPrice]}>
                {formatCurrency(invoice.weeklyQuotaAmount || invoice.amount, invoice.currency)}
              </Text>
              <Text style={[styles.tableCell, styles.col3]}>
                {formatCurrency(invoice.weeklyQuotaAmount || invoice.amount, invoice.currency)}
              </Text>
            </View>
            {invoice.advancePayment && invoice.advancePayment > 0 && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.col1]}>Adelanto / Abono</Text>
                <Text style={[styles.tableCell, styles.col2]}>1</Text>
                <Text style={[styles.tableCell, styles.colUnitPrice, { color: "#166534" }]}>
                  -{formatCurrency(invoice.advancePayment, invoice.currency)}
                </Text>
                <Text style={[styles.tableCell, styles.col3, { color: "#166534" }]}>
                  -{formatCurrency(invoice.advancePayment, invoice.currency)}
                </Text>
              </View>
            )}
            {invoice.lateFeeAmount && invoice.lateFeeAmount > 0 && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.col1, { color: "#991B1B" }]}>
                  Multa por Retraso (10% diario)
                </Text>
                <Text style={[styles.tableCell, styles.col2]}>1</Text>
                <Text style={[styles.tableCell, styles.colUnitPrice, { color: "#991B1B" }]}>
                  +{formatCurrency(invoice.lateFeeAmount, invoice.currency)}
                </Text>
                <Text style={[styles.tableCell, styles.col3, { color: "#991B1B" }]}>
                  +{formatCurrency(invoice.lateFeeAmount, invoice.currency)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(invoice.weeklyQuotaAmount || invoice.amount, invoice.currency)}
            </Text>
          </View>
          {invoice.advancePayment && invoice.advancePayment > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Adelanto:</Text>
              <Text style={[styles.totalValue, { color: "#166534" }]}>
                -{formatCurrency(invoice.advancePayment, invoice.currency)}
              </Text>
            </View>
          )}
          {invoice.lateFeeAmount && invoice.lateFeeAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Multa:</Text>
              <Text style={[styles.totalValue, { color: "#991B1B" }]}>
                +{formatCurrency(invoice.lateFeeAmount, invoice.currency)}
              </Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>TOTAL A PAGAR:</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(totalAmount - (invoice.advancePayment || 0), invoice.currency)}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Notas:</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Este documento es un comprobante de pago generado por {company.name}</Text>
          <Text>Generado el {format(new Date(), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}</Text>
        </View>
      </Page>
    </Document>
  );
};

// Componente de botón para descargar PDF
interface InvoicePDFDownloadProps extends InvoicePDFProps {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function InvoicePDFDownload({
  company,
  client,
  vehicle,
  invoice,
  className,
  variant = "default",
  size = "default",
}: InvoicePDFDownloadProps) {
  // Soportar tanto invoiceNumber (v1) como receiptNumber (v2)
  const invoiceNumber = invoice.receiptNumber || invoice.invoiceNumber || "SIN_NUMERO";
  const fileName = `Recibo_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <InvoiceDocument
          company={company}
          client={client}
          vehicle={vehicle}
          invoice={invoice}
        />
      }
      fileName={fileName}
    >
      {({ loading }) => (
        <Button
          variant={variant}
          size={size}
          className={cn("gap-2", className)}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Descargar PDF
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
}

// Export del componente de documento para uso directo si es necesario
export { InvoiceDocument };
