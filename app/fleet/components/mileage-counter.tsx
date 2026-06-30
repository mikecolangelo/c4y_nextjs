"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import {
  Gauge,
  AlertTriangle,
  Loader2,
  RotateCcw,
  History,
  User,
  Wrench,
  ClipboardList,
  Trash2,
} from "lucide-react";
import { MaintenanceOrderDialog } from "./maintenance-order-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { computeNewMileage, pickHistoryHighlightKey } from "./mileage-utils";
import type { FleetMileageHistoryItem } from "@/validations/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components_shadcn/ui/dialog";

interface MileageCounterProps {
  vehicleId: string;
  vehicleName: string;
  currentMileage?: number;
  lastOilChangeMileage?: number;
  oilChangeInterval?: number;
  oilChangeNotificationSent?: boolean;
  onMileageUpdated?: () => void;
  variant?: "compact" | "full";
}

export function MileageCounter({
  vehicleId,
  vehicleName,
  currentMileage = 0,
  lastOilChangeMileage = 0,
  oilChangeInterval = 5000,
  oilChangeNotificationSent = false,
  onMileageUpdated,
  variant = "full",
}: MileageCounterProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [localMileage, setLocalMileage] = useState(currentMileage);
  const [localLastOilChange, setLocalLastOilChange] = useState(lastOilChangeMileage);
  const [localInterval, setLocalInterval] = useState(oilChangeInterval);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    setLocalMileage(currentMileage);
    setLocalLastOilChange(lastOilChangeMileage);
    setLocalInterval(oilChangeInterval);
  }, [currentMileage, lastOilChangeMileage, oilChangeInterval, vehicleId]);

  const distanceSinceLastOilChange = localMileage - localLastOilChange;
  const warningThreshold = Math.floor(localInterval * 0.9);
  const remainingKm = Math.max(0, localInterval - distanceSinceLastOilChange);
  const progressPercent = Math.min(100, (distanceSinceLastOilChange / localInterval) * 100);

  const isWarning =
    distanceSinceLastOilChange >= warningThreshold && distanceSinceLastOilChange < localInterval;
  const isDanger = distanceSinceLastOilChange >= localInterval;

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [showMileageDialog, setShowMileageDialog] = useState(false);
  const [newMileage, setNewMileage] = useState("");
  // "set" = establecer el kilometraje total final; "add" = sumar X km al actual
  const [updateMode, setUpdateMode] = useState<"set" | "add">("set");

  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [history, setHistory] = useState<FleetMileageHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // Kilometraje a resaltar al abrir el historial desde un estado del vehículo
  const [highlightMileage, setHighlightMileage] = useState<number | null>(null);
  const highlightRowRef = useRef<HTMLDivElement | null>(null);

  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/fleet/${vehicleId}/mileage`);
      if (!response.ok) throw new Error("Error cargando historial");
      const result = await response.json();
      setHistory(result.data || []);
    } catch (error) {
      console.error("Error cargando historial de kilometraje:", error);
      toast.error("No se pudo cargar el historial de kilometraje");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [vehicleId]);

  const handleOpenHistoryDialog = useCallback(() => {
    setHighlightMileage(null);
    setShowHistoryDialog(true);
    loadHistory();
  }, [loadHistory]);

  // Abrir el historial y resaltar un kilometraje al recibir el evento desde un
  // estado del vehículo ("Ver en historial").
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const m = typeof detail?.mileage === "number" ? detail.mileage : null;
      setHighlightMileage(m);
      setShowHistoryDialog(true);
      loadHistory();
    };
    window.addEventListener("c4y:open-mileage-history", handler as EventListener);
    return () => window.removeEventListener("c4y:open-mileage-history", handler as EventListener);
  }, [loadHistory]);

  // Identifica el item del historial más cercano al kilometraje a resaltar.
  const highlightTargetKey = pickHistoryHighlightKey(history, highlightMileage);

  // Hacer scroll al item resaltado cuando el historial está listo.
  useEffect(() => {
    if (
      showHistoryDialog &&
      highlightMileage != null &&
      !isLoadingHistory &&
      highlightRowRef.current
    ) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [showHistoryDialog, highlightMileage, isLoadingHistory, history]);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteHistoryEntry = useCallback(
    async (recordId: string) => {
      setDeletingId(recordId);
      try {
        const res = await fetch(
          `/api/fleet/${vehicleId}/mileage?recordId=${encodeURIComponent(recordId)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Error del servidor: ${res.status}`);
        }
        const result = await res.json().catch(() => ({}));
        // Si el backend recalculó el kilometraje actual, reflejarlo en el pill
        if (result?.data?.currentMileage !== undefined && result.data.currentMileage !== null) {
          setLocalMileage(result.data.currentMileage);
        }
        toast.success("Registro de kilometraje eliminado");
        await loadHistory();
        if (onMileageUpdated) onMileageUpdated();
      } catch (error) {
        console.error("Error eliminando registro de kilometraje:", error);
        toast.error(error instanceof Error ? error.message : "No se pudo eliminar el registro");
      } finally {
        setDeletingId(null);
      }
    },
    [vehicleId, loadHistory, onMileageUpdated]
  );

  const handleResetOilChange = useCallback(async () => {
    if (isLoading || isProcessingRef.current) {
      toast.info("Ya hay una operación en curso, espera un momento");
      return;
    }
    setShowConfirmDialog(true);
  }, [isLoading]);

  const handleOpenMileageDialog = useCallback(() => {
    if (isLoading || isProcessingRef.current) {
      toast.info("Ya hay una operación en curso, espera un momento");
      return;
    }
    setUpdateMode("set");
    setNewMileage(localMileage.toString());
    setShowMileageDialog(true);
    loadHistory();
  }, [isLoading, localMileage, loadHistory]);

  const handleConfirmMileageUpdate = useCallback(async () => {
    const raw = parseInt(newMileage, 10);
    if (isNaN(raw) || raw < 0) {
      toast.error(
        updateMode === "add"
          ? "Ingrese una cantidad de km válida (entero >= 0)"
          : "Por favor ingrese un kilometraje válido (entero >= 0)"
      );
      return;
    }

    if (updateMode === "add" && raw <= 0) {
      toast.error("La cantidad a sumar debe ser mayor a 0");
      return;
    }

    // En modo "add" el valor final es el actual + la cantidad ingresada
    const mileageValue = computeNewMileage(updateMode, raw, localMileage);

    if (mileageValue === null) {
      toast.error("El kilometraje no puede ser menor al actual", {
        description: `Kilometraje actual: ${formatNumber(localMileage)} km`,
      });
      return;
    }

    isProcessingRef.current = true;
    setIsLoading(true);

    try {
      const response = await fetch(`/api/fleet/${vehicleId}/mileage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newMileage: mileageValue }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Error del servidor: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data;
      setLocalMileage(data.newMileage);

      toast.success(
        `Kilometraje actualizado para ${vehicleName}: ${formatNumber(data.newMileage)} km`
      );

      if (onMileageUpdated) onMileageUpdated();

      // Verificar recordatorios en segundo plano
      fetch(`/api/fleet/${vehicleId}/check-mileage-reminders`, { method: "POST" }).catch((err) => {
        console.warn("Error verificando recordatorios:", err);
      });

      setShowMileageDialog(false);
      setNewMileage("");
    } catch (error) {
      console.error("Error actualizando kilometraje:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el kilometraje");
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 300);
    }
  }, [newMileage, vehicleId, vehicleName, onMileageUpdated, localMileage, updateMode]);

  const handleConfirmReset = useCallback(async () => {
    isProcessingRef.current = true;
    setIsLoading(true);

    try {
      const response = await fetch(`/api/fleet/${vehicleId}/oil-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Error del servidor: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data;

      setLocalMileage(data.currentMileage);
      setLocalLastOilChange(data.lastOilChangeMileage);

      toast.success(`Cambio de aceite registrado para ${vehicleName}`);

      if (onMileageUpdated) onMileageUpdated();

      fetch(`/api/fleet/${vehicleId}/check-mileage-reminders`, { method: "POST" }).catch((err) => {
        console.warn("Error verificando recordatorios:", err);
      });

      setShowConfirmDialog(false);
    } catch (error) {
      console.error("Error registrando cambio de aceite:", error);
      toast.error(
        error instanceof Error ? error.message : "No se pudo registrar el cambio de aceite"
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 300);
    }
  }, [vehicleId, vehicleName, onMileageUpdated]);

  const formatNumber = (num: number) => {
    return num.toLocaleString("es-PA", { maximumFractionDigits: 0 });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-PA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateOnly = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-PA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTimeOnly = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("es-PA", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isButtonDisabled = isLoading || isProcessingRef.current;

  const handleOpenMaintenanceDialog = useCallback(() => {
    if (isLoading || isProcessingRef.current) {
      toast.info("Ya hay una operación en curso, espera un momento");
      return;
    }
    setShowMaintenanceDialog(true);
  }, [isLoading]);

  const renderContent = () => {
    if (variant === "compact") {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            <span>{formatNumber(localMileage)} km</span>
            {(isWarning || isDanger) && (
              <AlertTriangle
                className={cn("h-3.5 w-3.5", isDanger ? "text-red-500" : "text-yellow-500")}
              />
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs font-semibold shadow-sm px-2 py-0"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenMileageDialog();
              }}
              disabled={isButtonDisabled}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Actualizar KM
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs font-semibold px-2 py-0"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenHistoryDialog();
              }}
              disabled={isButtonDisabled}
            >
              <History className="h-3 w-3 mr-1" />
              Historial
            </Button>
            {(isWarning || isDanger) && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="h-6 text-xs font-semibold shadow-sm px-2 py-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetOilChange();
                  }}
                  disabled={isButtonDisabled}
                >
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Cambio realizado
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs font-semibold shadow-sm px-2 py-0 border-primary text-primary hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenMaintenanceDialog();
                  }}
                  disabled={isButtonDisabled}
                >
                  <ClipboardList className="h-3 w-3 mr-1" />
                  Servicio + Orden
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Kilometraje Recorrido</span>
          </div>
          {(isWarning || isDanger) && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                isDanger
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              <span>{isDanger ? "Cambio urgente" : "Próximo cambio"}</span>
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{formatNumber(localMileage)}</span>
          <span className="text-sm text-muted-foreground">km</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Último cambio: {formatNumber(localLastOilChange)} km</span>
            <span>Próximo: {formatNumber(localLastOilChange + localInterval)} km</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                isDanger ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-green-500"
              )}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span
              className={cn(
                isDanger
                  ? "text-red-600 font-medium"
                  : isWarning
                    ? "text-yellow-600"
                    : "text-muted-foreground"
              )}
            >
              {isDanger
                ? `⚠️ Superado por ${formatNumber(distanceSinceLastOilChange - localInterval)} km`
                : isWarning
                  ? `⚡ Restan ${formatNumber(remainingKm)} km`
                  : `✓ ${formatNumber(remainingKm)} km restantes`}
            </span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 text-xs font-semibold shadow-sm transition-all duration-200 flex-1",
              isButtonDisabled && "opacity-70 cursor-not-allowed"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenMileageDialog();
            }}
            disabled={isButtonDisabled}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Colocar Nuevo Record
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className={cn(
              "h-8 text-xs font-semibold shadow-sm transition-all duration-200 flex-1",
              isButtonDisabled && "opacity-70 cursor-not-allowed"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenHistoryDialog();
            }}
            disabled={isButtonDisabled}
          >
            <History className="h-3.5 w-3.5 mr-1" />
            Ver Historial
          </Button>

          {(isWarning || isDanger) && (
            <>
              <Button
                variant="default"
                size="sm"
                className={cn(
                  "h-8 text-xs font-semibold shadow-sm transition-all duration-200 flex-1",
                  isButtonDisabled && "opacity-70 cursor-not-allowed"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetOilChange();
                }}
                disabled={isButtonDisabled}
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                {isLoading ? "Procesando..." : "Cambio realizado"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 text-xs font-semibold shadow-sm transition-all duration-200 flex-1 border-primary text-primary hover:bg-primary/10",
                  isButtonDisabled && "opacity-70 cursor-not-allowed"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenMaintenanceDialog();
                }}
                disabled={isButtonDisabled}
              >
                <ClipboardList className="h-3.5 w-3.5 mr-1" />
                Servicio + Orden
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderContent()}

      {/* Diálogo de confirmación para cambio de aceite */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Cambio de Aceite</DialogTitle>
            <DialogDescription>
              ¿Confirmas que el cambio de aceite ha sido realizado?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmReset} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para actualizar record de kilometraje */}
      <Dialog open={showMileageDialog} onOpenChange={setShowMileageDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Actualizar Kilometraje</DialogTitle>
            <DialogDescription>
              Ingrese el nuevo valor de kilometraje para {vehicleName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Selector de modo: establecer total final o sumar X km */}
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <Button
                type="button"
                variant={updateMode === "set" ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs font-semibold"
                onClick={() => {
                  setUpdateMode("set");
                  setNewMileage(localMileage.toString());
                }}
              >
                Establecer total
              </Button>
              <Button
                type="button"
                variant={updateMode === "add" ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs font-semibold"
                onClick={() => {
                  setUpdateMode("add");
                  setNewMileage("");
                }}
              >
                Sumar (+km)
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="newMileage" className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                {updateMode === "add"
                  ? "Kilómetros a sumar (+km)"
                  : "Kilometraje actual final (km)"}
              </Label>
              <Input
                id="newMileage"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={newMileage}
                onChange={(e) => setNewMileage(e.target.value)}
                className="col-span-3"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Kilometraje actual: {formatNumber(localMileage)} km
                {updateMode === "add" && newMileage && !isNaN(parseInt(newMileage, 10)) && (
                  <>
                    {" "}
                    → Nuevo total:{" "}
                    <span className="font-semibold text-foreground">
                      {formatNumber(localMileage + Math.max(0, parseInt(newMileage, 10) || 0))} km
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground">Últimas actualizaciones</p>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">Cargando...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-3 text-muted-foreground border rounded-lg bg-muted/30">
                  <p className="text-xs">No hay registros previos de kilometraje.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 2).map((item, index) => {
                    const diff = item.newMileage - item.previousMileage;
                    const isOilChange = item.changeType === "oil_change_reset";
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isOilChange ? (
                              <span className="text-sm font-medium flex items-center gap-1">
                                <Wrench className="h-3.5 w-3.5 text-blue-500" />
                                Cambio de aceite
                              </span>
                            ) : (
                              <>
                                <span className="text-sm font-medium">
                                  {formatNumber(item.previousMileage)} km
                                </span>
                                <span className="text-xs text-muted-foreground">→</span>
                                <span className="text-sm font-bold text-primary">
                                  {formatNumber(item.newMileage)} km
                                </span>
                                {diff > 0 && (
                                  <span className="text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                                    +{formatNumber(diff)} km
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{formatDateOnly(item.createdAt || "")}</span>
                            <span>•</span>
                            <span>{formatTimeOnly(item.createdAt || "")}</span>
                            {item.createdByName && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {item.createdByName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {index === 0 && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0 ml-2">
                            Último
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMileageDialog(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmMileageUpdate} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de orden de mantenimiento automática */}
      <MaintenanceOrderDialog
        open={showMaintenanceDialog}
        onOpenChange={setShowMaintenanceDialog}
        vehicleId={vehicleId}
        vehicleName={vehicleName}
        currentMileage={localMileage}
        maintenanceType="oil_change"
        maintenanceTypeLabel="Cambio de Aceite"
        onSuccess={() => {
          if (onMileageUpdated) onMileageUpdated();
        }}
      />

      {/* Diálogo para ver historial completo */}
      <Dialog
        open={showHistoryDialog}
        onOpenChange={(open) => {
          setShowHistoryDialog(open);
          if (!open) setHighlightMileage(null);
        }}
      >
        <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Kilometraje
            </DialogTitle>
            <DialogDescription>
              Registro de todos los cambios de kilometraje para {vehicleName}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Cargando historial...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No hay registros de cambios de kilometraje aún.</p>
                <p className="text-xs mt-1">
                  Los cambios se guardarán automáticamente cada vez que actualices el kilometraje.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item, index) => {
                  const diff = item.newMileage - item.previousMileage;
                  const isOilChange = item.changeType === "oil_change_reset";
                  const itemKey = item.documentId ?? String(item.id);
                  const isHighlighted =
                    highlightTargetKey != null && itemKey === highlightTargetKey;
                  return (
                    <div
                      key={item.id}
                      ref={isHighlighted ? highlightRowRef : undefined}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
                        isHighlighted && "border-primary ring-2 ring-primary/40 bg-primary/5"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isOilChange ? (
                            <span className="text-sm font-medium flex items-center gap-1">
                              <Wrench className="h-3.5 w-3.5 text-blue-500" />
                              Cambio de aceite
                            </span>
                          ) : (
                            <>
                              <span className="text-sm font-medium">
                                {formatNumber(item.previousMileage)} km
                              </span>
                              <span className="text-xs text-muted-foreground">→</span>
                              <span className="text-sm font-bold text-primary">
                                {formatNumber(item.newMileage)} km
                              </span>
                              {diff > 0 && (
                                <span className="text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                                  +{formatNumber(diff)} km
                                </span>
                              )}
                              {diff === 0 && (
                                <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  Sin cambio
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span>{formatDateOnly(item.createdAt || "")}</span>
                          <span>•</span>
                          <span>{formatTimeOnly(item.createdAt || "")}</span>
                          {item.createdByName && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {item.createdByName}
                              </span>
                            </>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {index === 0 && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2 py-1 rounded-full">
                            Último
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() =>
                            handleDeleteHistoryEntry(item.documentId ?? String(item.id))
                          }
                          disabled={deletingId === (item.documentId ?? String(item.id))}
                          aria-label="Eliminar registro de kilometraje"
                        >
                          {deletingId === (item.documentId ?? String(item.id)) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
