"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components_shadcn/ui/sheet";
import { spacing, typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { resolveNavHref } from "@/lib/permissions";
import { useMyPermissions } from "@/lib/use-my-permissions";
import { useMenuOrder } from "@/lib/use-menu-order";
import { adminNavSections, sortMenuItemsByOrder, isHiddenForRole } from "@/lib/menu-items";

// Re-exportado para conservar las importaciones existentes (spotlight, tests).
// La fuente única vive ahora en `@/lib/menu-items`.
export { adminNavSections } from "@/lib/menu-items";
export type { NavItem, NavSection } from "@/lib/menu-items";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { role, permissions, loading } = useMyPermissions();
  const { order, hidden } = useMenuOrder();

  // Aplica el orden guardado en Configuración a cada sección del menú.
  const sections = useMemo(
    () =>
      adminNavSections.map((section) => ({
        ...section,
        items: sortMenuItemsByOrder(section.items, order),
      })),
    [order]
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 flex items-center justify-center">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[300px] sm:w-[400px] [&>button]:hidden bg-background/80 backdrop-blur-sm"
      >
        <SheetHeader>
          <SheetTitle>Menú de Navegación</SheetTitle>
        </SheetHeader>
        <nav className={cn("mt-6 flex flex-col", spacing.gap.large)}>
          {sections.map((section) => {
            // Mostrar un item si el usuario tiene acceso (canAccess) Y no está
            // oculto del menú para su rol (visibilidad configurable, no afecta
            // el acceso por URL).
            const filteredItems = loading
              ? []
              : section.items.filter(
                  (item) =>
                    permissions[item.module]?.canAccess &&
                    !isHiddenForRole(hidden, item.module, role)
                );

            return (
              <div key={section.label} className={cn("flex flex-col", spacing.gap.small)}>
                <p
                  className={cn(
                    typography.label,
                    "px-4 uppercase tracking-wide text-muted-foreground/80"
                  )}
                >
                  {section.label}
                </p>
                <div className={cn("flex flex-col", spacing.gap.small)}>
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const href = resolveNavHref(item, role);
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={item.href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
