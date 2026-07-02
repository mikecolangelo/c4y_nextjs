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
  ArrowUpDown,
  ChevronRight,
  Plus,
  Shield,
  Car,
  Briefcase,
  UserPlus,
  History,
  FolderPlus,
  Upload,
  Trash2,
  Loader2,
} from "lucide-react";
import { usePaginatedSelection } from "@/hooks/use-paginated-selection";
import { useBatchDelete } from "@/hooks/use-batch-delete";
import { DataPagination } from "@/components/ui/data-pagination";
import { PageSizeSelect } from "@/components/ui/page-size-select";
import { Can } from "@/components/auth/can";
import { getInitials } from "@/lib/format";
import { clientLogger } from "@/lib/client-logger";
import { BulkActionBar } from "@/components/ui/selection/bulk-action-bar";
import { SelectAllAcrossPagesBanner } from "@/components/ui/selection/select-all-across-pages-banner";
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
  role: string;
  department?: string;
  avatar?: {
    url?: string;
    alternativeText?: string;
  };
  registeredVehiclesCount?: number;
  driverHistoriesCount?: number;
  assignedVehiclesCount?: number;
}

// Shape returned by POST /api/user-profiles/deletion-impact (forwarded from Strapi).
interface DeletionImpact {
  contacts: number;
  accounts: number;
  totalRelated: number;
  related: {
    deals: number;
    clients: number;
    appointments: number;
    userComments: number;
    communicationLogs: number;
    serviceOrders: number;
    serviceNotes: number;
    inventoryNotes: number;
    notifications: number;
    driverHistory: number;
    financings: number;
    weeklyCollections: number;
    billingRecords: number;
    invoices: number;
    fleetReminders: number;
    inventoryRequests: number;
    supplyRequests: number;
  };
}

// Human-readable labels for the related-record breakdown in the delete dialog.
const RELATED_LABELS: Record<keyof DeletionImpact["related"], string> = {
  deals: "Deals",
  clients: "Clientes",
  appointments: "Citas",
  userComments: "Comentarios",
  communicationLogs: "Registros de comunicación",
  serviceOrders: "Órdenes de servicio",
  serviceNotes: "Notas de servicio",
  inventoryNotes: "Notas de inventario",
  notifications: "Notificaciones",
  driverHistory: "Historial de conductor",
  financings: "Financiamientos",
  weeklyCollections: "Cobros semanales",
  billingRecords: "Registros de facturación",
  invoices: "Facturas",
  fleetReminders: "Recordatorios de flota",
  inventoryRequests: "Solicitudes de inventario",
  supplyRequests: "Solicitudes de suministro",
};

interface RoleDisplay {
  label: string;
  className: string;
  icon: typeof Shield;
}

const roleConfig: Record<string, RoleDisplay> = {
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

/** Apariencia de un rol; los personalizados usan un estilo neutro genérico. */
const displayForRole = (roleKey: string): RoleDisplay =>
  roleConfig[roleKey] ?? {
    label: roleKey,
    className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
    icon: Briefcase,
  };

export default function UsersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Selección múltiple (patrón reutilizable)
  const selection = usePaginatedSelection();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Batch delete via shared hook: it owns isDeleting + success/partial/error toasts.
  const { isDeleting, runDelete } = useBatchDelete({
    deleteBatch: async (ids) => {
      const response = await fetch("/api/user-profiles/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Error eliminando contactos");
      }
      return { deletedCount: result.deletedCount, failedCount: result.failedCount };
    },
    labels: { singular: "contacto", plural: "contactos" },
    onSuccess: () => {
      selection.clearAll();
      setRefreshKey((k) => k + 1);
    },
  });

  // Vista previa del impacto de la eliminación (registros relacionados afectados)
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactFailed, setImpactFailed] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
          const apiError =
            errorData.error?.message ||
            errorData.error ||
            `Error ${response.status}: ${response.statusText}`;
          if (response.status === 403) {
            throw new Error(
              `Permisos insuficientes: ${apiError}. Verifica los permisos de la colección "user-profiles" en Strapi.`
            );
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
        clientLogger.error("Error cargando contactos:", err);
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

  // ─── Paginación ───
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Volver a la página 1 cuando cambian filtros, búsqueda o tamaño de página
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter, pageSize]);

  // ─── Selección múltiple (vía hook reutilizable) ───
  const userKey = (u: UserProfile) => u.documentId || String(u.id);
  const pageIds = paginatedUsers.map(userKey);
  const allFilteredIds = filteredUsers.map(userKey);
  const selectionCount = selection.selectionCount;
  const isAllSelected = selection.isCurrentPageAllSelected(pageIds);
  const banner = selection.getAcrossPagesBanner(pageIds, allFilteredIds);

  // Run the batch delete via the shared hook, then close the dialog.
  const handleBatchDelete = async () => {
    await runDelete(Array.from(selection.selectedIds));
    setShowDeleteDialog(false);
  };

  // Fetch the deletion impact preview whenever the dialog opens.
  const openDeleteDialog = async () => {
    setShowDeleteDialog(true);
    setImpact(null);
    setImpactFailed(false);
    setImpactLoading(true);
    try {
      const response = await fetch("/api/user-profiles/deletion-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: Array.from(selection.selectedIds) }),
      });
      if (!response.ok) throw new Error("No se pudo calcular el impacto");
      const data: DeletionImpact = await response.json();
      setImpact(data);
    } catch (err) {
      clientLogger.error("Error calculando impacto de eliminación:", err);
      setImpactFailed(true);
    } finally {
      setImpactLoading(false);
    }
  };

  const getRoleBadge = (role: UserProfile["role"]) => {
    const config = displayForRole(role);
    const Icon = config.icon;
    return (
      <Badge
        className={`${config.className} rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1`}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <AdminLayout title="Contactos" showFilterAction>
        <section className={`flex flex-col ${spacing.gap.base} pb-24`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 min-h-[88px] py-4 border-b border-border"
            >
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
        <section
          className={`flex flex-col items-center justify-center ${spacing.gap.base} min-h-[400px]`}
        >
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
                      <Icon
                        className={`h-4 w-4 shrink-0 ${isActive ? "" : "text-muted-foreground"}`}
                      />
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

          {/* Acciones: crear / importar + selector de cantidad por página */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Can module="users" action="canCreate">
              <div className="flex items-center gap-2">
                <QuickUserCreate
                  onUserCreated={handleUserCreated}
                  trigger={
                    <Button className="rounded-lg h-9 gap-2 font-semibold">
                      <Plus className="h-4 w-4" />
                      Crear Contacto
                    </Button>
                  }
                />
                <Button
                  variant="secondary"
                  className="rounded-lg h-9 gap-2 font-semibold"
                  onClick={() => router.push("/users/import")}
                >
                  <Upload className="h-4 w-4" />
                  Importar Contactos
                </Button>
              </div>
            </Can>
            <PageSizeSelect value={pageSize} onChange={setPageSize} />
          </div>
        </div>

        <Separator className="my-3" />

        {/* Barra de acciones masivas */}
        <Can module="users" action="canDelete">
          <BulkActionBar
            selectionCount={selectionCount}
            onClear={selection.clearAll}
            onSelectCurrentPage={() => selection.selectCurrentPage(pageIds)}
            currentPageCount={paginatedUsers.length}
          >
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              onClick={openDeleteDialog}
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Eliminar
            </Button>
          </BulkActionBar>
        </Can>

        {/* Banner "seleccionar en todas las páginas" (estilo Gmail) */}
        <SelectAllAcrossPagesBanner
          show={banner.show}
          isAllFilteredSelected={banner.isAllFilteredSelected}
          pageCount={banner.pageCount}
          totalFiltered={banner.totalFiltered}
          onSelectAll={() => selection.selectAllAcrossPages(allFilteredIds)}
          onRevert={() => selection.setSelectedIds(new Set(pageIds))}
        />

        {/* Checkbox "Seleccionar todos" cuando no hay selección pero sí resultados */}
        {selectionCount === 0 && filteredUsers.length > 0 && (
          <Can module="users" action="canDelete">
            <div className="flex items-center gap-2 px-1 py-1">
              <Checkbox
                id="select-all"
                checked={isAllSelected}
                onCheckedChange={(checked) => {
                  if (checked) selection.selectCurrentPage(pageIds);
                  else selection.clearCurrentPage(pageIds);
                }}
              />
              <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                Seleccionar todos en esta página ({paginatedUsers.length})
              </label>
            </div>
          </Can>
        )}
      </div>

      <section className={`flex flex-col ${spacing.gap.base} pb-24`}>
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <p className={typography.body.large}>No se encontraron contactos</p>
          </div>
        ) : (
          paginatedUsers.map((user) => {
            const key = userKey(user);
            const isSelected = selection.isSelected(key);
            return (
              <article
                key={user.id}
                onClick={() => {
                  if (selection.selectionCount === 0) {
                    router.push(`/users/details/${key}`);
                  }
                }}
                className={`flex items-center ${spacing.gap.medium} min-h-[88px] py-4 justify-between border-b border-border cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted ${isSelected ? "bg-primary/5" : ""}`}
              >
                <div className={`flex items-center ${spacing.gap.medium} flex-1 min-w-0`}>
                  {/* Checkbox de selección */}
                  <Can module="users" action="canDelete">
                    <div
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        selection.toggle(key);
                      }}
                    >
                      <Checkbox checked={isSelected} />
                    </div>
                  </Can>

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
                    <p className={`${typography.body.large} line-clamp-1 text-base`}>
                      {user.displayName}
                    </p>
                    <p
                      className={`${typography.body.small} line-clamp-2 text-sm text-muted-foreground`}
                    >
                      {user.email || user.phone || "Sin contacto"}
                    </p>
                    {/* Indicadores de actividad */}
                    <div className="flex items-center gap-3 mt-1">
                      {(user.assignedVehiclesCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Car className="h-3 w-3" />
                          {user.assignedVehiclesCount}
                        </span>
                      )}
                      {(user.driverHistoriesCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <History className="h-3 w-3" />
                          {user.driverHistoriesCount}
                        </span>
                      )}
                      {(user.registeredVehiclesCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
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

        {/* Controles de paginación */}
        {!isLoading && !error && filteredUsers.length > 0 && (
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </section>

      {/* Diálogo de confirmación de eliminación masiva con vista previa del impacto */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectionCount} contacto(s)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {impactLoading ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculando el impacto de la eliminación…
                </span>
              ) : impact ? (
                <span>
                  Vas a eliminar <strong>{impact.contacts} contacto(s)</strong> y su(s){" "}
                  <strong>{impact.accounts} cuenta(s) de acceso</strong>. Esto afecta{" "}
                  <strong>{impact.totalRelated} registro(s) relacionados</strong> (historial,
                  comentarios, deals, etc.). No volverás a tener acceso a estos usuarios ni a su
                  historial. Esta acción no se puede deshacer.
                </span>
              ) : (
                <span>
                  Vas a eliminar <strong>{selectionCount} contacto(s)</strong>. No volverás a tener
                  acceso a estos usuarios ni a su historial. Esta acción no se puede deshacer.
                  {impactFailed && (
                    <span className="block mt-1 text-xs text-muted-foreground">
                      No se pudo calcular el impacto completo; aún puedes continuar con la
                      eliminación.
                    </span>
                  )}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Desglose compacto de los registros relacionados no vacíos */}
          {impact && impact.totalRelated > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
              {(Object.keys(RELATED_LABELS) as Array<keyof DeletionImpact["related"]>)
                .filter((k) => impact.related[k] > 0)
                .map((k) => (
                  <li key={k} className="flex items-center justify-between py-0.5">
                    <span className="text-muted-foreground">{RELATED_LABELS[k]}</span>
                    <span className="font-medium tabular-nums">{impact.related[k]}</span>
                  </li>
                ))}
            </ul>
          )}

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
