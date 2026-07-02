/**
 * Cliente de roles (lado frontend).
 *
 * La fuente de verdad vive en el backend (content-type `role`). Aquí solo
 * consumimos la lista (base + personalizados) para poblar selectores y tabs.
 */

"use client";

import { useEffect, useState } from "react";

export interface Role {
  id: number;
  documentId?: string;
  key: string;
  label: string;
  color?: string | null;
  isSystem: boolean;
  isActive: boolean;
}

/** Roles base que NO reciben credenciales de acceso al portal. */
const NO_CREDENTIAL_ROLES = new Set(["lead"]);

/** ¿Un rol recibe credenciales de acceso? (todos menos lead). */
export function roleGetsCredentials(roleKey: string): boolean {
  return !NO_CREDENTIAL_ROLES.has(roleKey);
}

/** Etiqueta legible de un rol a partir de la lista cargada (fallback a la key). */
export function labelForRole(roles: Role[], roleKey: string): string {
  return roles.find((r) => r.key === roleKey)?.label ?? roleKey;
}

/** Obtiene la lista de roles desde el proxy `/api/roles`. */
export async function fetchRoles(): Promise<Role[]> {
  const res = await fetch("/api/roles", { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.data) ? (json.data as Role[]) : [];
}

export interface UseRoles {
  roles: Role[];
  loading: boolean;
  /** Solo roles activos (para selectores de asignación). */
  activeRoles: Role[];
  reload: () => Promise<void>;
}

/**
 * Hook compartido que carga los roles disponibles. Ante error deja la lista
 * vacía; los consumidores deben aplicar su propio fallback si lo necesitan.
 */
export function useRoles(): UseRoles {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const reload = async () => {
    setLoading(true);
    try {
      setRoles(await fetchRoles());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const list = await fetchRoles();
      if (active) {
        setRoles(list);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return {
    roles,
    loading,
    activeRoles: roles.filter((r) => r.isActive),
    reload,
  };
}
