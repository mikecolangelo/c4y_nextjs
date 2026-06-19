"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_COOKIE_NAME = "admin-theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

// Función para leer cookie
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

// Función para escribir cookie
function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${value}; max-age=${maxAge}; path=/; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

// Función para eliminar cookie
function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

// Función exportada para limpiar el tema (útil para logout)
export function clearThemeCookie() {
  deleteCookie(THEME_COOKIE_NAME);
}

const VALID_THEMES: Theme[] = ["light", "dark", "system"];

function isValidTheme(value: unknown): value is Theme {
  return typeof value === "string" && VALID_THEMES.includes(value as Theme);
}

// Persiste la preferencia en la base de datos (por usuario). Es "fire and
// forget": si el usuario no está autenticado o falla la red, el tema sigue
// viviendo en la cookie y no rompemos la experiencia.
function persistThemeToDb(theme: Theme) {
  if (typeof window === "undefined") return;
  fetch("/api/user-profile/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ themePreference: theme }),
  }).catch(() => {
    /* sin conexión o sin sesión: la cookie mantiene la preferencia */
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Inicializar tema desde cookie o usar "light" por defecto
  useEffect(() => {
    const cookieTheme = getCookie(THEME_COOKIE_NAME) as Theme | null;
    const initialTheme = cookieTheme || "light";
    setThemeState(initialTheme);

    // Resolver tema inicial inmediatamente
    let initialResolved: "light" | "dark";
    if (initialTheme === "system") {
      initialResolved = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else {
      initialResolved = initialTheme;
    }
    setResolvedTheme(initialResolved);
    setMounted(true);

    // La cookie da una respuesta instantánea (evita parpadeo). La fuente de
    // verdad es la base de datos: al cargar, traemos la preferencia guardada
    // del usuario y la aplicamos para que el tema siga al usuario entre
    // dispositivos. No re-persistimos aquí (solo hidratamos el estado).
    fetch("/api/user-profile/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        const dbTheme = payload?.data?.themePreference;
        if (isValidTheme(dbTheme) && dbTheme !== initialTheme) {
          setThemeState(dbTheme);
          setCookie(THEME_COOKIE_NAME, dbTheme, THEME_COOKIE_MAX_AGE);
        }
      })
      .catch(() => {
        /* sin sesión o sin red: nos quedamos con la cookie */
      });
  }, []);

  // Resolver el tema real (light/dark) basado en el tema seleccionado
  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;
    let resolved: "light" | "dark";

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      resolved = systemTheme;
    } else {
      resolved = theme;
    }

    setResolvedTheme(resolved);

    // Aplicar clase dark al elemento html
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, mounted]);

  // Escuchar cambios en la preferencia del sistema cuando el tema es "system"
  useEffect(() => {
    if (!mounted || theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const resolved = mediaQuery.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      const root = window.document.documentElement;
      if (resolved === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    // Guardar en cookie (instantáneo) y persistir en la BD (por usuario).
    setCookie(THEME_COOKIE_NAME, newTheme, THEME_COOKIE_MAX_AGE);
    persistThemeToDb(newTheme);
  };

  // Siempre proporcionar el contexto, incluso antes de montar
  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme debe ser usado dentro de ThemeProvider");
  }
  return context;
}
