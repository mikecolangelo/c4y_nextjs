import type { ComponentType } from "react";
import {
  Users,
  Settings,
  Package,
  Car,
  CreditCard,
  Cog,
  BarChart3,
  Bell,
  CalendarDays,
} from "lucide-react";

/**
 * Definición compartida de los items del menú de navegación.
 *
 * Fuente única consumida por el menú móvil, la búsqueda (spotlight) y el editor
 * de orden en Configuración. El `module` enlaza cada item con la matriz de
 * permisos (role-permission): su visibilidad por rol se controla con
 * `canAccess`, y su orden se guarda en el content-type `menu-config`.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Clave de módulo en la matriz de permisos. */
  module: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const adminNavSections: NavSection[] = [
  {
    label: "Aplicación",
    items: [
      { href: "/dashboard", label: "Panel", icon: BarChart3, module: "dashboard" },
      { href: "/users", label: "Contactos", icon: Users, module: "users" },
      { href: "/adm-services", label: "Servicios", icon: Settings, module: "adm-services" },
      { href: "/stock", label: "Inventario", icon: Package, module: "stock" },
      { href: "/fleet", label: "Flota", icon: Car, module: "fleet" },
      { href: "/billing", label: "Facturación", icon: CreditCard, module: "billing" },
      { href: "/notifications", label: "Notificaciones", icon: Bell, module: "notifications" },
      { href: "/calendar", label: "Calendario", icon: CalendarDays, module: "calendar" },
      { href: "/settings", label: "Configuración", icon: Cog, module: "settings" },
    ],
  },
];

/** Lista plana de todos los items del menú (a través de todas las secciones). */
export const adminNavItems: NavItem[] = adminNavSections.flatMap((s) => s.items);

/**
 * Reordena una lista de items según un orden de `moduleKey`.
 *
 * Los items cuyo módulo aparece en `order` se ordenan por su posición; los que
 * no estén en `order` se conservan al final en su orden original, de modo que un
 * item nuevo nunca desaparezca del menú.
 */
export function sortMenuItemsByOrder<T extends { module: string }>(
  items: T[],
  order: string[]
): T[] {
  const rank = new Map(order.map((key, index) => [key, index]));
  const fallback = items.length;
  return [...items].sort((a, b) => {
    const ra = rank.has(a.module) ? rank.get(a.module)! : fallback;
    const rb = rank.has(b.module) ? rank.get(b.module)! : fallback;
    return ra - rb;
  });
}

/** Mapa { moduleKey: rolesOcultos[] } devuelto por `/api/menu-config`. */
export type HiddenMap = Record<string, string[]>;

/**
 * ¿Está oculto del menú el módulo para el rol dado?
 *
 * La visibilidad de menú es independiente del acceso: ocultar un item solo lo
 * quita del menú (útil para que un admin "limpie" su menú sin perder acceso).
 */
export function isHiddenForRole(hidden: HiddenMap, module: string, role: string): boolean {
  return Boolean(role) && Array.isArray(hidden[module]) && hidden[module].includes(role);
}
