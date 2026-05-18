"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { Separator } from "@/components_shadcn/ui/separator";
import { 
  ArrowLeft, 
  MoreVertical, 
  Edit,
  Trash2,
  Banknote,
  Settings,
  Wrench,
  Loader2,
  Calculator,
  Save,
  AlertCircle,
  Package,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
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
import { spacing, typography } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/lib/format";
import type { ServiceCard, ServiceCoverage, InventoryItemRaw } from "@/validations/types";
import { ServiceDetailDialog } from "@/components/service-v2/service-detail-dialog";
import { CreateServiceOrderDialog } from "@/components/service-v2/create-service-order-dialog";

interface TemplateItemState {
  id: string;
  inventoryItemId: string;
  code: string;
  description: string;
  salePrice: number;
  quantity: number;
}

export default function AdmServicesDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = params.id as string;
  
  const [service, setService] = useState<ServiceCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
  const [orderPreset, setOrderPreset] = useState<{
    laborCost: number;
    usedItems: Array<{
      inventoryItemId: string | number;
      code: string;
      description: string;
      quantity: number;
      unitPriceAtMoment: number;
    }>;
  } | null>(null);
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    coverage: "cliente" as ServiceCoverage,
    description: "",
    category: "",
  });

  // ===== ESTADOS PARA PLANTILLA DE REPUESTOS =====
  const [templateItems, setTemplateItems] = useState<TemplateItemState[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<InventoryItemRaw[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateSelectValue, setTemplateSelectValue] = useState("none");
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const hasUserModifiedTemplate = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = userRole === "admin" || userRole === "super-admin";

  const loadService = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/services/${serviceId}`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 404) {
          setService(null);
          return;
        }
        throw new Error("Service request failed");
      }
      const { data } = (await response.json()) as { data?: ServiceCard };
      setService(data || null);
      if (data) {
        setFormData({
          name: data.name,
          price: data.isFree ? "" : String(data.price),
          coverage: data.coverage,
          description: data.description || "",
          category: data.category || "",
        });

        // Inicializar plantilla desde defaultTemplate o maintenanceKits
        if (data.defaultTemplate && data.defaultTemplate.length > 0) {
          setTemplateItems(
            data.defaultTemplate.map((t, idx) => ({
              id: `tpl-${idx}`,
              inventoryItemId: t.inventoryItemId,
              code: t.code,
              description: t.description,
              salePrice: t.salePrice,
              quantity: t.quantity,
            }))
          );
        } else if (data.maintenanceKits?.[0]?.kitItems) {
          setTemplateItems(
            data.maintenanceKits[0].kitItems.map((ki) => ({
              id: ki.id,
              inventoryItemId: ki.inventoryItem.id,
              code: ki.inventoryItem.code,
              description: ki.inventoryItem.description,
              salePrice: ki.inventoryItem.salePrice,
              quantity: ki.quantity,
            }))
          );
        } else {
          setTemplateItems([]);
        }
        // Resetear flag de modificacion para evitar autosave en carga inicial
        hasUserModifiedTemplate.current = false;
      }
    } catch (error) {
      console.error("Error loading service:", error);
      toast.error("No pudimos cargar el servicio. Intenta nuevamente.");
      setService(null);
    } finally {
      setIsLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    loadService();
  }, [loadService]);

  // Cargar rol del usuario actual
  useEffect(() => {
    let cancelled = false;
    async function loadUserRole() {
      try {
        const res = await fetch("/api/user-profile/me", { cache: "no-store" });
        if (!res.ok) return;
        const payload = await res.json();
        const roleName = payload?.data?.role;
        if (!cancelled && roleName) setUserRole(roleName);
      } catch (e) {
        console.error("Error loading user role:", e);
      }
    }
    loadUserRole();
    return () => { cancelled = true; };
  }, []);

  // Cargar inventario para la plantilla
  useEffect(() => {
    let cancelled = false;
    async function loadInventory() {
      setIsLoadingInventory(true);
      setInventoryError(null);
      try {
        const res = await fetch("/api/inventory-items?pageSize=500", { cache: "no-store" });
        if (!res.ok) throw new Error("Error al cargar inventario");
        const payload = await res.json();
        const data = Array.isArray(payload?.data) ? payload.data : [];
        if (!cancelled) setInventoryOptions(data);
      } catch (e) {
        if (!cancelled) {
          setInventoryError("No se pudo cargar el inventario. Intenta de nuevo.");
          console.error(e);
        }
      } finally {
        if (!cancelled) setIsLoadingInventory(false);
      }
    }
    loadInventory();
    return () => { cancelled = true; };
  }, []);

  const availableInventory = useMemo(() => {
    const usedIds = new Set(templateItems.map((i) => i.inventoryItemId));
    return inventoryOptions.filter(
      (opt) => !usedIds.has(String(opt.documentId ?? opt.id))
    );
  }, [inventoryOptions, templateItems]);

  const handleAddTemplateItem = useCallback((inventoryItemId: string) => {
    const inv = inventoryOptions.find(
      (i) => String(i.id) === inventoryItemId || String(i.documentId) === inventoryItemId
    );
    if (!inv) return;

    hasUserModifiedTemplate.current = true;
    setTemplateItems((prev) => {
      const exists = prev.find((p) => p.inventoryItemId === String(inv.documentId ?? inv.id));
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `tmp-${Date.now()}`,
          inventoryItemId: String(inv.documentId ?? inv.id),
          code: inv.code || "",
          description: inv.description || "",
          salePrice: Number(inv.salePrice ?? inv.unitCost ?? 0),
          quantity: 1,
        },
      ];
    });
    // Resetear el selector para que vuelva a mostrar el placeholder
    setTemplateSelectValue("none");
  }, [inventoryOptions]);

  const handleRemoveTemplateItem = useCallback((id: string) => {
    hasUserModifiedTemplate.current = true;
    setTemplateItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleQuantityChange = useCallback((id: string, value: string) => {
    const qty = parseFloat(value);
    if (isNaN(qty) || qty < 0) return;
    hasUserModifiedTemplate.current = true;
    setTemplateItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
  }, []);

  const handlePriceChange = useCallback((id: string, value: string) => {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) return;
    hasUserModifiedTemplate.current = true;
    setTemplateItems((prev) => prev.map((i) => (i.id === id ? { ...i, salePrice: price } : i)));
  }, []);

  // Autosave con debounce cuando el usuario modifica la plantilla
  useEffect(() => {
    if (!service || !hasUserModifiedTemplate.current) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    setAutoSaveStatus('idle');

    autoSaveTimeoutRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        const defaultTemplate = templateItems.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          code: item.code,
          description: item.description,
          quantity: item.quantity,
          salePrice: item.salePrice,
        }));

        const res = await fetch(`/api/services/${service.documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { defaultTemplate } }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al guardar");
        }

        const { data } = await res.json();
        setService(data);
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev)), 2000);
      } catch (e) {
        console.error(e);
        setAutoSaveStatus('error');
      }
    }, 800);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateItems, service]);

  const handleSaveTemplate = async (silent = false) => {
    if (!service) return;
    if (!silent) setIsSavingTemplate(true);
    if (silent) setAutoSaveStatus('saving');
    try {
      const defaultTemplate = templateItems.map((item) => ({
        inventoryItemId: item.inventoryItemId,
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        salePrice: item.salePrice,
      }));

      const res = await fetch(`/api/services/${service.documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { defaultTemplate } }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }

      const { data } = await res.json();
      setService(data);
      if (!silent) {
        toast.success("Plantilla de repuestos guardada exitosamente");
      } else {
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev)), 2000);
      }
    } catch (e) {
      console.error(e);
      if (!silent) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar la plantilla");
      } else {
        setAutoSaveStatus('error');
      }
    } finally {
      if (!silent) setIsSavingTemplate(false);
    }
  };

  const backButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => router.back()}
      className="h-10 w-10 flex items-center justify-center rounded-full"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );

  const handleSaveChanges = async () => {
    if (!formData.name.trim()) {
      toast.error("El nombre del servicio es requerido.");
      return;
    }

    const price = parseFloat(formData.price) || 0;
    if (price < 0) {
      toast.error("El precio no puede ser negativo.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            name: formData.name.trim(),
            price,
            coverage: formData.coverage,
            description: formData.description.trim() || undefined,
            category: formData.category.trim() || undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo actualizar el servicio");
      }

      toast.success("Servicio actualizado exitosamente");
      setIsEditing(false);
      await loadService();
    } catch (error) {
      console.error("Error updating service:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el servicio");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteService = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo eliminar el servicio");
      }

      toast.success("Servicio eliminado exitosamente");
      router.push("/adm-services");
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el servicio");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Cargando..." showFilterAction leftActions={backButton}>
        <section className={`flex flex-col ${spacing.gap.large}`}>
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardContent className="flex flex-col items-center gap-4 p-6">
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardHeader className="px-6 pt-6 pb-4">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-6 pb-6">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        </section>
      </AdminLayout>
    );
  }

  if (!service) {
    return (
      <AdminLayout title="Servicio no encontrado" showFilterAction leftActions={backButton}>
        <section className={`flex flex-col items-center justify-center ${spacing.gap.base} min-h-[400px]`}>
          <p className={typography.body.large}>El servicio solicitado no existe.</p>
          <Button onClick={() => router.push("/adm-services")}>
            Volver a Servicios
          </Button>
        </section>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={service.name} showFilterAction leftActions={backButton}>
      <section className={`flex flex-col ${spacing.gap.large}`}>
        {/* Información del Servicio */}
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardContent className={`flex flex-col items-center ${spacing.gap.base} p-6 relative`}>
            {/* Botones de navegación */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full flex items-center justify-center"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full flex items-center justify-center">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[8rem]">
                  <DropdownMenuItem className="cursor-pointer" onClick={() => setIsEditing(true)}>
                    Editar Servicio
                  </DropdownMenuItem>
                    <DropdownMenuItem 
                    variant="destructive" 
                    className="cursor-pointer"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    Eliminar Servicio
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Icono */}
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mt-8">
              <Wrench className="h-6 w-6" />
            </div>

            {/* Nombre y Badge */}
            <div className="flex flex-col items-center text-center">
              <h2 className={`${typography.h3} text-center`}>
                {service.name}
              </h2>
              {service.category && (
                <p className={`${typography.body.small} mt-1 text-muted-foreground`}>
                  {service.category}
                </p>
              )}
              <div className="mt-2">
                <Badge className={`rounded-full px-3 py-1 text-xs font-medium ${
                  service.isFree ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                }`}>
                  {service.coverageLabel}
                </Badge>
              </div>
            </div>

            {/* Botones de acción */}
            <div className={`flex items-center justify-center ${spacing.gap.small} w-full pt-2`}>
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit className="h-5 w-5 flex-shrink-0" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-5 w-5 flex-shrink-0" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center"
                onClick={() => setShowDetailDialog(true)}
                title="Cotizar repuestos"
              >
                <Calculator className="h-5 w-5 flex-shrink-0" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Información Detallada */}
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle className={typography.h4}>Detalles del Servicio</CardTitle>
          </CardHeader>
          <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
            {isEditing ? (
              <>
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label htmlFor="name">Nombre del Servicio</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Cambio de Aceite"
                    disabled={isSaving}
                  />
                </div>
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label htmlFor="price">Precio (PAB)</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="price"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="pl-7"
                      placeholder="80.00"
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={isSaving}
                    />
                  </div>
                </div>
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label htmlFor="coverage">Cobertura del coste</Label>
                  <Select 
                    value={formData.coverage} 
                    onValueChange={(value: ServiceCoverage) => setFormData({ ...formData, coverage: value })}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="coverage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Pagado por el cliente</SelectItem>
                      <SelectItem value="empresa">Cubierto por la empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label htmlFor="category">Categoría</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Mantenimiento"
                    disabled={isSaving}
                  />
                </div>
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Descripción del servicio..."
                    disabled={isSaving}
                  />
                </div>
                <div className={`flex flex-col sm:flex-row ${spacing.gap.small} mt-2`}>
                  <Button
                    variant="default"
                    size="lg"
                    className="flex-1 min-h-[44px]"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="animate-spin mr-2" />
                        Guardando...
                      </>
                    ) : (
                      "Guardar Cambios"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1 min-h-[44px]"
                    onClick={() => {
                      setIsEditing(false);
                      if (service) {
                        setFormData({
                          name: service.name,
                          price: service.isFree ? "" : String(service.price),
                          coverage: service.coverage,
                          description: service.description || "",
                          category: service.category || "",
                        });
                      }
                    }}
                    disabled={isSaving}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className={`flex items-center ${spacing.gap.medium}`}>
                  <Banknote className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className={`${typography.body.small} text-muted-foreground`}>Precio</p>
                    <p className={`${typography.body.large} font-semibold ${
                      service.isFree ? "text-green-600" : ""
                    }`}>
                      {service.priceLabel}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center ${spacing.gap.medium}`}>
                  <Settings className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className={`${typography.body.small} text-muted-foreground`}>Cobertura</p>
                    <p className={typography.body.base}>{service.coverageLabel}</p>
                  </div>
                </div>
                {service.category && (
                  <div className={`flex items-center ${spacing.gap.medium}`}>
                    <Wrench className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className={`${typography.body.small} text-muted-foreground`}>Categoría</p>
                      <p className={typography.body.base}>{service.category}</p>
                    </div>
                  </div>
                )}
                {service.description && (
                  <div className={`flex items-start ${spacing.gap.medium} pt-2`}>
                    <div className="flex-1">
                      <p className={`${typography.body.small} text-muted-foreground`}>Descripción</p>
                      <p className={typography.body.base}>{service.description}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ===== NUEVA SECCIÓN: PLANTILLA DE REPUESTOS ===== */}
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className={typography.h4}>Plantilla de Repuestos</CardTitle>
              <div className="flex items-center gap-3">
                {autoSaveStatus === 'saving' && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Guardando...
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Guardado
                  </span>
                )}
                {autoSaveStatus === 'error' && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Error al guardar
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {templateItems.length} ítem{templateItems.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
            {/* Selector de repuestos */}
            <div>
              <Select
                value={templateSelectValue}
                onValueChange={(value) => {
                  setTemplateSelectValue(value);
                  if (value !== "none") handleAddTemplateItem(value);
                }}
                disabled={isLoadingInventory || availableInventory.length === 0}
              >
                <SelectTrigger className="h-10 text-sm w-full">
                  <SelectValue
                    placeholder={
                      isLoadingInventory
                        ? "Cargando inventario..."
                        : inventoryError
                        ? "Error al cargar"
                        : availableInventory.length === 0
                        ? "Sin repuestos disponibles"
                        : "Añadir repuesto del inventario..."
                    }
                  />
                </SelectTrigger>
                <SelectContent className="min-w-[320px] max-w-[90vw] w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="none">Seleccionar repuesto...</SelectItem>
                  {availableInventory.map((inv) => {
                    const itemPrice = Number(inv.salePrice ?? inv.unitCost ?? 0);
                    return (
                      <SelectItem
                        key={String(inv.id ?? inv.documentId)}
                        value={String(inv.documentId ?? inv.id)}
                        title={`${inv.code} — ${inv.description || ""}`}
                      >
                        <div className="flex items-center gap-2 w-full min-w-0">
                          <span className="font-medium shrink-0">{inv.code}</span>
                          <span className="text-muted-foreground truncate flex-1 min-w-0">
                            {inv.description}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {itemPrice > 0 ? `$${itemPrice.toFixed(2)}` : "$0.00"}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {inventoryError && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {inventoryError}
                </p>
              )}
            </div>

            {/* Lista de repuestos de la plantilla */}
            {templateItems.length === 0 ? (
              <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border">
                <Package className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Este servicio no tiene repuestos en su plantilla.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Añade repuestos desde el selector de arriba.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {templateItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 p-3 bg-muted/40 rounded-lg border border-border/50"
                  >
                    {/* Fila superior: código + descripción + eliminar */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" title={item.code}>
                          {item.code}
                        </p>
                        <p className="text-xs text-muted-foreground truncate" title={item.description}>
                          {item.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTemplateItem(item.id)}
                        className="p-1.5 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0 mt-0.5"
                        title="Eliminar repuesto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Fila inferior: cantidad, precio unitario, total */}
                    <div className="flex items-end gap-3">
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Cantidad
                        </Label>
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className="w-20 h-8 text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Precio unitario
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.salePrice}
                          onChange={(e) => handlePriceChange(item.id, e.target.value)}
                          className="w-full h-8 text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Total
                        </Label>
                        <p className="h-8 flex items-center text-sm font-semibold tabular-nums">
                          {formatCurrency(item.salePrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                <Separator />

                {/* Totales de la plantilla */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm text-muted-foreground">
                    Subtotal repuestos
                  </span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(
                      templateItems.reduce((sum, i) => sum + i.salePrice * i.quantity, 0)
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Botón guardar manual (fallback) */}
            <Button
              onClick={() => handleSaveTemplate(false)}
              disabled={isSavingTemplate}
              variant="outline"
              size="sm"
              className="w-full mt-2"
            >
              {isSavingTemplate ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar ahora
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Diálogo de cotización de repuestos */}
      <ServiceDetailDialog
        service={service}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        userRole={userRole}
        onTemplateSaved={async (updated) => {
          setService(updated);
          await loadService();
        }}
        onCreateOrder={(data) => {
          setOrderPreset({
            laborCost: data.laborCost,
            usedItems: data.usedItems.map((item) => ({
              inventoryItemId: item.inventoryItemId,
              code: item.code,
              description: item.description,
              quantity: item.quantity,
              unitPriceAtMoment: item.salePrice,
            })),
          });
          setShowCreateOrderDialog(true);
        }}
      />

      {/* Diálogo de creación de orden pre-poblado desde cotización */}
      <CreateServiceOrderDialog
        isOpen={showCreateOrderDialog}
        onOpenChange={setShowCreateOrderDialog}
        onSuccess={() => {
          toast.success("Orden creada y reflejada en el timeline de órdenes");
        }}
        preselectedService={
          service
            ? {
                id: service.id,
                documentId: service.documentId,
                name: service.name,
                price: service.price,
                durationMinutes: service.durationMinutes,
                defaultTemplate: service.defaultTemplate,
                maintenanceKits: service.maintenanceKits,
              }
            : undefined
        }
        preselectedLaborCost={orderPreset?.laborCost ?? service?.basePrice ?? service?.price ?? 0}
        preselectedUsedItems={
          orderPreset?.usedItems ??
          (service?.defaultTemplate && service.defaultTemplate.length > 0
            ? service.defaultTemplate.map((t) => ({
                inventoryItemId: t.inventoryItemId,
                code: t.code,
                description: t.description,
                quantity: t.quantity,
                unitPriceAtMoment: t.salePrice,
              }))
            : service?.maintenanceKits?.[0]?.kitItems
            ? service.maintenanceKits[0].kitItems.map((ki) => ({
                inventoryItemId: ki.inventoryItem.id,
                code: ki.inventoryItem.code,
                description: ki.inventoryItem.description,
                quantity: ki.quantity,
                unitPriceAtMoment: ki.inventoryItem.salePrice,
              }))
            : undefined)
        }
      />

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el servicio 
              <strong> {service.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteService}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
