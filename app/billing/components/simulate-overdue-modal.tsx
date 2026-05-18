"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components_shadcn/ui/dialog";
import { Button } from "@/components_shadcn/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components_shadcn/ui/table";
import { Badge } from "@/components_shadcn/ui/badge";
import { AlertTriangle, Calendar, Banknote, User, Car } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface OverdueInvoice {
  id: number;
  documentId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  vehicleInfo: string;
  amount: number;
  penaltyAmount: number;
  totalWithPenalty: number;
  daysOverdue: number;
  dueDate?: string;
  quotaNumber?: number;
}

interface SimulateOverdueModalProps {
  isOpen: boolean;
  onClose: () => void;
  overdueData: {
    overdueCount: number;
    totalPenaltyAmount: number;
    simulationDate: string;
    penaltyPercentage: number;
    invoices: OverdueInvoice[];
  } | null;
}

export function SimulateOverdueModal({
  isOpen,
  onClose,
  overdueData,
}: SimulateOverdueModalProps) {
  if (!overdueData || overdueData.overdueCount === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Simulación de Facturas Vencidas
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Banknote className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-lg font-medium text-green-700">
              No hay facturas vencidas
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Para la fecha simulada no se encontraron facturas pendientes de pago
            </p>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Facturas Vencidas - Simulación
          </DialogTitle>
          <DialogDescription>
            Fecha de simulación: {" "}
            {format(new Date(overdueData.simulationDate), "d 'de' MMMM, yyyy", {
              locale: es,
            })}
            <span className="ml-2 text-amber-600">
              (Penalidad: {overdueData.penaltyPercentage}%)
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-muted-foreground">Facturas Vencidas</p>
            <p className="text-2xl font-semibold text-red-700 dark:text-red-400">
              {overdueData.overdueCount}
            </p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p className="text-sm text-muted-foreground">Penalidad Total</p>
            <p className="text-2xl font-semibold text-amber-700 dark:text-amber-400">
              ${overdueData.totalPenaltyAmount.toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-muted-foreground">Total con Penalidad</p>
            <p className="text-2xl font-semibold text-blue-700 dark:text-blue-400">
              ${
                overdueData.invoices
                  .reduce((sum, inv) => sum + inv.totalWithPenalty, 0)
                  .toFixed(2)
              }
            </p>
          </div>
        </div>

        {/* Tabla */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Cuota</TableHead>
                <TableHead>Penalidad</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Días Vencido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueData.invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {invoice.invoiceNumber}
                    </div>
                    {invoice.quotaNumber && (
                      <span className="text-xs text-muted-foreground block">
                        Cuota {invoice.quotaNumber}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {invoice.clientName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      {invoice.vehicleInfo}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    ${invoice.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-red-600 font-medium">
                      +${invoice.penaltyAmount.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${invoice.totalWithPenalty.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        invoice.daysOverdue > 7 ? "destructive" : "secondary"
                      }
                    >
                      {invoice.daysOverdue} días
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-800 dark:text-amber-300">
          <strong>Nota:</strong> Esta es una simulación. Los datos mostrados no
          se han guardado en la base de datos. Las facturas permanecen en estado
          &quot;pendiente&quot; hasta que se ejecute el cron job real.
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SimulateOverdueModal;
