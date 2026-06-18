"use client";

import type { ComponentType } from "react";
import { useState } from "react";
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
import {
  Users,
  Settings,
  Package,
  Car,
  CreditCard,
  Cog,
  BarChart3,
} from "lucide-react";
import { spacing, typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { resolveNavHref } from "@/lib/permissions";
import { useMyPermissions } from "@/lib/use-my-permissions";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Clave de módulo en la matriz de permisos. */
  module: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const adminNavSections: NavSection[] = [
  {
    label: "Aplicación",
    items: [
      {
        href: "/dashboard",
        label: "Panel",
        icon: BarChart3,
        module: "dashboard",
      },
      {
        href: "/users",
        label: "Contactos",
        icon: Users,
        module: "users",
      },
      {
        href: "/adm-services",
        label: "Servicios",
        icon: Settings,
        module: "adm-services",
      },
      {
        href: "/stock",
        label: "Inventario",
        icon: Package,
        module: "stock",
      },
      {
        href: "/fleet",
        label: "Flota",
        icon: Car,
        module: "fleet",
      },
      {
        href: "/billing",
        label: "Facturación",
        icon: CreditCard,
        module: "billing",
      },
      {
        href: "/settings",
        label: "Configuración",
        icon: Cog,
        module: "settings",
      },
    ],
  },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { role, permissions, loading } = useMyPermissions();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 flex items-center justify-center">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px] [&>button]:hidden bg-background/80 backdrop-blur-sm">
        <SheetHeader>
          <SheetTitle>Menú de Navegación</SheetTitle>
        </SheetHeader>
        <nav className={cn("mt-6 flex flex-col", spacing.gap.large)}>
          {adminNavSections.map((section) => {
            // Filtrar items según los permisos del usuario (canAccess por módulo)
            const filteredItems = loading
              ? []
              : section.items.filter((item) => permissions[item.module]?.canAccess);

            return (
              <div key={section.label} className={cn("flex flex-col", spacing.gap.small)}>
                <p className={cn(typography.label, "px-4 uppercase tracking-wide text-muted-foreground/80")}>
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

