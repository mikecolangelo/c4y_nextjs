"use client";

import { useState } from "react";
import { Calendar, AlertTriangle, Loader2, Play, Bug } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components_shadcn/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components_shadcn/ui/alert-dialog";
import { toast } from "sonner";

interface OverdueSimulationData {
  overdueCount: number;
  totalPenaltyAmount: number;
  simulationDate: string;
  penaltyPercentage: number;
  invoices: Array<{
    id: number;
    documentId: string;
    invoiceNumber: string;
    clientName: string;
    vehicleInfo: string;
    amount: number;
    penaltyAmount: number;
    totalWithPenalty: number;
    daysOverdue: number;
  }>;
}

interface BillingSimulationButtonsProps {
  isTestModeEnabled: boolean;
  userRole?: string;
  onSimulateComplete?: () => void;
  onSimulateFridayData?: (data: OverdueSimulationData) => void;
}

export function BillingSimulationButtons({
  isTestModeEnabled,
  userRole = "",
  onSimulateComplete,
  onSimulateFridayData,
}: BillingSimulationButtonsProps) {
  const [isSimulatingTuesday, setIsSimulatingTuesday] = useState(false);
  const [isSimulatingFriday, setIsSimulatingFriday] = useState(false);

  // Debug: mostrar en consola por qué no se muestra
  if (typeof window !== "undefined") {
    console.log("[BillingSimulation] isTestModeEnabled:", isTestModeEnabled);
    console.log("[BillingSimulation] userRole:", userRole);
  }

  // Solo mostrar si es admin y modo pruebas está activo
  if (!isTestModeEnabled) {
    return (
      <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-600">
        <Bug className="h-4 w-4 inline mr-2" />
        Modo pruebas desactivado. Actívalo en Configuración &gt; Facturación.
      </div>
    );
  }

  if (userRole !== "admin") {
    return (
      <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
        <Bug className="h-4 w-4 inline mr-2" />
        Modo pruebas activo pero tu rol ({userRole || "sin rol"}) no es admin.
      </div>
    );
  }

  const handleSimulateTuesday = async () => {
    setIsSimulatingTuesday(true);
    try {
      const response = await fetch("/api/invoices/simulate-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulationDate: new Date().toISOString().split("T")[0],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error en simulación");
      }

      toast.success(`Se generaron ${data.generatedCount} facturas exitosamente. Próximo vencimiento: ${data.dueDate}`);

      onSimulateComplete?.();
    } catch (error) {
      console.error("Error simulando martes:", error);
      toast.error(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsSimulatingTuesday(false);
    }
  };

  const handleSimulateFriday = async () => {
    setIsSimulatingFriday(true);
    try {
      // POST para actualizar las facturas a overdue
      const response = await fetch("/api/invoices/simulate-overdue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulationDate: new Date().toISOString().split("T")[0],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error en simulación");
      }

      if (data.overdueCount === 0) {
        toast("No hay facturas pendientes de vencimiento para la fecha simulada");
      } else {
        toast.warning(
          `${data.overdueCount} facturas marcadas como vencidas (overdue). ` +
          `Penalidad total aplicada: $${data.totalPenaltyAmount.toFixed(2)}`
        );
      }
      
      onSimulateFridayData?.(data);
      onSimulateComplete?.(); // Recargar datos
    } catch (error) {
      console.error("Error simulando viernes:", error);
      toast.error(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsSimulatingFriday(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2">
          {/* Botón Simular Martes */}
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                    disabled={isSimulatingTuesday}
                  >
                    {isSimulatingTuesday ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                    Simular Martes
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Generar facturas para todos los financiamientos activos</p>
              </TooltipContent>
            </Tooltip>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Generar facturas de simulación?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esto generará facturas para todos los financiamientos activos como si fuera martes de facturación.
                  <br /><br />
                  <strong>Nota:</strong> Las facturas generadas se marcarán como simuladas y pueden eliminarse después.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleSimulateTuesday}>
                  <Play className="h-4 w-4 mr-2" />
                  Generar Facturas
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Botón Simular Viernes */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700"
                onClick={handleSimulateFriday}
                disabled={isSimulatingFriday}
              >
                {isSimulatingFriday ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                Simular Viernes
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ver facturas que estarían vencidas</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Indicador de modo pruebas */}
        <div className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium whitespace-nowrap">
          🧪 Modo Pruebas Activo
        </div>
      </div>
    </TooltipProvider>
  );
}

export default BillingSimulationButtons;
