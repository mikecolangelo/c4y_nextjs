"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components_shadcn/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import type { PaymentRecord, PaymentStatusFilter } from "./payment-timeline";
import { PaymentHistoryPDF } from "./payment-history-pdf";

interface PaymentExportProps {
  payments: PaymentRecord[];
  selectedStatuses: PaymentStatusFilter[];
  financingNumber?: string;
  financingId?: string;
  clientName?: string;
  vehicleName?: string;
  totalAmount?: number;
  currentBalance?: number;
  containerRef?: React.RefObject<HTMLElement | null>;
}

// Helper para formatear moneda
const formatCurrency = (amount: number, currency: string = "PAB") => {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

// Helper para formatear fecha
const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: es });
  } catch {
    return dateString;
  }
};

// Helper para obtener label de estado
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

export function PaymentExport({
  payments,
  selectedStatuses,
  financingNumber,
  financingId,
  clientName,
  vehicleName,
  totalAmount,
  currentBalance,
  containerRef,
}: PaymentExportProps) {
  // Exportar a Excel
  const exportToExcel = useCallback(() => {
    if (payments.length === 0) {
      toast.error("No hay pagos para exportar");
      return;
    }

    // Obtener datos del cliente y vehículo del primer pago (todos son del mismo financiamiento)
    const firstPayment = payments[0];
    const clientInfo = firstPayment?.clientName || clientName || "—";
    const vehicleInfo = firstPayment?.vehicleName || vehicleName || "—";
    const vehiclePlate = firstPayment?.vehiclePlate || "—";
    const clientPhone = firstPayment?.clientPhone || "—";

    // Preparar datos para Excel
    const data = payments.map((payment, index) => ({
      "#": index + 1,
      "Número de Recibo": payment.invoiceNumber,
      "Cuota": payment.quotaNumber || "—",
      "Estado": getStatusLabel(payment.status),
      "Fecha Vencimiento": formatDate(payment.dueDate),
      "Fecha de Pago": formatDate(payment.paymentDate),
      "Monto": payment.amount,
      "Multa": payment.lateFeeAmount && payment.lateFeeAmount > 0 ? payment.lateFeeAmount : 0,
      "Total": payment.amount + (payment.lateFeeAmount || 0),
      "Moneda": payment.currency || "PAB",
      "Días de Retraso": payment.daysLate || 0,
      "Cliente": payment.clientName || clientName || "—",
      "Vehículo": payment.vehicleName || vehicleName || "—",
      "Placa": payment.vehiclePlate || "—",
    }));

    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Ajustar anchos de columna
    const colWidths = [
      { wch: 4 },   // #
      { wch: 20 },  // Recibo
      { wch: 10 },  // Cuota
      { wch: 12 },  // Estado
      { wch: 15 },  // Vencimiento
      { wch: 15 },  // Fecha pago
      { wch: 12 },  // Monto
      { wch: 12 },  // Multa
      { wch: 12 },  // Total
      { wch: 8 },   // Moneda
      { wch: 12 },  // Días retraso
      { wch: 25 },  // Cliente
      { wch: 25 },  // Vehículo
      { wch: 12 },  // Placa
    ];
    ws["!cols"] = colWidths;

    // Añadir worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");

    // Generar nombre de archivo
    const timestamp = format(new Date(), "yyyyMMdd-HHmm");
    const prefix = financingNumber ? `pagos-${financingNumber}` : "pagos";
    const filename = `${prefix}-${timestamp}.xlsx`;

    // Descargar
    XLSX.writeFile(wb, filename);
  }, [payments, financingNumber, clientName, vehicleName]);

  // Exportar a CSV (alternativa ligera)
  const exportToCSV = useCallback(() => {
    if (payments.length === 0) {
      toast.error("No hay pagos para exportar");
      return;
    }

    // Headers
    const headers = [
      "#",
      "Número de Recibo",
      "Cuota",
      "Estado",
      "Fecha Vencimiento",
      "Fecha de Pago",
      "Monto",
      "Multa",
      "Total",
      "Moneda",
      "Días de Retraso",
      "Cliente",
      "Vehículo",
      "Placa",
    ];

    // Rows
    const rows = payments.map((payment, index) => [
      index + 1,
      payment.invoiceNumber,
      payment.quotaNumber || "—",
      getStatusLabel(payment.status),
      formatDate(payment.dueDate),
      formatDate(payment.paymentDate),
      payment.amount,
      payment.lateFeeAmount || 0,
      payment.amount + (payment.lateFeeAmount || 0),
      payment.currency || "PAB",
      payment.daysLate || 0,
      payment.clientName || clientName || "—",
      payment.vehicleName || vehicleName || "—",
      payment.vehiclePlate || "—",
    ]);

    // Crear contenido CSV
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            // Escapar comillas y envolver en comillas si es necesario
            const cellStr = String(cell);
            if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(",")
      )
      .join("\n");

    // Crear blob y descargar
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const timestamp = format(new Date(), "yyyyMMdd-HHmm");
    const prefix = financingNumber ? `pagos-${financingNumber}` : "pagos";
    link.href = URL.createObjectURL(blob);
    link.download = `${prefix}-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [payments, financingNumber, clientName, vehicleName]);

  // Capturar screenshot con fix para colores oklch/lab (mantenido pero no usado)
  const captureScreenshot = useCallback(async () => {
    const element = containerRef?.current;
    if (!element) {
      toast.error("No se encontró el elemento para capturar");
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        // Fix: eliminar todos los stylesheets y inyectar CSS limpio con hex/rgb
        onclone: (clonedDoc) => {
          // Eliminar todos los stylesheets y styles existentes (que pueden tener oklch/lab)
          clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => el.remove());
          
          // Limpiar estilos inline de TODOS los elementos (previene oklch/lab en atributos style)
          clonedDoc.querySelectorAll('*').forEach((el) => {
            const style = (el as HTMLElement).getAttribute('style');
            if (style && (style.includes('oklch') || style.includes('lab') || style.includes('color('))) {
              (el as HTMLElement).setAttribute('style', '');
            }
          });
          
          // Limpiar SVGs: eliminar atributos fill/stroke con colores problemáticos
          clonedDoc.querySelectorAll('svg, svg *').forEach((el) => {
            const svgEl = el as SVGElement;
            ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color'].forEach((attr) => {
              const val = svgEl.getAttribute(attr);
              if (val && (val.includes('oklch') || val.includes('lab') || val.includes('color('))) {
                svgEl.setAttribute(attr, 'currentColor');
              }
            });
          });
          
          // Inyectar CSS limpio con valores hex/rgb
          const style = clonedDoc.createElement("style");
          style.innerHTML = `
            * { margin: 0; padding: 0; box-sizing: border-box; }
            :root {
              --background: #ffffff;
              --foreground: #0a0a0a;
              --card: #ffffff;
              --card-foreground: #0a0a0a;
              --popover: #ffffff;
              --popover-foreground: #0a0a0a;
              --primary: #171717;
              --primary-foreground: #fafafa;
              --secondary: #f5f5f5;
              --secondary-foreground: #171717;
              --muted: #f5f5f5;
              --muted-foreground: #737373;
              --accent: #f5f5f5;
              --accent-foreground: #171717;
              --destructive: #dc2626;
              --destructive-foreground: #fafafa;
              --border: #e5e5e5;
              --input: #e5e5e5;
              --ring: #171717;
            }
            body { 
              background: #ffffff; 
              color: #0a0a0a; 
              font-family: system-ui, -apple-system, sans-serif;
            }
            [data-slot="card"] { background: #ffffff; border: 1px solid #e5e5e5; }
            [data-slot="card-content"] { background: #ffffff; }
            [class*="bg-card"] { background: #ffffff; }
            [class*="bg-muted"] { background: #f5f5f5; }
            [class*="bg-primary"] { background: #171717; color: #fafafa; }
            [class*="text-primary"] { color: #171717; }
            [class*="text-muted"] { color: #737373; }
            [class*="border-border"] { border-color: #e5e5e5; }
            [class*="bg-green-"] { background: #dcfce7; }
            [class*="text-green-"] { color: #166534; }
            [class*="bg-yellow-"] { background: #fef9c3; }
            [class*="text-yellow-"] { color: #854d0e; }
            [class*="bg-blue-"] { background: #dbeafe; }
            [class*="text-blue-"] { color: #1e40af; }
            [class*="bg-red-"] { background: #fee2e2; }
            [class*="text-red-"] { color: #991b1b; }
            [class*="bg-purple-"] { background: #f3e8ff; }
            [class*="text-purple-"] { color: #6b21a8; }
            [class*="bg-orange-"] { background: #ffedd5; }
            [class*="text-orange-"] { color: #9a3412; }
            .rounded-lg { border-radius: 8px; }
            .p-3 { padding: 12px; }
            .p-4 { padding: 16px; }
            .gap-2 { gap: 8px; }
            .gap-3 { gap: 12px; }
            .text-xs { font-size: 12px; }
            .text-sm { font-size: 14px; }
            .text-base { font-size: 16px; }
            .font-bold { font-weight: 700; }
            .text-center { text-align: center; }
            .flex { display: flex; }
            .grid { display: grid; }
            .flex-col { flex-direction: column; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            svg { fill: currentColor; }
          `;
          clonedDoc.head.appendChild(style);
        },
      });

      // Convertir a imagen y descargar
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const timestamp = format(new Date(), "yyyyMMdd-HHmm");
      const prefix = financingNumber ? `pagos-${financingNumber}` : "pagos";
      link.href = image;
      link.download = `${prefix}-${timestamp}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error capturando screenshot:", error);
      toast.error("Error al capturar la imagen");
    }
  }, [containerRef, financingNumber]);



  const hasPayments = payments.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!hasPayments}
        >
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Opciones de exportación</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          <span>Excel (.xlsx)</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          <span>CSV (Excel)</span>
        </DropdownMenuItem>
        
        {/* Reporte PDF - usa PaymentHistoryPDF */}
        <div className="px-2 py-1.5">
          <PaymentHistoryPDF
            payments={payments}
            selectedStatuses={selectedStatuses}
            financingNumber={financingNumber}
            financingId={financingId}
            clientName={clientName}
            vehicleName={vehicleName}
            totalAmount={totalAmount}
            currentBalance={currentBalance}
            className="w-full"
          />
        </div>
        

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
