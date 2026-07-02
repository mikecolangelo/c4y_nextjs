/**
 * Utilidades de permisos por rol y módulo (lado frontend).
 *
 * La fuente de verdad vive en el backend (content-type role-permission).
 * Aquí solo consumimos esa matriz y la mapeamos a rutas del frontend.
 */

export interface ModulePermission {
  canAccess: boolean;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export type RolePermissions = Record<string, ModulePermission>;

/** Acciones auditables de un módulo (columnas de la matriz de permisos). */
export type PermissionActionKey = keyof ModulePermission;

/**
 * ¿El rol con estos permisos puede ejecutar `action` sobre `moduleKey`?
 * Fuente única de la lógica de acción; el bypass de admin se resuelve en el
 * contexto (ver `permissions-context`), no aquí.
 */
export function can(
  permissions: RolePermissions,
  moduleKey: string,
  action: PermissionActionKey
): boolean {
  return !!permissions?.[moduleKey]?.[action];
}

export interface MyPermissions {
  role: string;
  permissions: RolePermissions;
}

/** Mapa de prefijo de ruta -> clave de módulo (para el middleware). */
export const ROUTE_MODULE_MAP: Array<{ prefix: string; module: string }> = [
  { prefix: "/dashboard-user", module: "dashboard" },
  { prefix: "/dashboard", module: "dashboard" },
  { prefix: "/users", module: "users" },
  { prefix: "/adm-services", module: "adm-services" },
  { prefix: "/stock", module: "stock" },
  { prefix: "/fleet", module: "fleet" },
  { prefix: "/billing", module: "billing" },
  { prefix: "/calendar", module: "calendar" },
  { prefix: "/deal", module: "deal" },
  { prefix: "/service-orders", module: "service-orders" },
  { prefix: "/notifications", module: "notifications" },
  { prefix: "/profile", module: "profile" },
  { prefix: "/settings", module: "settings" },
];

/** Devuelve la clave de módulo para una ruta, o null si no está mapeada. */
export function moduleForPath(path: string): string | null {
  const match = ROUTE_MODULE_MAP.find((m) => path === m.prefix || path.startsWith(`${m.prefix}/`));
  return match ? match.module : null;
}

/** ¿El rol con estos permisos puede ver/entrar a la ruta dada? */
export function canAccessPath(permissions: RolePermissions, path: string): boolean {
  const moduleKey = moduleForPath(path);
  if (!moduleKey) return true; // rutas no mapeadas (perfil base, etc.) no se bloquean aquí
  return !!permissions?.[moduleKey]?.canAccess;
}

/** Ruta de aterrizaje por defecto según el rol. */
export function landingForRole(role: string): string {
  if (role === "admin") return "/dashboard";
  if (role === "driver") return "/dashboard-user";
  return "/signin";
}

/**
 * Resuelve el href de un item de navegación según el rol.
 *
 * El módulo `dashboard` es compartido por `/dashboard` (panel admin) y
 * `/dashboard-user` (panel del conductor). Para el conductor debemos
 * enlazar a su propio panel, no al de admin.
 */
export function resolveNavHref(item: { href: string; module: string }, role: string): string {
  if (item.module === "dashboard" && role === "driver") {
    return "/dashboard-user";
  }
  return item.href;
}

/** Obtiene los permisos del usuario actual desde Strapi usando su JWT. */
export async function fetchMyPermissions(
  jwt: string,
  baseUrl: string
): Promise<MyPermissions | null> {
  try {
    const res = await fetch(`${baseUrl}/api/role-permissions/mine`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

/** Módulos que aún están en construcción (se muestra aviso en vez de romper). */
export const UNDER_CONSTRUCTION_MODULES = new Set<string>(["calendar"]);

export function isUnderConstruction(moduleKey: string | null): boolean {
  return !!moduleKey && UNDER_CONSTRUCTION_MODULES.has(moduleKey);
}
