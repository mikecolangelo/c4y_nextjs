"use client";

import { SearchInput } from "@/components/ui/search-input";
import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import { Badge } from "@/components_shadcn/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components_shadcn/ui/tabs";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import {
  MoreVertical,
  Filter,
  CircleDot,
  Zap,
  Wrench,
  ChevronRight,
  Package,
  ClipboardList,
  CheckCircle,
  XCircle,
  Truck,
  Clock,
  AlertCircle,
  Plus,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { commonClasses, spacing, typography } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Can } from "@/components/auth/can";
import { toast } from "@/lib/toast";
import type { InventoryItemCard, StockStatus, InventoryIcon } from "@/validations/types";
import type { InventoryRequestCard } from "@/validations/inventory-request-types";
import {
  AddInventoryItemButton,
  CreateInventoryItemDialog,
  CreateInventoryItemFormData,
} from "./components/stock-dialogs";
import { CreateInventoryRequestDialog } from "./components/inventory-request-dialogs";

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

const createInitialFormData = (): CreateInventoryItemFormData => ({
  code: "",
  description: "",
  stock: "",
  minStock: "",
  maxStock: "",
  unit: "",
  assignedTo: "",
  location: "",
  supplier: "",
  icon: "filter",
  unitCost: "",
  salePrice: "",
});

// Maps a stock level to a semantic StatusBadge tone (in stock → success,
// medium → warning, low → danger).
const STOCK_STATUS_TONE: Record<StockStatus, StatusTone> = {
  high: "success",
  medium: "warning",
  low: "danger",
};

const getStockBadge = (status: StockStatus, stock: number, unit?: string) => {
  const label = unit ? `${stock} ${unit}` : `Stock: ${stock}`;
  return <StatusBadge tone={STOCK_STATUS_TONE[status]}>{label}</StatusBadge>;
};

const getIcon = (icon: InventoryIcon) => {
  switch (icon) {
    case "filter":
      return <Filter className="h-6 w-6" />;
    case "disc":
      return <CircleDot className="h-6 w-6" />;
    case "bolt":
      return <Zap className="h-6 w-6" />;
    case "tire":
      return <Wrench className="h-6 w-6" />;
  }
};

// Maps a request status to its semantic tone, icon and label so every status
// pill is rendered through the shared StatusBadge.
const REQUEST_STATUS_CONFIG: Record<
  string,
  { tone: StatusTone; icon: typeof Clock; label: string }
> = {
  pendiente: { tone: "warning", icon: Clock, label: "Pendiente" },
  aprobado: { tone: "info", icon: CheckCircle, label: "Aprobado" },
  rechazado: { tone: "danger", icon: XCircle, label: "Rechazado" },
  entregado: { tone: "success", icon: Truck, label: "Entregado" },
  cancelado: { tone: "neutral", icon: AlertCircle, label: "Cancelado" },
};

const getStatusBadge = (status: string) => {
  const config = REQUEST_STATUS_CONFIG[status];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <StatusBadge tone={config.tone}>
      <Icon />
      {config.label}
    </StatusBadge>
  );
};

export default function StockPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("catalog");
  const [searchQuery, setSearchQuery] = useState("");

  // Estados para items
  const [items, setItems] = useState<InventoryItemCard[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  // Estados para solicitudes
  const [requests, setRequests] = useState<InventoryRequestCard[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  // Estados para diálogo de crear item
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [formData, setFormData] = useState<CreateInventoryItemFormData>(() =>
    createInitialFormData()
  );

  // Estados para diálogo de crear solicitud
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);

  // Estados para menú de opciones y diálogo de eliminar
  const [itemToDelete, setItemToDelete] = useState<InventoryItemCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch("/api/user-profile/me", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          setRole(data.data?.role || null);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };
    fetchUserRole();
  }, []);

  const canManageRequests = useMemo(() => ["admin"].includes(role || ""), [role]);

  const loadItems = useCallback(async () => {
    setIsLoadingItems(true);
    try {
      const response = await fetch("/api/inventory-items", {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch inventory items");
      const result = (await response.json()) as { data?: InventoryItemCard[] };
      setItems(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error("Error loading inventory items:", error);
      toast.error("No pudimos cargar el catálogo de piezas.");
      setItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const response = await fetch("/api/inventory-requests", {
        cache: "no-store",
        headers: {
          "x-user-role": role || "",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch inventory requests");
      const result = (await response.json()) as { data?: InventoryRequestCard[] };
      setRequests(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error("Error loading inventory requests:", error);
      toast.error("No pudimos cargar las solicitudes de piezas.");
      setRequests([]);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [role]);

  useEffect(() => {
    loadItems();
    loadRequests();
  }, [loadItems, loadRequests]);

  const filteredItems = items.filter(
    (item) =>
      item.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRequests = requests.filter(
    (request) =>
      request.justification?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.inventoryItemCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.inventoryItemDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.requestNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.requesterName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isFormValid = useMemo(() => {
    const stock = Number(formData.stock);
    return (
      formData.code.trim() !== "" &&
      formData.description.trim() !== "" &&
      formData.stock.trim() !== "" &&
      !isNaN(stock) &&
      stock >= 0
    );
  }, [formData]);

  const resetForm = () => {
    setFormData(createInitialFormData());
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsItemDialogOpen(open);
    if (!open) resetForm();
  };

  const handleCancelCreateDialog = () => {
    setIsItemDialogOpen(false);
    resetForm();
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/inventory/${itemToDelete.documentId ?? itemToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo eliminar la pieza");
      }
      toast.success("Pieza eliminada exitosamente");
      setItemToDelete(null);
      await loadItems();
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la pieza");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateItem = async () => {
    if (!formData.code || !formData.description || !formData.stock) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }
    const stock = Number(formData.stock);
    if (isNaN(stock) || stock < 0) {
      toast.error("El stock debe ser un número válido mayor o igual a 0");
      return;
    }
    if (formData.minStock && (isNaN(Number(formData.minStock)) || Number(formData.minStock) < 0)) {
      toast.error("El stock mínimo debe ser un número válido mayor o igual a 0");
      return;
    }
    if (formData.maxStock && (isNaN(Number(formData.maxStock)) || Number(formData.maxStock) < 0)) {
      toast.error("El stock máximo debe ser un número válido mayor o igual a 0");
      return;
    }
    if (formData.unitCost && (isNaN(Number(formData.unitCost)) || Number(formData.unitCost) < 0)) {
      toast.error("El costo unitario debe ser un número válido mayor o igual a 0");
      return;
    }
    if (
      formData.salePrice &&
      (isNaN(Number(formData.salePrice)) || Number(formData.salePrice) < 0)
    ) {
      toast.error("El precio de venta debe ser un número válido mayor o igual a 0");
      return;
    }

    setIsCreatingItem(true);
    try {
      const payload = {
        code: formData.code,
        description: formData.description,
        stock: stock,
        minStock: formData.minStock ? Number(formData.minStock) : undefined,
        maxStock: formData.maxStock ? Number(formData.maxStock) : undefined,
        unit: formData.unit || undefined,
        assignedTo: formData.assignedTo || undefined,
        location: formData.location || undefined,
        supplier: formData.supplier || undefined,
        icon: formData.icon,
        unitCost: formData.unitCost ? Number(formData.unitCost) : undefined,
        salePrice: formData.salePrice ? Number(formData.salePrice) : undefined,
      };
      const response = await fetch("/api/inventory", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo crear la pieza");
      }
      const { data } = (await response.json()) as { data: InventoryItemCard };
      toast.success("Pieza creada exitosamente");
      setIsItemDialogOpen(false);
      resetForm();
      await loadItems();
      router.push(`/stock/details/${data.documentId ?? data.id}`);
    } catch (error) {
      console.error("Error creating inventory item:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo crear la pieza");
    } finally {
      setIsCreatingItem(false);
    }
  };

  const handleCreateRequest = async (formData: {
    inventoryItem: string;
    quantity: string;
    unit: string;
    justification: string;
  }) => {
    setIsCreatingRequest(true);
    try {
      const payload = {
        inventoryItem: formData.inventoryItem,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        justification: formData.justification,
      };
      const response = await fetch("/api/inventory-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo crear la solicitud");
      }
      toast.success("Solicitud creada exitosamente");
      setIsRequestDialogOpen(false);
      await loadRequests();
      setActiveTab("requests");
    } catch (error) {
      console.error("Error creating inventory request:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo crear la solicitud");
    } finally {
      setIsCreatingRequest(false);
    }
  };

  const handleApproveRequest = async (id: string, notes?: string) => {
    try {
      const response = await fetch(`/api/inventory-requests/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": role || "",
        },
        body: JSON.stringify({ data: { notes } }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo aprobar la solicitud");
      }
      toast.success("Solicitud aprobada exitosamente");
      await loadRequests();
      await loadItems();
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo aprobar la solicitud");
    }
  };

  const handleRejectRequest = async (id: string, notes?: string) => {
    try {
      const response = await fetch(`/api/inventory-requests/${id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": role || "",
        },
        body: JSON.stringify({ data: { notes } }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo rechazar la solicitud");
      }
      toast.success("Solicitud rechazada");
      await loadRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo rechazar la solicitud");
    }
  };

  const handleDeliverRequest = async (id: string) => {
    try {
      const response = await fetch(`/api/inventory-requests/${id}/deliver`, {
        method: "POST",
        headers: {
          "x-user-role": role || "",
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo marcar como entregado");
      }
      toast.success("Solicitud marcada como entregada");
      await loadRequests();
    } catch (error) {
      console.error("Error delivering request:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo marcar como entregado");
    }
  };

  return (
    <AdminLayout title="Inventario de Piezas" showFilterAction>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Catálogo de Piezas
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Solicitudes de Piezas
            {requests.filter((r) => r.status === "pendiente").length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {requests.filter((r) => r.status === "pendiente").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mb-6">
          <SearchInput
            variant="muted"
            placeholder="Buscar por código, descripción, justificación..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <TabsContent value="catalog" className="mt-0">
          <div className={`flex flex-col ${spacing.gap.base}`}>
            {isLoadingItems ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className={commonClasses.card}>
                  <CardContent className={spacing.card.padding}>
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : filteredItems.length === 0 ? (
              <p className={`${typography.body.base} text-muted-foreground text-center py-8`}>
                {searchQuery ? "No se encontraron resultados." : "No hay piezas en el inventario."}
              </p>
            ) : (
              filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className={`${commonClasses.card} cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted`}
                  onClick={() => router.push(`/stock/details/${item.documentId}`)}
                >
                  <CardContent className={spacing.card.padding}>
                    <div className={`flex flex-col ${spacing.gap.medium} justify-between`}>
                      <div className="flex items-start gap-4">
                        <div className="text-muted-foreground flex items-center justify-center rounded-lg bg-muted shrink-0 size-12">
                          {getIcon(item.icon)}
                        </div>
                        <div className="flex flex-1 flex-col justify-center min-w-0">
                          <p className={`${typography.body.large} font-bold`}>{item.description}</p>
                          <p className={typography.body.base}>{item.code}</p>
                          {item.assignedTo && (
                            <p className={`${typography.body.small} mt-1`}>
                              Asignado a: {item.assignedTo}
                            </p>
                          )}
                          {item.salePrice !== undefined && item.salePrice > 0 && (
                            <p
                              className={`${typography.body.small} mt-1 font-semibold text-primary`}
                            >
                              Precio: B/. {item.salePrice.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-muted-foreground flex items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <MoreVertical className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem
                                onClick={() => router.push(`/stock/details/${item.documentId}`)}
                              >
                                Ver detalles
                              </DropdownMenuItem>
                              <Can module="stock" action="canUpdate">
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/stock/details/${item.documentId}?edit=true`)
                                  }
                                >
                                  Editar
                                </DropdownMenuItem>
                              </Can>
                              <Can module="stock" action="canDelete">
                                <DropdownMenuItem
                                  onClick={() => setItemToDelete(item)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  Eliminar
                                </DropdownMenuItem>
                              </Can>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        {getStockBadge(item.stockStatus, item.stock, item.unit)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-0">
          <div className={`flex flex-col ${spacing.gap.base}`}>
            {isLoadingRequests ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className={commonClasses.card}>
                  <CardContent className={spacing.card.padding}>
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-48 mb-1" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : filteredRequests.length === 0 ? (
              <p className={`${typography.body.base} text-muted-foreground text-center py-8`}>
                {searchQuery ? "No se encontraron resultados." : "No hay solicitudes registradas."}
              </p>
            ) : (
              filteredRequests.map((request) => (
                <Card
                  key={request.id}
                  className={`${commonClasses.card} transition-colors hover:bg-muted/50`}
                >
                  <CardContent className={spacing.card.padding}>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-4">
                        <div className="text-muted-foreground flex items-center justify-center rounded-lg bg-muted shrink-0 size-12">
                          <Package className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`${typography.body.large} font-bold`}>
                              {request.quantity} {request.unit} de{" "}
                              {request.inventoryItemDescription || request.inventoryItemCode}
                            </p>
                            {request.requestNumber && (
                              <span className="text-xs text-muted-foreground">
                                #{request.requestNumber}
                              </span>
                            )}
                          </div>
                          <p className={typography.body.small}>
                            Solicitado por: {request.requesterName || "Desconocido"}
                          </p>
                          <p className={`${typography.body.small} text-muted-foreground truncate`}>
                            {request.justification}
                          </p>
                          <p className={`${typography.body.small} text-muted-foreground mt-1`}>
                            {request.requestedAtLabel}
                          </p>
                        </div>
                        <div className="shrink-0">{getStatusBadge(request.status)}</div>
                      </div>

                      {/* Acciones para admin */}
                      {canManageRequests && request.canApprove && (
                        <div className="flex gap-2 justify-end pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleRejectRequest(
                                request.id,
                                "Solicitud rechazada por administrador"
                              )
                            }
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rechazar
                          </Button>
                          <Button size="sm" onClick={() => handleApproveRequest(request.id)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprobar
                          </Button>
                        </div>
                      )}

                      {canManageRequests && request.canDeliver && (
                        <div className="flex gap-2 justify-end pt-2 border-t">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleDeliverRequest(request.id)}
                          >
                            <Truck className="h-4 w-4 mr-1" />
                            Marcar Entregado
                          </Button>
                        </div>
                      )}

                      {request.status !== "pendiente" && (
                        <div className="pt-2 border-t">
                          {request.approvedByName && (
                            <p className={`${typography.body.small} text-muted-foreground`}>
                              {request.status === "rechazado" ? "Rechazado" : "Aprobado"} por:{" "}
                              {request.approvedByName}
                              {request.approvedAtLabel && ` • ${request.approvedAtLabel}`}
                            </p>
                          )}
                          {request.notes && (
                            <p className={`${typography.body.small} text-muted-foreground mt-1`}>
                              Notas: {request.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Botón flotante contextual */}
      <Can module="stock" action="canCreate">
        {activeTab === "catalog" ? (
          <AddInventoryItemButton onClick={() => setIsItemDialogOpen(true)} />
        ) : (
          <Button
            className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
            size="icon"
            onClick={() => setIsRequestDialogOpen(true)}
            aria-label="Solicitar pieza"
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}
      </Can>

      <CreateInventoryItemDialog
        isOpen={isItemDialogOpen}
        onOpenChange={handleDialogOpenChange}
        formData={formData}
        setFormData={setFormData}
        isCreating={isCreatingItem}
        isFormValid={isFormValid}
        onConfirm={handleCreateItem}
        onCancel={handleCancelCreateDialog}
      />

      <CreateInventoryRequestDialog
        isOpen={isRequestDialogOpen}
        onOpenChange={setIsRequestDialogOpen}
        isCreating={isCreatingRequest}
        onConfirm={handleCreateRequest}
        inventoryItems={items}
      />

      {/* Diálogo de confirmación para eliminar */}
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pieza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la pieza
              <strong>{itemToDelete ? ` "${itemToDelete.code}"` : ""}</strong> del inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)} disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
