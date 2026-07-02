"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Car,
  User,
  Calendar,
  Banknote,
  FileText,
  Plus,
  Edit,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

// UI Components
import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Badge } from "@/components_shadcn/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/ui";
import { Progress } from "@/components_shadcn/ui/progress";
import { Separator } from "@/components_shadcn/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components_shadcn/ui/alert-dialog";

// Layout & Design
import { AdminLayout } from "@/components/admin/admin-layout";
import { BackButton } from "@/components/admin/back-button";
import { Can } from "@/components/auth/can";
import { typography, spacing, components } from "@/lib/design-system";
import { cn } from "@/lib/utils";

// Components
import { FinancingCalculator } from "@/components/ui/billing";
import { PaymentTimeline, type PaymentRecord } from "../../components/payment-timeline";
import { CreatePaymentDialog, type FinancingOption } from "../../components/create-payment-dialog";

// Types
import type { FinancingCard } from "@/lib/financing";
import type { BillingRecordCard } from "@/lib/billing";

type FinancingStatus = "activo" | "inactivo" | "en_mora" | "completado";

type ExtendedPaymentStatus = "pagado" | "pendiente" | "adelanto" | "retrasado" | "abonado";

const statusConfig: Record<
  FinancingStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    tone: StatusTone;
    // Accent classes for the decorative status icon circle (kept aligned with the tone).
    bgColor: string;
    textColor: string;
    borderColor: string;
  }
> = {
  activo: {
    label: "Activo",
    icon: CheckCircle2,
    tone: "success",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-500/20",
  },
  inactivo: {
    label: "Inactivo",
    icon: XCircle,
    tone: "neutral",
    bgColor: "bg-muted",
    textColor: "text-muted-foreground",
    borderColor: "border-border",
  },
  en_mora: {
    label: "En Mora",
    icon: AlertTriangle,
    tone: "danger",
    bgColor: "bg-red-500/10",
    textColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-500/20",
  },
  completado: {
    label: "Completado",
    icon: CheckCircle2,
    tone: "info",
    bgColor: "bg-sky-500/10",
    textColor: "text-sky-700 dark:text-sky-300",
    borderColor: "border-sky-500/20",
  },
};

const frequencyLabels: Record<string, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
};

export default function FinancingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // State
  const [financing, setFinancing] = useState<FinancingCard | null>(null);
  const [payments, setPayments] = useState<BillingRecordCard[]>([]);
  const [penaltyDebts, setPenaltyDebts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true); // Inicia en true para primera carga
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Simulación
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentWeek, setCurrentWeek] = useState(1); // Semana de simulación actual

  // Key para forzar re-render del PaymentTimeline después de generar cuotas
  const [refreshKey, setRefreshKey] = useState(0);

  // Confirm dialog hook
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  // Calcular totales desde los payments (separando pagos de multas) - DEBE estar antes de cualquier return condicional
  const { totalPaidPositive, totalMultas, creditReal } = useMemo(() => {
    // Solo pagos positivos cuentan como "pagado"
    const totalPaidPositive = payments
      .filter((p) => p.amount > 0)
      .reduce((sum, p) => sum + p.amount, 0);

    // Montos negativos = multas
    const totalMultas = payments
      .filter((p) => p.amount < 0)
      .reduce((sum, p) => sum + Math.abs(p.amount), 0);

    // Calcular crédito REAL desde los payments (no del financing que puede estar desactualizado)
    // Crédito = excedente de abonos/adelantos (amount - quotaAmount) para pagos que cubren más de una cuota
    const creditFromPayments = payments
      .filter((p) => p.amount > 0 && (p.status === "abonado" || p.status === "adelanto"))
      .reduce((sum, p) => {
        const quotaAmount = financing?.quotaAmount || 0;
        const quotasCovered = p.quotasCovered || 1;
        // Si el pago cubre más del monto de las cuotas, el excedente es crédito
        const amountForQuotas = quotasCovered * quotaAmount;
        const creditFromThisPayment = Math.max(0, p.amount - amountForQuotas);
        return sum + creditFromThisPayment;
      }, 0);

    // Crédito real = crédito de payments - multas (no puede ser negativo)
    const creditReal = Math.max(0, creditFromPayments - totalMultas);

    return { totalPaidPositive, totalMultas, creditReal };
  }, [payments, financing?.quotaAmount]);

  // Fetch billing records y penalty-debts en paralelo
  const fetchBillingRecords = useCallback(async () => {
    console.log(`[FetchBillingRecords] Iniciando fetch para financing=${id}`);
    setIsLoadingPayments(true);
    try {
      const timestamp = Date.now();
      const [billingRes, penaltiesRes] = await Promise.all([
        fetch(`/api/billing?financing=${id}&_t=${timestamp}`, { cache: "no-store" }),
        fetch(`/api/penalties?financing=${id}&_t=${timestamp}`, { cache: "no-store" }),
      ]);

      if (billingRes.ok) {
        const data = await billingRes.json();
        console.log(`[FetchBillingRecords] Respuesta recibida:`, {
          count: data.data?.length || 0,
          records: data.data?.map((p: BillingRecordCard) => ({
            documentId: p.documentId,
            status: p.status,
            parentRecordId: p.parentRecordId,
          })),
        });
        setPayments(data.data || []);
      } else {
        console.error("Error response from billing API:", await billingRes.text());
        setPayments([]);
      }

      if (penaltiesRes.ok) {
        const data = await penaltiesRes.json();
        console.log(`[FetchPenalties] Respuesta recibida:`, {
          count: data.data?.length || 0,
          penalties: data.data?.map((p: any) => ({
            documentId: p.documentId,
            status: p.status,
            amountPending: p.amountPending,
          })),
        });
        setPenaltyDebts(data.data || []);
      } else {
        console.error("Error response from penalties API:", await penaltiesRes.text());
        setPenaltyDebts([]);
      }
    } catch (err) {
      console.error("Error fetching billing records or penalties:", err);
      setPayments([]);
      setPenaltyDebts([]);
    } finally {
      setIsLoadingPayments(false);
    }
  }, [id, refreshKey]);

  // Fetch financing data
  const fetchFinancing = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/financing/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Financiamiento no encontrado");
        }
        throw new Error("Error al cargar el financiamiento");
      }

      const data = await response.json();
      setFinancing(data.data);

      // Fetch payments directamente para asegurar datos actualizados
      await fetchBillingRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }, [id, fetchBillingRecords]);

  // Auto-cover: ejecutar cobertura automática de cuotas pendientes con adelantos
  const triggerAutoCover = useCallback(async () => {
    if (!id) return;
    try {
      console.log(`[FinancingPage] Ejecutando auto-cover para financing ${id}`);
      const response = await fetch("/api/billing/auto-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financingDocumentId: id }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.coveredCount > 0) {
          console.log(`[FinancingPage] Auto-cover cubrió ${result.coveredCount} cuota(s)`);
          toast.info(`${result.coveredCount} cuota(s) cubierta(s) automáticamente con adelantos`);
          // Refrescar datos para reflejar cambios
          await fetchFinancing();
        }
      }
    } catch (err) {
      console.error("[FinancingPage] Error en auto-cover:", err);
    }
  }, [id, fetchFinancing]);

  // Fetch test mode config
  const fetchTestModeConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/configuration");
      if (response.ok) {
        const data = await response.json();
        const configs = data.data || [];
        const testModeConfig = configs.find(
          (c: { key?: string; value?: string }) => c.key === "billing-test-mode-enabled"
        );
        setIsTestModeEnabled(testModeConfig?.value === "true");
      }
    } catch (err) {
      console.error("Error loading test mode config:", err);
    }
  }, []);

  // Fetch current user role
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await fetch("/api/user-profile/me");
      if (response.ok) {
        const data = await response.json();
        setCurrentUserRole(data.data?.role || "");
      }
    } catch (err) {
      console.error("Error loading current user:", err);
    }
  }, []);

  // useEffect para cargar datos iniciales
  useEffect(() => {
    if (id) {
      // Cargar todos los datos en paralelo
      Promise.all([fetchFinancing(), fetchTestModeConfig(), fetchCurrentUser()])
        .then(() => {
          // Después de cargar datos, ejecutar auto-cover para cubrir cuotas pendientes
          triggerAutoCover();
        })
        .catch((err) => {
          console.error("Error cargando datos iniciales:", err);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Solo depende de id, no de fetchFinancing para evitar loops

  // Delete financing
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/financing/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar");
      }
      toast.success("Financiamiento eliminado");
      router.push("/billing");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // Format helpers
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency: "PAB",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return "-";
    try {
      return format(new Date(`${dateString}T00:00:00`), "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  // Calcular el próximo vencimiento real considerando abonos y crédito
  const calculateRealNextDueDate = (): string => {
    if (!financing || payments.length === 0) {
      return financing?.nextDueDate ? formatDate(financing.nextDueDate) : "-";
    }

    // Encontrar la última cuota cubierta (pagada o abonada)
    const paidOrAbonadoPayments = payments.filter(
      (p) => p.status === "pagado" || p.status === "abonado" || p.status === "adelanto"
    );

    if (paidOrAbonadoPayments.length === 0) {
      // No hay pagos, usar el nextDueDate del financing
      return formatDate(financing.nextDueDate);
    }

    // Encontrar el máximo quotaNumber cubierto
    const maxQuotaCovered = Math.max(
      ...paidOrAbonadoPayments.map((p) => (p.quotaNumber || 0) + (p.quotasCovered || 1) - 1)
    );

    // Encontrar el pago con la mayor fecha (último pago realizado)
    const lastPayment = paidOrAbonadoPayments.sort((a, b) => {
      const dateA = new Date(a.paymentDate || a.dueDate || 0).getTime();
      const dateB = new Date(b.paymentDate || b.dueDate || 0).getTime();
      return dateB - dateA;
    })[0];

    const baseDate = new Date(
      lastPayment.dueDate || lastPayment.paymentDate || financing.nextDueDate || new Date()
    );
    const frequency = financing.paymentFrequency || "semanal";
    const nextQuotaNumber = maxQuotaCovered + 1;

    // Calcular la fecha de la siguiente cuota
    const resultDate = new Date(baseDate);

    switch (frequency) {
      case "semanal":
        // Sumar semanas desde la fecha base hasta la siguiente cuota
        resultDate.setDate(
          resultDate.getDate() + (nextQuotaNumber - (lastPayment.quotaNumber || 1)) * 7
        );
        break;
      case "quincenal":
        // Sumar quincenas desde la fecha base
        resultDate.setDate(
          resultDate.getDate() + (nextQuotaNumber - (lastPayment.quotaNumber || 1)) * 15
        );
        break;
      case "mensual":
        // Sumar meses desde la fecha base
        resultDate.setMonth(
          resultDate.getMonth() + (nextQuotaNumber - (lastPayment.quotaNumber || 1))
        );
        break;
      default:
        resultDate.setDate(
          resultDate.getDate() + (nextQuotaNumber - (lastPayment.quotaNumber || 1)) * 7
        );
    }

    return format(resultDate, "d 'de' MMMM, yyyy", { locale: es });
  };

  // Loading state
  if (isLoading) {
    return (
      <AdminLayout title="Cargando..." leftActions={<BackButton fallbackHref="/billing" />}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  // Error state
  if (error || !financing) {
    return (
      <AdminLayout title="Error" leftActions={<BackButton fallbackHref="/billing" />}>
        <Card className={components.card}>
          <CardContent className={cn(spacing.card.padding, "text-center")}>
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <p className="text-destructive mb-4">{error || "Financiamiento no encontrado"}</p>
            <Button variant="outline" onClick={() => router.push("/billing")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Financiamientos
            </Button>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  const status = (financing.status as FinancingStatus) || "activo";
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const progressPercentage =
    financing.totalQuotas > 0 ? (financing.paidQuotas / financing.totalQuotas) * 100 : 0;

  // Preselected financing for payment dialog
  const preselectedFinancing: FinancingOption = {
    documentId: financing.documentId,
    financingNumber: financing.financingNumber,
    vehicleName: financing.vehicleName || "Sin vehículo",
    vehiclePlaca: financing.vehiclePlaca,
    clientName: financing.clientName || "Sin cliente",
    quotaAmount: financing.quotaAmount,
    paidQuotas: financing.paidQuotas,
    totalQuotas: financing.totalQuotas,
    currentBalance: financing.currentBalance,
    nextDueDate: financing.nextDueDate || "",
    partialPaymentCredit: financing.partialPaymentCredit || 0,
    lateFeePercentage: financing.lateFeePercentage || 10,
    status: financing.status,
  };

  return (
    <AdminLayout title="" leftActions={<BackButton fallbackHref="/billing" />}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center",
                config.bgColor,
                "border-2",
                config.borderColor
              )}
            >
              <StatusIcon className={cn("h-6 w-6", config.textColor)} />
            </div>
            <div>
              <h1 className={typography.h2}>{financing.financingNumber}</h1>
              <StatusBadge tone={config.tone}>{config.label}</StatusBadge>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Can module="billing" action="canUpdate">
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
            </Can>
            <DropdownMenuSeparator />
            <Can module="billing" action="canDelete">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </Can>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Vehicle & Client Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card
          className={cn(
            components.card,
            financing.vehicleDocumentId && "cursor-pointer hover:bg-accent/50 transition-colors"
          )}
          onClick={() => {
            if (financing.vehicleDocumentId) {
              router.push(`/fleet/details/${financing.vehicleDocumentId}`);
            }
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vehículo</p>
                <p className={typography.body.large}>{financing.vehicleName || "Sin vehículo"}</p>
                {financing.vehiclePlaca && (
                  <Badge variant="outline" className="text-xs mt-1">
                    {financing.vehiclePlaca}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            components.card,
            financing.clientDocumentId && "cursor-pointer hover:bg-accent/50 transition-colors"
          )}
          onClick={() => {
            if (financing.clientDocumentId) {
              router.push(`/users/details/${financing.clientDocumentId}`);
            }
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className={typography.body.large}>{financing.clientName || "Sin cliente"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card className={cn(components.card, "mb-6")}>
        <CardHeader className={spacing.card.header}>
          <CardTitle className={cn(typography.h4, "flex items-center gap-2")}>
            <Banknote className="h-5 w-5" />
            Resumen Financiero
          </CardTitle>
        </CardHeader>
        <CardContent className={spacing.card.content}>
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Progreso</span>
              <span className={typography.body.large}>
                {financing.paidQuotas} de {financing.totalQuotas} cuotas (
                {progressPercentage.toFixed(1)}%)
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Monto Total</p>
              <p className={cn(typography.metric.base, "text-primary")}>
                {formatCurrency(financing.totalAmount)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Cuota</p>
              <p className={cn(typography.metric.base, "text-primary")}>
                {formatCurrency(financing.quotaAmount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {frequencyLabels[financing.paymentFrequency] || financing.paymentFrequency}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Pagado</p>
              <p className={cn(typography.metric.base, "text-green-600")}>
                {formatCurrency(totalPaidPositive)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Saldo Pendiente</p>
              <p className={cn(typography.metric.base, "text-primary")}>
                {formatCurrency(financing.currentBalance)}
              </p>
            </div>
          </div>

          {/* Multas aplicadas - solo mostrar si hay multas */}
          {totalMultas > 0 && (
            <div
              className={cn(
                "mt-4 p-3 rounded-lg flex items-center justify-between",
                "bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800"
              )}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="text-sm text-orange-700 dark:text-orange-400">
                  Multas Aplicadas
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                  {formatCurrency(totalMultas)}
                </span>
                <p className="text-[10px] text-orange-600 dark:text-orange-400">
                  Aumentan lo pendiente por pagar
                </p>
              </div>
            </div>
          )}

          {/* Additional Info */}
          <Separator className="my-4" />

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Fecha de Inicio</p>
                <p className="text-sm">{formatDate(financing.startDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Próximo Vencimiento</p>
                <p className="text-sm font-medium text-primary">{calculateRealNextDueDate()}</p>
                {/* Solo mostrar "considerando crédito..." cuando NO hay multas */}
                {creditReal > 0 && totalMultas === 0 && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">
                    (considerando crédito y abonos)
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Duración</p>
                <p className="text-sm">{financing.financingMonths} meses</p>
              </div>
            </div>
          </div>

          {/* Late fees if any */}
          {financing.totalLateFees > 0 && (
            <div
              className={cn(
                "mt-4 p-3 rounded-lg flex items-center justify-between",
                "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
              )}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-700 dark:text-red-400">Multas Acumuladas</span>
              </div>
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                {formatCurrency(financing.totalLateFees)}
              </span>
            </div>
          )}

          {/* Credit if any (después de descontar multas) */}
          {creditReal > 0 && (
            <div
              className={cn(
                "mt-4 p-3 rounded-lg flex items-center justify-between",
                "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
              )}
            >
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-700 dark:text-blue-400">Crédito a Favor</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                  {formatCurrency(creditReal)}
                </span>
                {totalMultas > 0 && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">
                    (después de multas)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Aviso si las multas consumieron todo el crédito */}
          {/* Se muestra si hay multas, no hay crédito real, pero hay abonos/adelantos que sin multas generarían crédito */}
          {totalMultas > 0 &&
            creditReal === 0 &&
            payments.some(
              (p) => p.amount > 0 && (p.status === "abonado" || p.status === "adelanto")
            ) && (
              <div
                className={cn(
                  "mt-4 p-3 rounded-lg flex items-center justify-between",
                  "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                )}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    Crédito Consumido
                  </span>
                </div>
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Las multas han consumido el crédito
                </span>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <CreatePaymentDialog
        isOpen={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        preselectedFinancing={preselectedFinancing}
        onSuccess={() => {
          // Actualizar datos en background sin bloquear
          fetchFinancing().catch((err) => console.error("Error refrescando:", err));
          toast.success("Pago registrado exitosamente");
        }}
      />

      {/* Calculator (readonly) */}
      <div className="mb-6">
        <FinancingCalculator
          totalAmount={financing.totalAmount}
          financingMonths={financing.financingMonths}
          paymentFrequency={financing.paymentFrequency}
          startDate={financing.startDate}
          totalQuotas={financing.totalQuotas}
          showInputs={false}
          readOnly={true}
        />
      </div>

      {/* Payments Timeline */}
      <PaymentTimeline
        key={`timeline-${refreshKey}`}
        payments={(() => {
          const quotaRecords: PaymentRecord[] = (payments || []).map((p): PaymentRecord => {
            // REGLA: Si es hijo (tiene parentRecordId) y es "adelanto", mostrar como "abonado"
            // porque ya está vinculado a una cuota
            const correctedStatus =
              p.parentRecordId && p.status === "adelanto" ? "abonado" : p.status;

            // Calcular faltante por pagar para adelantos
            const remainingAmount =
              correctedStatus === "adelanto" && p.quotaAmountCovered && p.amount
                ? p.amount - p.quotaAmountCovered
                : 0;

            // Calcular a qué cuota se está adelantando
            const advanceForQuota =
              correctedStatus === "adelanto" && p.quotaNumber && p.quotasCovered
                ? p.quotaNumber + p.quotasCovered
                : undefined;

            // Mapear hijos si existen
            const children = p.childRecords?.map((child) => ({
              id: child.documentId,
              invoiceNumber: child.receiptNumber || "",
              amount: child.amount,
              status: child.status as ExtendedPaymentStatus,
              dueDate: child.dueDate || new Date().toISOString(),
              paymentDate: child.paymentDate,
              quotaNumber: child.quotaNumber,
              currency: child.currency,
              createdAt: child.createdAt,
              parentId: p.documentId,
              parentReceiptNumber: p.receiptNumber,
            }));

            // Calcular balance/disponible según el tipo de record
            let balanceDueParent: number;
            let availableAmount: number | undefined;

            if (correctedStatus === "adelanto") {
              // Para adelantos: calcular saldo disponible (amount - hijos consumidos)
              const totalConsumed =
                children?.reduce((sum, child) => sum + (child.amount > 0 ? child.amount : 0), 0) ||
                0;
              availableAmount = Math.max(0, p.amount - totalConsumed);
              balanceDueParent = 0; // Los adelantos no tienen "balance pendiente", tienen "disponible"
            } else if (
              correctedStatus === "cubierta" ||
              correctedStatus === "pagado" ||
              p.parentRecordId
            ) {
              // Para cuotas cubiertas o pagadas: balance es 0
              balanceDueParent = 0;
            } else {
              // Para cuotas normales con abonos: calcular balance pendiente
              const totalAbonos =
                children?.reduce((sum, child) => sum + (child.amount > 0 ? child.amount : 0), 0) ||
                0;
              // Fallback: si el backend envió remainingQuotaBalance, usarlo cuando no hay hijos visibles
              if (
                totalAbonos === 0 &&
                p.remainingQuotaBalance > 0 &&
                p.remainingQuotaBalance < p.amount
              ) {
                balanceDueParent = p.remainingQuotaBalance;
              } else {
                balanceDueParent = Math.max(0, p.amount - totalAbonos);
              }
            }

            // DEBUG
            console.log(
              `[DEBUG page.tsx] ${p.receiptNumber}: status=${correctedStatus}, amount=${p.amount}, available=${availableAmount}, balanceDue=${balanceDueParent}, children=${children?.length || 0}`
            );

            return {
              // Usar status corregido para la UI
              id: p.documentId,
              invoiceNumber: p.receiptNumber || "",
              amount: p.amount,
              status: correctedStatus as ExtendedPaymentStatus,
              dueDate: p.dueDate || new Date().toISOString(),
              paymentDate: p.paymentDate,
              quotaNumber: p.quotaNumber,
              lateFeeAmount: p.lateFeeAmount,
              daysLate: p.daysLate,
              currency: p.currency,
              clientName: p.clientName,
              createdAt: p.createdAt,
              // Datos de adelanto
              quotasCovered: p.quotasCovered,
              quotaAmountCovered: p.quotaAmountCovered,
              advanceCredit: p.advanceCredit,
              remainingQuotaBalance: p.remainingQuotaBalance,
              advanceForQuota,
              // Monto total de la cuota (para calcular saldo en pendientes)
              quotaTotalAmount: financing?.quotaAmount || p.amount,
              // Balance pendiente después de abonos (para cálculo de total a pagar)
              balanceDue: balanceDueParent,
              // Saldo disponible para adelantos (calculado en page.tsx)
              availableAmount,
              // Info del vehículo para exportación
              vehicleName: financing?.vehicleName,
              vehiclePlate: financing?.vehiclePlaca,
              // Info adicional del cliente para exportación
              clientPhone: financing?.clientPhone,
              // Relaciones padre/hijo
              parentId: p.parentRecordId,
              parentReceiptNumber: p.parentRecordReceiptNumber,
              children,
            };
          });
          return quotaRecords.sort((a, b) => {
            const dateA = new Date(a.dueDate).getTime();
            const dateB = new Date(b.dueDate).getTime();
            return dateA - dateB;
          });
        })()}
        partialPaymentCredit={financing?.partialPaymentCredit || 0}
        quotaAmount={financing?.quotaAmount || 0}
        paymentFrequency={financing?.paymentFrequency || "semanal"}
        paidQuotas={financing?.paidQuotas || 0}
        totalQuotas={financing?.totalQuotas || 0}
        totalAmount={financing?.totalAmount}
        currentBalance={financing?.currentBalance}
        title="Historial de Pagos"
        isLoading={isLoadingPayments}
        isTestModeEnabled={isTestModeEnabled}
        userRole={currentUserRole}
        financingId={id}
        currentWeek={currentWeek}
        onWeekChange={(week) => setCurrentWeek(week)}
        onSimulateTuesday={async () => {
          // Calcular fecha de simulación: martes de la primera semana basado en startDate
          const startDate = financing?.startDate ? new Date(financing.startDate) : new Date();
          const startDay = startDate.getDay(); // 0=dom, 1=lun, 2=mar, 3=mie, 4=jue, 5=vie, 6=sab
          const daysToTuesday = (2 - startDay + 7) % 7;
          const firstTuesday = new Date(startDate);
          firstTuesday.setDate(startDate.getDate() + daysToTuesday);

          let totalGenerated = 0;
          const errors: string[] = [];

          // Generar cuotas desde la semana 1 hasta la semana actual
          for (let week = 1; week <= currentWeek; week++) {
            const weekDate = new Date(firstTuesday);
            weekDate.setDate(firstTuesday.getDate() + (week - 1) * 7);
            const simulationDate = weekDate.toISOString().split("T")[0];

            const res = await fetch("/api/invoices/simulate-generation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ simulationDate, currentWeek: week }),
            });
            const data = await res.json();
            if (data.success) {
              totalGenerated += data.generatedCount || 0;
            } else {
              errors.push(`Semana ${week}: ${data.error || "Error"}`);
            }
          }

          if (totalGenerated > 0) {
            toast.success(
              `Se generaron ${totalGenerated} cuotas pendientes (semanas 1-${currentWeek})`
            );
          } else if (errors.length > 0) {
            console.error("[SimulateTuesday] Errores:", errors);
            toast.error(errors[0] || "Error al generar cuotas");
          } else {
            // No se generó nada y no hay errores: las cuotas ya existen
            toast.info(
              `Las cuotas de las semanas 1-${currentWeek} ya existen. No se generaron cuotas nuevas.`
            );
          }

          // Después de generar todas las semanas, actualizar días de atraso de cuotas retrasadas
          const lastTuesday = new Date(firstTuesday);
          lastTuesday.setDate(firstTuesday.getDate() + (currentWeek - 1) * 7);
          const updateDate = lastTuesday.toISOString().split("T")[0];

          await fetch("/api/invoices/simulate-overdue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ simulationDate: updateDate, mode: "update-existing" }),
          });

          // Refrescar datos en background sin bloquear la UI
          fetchFinancing()
            .then(() => setRefreshKey((prev) => prev + 1))
            .catch((err) => console.error("Error refrescando:", err));
        }}
        onSimulateFriday={async () => {
          // Calcular fecha de simulación: viernes de la semana actual
          // Encontrar el martes de la primera semana basado en startDate
          const startDate = financing?.startDate ? new Date(financing.startDate) : new Date();
          const startDay = startDate.getDay();
          const daysToTuesday = (2 - startDay + 7) % 7;
          const firstTuesday = new Date(startDate);
          firstTuesday.setDate(startDate.getDate() + daysToTuesday);

          // Viernes de la semana simulada (martes + 3 días)
          const baseDate = new Date(firstTuesday);
          baseDate.setDate(firstTuesday.getDate() + (currentWeek - 1) * 7 + 3);
          const simulationDate = baseDate.toISOString().split("T")[0];

          const res = await fetch("/api/invoices/simulate-overdue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ simulationDate }),
          });
          const data = await res.json();
          if (data.success) {
            if (data.overdueCount === 0) {
              toast("No hay cuotas pendientes por vencer");
            } else {
              toast.warning(
                `Semana ${currentWeek}: ${data.overdueCount} cuotas marcadas como retrasadas. Penalidad total: $${data.totalPenaltyAmount?.toFixed(2) || 0}`
              );
            }
            // Refrescar datos en background
            fetchFinancing().catch((err) => console.error("Error refrescando:", err));
          } else {
            toast.error(data.error || "Error al actualizar cuotas");
          }
        }}
        maxHeight="400px"
        showSummary={true}
        showFilters={true}
        onPaymentClick={(payment) => {
          // payment.id es el documentId (mapeado arriba)
          router.push(`/billing/details/${payment.id}`);
        }}
        onDeletePayment={async (payment) => {
          const confirmed = await confirm({
            title: "Eliminar cuota",
            description: `¿Estás seguro de que deseas eliminar la cuota ${payment.invoiceNumber}?${payment.children && payment.children.length > 0 ? `\n\n⚠️ Esta cuota tiene ${payment.children.length} pago(s) asociado(s) que también se eliminarán.` : ""}`,
            confirmText: "Eliminar",
            cancelText: "Cancelar",
            variant: "destructive",
          });

          if (!confirmed) return;

          // Recopilar IDs a eliminar (padre + hijos)
          const idsToDelete = [payment.id];
          if (payment.children && payment.children.length > 0) {
            payment.children.forEach((child) => idsToDelete.push(child.id));
          }

          console.log(`[DeletePayment] Eliminando ${idsToDelete.length} pago(s):`, idsToDelete);

          // Actualización optimista - eliminar del estado local inmediatamente (padre + hijos)
          const updatedPayments = payments.filter((p) => !idsToDelete.includes(p.documentId));
          setPayments(updatedPayments);
          console.log(
            `[DeletePayment] Estado local actualizado. Mostrando ${updatedPayments.length} pagos`
          );

          try {
            const response = await fetch(`/api/billing/${payment.id}`, {
              method: "DELETE",
            });

            if (!response.ok) {
              // Si falla, revertir el cambio local
              const errorText = await response.text();
              console.error(`[DeletePayment] Error del servidor:`, errorText);
              setPayments(payments); // Revertir
              throw new Error("Error al eliminar la cuota");
            }

            console.log(`[DeletePayment] Eliminación en servidor exitosa`);
            toast.success("Cuota y pagos asociados eliminados correctamente");

            // Actualizar financing y ejecutar auto-cover en background
            fetchFinancing()
              .then(() => {
                console.log(`[DeletePayment] Datos del financing actualizados`);
                triggerAutoCover();
              })
              .catch((err) => {
                console.error(`[DeletePayment] Error actualizando financing:`, err);
              });
          } catch (err) {
            console.error(`[DeletePayment] Error:`, err);
            toast.error(err instanceof Error ? err.message : "Error al eliminar");
          }
        }}
        onPayPending={async (payment, paymentData) => {
          try {
            const response = await fetch(`/api/billing/${payment.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                data: {
                  status: "pagado",
                  paymentDate: paymentData.paymentDate,
                  confirmationNumber: paymentData.confirmationNumber || undefined,
                  comments: paymentData.notes || undefined,
                },
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Error al registrar el pago");
            }

            toast.success(`Pago ${payment.invoiceNumber} registrado correctamente`);
            // Refrescar financiamiento y ejecutar auto-cover en background
            fetchFinancing()
              .then(() => triggerAutoCover())
              .catch((err) => console.error("Error refrescando:", err));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al registrar el pago");
            throw err;
          }
        }}
        // Props para anidación de recibos
        availableParents={payments
          .filter((p) => !p.parentRecordId) // Solo pagos que no son hijos
          .map((p) => ({
            id: p.documentId,
            receiptNumber: p.receiptNumber,
            amount: p.amount,
            paymentDate: p.paymentDate,
          }))}
        onAssociateToParent={async (paymentId, parentId) => {
          try {
            const response = await fetch(`/api/billing/${paymentId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                data: {
                  parentRecord: parentId,
                },
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Error al asociar el pago");
            }

            toast.success("Pago asociado correctamente");

            // La API verifica automáticamente si los abonos cubren el monto total
            // y cambia el status del padre a "pagado" si es necesario.
            // Refrescar datos y ejecutar auto-cover en background.
            fetchFinancing()
              .then(() => triggerAutoCover())
              .catch((err) => console.error("Error refrescando:", err));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al asociar el pago");
            throw err;
          }
        }}
        onDisassociateFromParent={async (paymentId) => {
          try {
            const response = await fetch(`/api/billing/${paymentId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                data: {
                  parentRecord: null,
                },
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Error al desasociar el pago");
            }

            toast.success("Pago desasociado correctamente");
            // Ejecutar auto-cover después de desasociar (puede liberar saldo)
            triggerAutoCover();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al desasociar el pago");
            throw err;
          }
        }}
      />

      {/* Register Payment Button */}
      <Can module="billing" action="canCreate">
        <Button
          className="w-full mt-6 mb-6 h-12 text-base font-bold"
          onClick={() => setIsPaymentDialogOpen(true)}
        >
          <Plus className="mr-2 h-5 w-5" />
          Registrar Pago
        </Button>
      </Can>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este financiamiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar <strong>{financing.financingNumber}</strong>. Esto también
              eliminará todos los pagos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Dialog para eliminación de cuotas */}
      <ConfirmDialogComponent />
    </AdminLayout>
  );
}
