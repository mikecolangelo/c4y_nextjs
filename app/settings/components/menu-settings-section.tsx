"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, Save, Loader2, ListOrdered, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components_shadcn/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components_shadcn/ui/tooltip";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  adminNavItems,
  sortMenuItemsByOrder,
  isHiddenForRole,
  type NavItem,
  type HiddenMap,
} from "@/lib/menu-items";
import type { ModulePermission } from "@/lib/permissions";
import { fetchRoles, type Role } from "@/lib/roles";

type FullMatrix = Record<string, Record<string, ModulePermission>>;

/** Etiquetas legibles para los roles base (fallback si no llega la lista). */
const BASE_ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  driver: "Conductor",
  lead: "Lead",
};

/** El lead no tiene portal, así que nunca se configura desde aquí. */
const NON_CONFIGURABLE_ROLES = new Set(["lead"]);

/**
 * Roles con acceso total permanente (admin). Su visibilidad de menú se controla
 * con la bandera `hidden` (solo afecta el menú) en vez de `canAccess`, para que
 * ocultar un item NO les quite el acceso por URL (evita auto-bloqueos).
 */
const FULL_ACCESS_ROLES = new Set(["admin"]);

const emptyPermission = (): ModulePermission => ({
  canAccess: false,
  canRead: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
});

/** Una fila arrastrable del editor de menú. */
function SortableMenuRow({
  item,
  configurableRoles,
  roleLabels,
  visibleRoles,
  onToggleVisibility,
  onChangeRoles,
}: {
  item: NavItem;
  configurableRoles: string[];
  roleLabels: Record<string, string>;
  visibleRoles: string[];
  onToggleVisibility: (module: string) => void;
  onChangeRoles: (module: string, roles: string[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.module,
  });
  const Icon = item.icon;
  const isVisible = visibleRoles.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-3",
        isDragging && "opacity-60 shadow-md"
      )}
    >
      {/* Asa de arrastre */}
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Reordenar ${item.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>

      <Icon className="size-5 text-muted-foreground" />
      <span className="text-sm font-medium">{item.label}</span>

      <div className="ml-auto flex items-center gap-3">
        {/* Roles que ven el item en el menú */}
        {configurableRoles.length > 0 && (
          <ToggleGroup
            type="multiple"
            variant="outline"
            size="sm"
            value={visibleRoles}
            onValueChange={(roles) => onChangeRoles(item.module, roles)}
            aria-label={`Roles que ven ${item.label}`}
          >
            {configurableRoles.map((role) => (
              <ToggleGroupItem key={role} value={role} className="text-xs">
                {roleLabels[role] ?? role}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {/* Ojito: mostrar/ocultar el item para todos los roles configurables */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onToggleVisibility(item.module)}
                aria-label={isVisible ? `Ocultar ${item.label}` : `Mostrar ${item.label}`}
                aria-pressed={isVisible}
              >
                {isVisible ? (
                  <Eye className="size-5" />
                ) : (
                  <EyeOff className="size-5 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isVisible ? "Visible en el menú" : "Oculto del menú"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

/**
 * Editor del menú de navegación.
 *
 * Permite (1) reordenar los items arrastrándolos y (2) decidir qué roles ven
 * cada item con el "ojito" y los chips de rol. El ORDEN y la bandera `hidden`
 * se guardan en `menu-config`.
 *
 * Visibilidad de un item para un rol = tiene acceso (`canAccess`) Y no está
 * oculto (`hidden`). Para roles normales (conductor) el toggle escribe
 * `canAccess` en la matriz (ocultar = sin acceso). Para el admin —que siempre
 * tiene acceso total— el toggle escribe la bandera `hidden`, así puede limpiar
 * su menú sin perder el acceso por URL.
 */
export function MenuSettingsSection() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [items, setItems] = useState<NavItem[]>([]);
  const [matrix, setMatrix] = useState<FullMatrix>({});
  const [hidden, setHidden] = useState<HiddenMap>({});
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>(BASE_ROLE_LABELS);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setIsLoading(true);
    try {
      const [matrixRes, orderRes, rolesList] = await Promise.all([
        fetch("/api/permissions/matrix", { cache: "no-store" }),
        fetch("/api/menu-config", { cache: "no-store" }),
        fetchRoles(),
      ]);
      if (!matrixRes.ok) throw new Error("No se pudo cargar la matriz de permisos");

      const matrixJson = await matrixRes.json();
      if (rolesList.length > 0) {
        setRoleLabels(
          rolesList.reduce<Record<string, string>>(
            (acc, role: Role) => {
              acc[role.key] = role.label;
              return acc;
            },
            { ...BASE_ROLE_LABELS }
          )
        );
      }
      const layoutJson = orderRes.ok ? await orderRes.json() : null;
      const order: string[] = Array.isArray(layoutJson?.data?.order) ? layoutJson.data.order : [];
      const hiddenMap: HiddenMap =
        layoutJson?.data?.hidden && typeof layoutJson.data.hidden === "object"
          ? layoutJson.data.hidden
          : {};

      setMatrix(matrixJson.data?.matrix || {});
      setHidden(hiddenMap);
      setItems(sortMenuItemsByOrder(adminNavItems, order));
    } catch (error) {
      console.error("Error cargando el menú:", error);
      toast.error("Error al cargar la configuración del menú");
    } finally {
      setIsLoading(false);
    }
  };

  // Roles configurables = los presentes en la matriz que tienen portal (todos
  // menos lead). Incluye admin, cuya visibilidad se maneja con `hidden`.
  const configurableRoles = useMemo(
    () => Object.keys(matrix).filter((role) => !NON_CONFIGURABLE_ROLES.has(role)),
    [matrix]
  );

  /** ¿El item es visible en el menú para el rol? (acceso Y no oculto) */
  const isVisibleForRole = (role: string, module: string): boolean => {
    const hasAccess = FULL_ACCESS_ROLES.has(role)
      ? true // el admin siempre tiene acceso
      : Boolean(matrix[role]?.[module]?.canAccess);
    return hasAccess && !isHiddenForRole(hidden, module, role);
  };

  const visibleRolesFor = (module: string): string[] =>
    configurableRoles.filter((role) => isVisibleForRole(role, module));

  /** Ajusta la visibilidad de un módulo para que la vean exactamente `roles`. */
  const setRolesForModule = (module: string, roles: string[]) => {
    const visible = new Set(roles);

    // Roles con acceso total (admin): solo togglear la bandera `hidden`.
    setHidden((prev) => {
      const next: HiddenMap = { ...prev };
      for (const role of configurableRoles) {
        if (!FULL_ACCESS_ROLES.has(role)) continue;
        const others = (next[module] ?? []).filter((r) => r !== role);
        next[module] = visible.has(role) ? others : [...others, role];
      }
      // Limpiar entradas vacías para no persistir ruido.
      if (next[module] && next[module].length === 0) delete next[module];
      return next;
    });

    // Roles normales (conductor): la visibilidad escribe `canAccess`.
    setMatrix((prev) => {
      const next: FullMatrix = { ...prev };
      for (const role of configurableRoles) {
        if (FULL_ACCESS_ROLES.has(role)) continue;
        const current = next[role]?.[module] ?? emptyPermission();
        next[role] = {
          ...next[role],
          [module]: visible.has(role)
            ? // Coherencia: ser visible implica al menos poder "Ver".
              { ...current, canAccess: true, canRead: true }
            : // Ocultar = sin acceso ni acciones sobre el módulo.
              emptyPermission(),
        };
      }
      return next;
    });
  };

  const handleToggleVisibility = (module: string) => {
    const visible = visibleRolesFor(module).length > 0;
    setRolesForModule(module, visible ? [] : configurableRoles);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.module === active.id);
      const newIndex = prev.findIndex((i) => i.module === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const [orderRes, matrixRes] = await Promise.all([
        fetch("/api/menu-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: items.map((i) => i.module), hidden }),
        }),
        fetch("/api/permissions/matrix", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matrix }),
        }),
      ]);

      if (!orderRes.ok || !matrixRes.ok) throw new Error("Error al guardar");
      toast.success("Menú actualizado correctamente");
    } catch (error) {
      console.error("Error guardando el menú:", error);
      toast.error("No se pudo guardar la configuración del menú");
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
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn(typography.h3, "flex items-center gap-2")}>
          <ListOrdered className="size-5" />
          Orden y visibilidad del menú
        </CardTitle>
        <CardDescription>
          Arrastra para reordenar. Usa el ojito o los chips de rol para decidir quién ve cada item.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Ocultar un item al conductor le quita el acceso (equivale a desactivar
            &quot;Acceso&quot; en Permisos). Al administrador solo lo quita de su menú: conserva el
            acceso por URL, así que nunca se queda fuera de Configuración.
          </p>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={items.map((i) => i.module)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <SortableMenuRow
                  key={item.module}
                  item={item}
                  configurableRoles={configurableRoles}
                  roleLabels={roleLabels}
                  visibleRoles={visibleRolesFor(item.module)}
                  onToggleVisibility={handleToggleVisibility}
                  onChangeRoles={setRolesForModule}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Badge variant="secondary" className="w-fit">
          Administrador: ocultar es solo visual, conserva el acceso
        </Badge>

        <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Guardar menú
        </Button>
      </CardContent>
    </Card>
  );
}
