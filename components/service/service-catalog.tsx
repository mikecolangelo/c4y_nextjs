"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { Plus, Wrench, ChevronRight, Loader2, CalendarPlus, Search, Trash2, Package } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { spacing, typography } from "@/lib/design-system";
import { toast } from "@/lib/toast";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { Badge } from "@/components_shadcn/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { ServiceCard, ServiceCoverage, InventoryItemRaw, ServiceTemplateItem } from "@/validations/types";

export function ServiceCatalog() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceCard[]>([]);
  const [filteredServices, setFilteredServices] = useState<ServiceCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form state
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceCoverage, setServiceCoverage] = useState<ServiceCoverage>("cliente");
  const [serviceDuration, setServiceDuration] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Template state
  const [templateItems, setTemplateItems] = useState<ServiceTemplateItem[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<InventoryItemRaw[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [templateSelectValue, setTemplateSelectValue] = useState("none");

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/services", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Services request failed");
      }
      const { data } = (await response.json()) as { data?: ServiceCard[] };
      const servicesData = Array.isArray(data) ? data : [];
      setServices(servicesData);
      setFilteredServices(servicesData);
    } catch (error) {
      console.error("Error loading services:", error);
      toast.error("No pudimos cargar los servicios. Intenta nuevamente.");
      setServices([]);
      setFilteredServices([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Cargar inventario cuando se abre el formulario
  useEffect(() => {
    if (!showAddForm) return;
    let cancelled = false;
    async function loadInventory() {
      setIsLoadingInventory(true);
      try {
        const res = await fetch("/api/inventory-items?pageSize=500", { cache: "no-store" });
        if (!res.ok) throw new Error("Error al cargar inventario");
        const payload = await res.json();
        const data = Array.isArray(payload?.data) ? payload.data : [];
        if (!cancelled) setInventoryOptions(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error("No se pudo cargar el inventario para la plantilla");
      } finally {
        if (!cancelled) setIsLoadingInventory(false);
      }
    }
    loadInventory();
    return () => { cancelled = true; };
  }, [showAddForm]);

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

    setTemplateItems((prev) => {
      const exists = prev.find((p) => p.inventoryItemId === String(inv.documentId ?? inv.id));
      if (exists) return prev;
      return [
        ...prev,
        {
          inventoryItemId: String(inv.documentId ?? inv.id),
          code: inv.code || "",
          description: inv.description || "",
          salePrice: Number(inv.salePrice ?? inv.unitCost ?? 0),
          quantity: 1,
        },
      ];
    });
    setTemplateSelectValue("none");
  }, [inventoryOptions]);

  const handleRemoveTemplateItem = useCallback((inventoryItemId: string) => {
    setTemplateItems((prev) => prev.filter((i) => i.inventoryItemId !== inventoryItemId));
  }, []);

  const handleQuantityChange = useCallback((inventoryItemId: string, value: string) => {
    const qty = parseFloat(value);
    if (isNaN(qty) || qty < 0) return;
    setTemplateItems((prev) => prev.map((i) => (i.inventoryItemId === inventoryItemId ? { ...i, quantity: qty } : i)));
  }, []);

  const handlePriceChange = useCallback((inventoryItemId: string, value: string) => {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) return;
    setTemplateItems((prev) => prev.map((i) => (i.inventoryItemId === inventoryItemId ? { ...i, salePrice: price } : i)));
  }, []);

  const templateSubtotal = useMemo(() => {
    return templateItems.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);
  }, [templateItems]);

  // Filtrar servicios por búsqueda
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredServices(services);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredServices(
        services.filter(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            s.description?.toLowerCase().includes(query) ||
            s.category?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, services]);

  const handleAddService = async () => {
    if (!serviceName.trim()) {
      toast.error("El nombre del servicio es requerido.");
      return;
    }

    const price = parseFloat(servicePrice) || 0;
    if (price < 0) {
      toast.error("El precio no puede ser negativo.");
      return;
    }

    setIsCreating(true);
    try {
      const payload: {
        name: string;
        price: number;
        coverage: ServiceCoverage;
        durationMinutes?: number;
        description?: string;
        defaultTemplate?: ServiceTemplateItem[];
      } = {
        name: serviceName.trim(),
        price,
        coverage: serviceCoverage,
        durationMinutes: serviceDuration ? parseInt(serviceDuration, 10) : undefined,
        description: serviceDescription || undefined,
      };

      if (templateItems.length > 0) {
        payload.defaultTemplate = templateItems;
      }

      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo crear el servicio");
      }

      toast.success("Servicio creado exitosamente");
      
      // Reset form
      setServiceName("");
      setServicePrice("");
      setServiceCoverage("cliente");
      setServiceDuration("");
      setServiceDescription("");
      setTemplateItems([]);
      setTemplateSelectValue("none");
      setShowAddForm(false);
      
      await loadServices();
    } catch (error) {
      console.error("Error creating service:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo crear el servicio");
    } finally {
      setIsCreating(false);
    }
  };

  const handleScheduleService = (service: ServiceCard) => {
    // Navegar al calendario con parámetros para pre-llenar
    const params = new URLSearchParams({
      serviceId: service.documentId || service.id,
      serviceName: service.name,
      fromService: "true",
    });
    router.push(`/adm-services?tab=calendar&${params.toString()}`);
  };

  // Helper: calcular precio total a mostrar
  const getDisplayPrice = (service: ServiceCard) => {
    const basePrice = Number(service.basePrice ?? service.price ?? 0);
    return basePrice;
  };

  return (
    <div className="space-y-4">
      {/* Búsqueda y botón agregar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar servicios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? "secondary" : "default"}
        >
          <Plus className="h-4 w-4 mr-2" />
          {showAddForm ? "Cancelar" : "Nuevo Servicio"}
        </Button>
      </div>

      {/* Formulario de agregar servicio */}
      {showAddForm && (
        <Card className="shadow-sm ring-1 ring-inset ring-border/50 border-l-4 border-l-primary">
          <CardHeader className={spacing.card.header}>
            <CardTitle className="text-base font-semibold">
              Añadir Nuevo Servicio al Catálogo
            </CardTitle>
          </CardHeader>
          <CardContent className={`flex flex-col ${spacing.gap.medium} ${spacing.card.content}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="service-name">
                  Nombre del Servicio <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="service-name"
                  placeholder="Ej: Alineación y Balanceo"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="service-price">Precio (USD)</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="service-price"
                    placeholder="0.00"
                    className="pl-7"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    disabled={isCreating}
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="service-coverage">Cobertura del coste</Label>
                <Select
                  value={serviceCoverage}
                  onValueChange={(value: ServiceCoverage) => setServiceCoverage(value)}
                  disabled={isCreating}
                >
                  <SelectTrigger id="service-coverage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Pagado por el cliente</SelectItem>
                    <SelectItem value="empresa">Cubierto por la empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="service-duration">Duración estimada (minutos)</Label>
                <Input
                  id="service-duration"
                  placeholder="Ej: 60"
                  value={serviceDuration}
                  onChange={(e) => setServiceDuration(e.target.value)}
                  disabled={isCreating}
                  type="number"
                  min="0"
                />
              </div>
            </div>

            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="service-description">Descripción</Label>
              <Input
                id="service-description"
                placeholder="Descripción del servicio..."
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                disabled={isCreating}
              />
            </div>

            {/* Plantilla de Repuestos */}
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Plantilla de Repuestos</Label>
              </div>

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Select
                  value={templateSelectValue}
                  onValueChange={(value) => {
                    if (value && value !== "none") {
                      handleAddTemplateItem(value);
                    }
                  }}
                  disabled={isCreating || isLoadingInventory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar repuesto..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>
                      {isLoadingInventory ? "Cargando inventario..." : "Seleccionar repuesto..."}
                    </SelectItem>
                    {availableInventory.map((item) => (
                      <SelectItem key={String(item.id)} value={String(item.documentId ?? item.id)}>
                        {item.code ? `${item.code} — ` : ""}
                        {item.description || "Sin descripción"}
                        {" "}(
                        {formatCurrency(Number(item.salePrice ?? item.unitCost ?? 0))}
                        {item.quantity != null ? ` · Stock: ${item.quantity}` : ""})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {templateItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No hay repuestos en la plantilla. Selecciona repuestos del inventario para agregarlos.
                  </p>
                ) : (
                  <div className="space-y-2 mt-2">
                    {templateItems.map((item) => (
                      <div
                        key={item.inventoryItemId}
                        className="flex items-center gap-2 p-2 rounded-md border bg-card"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.code ? `${item.code} — ` : ""}
                            {item.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex flex-col items-center">
                            <Label className="text-[10px] text-muted-foreground leading-none mb-0.5">Cantidad</Label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              className="w-16 h-7 text-xs px-1 text-center"
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(item.inventoryItemId, e.target.value)}
                              disabled={isCreating}
                            />
                          </div>
                          <div className="flex flex-col items-center">
                            <Label className="text-[10px] text-muted-foreground leading-none mb-0.5">Precio unit.</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-20 h-7 text-xs px-1 text-right"
                              value={item.salePrice}
                              onChange={(e) => handlePriceChange(item.inventoryItemId, e.target.value)}
                              disabled={isCreating}
                            />
                          </div>
                          <div className="flex flex-col items-center">
                            <Label className="text-[10px] text-muted-foreground leading-none mb-0.5">Total</Label>
                            <span className="w-20 h-7 flex items-center justify-end text-xs font-medium tabular-nums">
                              {formatCurrency(item.salePrice * item.quantity)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveTemplateItem(item.inventoryItemId)}
                            disabled={isCreating}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end pt-1">
                      <span className="text-sm font-semibold">
                        Subtotal Repuestos: {formatCurrency(templateSubtotal)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setTemplateItems([]);
                  setTemplateSelectValue("none");
                }}
                disabled={isCreating}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                onClick={handleAddService}
                disabled={isCreating || !serviceName.trim()}
                className="flex-1"
              >
                {isCreating ? (
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {isCreating ? "Creando..." : "Crear Servicio"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de servicios */}
      <Card className="shadow-sm ring-1 ring-inset ring-border/50">
        <CardHeader className={spacing.card.header}>
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Catálogo de Servicios</span>
            <span className={`${typography.body.small} text-muted-foreground font-normal`}>
              {filteredServices.length} servicio{filteredServices.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className={`flex flex-col ${spacing.gap.base} ${spacing.card.content}`}>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-card"
                >
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className={`${typography.body.base} text-muted-foreground`}>
                {searchQuery
                  ? "No se encontraron servicios que coincidan con la búsqueda"
                  : "No hay servicios registrados en el catálogo"}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir primer servicio
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredServices.map((service) => {
                const displayPrice = getDisplayPrice(service);
                return (
                  <div
                    key={service.id}
                    className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                    onClick={() =>
                      router.push(`/adm-services/details/${service.documentId}`)
                    }
                  >
                    {/* Icono */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Wrench className="h-5 w-5" />
                    </div>

                    {/* Nombre + categoría/cobertura */}
                    <div className="flex-1 min-w-0">
                      <p className={`${typography.body.base} font-medium truncate`}>
                        {service.name}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {service.category && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {service.category}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 ${
                            service.isFree
                              ? "border-green-300 text-green-700 bg-green-50"
                              : ""
                          }`}
                        >
                          {service.coverageLabel}
                        </Badge>
                      </div>
                    </div>

                    {/* Precio */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {service.isFree ? "Gratuito" : formatCurrency(displayPrice)}
                      </p>
                      {service.durationMinutes ? (
                        <p className="text-[11px] text-muted-foreground">
                          {service.durationMinutes} min
                        </p>
                      ) : null}
                    </div>

                    {/* Flecha + acciones hover */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleScheduleService(service);
                        }}
                        title="Agendar servicio"
                      >
                        <CalendarPlus className="h-4 w-4" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
