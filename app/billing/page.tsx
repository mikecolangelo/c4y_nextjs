"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  CreditCard, 
  Receipt, 
  Plus, 
  Loader2, 
  Trash2, 
  MoreVertical,
  FileText,
  AlertTriangle,
  ChevronDown,
  X,
  Banknote,
  Upload,
  History,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
// Roles administrativos (evitamos importar lib/admin-guard en Client Component)
const ALLOWED_ROLES = ["admin", "super-admin"];

// UI Components
import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { Input } from "@/components_shadcn/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components_shadcn/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { commonClasses, spacing, typography } from "@/lib/design-system";

// Billing Components
import { FinancingCard, PaymentCard } from "@/components/ui/billing";
import { CreateFinancingDialog } from "./components/create-financing-dialog";
import { CreatePaymentDialog } from "./components/create-payment-dialog";
import { QuotaCalculator } from "./components/quota-calculator";
import { PaymentTimeline, type PaymentRecord } from "./components/payment-timeline";
import { BillingSimulationButtons } from "./components/billing-simulation-buttons";
import { SimulateOverdueModal } from "./components/simulate-overdue-modal";
import { EmailConfigPanel } from "./components/email-config-panel";
import { SendEmailDialog } from "./components/send-email-dialog";

// Types
import type { FinancingCard as FinancingCardType } from "@/lib/financing";
import type { BillingRecordCard } from "@/lib/billing";

type TabValue = "financings" | "payments" | "calculator" | "timeline" | "email-config";
type StatusFilter = "all" | "activo" | "en_mora" | "completado" | "inactivo" | "pagado" | "pendiente" | "adelanto" | "retrasado";

export default function BillingPage() {
  const router = useRouter();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabValue>("financings");
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState("");
  
  // Data states
  const [financings, setFinancings] = useState<FinancingCardType[]>([]);
  const [payments, setPayments] = useState<BillingRecordCard[]>([]);
  const [isLoadingFinancings, setIsLoadingFinancings] = useState(true);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [isCreateFinancingOpen, setIsCreateFinancingOpen] = useState(false);
  const [isCreatePaymentOpen, setIsCreatePaymentOpen] = useState(false);
  
  // Simulation states
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(false);
  const [overdueModalOpen, setOverdueModalOpen] = useState(false);
  const [overdueData, setOverdueData] = useState<{
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
  } | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState("");
  
  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "financing" | "payment"; item: FinancingCardType | BillingRecordCard } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Email dialog state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailFinancing, setEmailFinancing] = useState<FinancingCardType | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<import("@/lib/email-config").EmailTemplate[]>([]);

  // Fetch email templates for send dialog
  const fetchEmailTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/billing/email-config");
      if (response.ok) {
        const data = await response.json();
        setEmailTemplates(data.data?.templates || []);
      }
    } catch (err) {
      console.error("Error loading email templates:", err);
    }
  }, []);

  // Fetch financings
  const fetchFinancings = useCallback(async () => {
    try {
      setIsLoadingFinancings(true);
      const response = await fetch("/api/financing");
      if (!response.ok) throw new Error("Error al cargar financiamientos");
      const data = await response.json();
      setFinancings(data.data || []);
    } catch (err) {
      console.error("Error loading financings:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoadingFinancings(false);
    }
  }, []);

  // Fetch payments
  const fetchPayments = useCallback(async () => {
    try {
      setIsLoadingPayments(true);
      const response = await fetch("/api/billing");
      if (!response.ok) throw new Error("Error al cargar pagos");
      const data = await response.json();
      setPayments(data.data || []);
    } catch (err) {
      console.error("Error loading payments:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoadingPayments(false);
    }
  }, []);

  // Fetch test mode configuration
  const fetchTestModeConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/configuration");
      if (response.ok) {
        const data = await response.json();
        const configs = data.data || [];
        const testModeConfig = configs.find((c: { key?: string; value?: string }) => c.key === "billing-test-mode-enabled");
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

  // Initial load
  useEffect(() => {
    fetchFinancings();
    fetchPayments();
    fetchTestModeConfig();
    fetchCurrentUser();
    fetchEmailTemplates();
  }, [fetchFinancings, fetchPayments, fetchTestModeConfig, fetchCurrentUser, fetchEmailTemplates]);

  // Handle delete
  const handleDeleteClick = (e: React.MouseEvent, type: "financing" | "payment", item: FinancingCardType | BillingRecordCard) => {
    e.stopPropagation();
    setItemToDelete({ type, item });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      const endpoint = itemToDelete.type === "financing" 
        ? `/api/financing/${itemToDelete.item.documentId}`
        : `/api/billing/${itemToDelete.item.documentId}`;
      
      const response = await fetch(endpoint, { method: "DELETE" });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar");
      }

      const identifier = itemToDelete.type === "financing" 
        ? (itemToDelete.item as FinancingCardType).financingNumber 
        : (itemToDelete.item as BillingRecordCard).receiptNumber;
      
      toast.success(`${itemToDelete.type === "financing" ? "Financiamiento" : "Pago"} ${identifier} eliminado`);
      
      if (itemToDelete.type === "financing") {
        // Al eliminar un financiamiento, también refrescar pagos para eliminar huérfanos de la UI
        fetchFinancings();
        fetchPayments();
      } else {
        fetchPayments();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Filter financings
  const filteredFinancings = financings.filter((f) => {
    const matchesSearch = 
      f.financingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.vehicleName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (f.clientName?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || f.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    // Filtro defensivo: excluir pagos huérfanos (cuyo financiamiento ya no existe)
    const isOrphan = p.financingDocumentId && 
      !financings.some(f => f.documentId === p.financingDocumentId);
    if (isOrphan) return false;
    
    const matchesSearch = 
      (p.receiptNumber?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (p.clientName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (p.financingNumber?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    
    let matchesDate = true;
    if (dateFilter && p.dueDate) {
      matchesDate = p.dueDate === dateFilter;
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Status options based on tab
  const getStatusOptions = () => {
    if (activeTab === "financings") {
      return [
        { value: "all", label: "Todos" },
        { value: "activo", label: "Activo", color: "text-green-600" },
        { value: "en_mora", label: "En Mora", color: "text-red-600" },
        { value: "completado", label: "Completado", color: "text-blue-600" },
        { value: "inactivo", label: "Inactivo", color: "text-gray-600" },
      ];
    }
    return [
      { value: "all", label: "Todos" },
      { value: "pagado", label: "Pagado", color: "text-green-600" },
      { value: "pendiente", label: "Pendiente", color: "text-yellow-600" },
      { value: "adelanto", label: "Adelanto", color: "text-blue-600" },
      { value: "retrasado", label: "Retrasado", color: "text-red-600" },
    ];
  };

  // Reset filter when changing tabs
  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue);
    setStatusFilter("all");
    setSearchQuery("");
    setDateFilter("");
  };

  // Stats
  const financingStats = {
    total: financings.length,
    activos: financings.filter(f => f.status === "activo").length,
    enMora: financings.filter(f => f.status === "en_mora").length,
    totalBalance: financings.reduce((sum, f) => sum + f.currentBalance, 0),
  };

  const paymentStats = {
    total: payments.length,
    pagados: payments.filter(p => p.status === "pagado").length,
    pendientes: payments.filter(p => p.status === "pendiente").length,
    totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency: "PAB",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const isLoading = isLoadingFinancings || isLoadingPayments;

  return (
    <AdminLayout title="Gestión de Financiamiento" showFilterAction>
      {/* Action Buttons */}
      <div className="flex gap-3 px-0 flex-wrap">
        <Button
          className="flex-1 rounded-lg bg-primary h-12 text-base font-bold text-primary-foreground transition-colors hover:bg-primary/90 flex items-center justify-center gap-2"
          onClick={() => setIsCreateFinancingOpen(true)}
        >
          <Plus className="h-5 w-5" />
          Nuevo Financiamiento
        </Button>
        <Button
          variant="outline"
          className="flex-1 rounded-lg h-12 text-base font-semibold flex items-center justify-center gap-2"
          onClick={() => setIsCreatePaymentOpen(true)}
        >
          <CreditCard className="h-5 w-5" />
          Registrar Pago
        </Button>
      </div>
      <div className="flex gap-3 px-0 flex-wrap">
        <Button
          variant="secondary"
          className="flex-1 rounded-lg h-12 text-base font-semibold flex items-center justify-center gap-2 px-4 shrink-0"
          onClick={() => router.push("/billing/import")}
        >
          <Upload className="h-5 w-5" />
          Importar Cobranza
        </Button>
        <Button
          variant="outline"
          className="flex-1 rounded-lg h-12 text-base font-semibold flex items-center justify-center gap-2 px-4 shrink-0"
          onClick={() => router.push("/billing/imports")}
        >
          <History className="h-5 w-5" />
          Historial de Importaciones
        </Button>
      </div>
      
      {/* Simulation Buttons (only in test mode) */}
      <BillingSimulationButtons
        isTestModeEnabled={isTestModeEnabled}
        userRole={currentUserRole}
        onSimulateComplete={() => {
          fetchFinancings();
          toast.success("Simulación completada");
        }}
        onSimulateFridayData={(data) => {
          setOverdueData(data);
          setOverdueModalOpen(true);
        }}
      />

      {/* Dialogs */}
      <CreateFinancingDialog
        isOpen={isCreateFinancingOpen}
        onOpenChange={setIsCreateFinancingOpen}
        onSuccess={() => {
          fetchFinancings();
          toast.success("Financiamiento creado exitosamente");
        }}
      />

      <CreatePaymentDialog
        isOpen={isCreatePaymentOpen}
        onOpenChange={setIsCreatePaymentOpen}
        onSuccess={() => {
          fetchPayments();
          fetchFinancings(); // Update financing progress
          toast.success("Pago registrado exitosamente");
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className={commonClasses.card}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Financiamientos</span>
            </div>
            <p className={typography.metric.base}>{financingStats.total}</p>
            <div className="flex gap-2 mt-1 text-xs">
              <span className="text-green-600">{financingStats.activos} activos</span>
              {financingStats.enMora > 0 && (
                <span className="text-red-600">{financingStats.enMora} en mora</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className={commonClasses.card}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Saldo Pendiente</span>
            </div>
            <p className={typography.metric.base}>{formatCurrency(financingStats.totalBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentStats.pagados} pagos registrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`grid w-full h-10 ${ALLOWED_ROLES.includes(currentUserRole) ? "grid-cols-5" : "grid-cols-4"}`}>
          <TabsTrigger value="financings" className="flex items-center gap-1.5 text-xs">
            <FileText className="h-4 w-4" />
            Financiamientos
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-1.5 text-xs">
            <CreditCard className="h-4 w-4" />
            Pagos
          </TabsTrigger>
          <TabsTrigger value="calculator" className="flex items-center gap-1.5 text-xs">
            <Receipt className="h-4 w-4" />
            Calculadora
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-1.5 text-xs">
            <AlertTriangle className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          {ALLOWED_ROLES.includes(currentUserRole) && (
            <TabsTrigger value="email-config" className="flex items-center gap-1.5 text-xs">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
          )}
        </TabsList>

        {/* Financings Tab */}
        <TabsContent value="financings" className="mt-4">
          {/* Filters */}
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <SearchInput
              variant="muted"
              placeholder="Buscar por número, vehículo, cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className={`flex ${spacing.gap.small}`}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 flex-1 rounded-lg bg-muted border-none ${
                      statusFilter !== "all" ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <span>Estado</span>
                    {statusFilter !== "all" && (
                      <span className="ml-1 capitalize">· {statusFilter}</span>
                    )}
                    <ChevronDown className="ml-auto h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>Filtrar por Estado</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {getStatusOptions().map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setStatusFilter(opt.value as StatusFilter)}
                      className={opt.color}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Loading */}
          {isLoadingFinancings && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty state */}
          {!isLoadingFinancings && filteredFinancings.length === 0 && (
            <Card className={`${commonClasses.card} my-4`}>
              <CardContent className={spacing.card.padding}>
                <p className="text-center text-muted-foreground">
                  {financings.length === 0
                    ? "No hay financiamientos creados"
                    : "No se encontraron financiamientos con los filtros aplicados"}
                </p>
                {financings.length === 0 && (
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => setIsCreateFinancingOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Crear primer financiamiento
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Financings List */}
          {!isLoadingFinancings && filteredFinancings.length > 0 && (
            <div className={`flex flex-col ${spacing.gap.medium} mt-4`}>
              {filteredFinancings.map((financing) => (
                <div key={financing.documentId} className="relative group">
                  <FinancingCard
                    financing={financing}
                    onClick={() => router.push(`/billing/financing/${financing.documentId}`)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/billing/financing/${financing.documentId}`)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Ver detalles
                      </DropdownMenuItem>
                      {ALLOWED_ROLES.includes(currentUserRole) && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEmailFinancing(financing);
                            setEmailDialogOpen(true);
                          }}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Enviar Email
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => handleDeleteClick(e, "financing", financing)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="mt-4">
          {/* Filters */}
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <SearchInput
              variant="muted"
              placeholder="Buscar por recibo, cliente, financiamiento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className={`flex ${spacing.gap.small}`}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 flex-1 rounded-lg bg-muted border-none ${
                      statusFilter !== "all" ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <span>Estado</span>
                    {statusFilter !== "all" && (
                      <span className="ml-1 capitalize">· {statusFilter}</span>
                    )}
                    <ChevronDown className="ml-auto h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>Filtrar por Estado</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {getStatusOptions().map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setStatusFilter(opt.value as StatusFilter)}
                      className={opt.color}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex-1 relative">
                <Input
                  type="date"
                  className="h-8 rounded-lg bg-muted border-none pr-8"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
                {dateFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-8 w-8"
                    onClick={() => setDateFilter("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Loading */}
          {isLoadingPayments && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty state */}
          {!isLoadingPayments && filteredPayments.length === 0 && (
            <Card className={`${commonClasses.card} my-4`}>
              <CardContent className={spacing.card.padding}>
                <p className="text-center text-muted-foreground">
                  {payments.length === 0
                    ? "No hay pagos registrados"
                    : "No se encontraron pagos con los filtros aplicados"}
                </p>
                {payments.length === 0 && (
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => setIsCreatePaymentOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Registrar primer pago
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payments List */}
          {!isLoadingPayments && filteredPayments.length > 0 && (
            <div className={`flex flex-col ${spacing.gap.medium} mt-4`}>
              {filteredPayments.map((payment) => (
                <div key={payment.documentId} className="relative group">
                  <PaymentCard
                    payment={payment}
                    onClick={() => router.push(`/billing/details/${payment.documentId}`)}
                    onFinancingClick={(id) => router.push(`/billing/financing/${id}`)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/billing/details/${payment.documentId}`)}
                      >
                        <Receipt className="mr-2 h-4 w-4" />
                        Ver detalles
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => handleDeleteClick(e, "payment", payment)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Calculator Tab */}
        <TabsContent value="calculator" className="mt-4">
          <QuotaCalculator />
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-4">
          <PaymentTimeline
            payments={payments
              .filter((p) => p.amount >= 0)
              .map((p): PaymentRecord => ({
                id: p.documentId, // Usar documentId para operaciones CRUD
                invoiceNumber: p.receiptNumber || "",
                amount: p.amount,
                status: p.status as "pagado" | "pendiente" | "adelanto" | "retrasado",
                dueDate: p.dueDate || new Date().toISOString(),
                paymentDate: p.paymentDate,
                quotaNumber: p.quotaNumber,
                lateFeeAmount: p.lateFeeAmount,
                currency: p.currency,
                clientName: p.clientName,
              }))}
            isLoading={isLoadingPayments}
            maxHeight="500px"
            showSummary={true}
            showFilters={true}
            onPaymentClick={(payment) => {
              // payment.id es el documentId (mapeado arriba)
              router.push(`/billing/details/${payment.id}`);
            }}
            onDeletePayment={async (payment) => {
              const confirmed = await confirm({
                title: "¿Eliminar pago?",
                description: `¿Estás seguro de que deseas eliminar el pago ${payment.invoiceNumber}? Esta acción no se puede deshacer.`,
                confirmText: "Eliminar",
                cancelText: "Cancelar",
                variant: "destructive",
              });
              if (!confirmed) return;
              
              try {
                const response = await fetch(`/api/billing/${payment.id}`, {
                  method: "DELETE",
                });
                
                if (!response.ok) {
                  throw new Error("Error al eliminar el pago");
                }
                
                toast.success("Pago eliminado correctamente");
                fetchPayments(); // Refrescar lista
              } catch (err) {
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
                fetchPayments(); // Refrescar lista
                fetchFinancings(); // Refrescar financiamientos (saldo actualizado)
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Error al registrar el pago");
                throw err;
              }
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Simulate Overdue Modal */}
      <SimulateOverdueModal
        isOpen={overdueModalOpen}
        onClose={() => setOverdueModalOpen(false)}
        overdueData={overdueData}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar este {itemToDelete?.type === "financing" ? "financiamiento" : "pago"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar{" "}
              <strong>
                {itemToDelete?.type === "financing"
                  ? (itemToDelete.item as FinancingCardType).financingNumber
                  : (itemToDelete?.item as BillingRecordCard)?.receiptNumber || "este registro"}
              </strong>
              . Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
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
      
      {/* Diálogo de confirmación genérico */}
      <ConfirmDialogComponent />
    </AdminLayout>
  );
}
