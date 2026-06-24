"use client";

import { useEffect, useState } from "react";

/**
 * Obtiene el orden guardado de los items del menú desde `/api/menu-config`.
 *
 * Devuelve `order` como una lista de `moduleKey`. Ante error o sin datos,
 * devuelve `[]` para que los consumidores caigan al orden por defecto de la
 * definición compartida (`sortMenuItemsByOrder` deja todo en su sitio).
 */
export function useMenuOrder(): { order: string[]; loading: boolean } {
  const [order, setOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/menu-config", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && Array.isArray(json?.data?.order)) setOrder(json.data.order);
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

  return { order, loading };
}
