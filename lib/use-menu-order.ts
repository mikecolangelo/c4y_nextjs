"use client";

import { useEffect, useState } from "react";
import type { HiddenMap } from "@/lib/menu-items";

export interface MenuLayout {
  /** Orden guardado como lista de `moduleKey`. */
  order: string[];
  /** { moduleKey: rolesOcultos[] } — visibilidad de menú, no afecta el acceso. */
  hidden: HiddenMap;
  loading: boolean;
}

/**
 * Obtiene el layout del menú desde `/api/menu-config` (orden + visibilidad).
 *
 * Ante error o sin datos, devuelve valores vacíos para que los consumidores
 * caigan al orden por defecto y no oculten nada.
 */
export function useMenuOrder(): MenuLayout {
  const [order, setOrder] = useState<string[]>([]);
  const [hidden, setHidden] = useState<HiddenMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/menu-config", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active) return;
        if (Array.isArray(json?.data?.order)) setOrder(json.data.order);
        if (json?.data?.hidden && typeof json.data.hidden === "object") {
          setHidden(json.data.hidden);
        }
      })
      .catch(() => {
        /* silencioso: se usa el orden por defecto */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { order, hidden, loading };
}
