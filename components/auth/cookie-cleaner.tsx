"use client";

import { useEffect } from "react";
import { clearSessionCookies } from "@/lib/utils";

/**
 * Componente que limpia las cookies de sesión cuando se monta
 * Se usa en páginas de autenticación para asegurar que no queden cookies residuales
 */
export function CookieCleaner() {
  useEffect(() => {
    // Limpiar cookies del lado del cliente cuando se monta en páginas de auth
    clearSessionCookies();
  }, []);

  return null;
}

