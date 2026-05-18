"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components_shadcn/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components_shadcn/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components_shadcn/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components_shadcn/ui/dialog";
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
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { toast } from "sonner";

export interface CrudSelectOption {
  id: string;
  documentId?: string;
  name: string;
  description?: string;
}

interface CrudSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: CrudSelectOption[];
  onOptionsChange?: (options: CrudSelectOption[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  createLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
  disabled?: boolean;
  className?: string;
  apiEndpoint?: string;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
}

export function CrudSelect({
  value,
  onValueChange,
  options,
  onOptionsChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyText = "No se encontraron resultados.",
  createLabel = "Crear nuevo",
  editLabel = "Editar",
  deleteLabel = "Eliminar",
  disabled = false,
  className,
  apiEndpoint,
  allowCreate = true,
  allowEdit = true,
  allowDelete = true,
}: CrudSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [editingOption, setEditingOption] = React.useState<CrudSelectOption | null>(null);
  const [formData, setFormData] = React.useState({ name: "", description: "" });

  const selectedOption = options.find((option) => 
    option.id === value || option.documentId === value
  );

  const resetForm = () => {
    setFormData({ name: "", description: "" });
    setEditingOption(null);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    setLoading(true);
    try {
      if (apiEndpoint) {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Error al crear");
        }

        const { data } = await response.json();
        const newOption: CrudSelectOption = {
          id: String(data.id || data.documentId),
          documentId: data.documentId,
          name: data.name,
          description: data.description,
        };

        if (onOptionsChange) {
          onOptionsChange([...options, newOption]);
        }
        onValueChange(newOption.documentId || newOption.id);
        toast.success("Creado exitosamente");
      } else {
        // Modo local sin API
        const newOption: CrudSelectOption = {
          id: `local-${Date.now()}`,
          name: formData.name,
          description: formData.description,
        };
        if (onOptionsChange) {
          onOptionsChange([...options, newOption]);
        }
        onValueChange(newOption.id);
        toast.success("Creado exitosamente");
      }

      setCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingOption || !formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    setLoading(true);
    try {
      const optionId = editingOption.documentId || editingOption.id;

      if (apiEndpoint) {
        const response = await fetch(`${apiEndpoint}/${optionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Error al actualizar");
        }

        const { data } = await response.json();
        const updatedOptions = options.map((opt) =>
          (opt.id === editingOption.id || opt.documentId === editingOption.documentId)
            ? { ...opt, name: data.name, description: data.description }
            : opt
        );

        if (onOptionsChange) {
          onOptionsChange(updatedOptions);
        }
        toast.success("Actualizado exitosamente");
      } else {
        // Modo local sin API
        const updatedOptions = options.map((opt) =>
          opt.id === editingOption.id
            ? { ...opt, name: formData.name, description: formData.description }
            : opt
        );
        if (onOptionsChange) {
          onOptionsChange(updatedOptions);
        }
        toast.success("Actualizado exitosamente");
      }

      setEditDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingOption) return;

    setLoading(true);
    try {
      const optionId = editingOption.documentId || editingOption.id;

      if (apiEndpoint) {
        const response = await fetch(`${apiEndpoint}/${optionId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Error al eliminar");
        }
      }

      const updatedOptions = options.filter(
        (opt) => opt.id !== editingOption.id && opt.documentId !== editingOption.documentId
      );

      if (onOptionsChange) {
        onOptionsChange(updatedOptions);
      }

      // Si el elemento eliminado era el seleccionado, limpiar selección
      if (value === editingOption.id || value === editingOption.documentId) {
        onValueChange("");
      }

      toast.success("Eliminado exitosamente");
      setDeleteDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (option: CrudSelectOption, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOption(option);
    setFormData({ name: option.name, description: option.description || "" });
    setEditDialogOpen(true);
    setOpen(false);
  };

  const openDeleteDialog = (option: CrudSelectOption, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOption(option);
    setDeleteDialogOpen(true);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              className
            )}
          >
            {selectedOption?.name || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.name}
                    onSelect={() => {
                      onValueChange(option.documentId || option.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4",
                          (value === option.id || value === option.documentId)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{option.name}</span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {allowEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => openEditDialog(option, e)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {allowDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={(e) => openDeleteDialog(option, e)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {allowCreate && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        setCreateDialogOpen(true);
                      }}
                      className="text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {createLabel}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Dialog para crear */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createLabel}</DialogTitle>
            <DialogDescription>
              Ingresa los datos para crear un nuevo elemento.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre del tipo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción opcional"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editLabel}</DialogTitle>
            <DialogDescription>
              Modifica los datos del elemento.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre del tipo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción opcional"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog para eliminar */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará "{editingOption?.name}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetForm}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleteLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
