"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
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
import { Save, Loader2, ShieldCheck, Info } from "lucide-react";
import { typography } from "@/lib/design-system";
import { toast } from "@/lib/toast";
import type { ModulePermission } from "@/lib/permissions";

interface ModuleDefinition {
  key: string;
  label: string;
  path: string;
}

type FullMatrix = Record<string, Record<string, ModulePermission>>;

const ROLE_TABS: { role: string; label: string; description: string }[] = [
  { role: "admin", label: "Administrador", description: "Acceso total a todo el sistema (no editable)." },
  { role: "driver", label: "Usuario", description: "Conductores: define qué pueden ver y gestionar." },
  { role: "lead", label: "Lead", description: "Prospectos sin acceso al portal." },
];

const ACTION_COLUMNS: { key: keyof ModulePermission; label: string }[] = [
  { key: "canAccess", label: "Acceso" },
  { key: "canRead", label: "Ver" },
  { key: "canCreate", label: "Crear" },
  { key: "canUpdate", label: "Editar" },
  { key: "canDelete", label: "Eliminar" },
];

const emptyPermission = (): ModulePermission => ({
  canAccess: false,
  canRead: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
});

export function PermissionsSettingsSection() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modules, setModules] = useState<ModuleDefinition[]>([]);
  const [matrix, setMatrix] = useState<FullMatrix>({});

  useEffect(() => {
    loadMatrix();
  }, []);

  const loadMatrix = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/permissions/matrix", { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo cargar la matriz");
      const json = await res.json();
      setMatrix(json.data?.matrix || {});
      setModules(json.data?.modules || []);
    } catch (error) {
      console.error("Error cargando permisos:", error);
      toast.error("Error al cargar los permisos");
    } finally {
      setIsLoading(false);
    }
  };

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
        <CardTitle className={`${typography.h3} flex items-center gap-2`}>
          <ShieldCheck className="h-5 w-5" />
          Permisos por rol
        </CardTitle>
        <CardDescription>
          Define qué módulos puede ver cada rol en el menú y qué acciones puede realizar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs defaultValue="driver" className="w-full">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0 mb-4">
            {ROLE_TABS.map((rt) => (
              <TabsTrigger key={rt.role} value={rt.role} className="data-[state=active]:bg-primary/10">
                {rt.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {ROLE_TABS.map((rt) => {
            const isAdmin = rt.role === "admin";
            return (
              <TabsContent key={rt.role} value={rt.role} className="flex flex-col gap-3">
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                  <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">{rt.description}</p>
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
                          : getPerm(rt.role, mod.key);
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
                                    togglePermission(rt.role, mod.key, col.key, v === true)
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
    </Card>
  );
}
