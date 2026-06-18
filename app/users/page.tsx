"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components_shadcn/ui/button";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import { SearchInput } from "@/components/ui/search-input";
import { Badge } from "@/components_shadcn/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components_shadcn/ui/avatar";
import { Separator } from "@/components_shadcn/ui/separator";
import {
  MoreVertical,
  ArrowUpDown,
  Tag,
  User as UserIcon,
  ChevronRight,
  Plus,
  Shield,
  Car,
  UserPlus,
  History,
  FolderPlus,
  Upload,
  Trash2,
  X,
} from "lucide-react";
import { QuickUserCreate, type CreatedUser } from "@/components/ui/billing";
import { spacing, typography } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { strapiImages } from "@/lib/strapi-images";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { toast } from "@/lib/toast";
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

interface UserProfile {
  id: number;
  documentId?: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: "admin" | "driver" | "lead";
  department?: string;
  avatar?: {
    url?: string;
    alternativeText?: string;
  };
  registeredVehiclesCount?: number;
  driverHistoriesCount?: number;
  assignedVehiclesCount?: number;
}

const roleConfig = {
  admin: {
    label: "Administrador",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100",
    icon: Shield,
  },
  driver: {
    label: "Conductor",
    className: "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
    icon: Car,
  },
  lead: {
    label: "Lead",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
    icon: UserPlus,
  },
};

export default function UsersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Estados para selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Callback cuando se crea un nuevo contacto
  const handleUserCreated = (user: CreatedUser) => {
    // Refrescar la lista de contactos
    setRefreshKey((k) => k + 1);
    toast.success(`Contacto ${user.displayName} creado exitosamente`);
  };

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/user-profiles", { cache: "no-store" });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const apiError = errorData.error?.message || errorData.error || `Error ${response.status}: ${response.statusText}`;
          if (response.status === 403) {
            throw new Error(`Permisos insuficientes: ${apiError}. Verifica los permisos de la colección "user-profiles" en Strapi.`);
          }
          throw new Error(apiError);
        }
        const { data } = await response.json();
        // Transformar datos para incluir contadores
        const usersWithCounts = (data || []).map((user: any) => ({
          ...user,
          registeredVehiclesCount: user.registeredVehicles?.length || 0,
          driverHistoriesCount: user.driverHistories?.length || 0,
          assignedVehiclesCount: user.assignedVehicles?.length || 0,
        }));
        setUsers(usersWithCounts);
      } catch (err) {
        console.error("Error cargando contactos:", err);
        const errorMsg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudieron cargar los contactos: ${errorMsg}`);
        toast.error(`Error al cargar contactos: ${errorMsg}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesFilter = true;
    if (activeFilter === "admin" || activeFilter === "driver" || activeFilter === "lead") {
      matchesFilter = user.role === activeFilter;
    }

    return matchesSearch && matchesFilter;
  });

  // ─── Selección múltiple ───
  const toggleSelection = (documentId: string, e?: React.MouseEvent | React.ChangeEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = filteredUsers.map((u) => u.documentId || String(u.id));
    setSelectedIds(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/user-profiles/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error eliminando contactos");
      }

      if (result.failedCount > 0) {
        toast.warning(
          `Se eliminaron ${result.deletedCount} contactos. ${result.failedCount} no se pudieron eliminar.`
        );
      } else {
        toast.success(`${result.deletedCount} contacto(s) eliminado(s) correctamente`);
      }

      setSelectedIds(new Set());
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Error eliminando contactos:", err);
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al eliminar: ${msg}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: UserProfile["role"]) => {
    const config = roleConfig[role];
    const Icon = config.icon;
    return (
      <Badge className={`${config.className} rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const isAllSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u.documentId || String(u.id)));
  const selectionCount = selectedIds.size;

  if (isLoading) {
    return (
      <AdminLayout title="Contactos" showFilterAction>
        <section className={`flex flex-col ${spacing.gap.base} pb-24`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 min-h-[88px] py-4 border-b border-border">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </section>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Contactos" showFilterAction>
        <section className={`flex flex-col items-center justify-center ${spacing.gap.base} min-h-[400px]`}>
          <p className={typography.body.large}>{error}</p>
          <Button onClick={() => setRefreshKey((k) => k + 1)}>Reintentar</Button>
        </section>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Contactos" showFilterAction>
      {/* Sticky header: búsqueda + filtros + acciones de selección */}
      <div className="sticky top-0 z-20 bg-background -mx-6 px-6 py-4">
        <div className={`flex flex-col ${spacing.gap.base}`}>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchInput
                variant="muted"
                placeholder="Buscar por nombre, email, teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              className="rounded-lg h-12 text-base font-semibold flex items-center justify-center gap-2 px-4 shrink-0"
              onClick={() => router.push("/users/import")}
            >
              <Upload className="h-5 w-5" />
              Importar Leads
            </Button>
          </div>

          <ScrollAreaPrimitive.Root className="relative w-full overflow-hidden">
            <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
              <nav className={`flex ${spacing.gap.small} whitespace-nowrap`}>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 px-3 rounded-lg bg-muted border-none`}
                  onClick={() => setActiveFilter(null)}
                >
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className={`${typography.body.base} text-foreground`}>Todos</span>
                </Button>
                {(["admin", "driver", "lead"] as const).map((role) => {
                  const config = roleConfig[role];
                  const Icon = config.icon;
                  const isActive = activeFilter === role;
                  return (
                    <Button
                      key={role}
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      className={`h-8 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 px-3 rounded-lg ${isActive ? "bg-primary/10 text-primary border-none hover:bg-primary/20" : "bg-muted border-none"}`}
                      onClick={() => setActiveFilter(isActive ? null : role)}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "" : "text-muted-foreground"}`} />
                      <span className={typography.body.base}>{config.label}</span>
                      {isActive && <span className="ml-1 shrink-0">×</span>}
                    </Button>
                  );
                })}
              </nav>
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.ScrollAreaScrollbar
              orientation="horizontal"
              className="flex touch-none select-none transition-colors w-full h-2.5 border-t border-t-transparent p-[1px]"
            >
              <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
            </ScrollAreaPrimitive.ScrollAreaScrollbar>
            <ScrollAreaPrimitive.Corner />
          </ScrollAreaPrimitive.Root>
        </div>

        <Separator className="my-3" />

        {/* Barra de selección */}
        {selectionCount > 0 && (
          <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-lg px-4 py-2 mb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary">
                {selectionCount} seleccionado{selectionCount !== 1 ? "s" : ""}
              </span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
                Seleccionar todos
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Eliminar
            </Button>
          </div>
        )}

        {/* Checkbox "Seleccionar todos" cuando no hay selección pero sí resultados */}
        {selectionCount === 0 && filteredUsers.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-1">
            <Checkbox
              id="select-all"
              checked={isAllSelected}
              onCheckedChange={(checked) => {
                if (checked) selectAll();
                else clearSelection();
              }}
            />
            <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
              Seleccionar todos ({filteredUsers.length})
            </label>
          </div>
        )}
      </div>

      <section className={`flex flex-col ${spacing.gap.base} pb-24`}>
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <p className={typography.body.large}>No se encontraron contactos</p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const userKey = user.documentId || String(user.id);
            const isSelected = selectedIds.has(userKey);
            return (
              <article
                key={user.id}
                onClick={() => {
                  if (selectedIds.size === 0) {
                    router.push(`/users/details/${userKey}`);
                  }
                }}
                className={`flex items-center ${spacing.gap.medium} min-h-[88px] py-4 justify-between border-b border-border cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted ${isSelected ? "bg-primary/5" : ""}`}
              >
                <div className={`flex items-center ${spacing.gap.medium} flex-1 min-w-0`}>
                  {/* Checkbox de selección */}
                  <div
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelection(userKey);
                    }}
                  >
                    <Checkbox checked={isSelected} />
                  </div>

                  <Avatar className="h-14 w-14 shrink-0 rounded-full overflow-hidden ring-2 ring-background">
                    {user.avatar?.url ? (
                      <AvatarImage
                        src={strapiImages.getURL(user.avatar.url)}
                        alt={user.avatar.alternativeText || `Avatar de ${user.displayName}`}
                        className="rounded-full object-cover w-full h-full"
                      />
                    ) : null}
                    <AvatarFallback className="rounded-full text-base w-full h-full flex items-center justify-center bg-muted">
                      {getInitials(user.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col justify-center min-w-0 flex-1">
                    <p className={`${typography.body.large} line-clamp-1 text-base`}>{user.displayName}</p>
                    <p className={`${typography.body.small} line-clamp-2 text-sm text-muted-foreground`}>
                      {user.email || user.phone || "Sin contacto"}
                    </p>
                    {/* Indicadores de actividad */}
                    <div className="flex items-center gap-3 mt-1">
                      {user.assignedVehiclesCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Car className="h-3 w-3" />
                          {user.assignedVehiclesCount}
                        </span>
                      )}
                      {user.driverHistoriesCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-blue-600">
                          <History className="h-3 w-3" />
                          {user.driverHistoriesCount}
                        </span>
                      )}
                      {user.registeredVehiclesCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-purple-600">
                          <FolderPlus className="h-3 w-3" />
                          {user.registeredVehiclesCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`shrink-0 flex items-center ${spacing.gap.small}`}>
                  {getRoleBadge(user.role)}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </article>
            );
          })
        )}
      </section>

      <QuickUserCreate
        onUserCreated={handleUserCreated}
        trigger={
          <Button
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary text-white hover:bg-primary/90"
            size="icon"
          >
            <Plus className="h-6 w-6" />
          </Button>
        }
      />

      {/* Diálogo de confirmación de eliminación masiva */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectionCount} contacto(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los contactos seleccionados serán eliminados permanentemente del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleBatchDelete();
              }}
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
