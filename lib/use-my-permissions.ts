"use client";

import { useEffect, useState } from "react";
import type { RolePermissions } from "@/lib/permissions";

export interface UseMyPermissions {
  role: string;
  permissions: RolePermissions;
  loading: boolean;
}

/**
 * Hook compartido que obtiene los permisos del usuario actual desde
 * `/api/permissions/me`. Consolida el fetch que antes duplicaban
 * MobileMenu, SpotlightSearch y admin-header.
 *
 * Devuelve `{ role, permissions, loading }`. Ante error o sin sesión,
 * deja `permissions` vacío y `role` vacío (sin acceso a módulos admin).
 */
export function useMyPermissions(): UseMyPermissions {
  const [role, setRole] = useState<string>("");
  const [permissions, setPermissions] = useState<RolePermissions>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const fetchPermissions = async () => {
      try {
        const response = await fetch("/api/permissions/me", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          if (active) {
            setRole(data.data?.role || "");
            setPermissions(data.data?.permissions || {});
          }
        } else if (active) {
          setPermissions({});
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
        if (active) setPermissions({});
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchPermissions();
    return () => {
      active = false;
    };
  }, []);

  return { role, permissions, loading };
}
