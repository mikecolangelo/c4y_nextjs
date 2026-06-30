import { getCurrentUserProfileViaJwt, type CurrentUserProfile } from "./auth";

/**
 * Roles permitidos para acceder al módulo de Flota y operaciones administrativas.
 * Array extensible para futuros roles privilegiados.
 */
export const ALLOWED_ROLES = ["admin", "super-admin"];

/**
 * Error específico para fallos de autorización por rol.
 */
export class AdminRequiredError extends Error {
  constructor(message = "Se requieren permisos de administrador") {
    super(message);
    this.name = "AdminRequiredError";
  }
}

/**
 * Valida que el usuario actual tenga un rol administrativo.
 * Úsalo al inicio de API Routes que requieran privilegios de admin.
 *
 * @throws {AdminRequiredError} Si el usuario no está autenticado o no es admin.
 */
export async function requireAdmin(): Promise<{
  role: string;
  profile: CurrentUserProfile;
}> {
  const profile = await getCurrentUserProfileViaJwt();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    throw new AdminRequiredError();
  }

  return { role: profile.role, profile };
}

/**
 * Verifica si el usuario actual es administrador (sin lanzar error).
 * Útil para decisiones condicionales en Server Components o Middleware.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica si un rol específico tiene privilegios administrativos.
 * Útil en Client Components donde ya se conoce el rol.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && ALLOWED_ROLES.includes(role);
}
