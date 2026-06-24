"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { Badge } from "@/components_shadcn/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components_shadcn/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components_shadcn/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components_shadcn/ui/dialog";
import { Save, Loader2, ShieldCheck, Info, Plus, Pencil, Trash2 } from "lucide-react";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { ModulePermission } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

interface ModuleDefinition {
  key: string;
  label: string;
  path: string;
}

type FullMatrix = Record<string, Record<string, ModulePermission>>;

const ACTION_COLUMNS: { key: keyof ModulePermission; label: string }[] = [
  { key: "canAccess", label: "Acceso" },
  { key: "canRead", label: "Ver" },
  { key: "canCreate", label: "Crear" },
  { key: "canUpdate", label: "Editar" },
  { key: "canDelete", label: "Eliminar" },
];

/** Descripciones de los roles base; los personalizados usan su label. */
const BASE_ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Acceso total a todo el sistema (no editable).",
  driver: "Conductores: define qué pueden ver y gestionar.",
  lead: "Prospectos sin acceso al portal.",
};

const emptyPermission = (): ModulePermission => ({
  canAccess: false,
  canRead: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
});

interface RoleFormState {
  label: string;
  color: string;
}

export function PermissionsSettingsSection() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modules, setModules] = useState<ModuleDefinition[]>([]);
  const [matrix, setMatrix] = useState<FullMatrix>({});
  const [roles, setRoles] = useState<Role[]>([]);

  // Estado del diálogo de crear/editar rol.
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<RoleFormState>({ label: "", color: "" });
  const [isSavingRole, setIsSavingRole] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [matrixRes, rolesRes] = await Promise.all([
        fetch("/api/permissions/matrix", { cache: "no-store" }),
        fetch("/api/roles", { cache: "no-store" }),
      ]);
      if (!matrixRes.ok) throw new Error("No se pudo cargar la matriz");
      const matrixJson = await matrixRes.json();
      setMatrix(matrixJson.data?.matrix || {});
      setModules(matrixJson.data?.modules || []);

      const rolesJson = rolesRes.ok ? await rolesRes.json() : null;
      setRoles(Array.isArray(rolesJson?.data) ? rolesJson.data : []);
    } catch (error) {
      console.error("Error cargando permisos:", error);
      toast.error("Error al cargar los permisos");
    } finally {
      setIsLoading(false);
    }
  };

  // Tabs de roles dinámicos: solo roles activos, en el orden recibido del backend.
  const roleTabs = useMemo(() => roles.filter((r) => r.isActive), [roles]);

  const defaultTab = roleTabs.find((r) => r.key === "driver")?.key ?? roleTabs[0]?.key ?? "admin";

  const getPerm = (role: string, moduleKey: string): ModulePermission =>
    matrix[role]?.[moduleKey] ?? emptyPermission();

  const togglePermission = (
    role: string,
    moduleKey: string,
    field: keyof ModulePermission,
    value: boolean
  ) => {
    setMatrix((prev) => {
      const current = prev[role]?.[moduleKey] ?? emptyPermission();
      const updated: ModulePermission = { ...current, [field]: value };

      // Coherencia: si se quita el acceso, se limpian las demás acciones.
      if (field === "canAccess" && !value) {
        updated.canRead = false;
        updated.canCreate = false;
        updated.canUpdate = false;
        updated.canDelete = false;
      }
      // Si se concede cualquier acción, se asegura el acceso al módulo.
      if (field !== "canAccess" && value) {
        updated.canAccess = true;
      }

      return {
        ...prev,
        [role]: { ...prev[role], [moduleKey]: updated },
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/permissions/matrix", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || err?.error || "Error al guardar");
      }
      const json = await res.json();
      if (json.data?.matrix) setMatrix(json.data.matrix);
      toast.success("Permisos guardados correctamente");
    } catch (error) {
      console.error("Error guardando permisos:", error);
      toast.error(error instanceof Error ? error.message : "Error al guardar los permisos");
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Gestión de roles -----------------------------------------------------

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ label: "", color: "" });
    setRoleDialogOpen(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleForm({ label: role.label, color: role.color ?? "" });
    setRoleDialogOpen(true);
  };

  const handleSaveRole = async () => {
    const label = roleForm.label.trim();
    if (!label) {
      toast.error("El nombre del rol es obligatorio");
      return;
    }

    setIsSavingRole(true);
    try {
      const isEdit = Boolean(editingRole);
      const url = isEdit ? `/api/roles/${editingRole!.id}` : "/api/roles";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, color: roleForm.color.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || err?.error || "Error al guardar el rol");
      }
      toast.success(isEdit ? "Rol actualizado" : "Rol creado correctamente");
      setRoleDialogOpen(false);
      await loadAll();
    } catch (error) {
      console.error("Error guardando rol:", error);
      toast.error(error instanceof Error ? error.message : "Error al guardar el rol");
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!window.confirm(`¿Eliminar el rol "${role.label}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // El backend devuelve un 409 con el conteo de contactos cuando está en uso.
        const message = err?.error?.message || err?.error || "No se pudo eliminar el rol";
        throw new Error(message);
      }
      toast.success("Rol eliminado");
      await loadAll();
    } catch (error) {
      console.error("Error eliminando rol:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el rol");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn(typography.h3, "flex items-center gap-2")}>
          <ShieldCheck className="h-5 w-5" />
          Permisos por rol
        </CardTitle>
        <CardDescription>
          Crea roles personalizados y define qué módulos puede ver cada uno en el menú y qué
          acciones puede realizar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Panel de gestión de roles */}
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium">Roles del sistema</h4>
            <Button size="sm" variant="outline" onClick={openCreateRole} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo rol
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm"
              >
                {role.color && (
                  <span
                    className="size-3 rounded-full border"
                    style={{ backgroundColor: role.color }}
                    aria-hidden
                  />
                )}
                <span className="font-medium">{role.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{role.key}</span>
                {role.isSystem ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Sistema
                  </Badge>
                ) : (
                  <span className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => openEditRole(role)}
                      aria-label={`Editar ${role.label}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteRole(role)}
                      aria-label={`Eliminar ${role.label}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <Tabs value={defaultTab} className="w-full" key={defaultTab}>
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0 mb-4">
            {roleTabs.map((role) => (
              <TabsTrigger
                key={role.key}
                value={role.key}
                className="data-[state=active]:bg-primary/10"
              >
                {role.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {roleTabs.map((role) => {
            const isAdmin = role.key === "admin";
            const description =
              BASE_ROLE_DESCRIPTIONS[role.key] ?? `Permisos para el rol "${role.label}".`;
            return (
              <TabsContent key={role.key} value={role.key} className="flex flex-col gap-3">
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                  <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>

                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">Módulo</TableHead>
                        {ACTION_COLUMNS.map((col) => (
                          <TableHead key={col.key} className="text-center">
                            {col.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modules.map((mod) => {
                        const perm = isAdmin
                          ? {
                              canAccess: true,
                              canRead: true,
                              canCreate: true,
                              canUpdate: true,
                              canDelete: true,
                            }
                          : getPerm(role.key, mod.key);
                        return (
                          <TableRow key={mod.key}>
                            <TableCell className="font-medium">
                              {mod.label}
                              <span className="ml-2 text-xs text-muted-foreground font-mono">
                                {mod.key}
                              </span>
                            </TableCell>
                            {ACTION_COLUMNS.map((col) => (
                              <TableCell key={col.key} className="text-center">
                                <Checkbox
                                  checked={perm[col.key]}
                                  disabled={isAdmin}
                                  onCheckedChange={(v) =>
                                    togglePermission(role.key, mod.key, col.key, v === true)
                                  }
                                  aria-label={`${mod.label} ${col.label}`}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {isAdmin && (
                  <Badge variant="secondary" className="w-fit">
                    El administrador siempre tiene acceso total
                  </Badge>
                )}
              </TabsContent>
            );
          })}
        </Tabs>

        <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Guardar permisos
        </Button>
      </CardContent>

      {/* Diálogo de crear/editar rol */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Editar rol" : "Nuevo rol"}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Actualiza el nombre o el color del rol."
                : "Crea un rol personalizado. La clave se genera a partir del nombre."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-label">Nombre del rol *</Label>
              <Input
                id="role-label"
                placeholder="Ej: Taller"
                value={roleForm.label}
                onChange={(e) => setRoleForm((prev) => ({ ...prev, label: e.target.value }))}
                disabled={isSavingRole}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-color">Color (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="role-color"
                  type="color"
                  className="h-9 w-14 p-1"
                  value={roleForm.color || "#888888"}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, color: e.target.value }))}
                  disabled={isSavingRole}
                  aria-label="Color del rol"
                />
                <Input
                  placeholder="#888888"
                  value={roleForm.color}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, color: e.target.value }))}
                  disabled={isSavingRole}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              disabled={isSavingRole}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveRole} disabled={isSavingRole} className="gap-2">
              {isSavingRole && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingRole ? "Guardar cambios" : "Crear rol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
