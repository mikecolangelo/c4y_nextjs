"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { can as canFn, type PermissionActionKey, type RolePermissions } from "@/lib/permissions";

export interface PermissionsValue {
  role: string;
  permissions: RolePermissions;
  loading: boolean;
  isAdmin: boolean;
  /** ¿El usuario actual puede ejecutar `action` sobre `moduleKey`? */
  can: (moduleKey: string, action: PermissionActionKey) => boolean;
}

/** Valor por defecto sin proveedor: deniega (fail-closed) una vez cargado. */
const DEFAULT_VALUE: PermissionsValue = {
  role: "",
  permissions: {},
  loading: false,
  isAdmin: false,
  can: () => false,
};

const PermissionsContext = createContext<PermissionsValue | null>(null);

/**
 * Proveedor de permisos del usuario actual. Hace UN solo fetch a
 * `/api/permissions/me` y lo comparte con todo el árbol (menú, guards de
 * acciones, etc.), evitando que cada consumidor duplique la llamada.
 */
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<string>("");
  const [permissions, setPermissions] = useState<RolePermissions>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const fetchPermissions = async () => {
      try {
        const res = await fetch("/api/permissions/me", { cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        if (!active) return;
        setRole(data?.data?.role || "");
        setPermissions(data?.data?.permissions || {});
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

  // admin/super-admin tienen acceso total; el resto se rige por la matriz.
  const isAdmin = role === "admin" || role === "super-admin";
  const can = useCallback(
    (moduleKey: string, action: PermissionActionKey) =>
      isAdmin || canFn(permissions, moduleKey, action),
    [isAdmin, permissions]
  );

  const value = useMemo<PermissionsValue>(
    () => ({ role, permissions, loading, isAdmin, can }),
    [role, permissions, loading, isAdmin, can]
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

/**
 * Lee el contexto de permisos compartido. Si no hay proveedor montado devuelve
 * un valor por defecto que deniega (fail-closed) para no exponer acciones.
 */
export function usePermissions(): PermissionsValue {
  return useContext(PermissionsContext) ?? DEFAULT_VALUE;
}
