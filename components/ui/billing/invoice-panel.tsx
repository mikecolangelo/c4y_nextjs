"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Calendar,
  Banknote,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  Loader2,
  Search,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Badge } from "@/components_shadcn/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components_shadcn/ui/table";
import { Alert, AlertDescription } from "@/components_shadcn/ui/alert";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Can } from "@/components/auth/can";

export interface Invoice {
  id: number;
  documentId: string;
  invoiceNumber: string;
  amount: number;
  penaltyAmount: number;
  totalAmount: number;
  dueDate: string;
  billingDate: string;
  paymentDate?: string;
  status: "pending" | "overdue" | "paid" | "cancelled";
  paymentMethod?: string;
  quotaNumber?: number;
  notes?: string;
  financing?: {
    financingNumber: string;
  };
  client?: {
    displayName: string;
    email: string;
  };
}

interface InvoicePanelProps {
  financingId?: string;
  clientId?: string;
  showFilters?: boolean;
}

const STATUS_CONFIG = {
  pending: {
    label: "Pendiente",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    icon: Clock,
  },
  overdue: {
    label: "Vencida",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: AlertCircle,
  },
  paid: {
    label: "Pagada",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelada",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    icon: XCircle,
  },
};

export function InvoicePanel({ financingId, clientId, showFilters = true }: InvoicePanelProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financingId, clientId, statusFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (financingId) params.append("financingId", financingId);
      if (clientId) params.append("clientId", clientId);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/invoices?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Error cargando facturas");
      }

      const data = await response.json();
      setInvoices(data.data || []);
    } catch (err) {
      console.error("Error cargando facturas:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handlePayInvoice = async (invoice: Invoice) => {
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentDate: new Date().toISOString().split("T")[0],
          paymentMethod: "cash",
        }),
      });

      if (!response.ok) {
        throw new Error("Error pagando factura");
      }

      // Recargar facturas
      fetchInvoices();
    } catch (err) {
      console.error("Error pagando factura:", err);
      alert("Error al procesar el pago");
    }
  };

  // Filtrar por búsqueda
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(query) ||
      inv.client?.displayName?.toLowerCase().includes(query) ||
      inv.financing?.financingNumber?.toLowerCase().includes(query)
    );
  });

  // Calcular totales
  const totals = invoices.reduce(
    (acc, inv) => {
      if (inv.status === "pending") acc.pending += inv.totalAmount;
      if (inv.status === "overdue") acc.overdue += inv.totalAmount;
      if (inv.status === "paid") acc.paid += inv.totalAmount;
      return acc;
    },
    { pending: 0, overdue: 0, paid: 0 }
  );

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-sm text-muted-foreground">Pendiente</p>
          <p className="text-xl font-semibold text-yellow-700 dark:text-yellow-400">
            ${totals.pending.toFixed(2)}
          </p>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-muted-foreground">Vencido</p>
          <p className="text-xl font-semibold text-red-700 dark:text-red-400">
            ${totals.overdue.toFixed(2)}
          </p>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-sm text-muted-foreground">Pagado</p>
          <p className="text-xl font-semibold text-green-700 dark:text-green-400">
            ${totals.paid.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, cliente o financiamiento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="overdue">Vencidas</SelectItem>
              <SelectItem value="paid">Pagadas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tabla */}
      {filteredInvoices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No se encontraron facturas</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => {
                const statusConfig = STATUS_CONFIG[invoice.status];
                const StatusIcon = statusConfig.icon;

                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                      {invoice.quotaNumber && (
                        <span className="text-xs text-muted-foreground block">
                          Cuota {invoice.quotaNumber}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{invoice.client?.displayName || "N/A"}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="font-medium">${invoice.totalAmount.toFixed(2)}</span>
                        {invoice.penaltyAmount > 0 && (
                          <span className="text-xs text-red-500 block">
                            +${invoice.penaltyAmount.toFixed(2)} penalidad
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(invoice.dueDate), "dd/MM/yyyy", { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("gap-1", statusConfig.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.status === "pending" && (
                        <Can module="billing" action="canUpdate">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePayInvoice(invoice)}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Pagar
                          </Button>
                        </Can>
                      )}
                      {invoice.status === "overdue" && (
                        <Can module="billing" action="canUpdate">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handlePayInvoice(invoice)}
                          >
                            <Banknote className="h-4 w-4 mr-1" />
                            Pagar + Penalidad
                          </Button>
                        </Can>
                      )}
                      {invoice.status === "paid" && invoice.paymentDate && (
                        <span className="text-sm text-muted-foreground">
                          Pagado el{" "}
                          {format(new Date(invoice.paymentDate), "dd/MM/yyyy", { locale: es })}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default InvoicePanel;
