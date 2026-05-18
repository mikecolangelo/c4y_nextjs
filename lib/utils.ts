import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Limpia las cookies de sesión del lado del cliente
 * Útil cuando se detecta que la sesión no es válida (401, token expirado, etc.)
 */
export function clearSessionCookies() {
  if (typeof document === "undefined") return;
  
  // Limpiar JWT (aunque normalmente es httpOnly, por si acaso)
  document.cookie = "jwt=; max-age=0; path=/; SameSite=Lax";
  
  // Limpiar admin-theme
  document.cookie = "admin-theme=; max-age=0; path=/; SameSite=Lax";
  
  // También limpiar del localStorage/sessionStorage por si acaso
  if (typeof window !== "undefined") {
    localStorage.removeItem("jwt");
    sessionStorage.removeItem("jwt");
    localStorage.removeItem("admin-theme");
    sessionStorage.removeItem("admin-theme");
  }
}
