import { getCurrentUserJwt, getCurrentUserProfileViaJwt } from "./auth";
import { STRAPI_BASE_URL } from "./config";

export type ModuleAction = "canAccess" | "canRead" | "canCreate" | "canUpdate" | "canDelete";

/**
 * Error específico para fallos de autorización por módulo/acción.
 */
export class ModulePermissionError extends Error {
  constructor(message = "No tenés permiso para esta acción.") {
    super(message);
    this.name = "ModulePermissionError";
  }
}

/** admin y super-admin tienen acceso total, igual que en el backend. */
export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "super-admin";
}

/** Decisión pura: ¿el rol puede ejecutar la acción sobre el módulo? */
export function isModuleActionAllowed({
  role,
  hasPermission,
}: {
  role: string;
  hasPermission: boolean;
}): boolean {
  if (isAdminRole(role)) return true;
  return hasPermission;
}

/**
 * Valida que el usuario actual (según su JWT) tenga `action` sobre `moduleKey`
 * en la matriz `role-permission`. Reemplaza al guard legado `requireAdmin()`
 * en rutas que antes bloqueaban todo a admin, ignorando la matriz de roles
 * personalizados.
 *
 * @throws {ModulePermissionError} si no está autenticado o no tiene el permiso.
 */
export async function requireModulePermission(
  moduleKey: string,
  action: ModuleAction
): Promise<{ role: string }> {
  const profile = await getCurrentUserProfileViaJwt();
  if (!profile) throw new ModulePermissionError("No autenticado.");
  if (isAdminRole(profile.role)) return { role: profile.role };

  const jwt = await getCurrentUserJwt();
  const response = await fetch(`${STRAPI_BASE_URL}/api/role-permissions/mine`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  if (!response.ok) throw new ModulePermissionError();

  const json = await response.json();
  const permissions = json?.data?.permissions ?? {};
  const hasPermission = !!permissions?.[moduleKey]?.[action];

  if (!isModuleActionAllowed({ role: profile.role, hasPermission })) {
    throw new ModulePermissionError();
  }

  return { role: profile.role };
}
