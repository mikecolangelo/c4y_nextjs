"use client";

import { useState } from "react";
import { Button } from "@/components_shadcn/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components_shadcn/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components_shadcn/ui/table";
import { MoreHorizontal, Plus, Pencil, Trash2, Settings, ArrowUp, ArrowDown } from "lucide-react";
import { spacing, typography } from "@/lib/design-system";
import type { VehicleDocumentCategory } from "@/validations/types";

interface DocumentCategoryManagerProps {
  categories: VehicleDocumentCategory[];
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  onCreate: (data: { name: string; description?: string; isActive: boolean; order: number }) => Promise<void>;
  onUpdate: (id: string | number, data: { name?: string; description?: string; isActive?: boolean; order?: number }) => Promise<void>;
  onDelete: (id: string | number) => Promise<void>;
}

export function DocumentCategoryManager({
  categories,
  isLoading,
  isCreating,
  isUpdating,
  isDeleting,
  onCreate,
  onUpdate,
  onDelete,
}: DocumentCategoryManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<VehicleDocumentCategory | null>(null);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formOrder, setFormOrder] = useState(0);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
    setFormOrder(categories.length);
    setSelectedCategory(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setFormOrder(categories.length);
    setIsCreateDialogOpen(true);
  };

  const handleOpenEdit = (category: VehicleDocumentCategory) => {
    setSelectedCategory(category);
    setFormName(category.name);
    setFormDescription(category.description || "");
    setFormIsActive(category.isActive);
    setFormOrder(category.order);
    setIsEditDialogOpen(true);
  };

  const handleOpenDelete = (category: VehicleDocumentCategory) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;

    await onCreate({
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      isActive: formIsActive,
      order: formOrder,
    });

    setIsCreateDialogOpen(false);
    resetForm();
  };

  const handleUpdate = async () => {
    if (!selectedCategory || !formName.trim()) return;

    await onUpdate(selectedCategory.documentId || selectedCategory.id, {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      isActive: formIsActive,
      order: formOrder,
    });

    setIsEditDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    await onDelete(selectedCategory.documentId || selectedCategory.id);

    setIsDeleteDialogOpen(false);
    resetForm();
  };

  const handleMoveOrder = async (category: VehicleDocumentCategory, direction: 'up' | 'down') => {
    const newOrder = direction === 'up'
      ? Math.max(0, category.order - 1)
      : category.order + 1;

    await onUpdate(category.documentId || category.id, { order: newOrder });
  };

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <Settings className="h-4 w-4" />
          Gestionar Categorías
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={typography.h4}>Gestionar Categorías de Documentos</DialogTitle>
          <DialogDescription>
            Administra las categorías de documentos disponibles para los vehículos. Puedes crear, editar, activar/desactivar y eliminar categorías.
          </DialogDescription>
        </DialogHeader>

        <div className={`flex flex-col ${spacing.gap.base} mt-4`}>
          <div className="flex justify-end">
            <Button onClick={handleOpenCreate} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Nueva Categoría
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando categorías...
            </div>
          ) : sortedCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay categorías configuradas.
              <br />
              Haz clic en &quot;Nueva Categoría&quot; para crear una.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Orden</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-24 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map((category, index) => (
                  <TableRow key={category.id} className={!category.isActive ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{category.order}</span>
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleMoveOrder(category, 'up')}
                            disabled={isUpdating || index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleMoveOrder(category, 'down')}
                            disabled={isUpdating || index === sortedCategories.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{category.name}</span>
                        {category.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {category.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        category.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {category.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(category)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onUpdate(category.documentId || category.id, { isActive: !category.isActive })}
                            disabled={isUpdating}
                          >
                            {category.isActive ? "Desactivar" : "Activar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenDelete(category)}
                            className="text-destructive focus:text-destructive"
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Dialog de crear */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Categoría de Documento</DialogTitle>
            <DialogDescription>
              Crea una nueva categoría de documento para los vehículos.
            </DialogDescription>
          </DialogHeader>

          <div className={`flex flex-col ${spacing.gap.base} py-4`}>
            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: Seguro Obligatorio"
              />
            </div>

            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descripción opcional de la categoría"
                rows={3}
              />
            </div>

            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="order">Orden</Label>
              <Input
                id="order"
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={formIsActive}
                onCheckedChange={(checked) => setFormIsActive(checked === true)}
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Activa (disponible para selección)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formName.trim() || isCreating}
            >
              {isCreating ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de editar */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoría de Documento</DialogTitle>
            <DialogDescription>
              Modifica los datos de la categoría de documento.
            </DialogDescription>
          </DialogHeader>

          <div className={`flex flex-col ${spacing.gap.base} py-4`}>
            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="edit-name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: Seguro Obligatorio"
              />
            </div>

            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descripción opcional de la categoría"
                rows={3}
              />
            </div>

            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="edit-order">Orden</Label>
              <Input
                id="edit-order"
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-isActive"
                checked={formIsActive}
                onCheckedChange={(checked) => setFormIsActive(checked === true)}
              />
              <Label htmlFor="edit-isActive" className="cursor-pointer">
                Activa (disponible para selección)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formName.trim() || isUpdating}
            >
              {isUpdating ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de eliminar */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Categoría de Documento</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la categoría{" "}
              <strong>{selectedCategory?.name}</strong>?
              <br /><br />
              <span className="text-destructive">
                Esta acción no se puede deshacer. Los documentos existentes de esta categoría no se eliminarán,
                pero no podrás crear nuevos documentos con esta categoría.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
