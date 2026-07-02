"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/lib/permissions-context";
import type { PermissionActionKey } from "@/lib/permissions";

interface CanProps {
  /** Clave de módulo de la matriz de permisos (p.ej. "fleet", "billing"). */
  module: string;
  /** Acción requerida sobre el módulo. */
  action: PermissionActionKey;
  children: ReactNode;
  /** Qué renderizar cuando el usuario NO tiene el permiso (default: nada). */
  fallback?: ReactNode;
}

/**
 * Guard declarativo de UI: renderiza `children` solo si el usuario actual tiene
 * `action` sobre `module` según la matriz de permisos. Mientras cargan los
 * permisos no renderiza nada, para no mostrar un control que luego se oculta.
 *
 * OJO: esto es gating de UX. NO es la barrera de seguridad — la autorización
 * real debe aplicarse también en el servidor (rutas Next / policies de Strapi).
 */
export function Can({ module, action, children, fallback = null }: CanProps) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  return <>{can(module, action) ? children : fallback}</>;
}
