"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import {
  MoreVertical,
  Edit,
  Trash2,
  Package,
  User,
  AlertCircle,
  CheckCircle,
  Filter,
  CircleDot,
  Zap,
  Wrench,
  Loader2,
  DollarSign,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import { spacing, typography } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import { BackButton } from "@/components/admin/back-button";
import { Can } from "@/components/auth/can";
import { toast } from "@/lib/toast";
import type { InventoryItemCard, StockStatus, InventoryIcon } from "@/validations/types";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface InventoryNote {
  id: number;
  documentId: string;
  content: string;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

// Maps a stock level to a semantic StatusBadge tone (in stock → success,
// medium → warning, low → danger).
const STOCK_STATUS_TONE: Record<StockStatus, StatusTone> = {
  high: "success",
  medium: "warning",
  low: "danger",
};

const getStockBadge = (status: StockStatus, stock: number) => {
  return <StatusBadge tone={STOCK_STATUS_TONE[status]}>Stock: {stock}</StatusBadge>;
};

const getIcon = (icon: InventoryIcon) => {
  switch (icon) {
    case "filter":
      return Filter;
    case "disc":
      return CircleDot;
    case "bolt":
      return Zap;
    case "tire":
      return Wrench;
  }
};

export default function StockDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [itemData, setItemData] = useState<InventoryItemCard | null>(null);
  const [notes, setNotes] = useState<InventoryNote[]>([]);
  const [note, setNote] = useState("");
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [formData, setFormData] = useState({
    stock: "",
    assignedTo: "",
    location: "",
    description: "",
    unitCost: "",
    salePrice: "",
  });

  const loadItem = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/inventory/${itemId}`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 404) {
          setItemData(null);
          return;
        }
        throw new Error("Failed to fetch inventory item");
      }
      const { data } = (await response.json()) as { data?: InventoryItemCard };
      setItemData(data || null);
      if (data) {
        setFormData({
          stock: data.stock.toString(),
          assignedTo: data.assignedTo || "",
          location: data.location || "",
          description: data.description,
          unitCost: data.unitCost !== undefined ? data.unitCost.toString() : "",
          salePrice: data.salePrice !== undefined ? data.salePrice.toString() : "",
        });
      }
    } catch (error) {
      console.error("Error loading inventory item:", error);
      toast.error("No pudimos cargar la información de la pieza.");
      setItemData(null);
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const backButton = <BackButton fallbackHref="/stock" />;

  const loadNotes = useCallback(async () => {
    if (!itemId) return;
    setIsLoadingNotes(true);
    try {
      const response = await fetch(`/api/inventory/${itemId}/notes`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch notes");
      }
      const { data } = await response.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading notes:", error);
      // No mostrar toast de error para no molestar al usuario
    } finally {
      setIsLoadingNotes(false);
    }
  }, [itemId]);

  useEffect(() => {
    if (itemId && !isLoading) {
      loadNotes();
    }
  }, [itemId, loadNotes, isLoading]);

  const handleSaveNote = async () => {
    if (!note.trim()) {
      toast.error("La nota no puede estar vacía");
      return;
    }

    setIsSavingNote(true);
    try {
      const response = await fetch(`/api/inventory/${itemId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: note.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar la nota");
      }

      const { data } = await response.json();
      setNotes((prev) => [data, ...prev]);
      toast.success("Nota guardada correctamente");
      setNote("");
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la nota");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (documentId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta nota?")) {
      return;
    }

    try {
      console.log("Eliminando nota con documentId:", documentId);
      const response = await fetch(`/api/inventory/notes/${documentId}`, {
        method: "DELETE",
        credentials: "include",
      });

      console.log("Respuesta del servidor:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error del servidor:", errorText);
        let errorMessage = "Error al eliminar la nota";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Si no es JSON, usar el texto como está
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      // Actualizar el estado inmediatamente
      setNotes((prev) => {
        const filtered = prev.filter((n) => n.documentId !== documentId);
        console.log("Notas filtradas:", filtered.length, "de", prev.length);
        return filtered;
      });

      toast.success("Nota eliminada correctamente");
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la nota");
    }
  };

  const formatNoteDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: es,
      });
    } catch {
      return dateString;
    }
  };

  const handleSaveChanges = async () => {
    if (!itemData) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/inventory/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            stock: parseInt(formData.stock, 10) || 0,
            assignedTo: formData.assignedTo || undefined,
            location: formData.location || undefined,
            description: formData.description,
            unitCost: formData.unitCost !== "" ? parseFloat(formData.unitCost) : undefined,
            salePrice: formData.salePrice !== "" ? parseFloat(formData.salePrice) : undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar los cambios");
      }

      const { data } = (await response.json()) as { data: InventoryItemCard };
      setItemData(data);
      setIsEditing(false);
      toast.success("Cambios guardados correctamente.");
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemData) return;

    if (!confirm("¿Estás seguro de que deseas eliminar esta pieza del inventario?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/inventory/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar la pieza");
      }

      toast.success("Pieza eliminada correctamente.");
      router.push("/stock");
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la pieza.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Cargando..." showFilterAction leftActions={backButton}>
        <section className={`flex flex-col ${spacing.gap.large}`}>
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardContent className={`flex flex-col items-center ${spacing.gap.base} p-6`}>
              <Skeleton className="h-16 w-16 rounded-lg mt-8" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </CardContent>
          </Card>
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardHeader className="px-6 pt-6 pb-4">
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`flex items-center ${spacing.gap.medium}`}>
                  <Skeleton className="h-5 w-5 rounded" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-24 mb-1" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </AdminLayout>
    );
  }

  if (!itemData) {
    return (
      <AdminLayout title="Pieza no encontrada" showFilterAction leftActions={backButton}>
        <section
          className={`flex flex-col items-center justify-center ${spacing.gap.base} min-h-[400px]`}
        >
          <p className={typography.body.large}>La pieza solicitada no existe.</p>
          <Button onClick={() => router.push("/stock")}>Volver a Inventario</Button>
        </section>
      </AdminLayout>
    );
  }

  const IconComponent = getIcon(itemData.icon);

  return (
    <AdminLayout title={itemData.code} showFilterAction leftActions={backButton}>
      <section className={`flex flex-col ${spacing.gap.large}`}>
        {/* Información de la Pieza */}
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardContent className={`flex flex-col items-center ${spacing.gap.base} p-6 relative`}>
            {/* Acciones de la pieza. La navegación "volver" vive en el menú
                (header), no en la tarjeta, para no duplicar el control. */}
            <div className="absolute top-4 right-4 flex items-center justify-end z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full flex items-center justify-center"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[8rem]">
                  <Can module="stock" action="canUpdate">
                    <DropdownMenuItem className="cursor-pointer" onClick={() => setIsEditing(true)}>
                      Editar Pieza
                    </DropdownMenuItem>
                  </Can>
                  <Can module="stock" action="canDelete">
                    <DropdownMenuItem
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Eliminando..." : "Eliminar Pieza"}
                    </DropdownMenuItem>
                  </Can>
                  <DropdownMenuItem className="cursor-pointer">Exportar Datos</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Icono */}
            <div
              className={`flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10 text-primary mt-8`}
            >
              <IconComponent className="h-8 w-8" />
            </div>

            {/* Código y Badge */}
            <div className="flex flex-col items-center text-center">
              <h2 className={`${typography.h3} text-center`}>{itemData.code}</h2>
              <p className={`${typography.body.small} mt-1 text-muted-foreground`}>
                {itemData.description}
              </p>
              <div className="mt-2">{getStockBadge(itemData.stockStatus, itemData.stock)}</div>
            </div>

            {/* Botones de acción */}
            <div className={`flex items-center justify-center ${spacing.gap.small} w-full pt-2`}>
              <Can module="stock" action="canUpdate">
                <Button
                  variant="default"
                  size="icon"
                  className="h-10 w-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center"
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={isSaving}
                >
                  <Edit className="h-5 w-5 flex-shrink-0" />
                </Button>
              </Can>
              <Can module="stock" action="canDelete">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Trash2 className="h-5 w-5 flex-shrink-0" />
                  )}
                </Button>
              </Can>
            </div>
          </CardContent>
        </Card>

        {/* Información Detallada */}
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle className={typography.h4}>Información del Inventario</CardTitle>
          </CardHeader>
          <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
            {isEditing ? (
              <>
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label htmlFor="stock">Stock Actual</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="50"
                    disabled={isSaving}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`flex flex-col ${spacing.gap.small}`}>
                    <Label htmlFor="unitCost">Costo Unitario</Label>
                    <Input
                      id="unitCost"
                      type="number"
                      step="0.01"
                      min={0}
                      value={formData.unitCost}
                      onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                      placeholder="25.50"
                      disabled={isSaving}
                    />
                  </div>
                  <div className={`flex flex-col ${spacing.gap.small}`}>
                    <Label htmlFor="salePrice">Precio de Venta</Label>
                    <Input
                      id="salePrice"
                      type="number"
                      step="0.01"
                      min={0}
                      value={formData.salePrice}
                      onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                      placeholder="45.00"
                      disabled={isSaving}
                    />
                  </div>
                </div>
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label htmlFor="assignedTo">Asignado a</Label>
                  <Input
                    id="assignedTo"
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    placeholder="Taller Mecánico"
                    disabled={isSaving}
                  />
                </div>
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label htmlFor="location">Ubicación</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Almacén A - Estante 3"
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
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                      if (itemData) {
                        setFormData({
                          stock: itemData.stock.toString(),
                          assignedTo: itemData.assignedTo || "",
                          location: itemData.location || "",
                          description: itemData.description,
                          unitCost:
                            itemData.unitCost !== undefined ? itemData.unitCost.toString() : "",
                          salePrice:
                            itemData.salePrice !== undefined ? itemData.salePrice.toString() : "",
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
                  <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className={`${typography.body.small} text-muted-foreground`}>Stock Actual</p>
                    <p className={`${typography.body.large} font-semibold`}>
                      {itemData.stock} {itemData.unit || "unidades"}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center ${spacing.gap.medium}`}>
                  <DollarSign className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className={`${typography.body.small} text-muted-foreground`}>Precios</p>
                    <div className="flex gap-4">
                      <p className={typography.body.base}>
                        Costo:{" "}
                        <span className="font-semibold">
                          {itemData.unitCost !== undefined
                            ? `B/. ${itemData.unitCost.toFixed(2)}`
                            : "No configurado"}
                        </span>
                      </p>
                      <p className={typography.body.base}>
                        Venta:{" "}
                        <span className="font-semibold text-primary">
                          {itemData.salePrice !== undefined
                            ? `B/. ${itemData.salePrice.toFixed(2)}`
                            : "No configurado"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                {itemData.minStock !== undefined && (
                  <div className={`flex items-center ${spacing.gap.medium}`}>
                    <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className={`${typography.body.small} text-muted-foreground`}>
                        Stock Mínimo
                      </p>
                      <p className={typography.body.base}>
                        {itemData.minStock} {itemData.unit || "unidades"}
                      </p>
                    </div>
                  </div>
                )}
                {itemData.maxStock !== undefined && (
                  <div className={`flex items-center ${spacing.gap.medium}`}>
                    <CheckCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className={`${typography.body.small} text-muted-foreground`}>
                        Stock Máximo
                      </p>
                      <p className={typography.body.base}>
                        {itemData.maxStock} {itemData.unit || "unidades"}
                      </p>
                    </div>
                  </div>
                )}
                {itemData.assignedTo && (
                  <div className={`flex items-center ${spacing.gap.medium}`}>
                    <User className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className={`${typography.body.small} text-muted-foreground`}>Asignado a</p>
                      <p className={typography.body.base}>{itemData.assignedTo}</p>
                    </div>
                  </div>
                )}
                {itemData.location && (
                  <div className={`flex items-center ${spacing.gap.medium}`}>
                    <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className={`${typography.body.small} text-muted-foreground`}>Ubicación</p>
                      <p className={typography.body.base}>{itemData.location}</p>
                    </div>
                  </div>
                )}
                {itemData.supplier && (
                  <div className={`flex items-center ${spacing.gap.medium}`}>
                    <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className={`${typography.body.small} text-muted-foreground`}>Proveedor</p>
                      <p className={typography.body.base}>{itemData.supplier}</p>
                    </div>
                  </div>
                )}
                {itemData.lastRestocked && (
                  <div className={`flex items-center ${spacing.gap.medium}`}>
                    <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className={`${typography.body.small} text-muted-foreground`}>
                        Última Reposición
                      </p>
                      <p className={typography.body.base}>
                        {new Date(itemData.lastRestocked).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Notas y Comentarios */}
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle className={typography.h4}>Notas y Comentarios</CardTitle>
          </CardHeader>
          <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
            {/* Lista de notas existentes */}
            {isLoadingNotes ? (
              <div className={`flex flex-col ${spacing.gap.base}`}>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : notes.length > 0 ? (
              <div className={`flex flex-col ${spacing.gap.medium} max-h-60 overflow-y-auto mb-4`}>
                {notes.map((noteItem) => (
                  <div
                    key={noteItem.id}
                    className="group flex flex-col gap-1 rounded-lg bg-muted/50 p-3"
                  >
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {noteItem.content}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{noteItem.authorName || "Usuario"}</span>
                      <div className="flex items-center gap-2">
                        <span>{formatNoteDate(noteItem.createdAt)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteNote(noteItem.documentId)}
                          className="size-7 text-destructive opacity-0 transition-opacity hover:text-destructive/80 group-hover:opacity-100"
                          title="Eliminar nota"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Formulario para nueva nota */}
            <Textarea
              placeholder="Añadir una nota sobre la pieza..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="min-h-20 resize-y"
              disabled={isSavingNote}
            />
            <Button
              onClick={handleSaveNote}
              variant="default"
              disabled={!note.trim() || isSavingNote}
            >
              {isSavingNote ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Nota"
              )}
            </Button>
          </CardContent>
        </Card>
      </section>
    </AdminLayout>
  );
}
