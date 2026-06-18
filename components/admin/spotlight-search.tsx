"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { adminNavSections } from "./mobile-menu";
import { resolveNavHref } from "@/lib/permissions";
import { useMyPermissions } from "@/lib/use-my-permissions";

export function SpotlightSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedItemRef = useRef<HTMLAnchorElement | null>(null);
  const router = useRouter();
  const { role, permissions, loading } = useMyPermissions();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    
    function handleKeyDown(e: KeyboardEvent) {
      try {
        // Defensa múltiple contra eventos inválidos
        if (typeof e !== "object" || e === null) return;
        if (typeof e.key !== "string") return;
        
        const key = String(e.key);
        const isMetaK = key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey);
        
        if (isMetaK) {
          e.preventDefault();
          setOpen((prev) => !prev);
        }
        if (key === "Escape") {
          setOpen(false);
        }
      } catch {
        // Ignorar errores de eventos inválidos
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
      return;
    }

    const previousActive = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
      previousActive?.focus();
    };
  }, [open, mounted]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open && selectedItemRef.current) {
      const timer = window.setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({ block: "nearest" });
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [selectedIndex, open]);

  const navItems = useMemo(() => {
    if (loading) return [];
    return adminNavSections.flatMap((section) =>
      section.items
        // Filtrar por permisos (canAccess por módulo) — evita fugas de UX
        .filter((item) => permissions[item.module]?.canAccess)
        .map((item) => ({
          ...item,
          href: resolveNavHref(item, role),
          section: section.label,
        }))
    );
  }, [loading, permissions, role]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter((item) =>
      item.label.toLowerCase().includes(q)
    );
  }, [query, navItems]);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[selectedIndex];
      if (item) {
        handleSelect(item.href);
      }
    }
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-full"
        aria-label="Buscar"
      >
        <Search className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-full"
        onClick={() => setOpen(true)}
        aria-label="Buscar (Ctrl+K)"
      >
        <Search className="h-5 w-5" />
      </Button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[20vh]"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Búsqueda"
          >
            <div
              className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b p-4">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDownList}
                  placeholder="Buscar..."
                  className="h-10 border-0 bg-transparent text-lg focus-visible:ring-0"
                />
              </div>

              <ScrollAreaPrimitive.Root className="max-h-[60vh]">
                <ScrollAreaPrimitive.Viewport className="max-h-[60vh]">
                  {results.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No se encontraron resultados
                    </div>
                  ) : (
                    <div className="p-2">
                      {results.map((item, index) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          ref={index === selectedIndex ? selectedItemRef : null}
                          onClick={() => handleSelect(item.href)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`flex items-center justify-between rounded-lg px-4 py-3 transition-colors ${
                            index === selectedIndex
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-muted"
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{item.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.section}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </ScrollAreaPrimitive.Viewport>
                <ScrollAreaPrimitive.ScrollAreaScrollbar
                  orientation="vertical"
                  className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
                >
                  <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
                </ScrollAreaPrimitive.ScrollAreaScrollbar>
              </ScrollAreaPrimitive.Root>

              <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-muted px-1.5 py-0.5">↑</kbd>
                    <kbd className="rounded bg-muted px-1.5 py-0.5">↓</kbd>
                    <span className="ml-1">navegar</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-muted px-1.5 py-0.5">↵</kbd>
                    <span className="ml-1">seleccionar</span>
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd>
                  <span className="ml-1">cerrar</span>
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
