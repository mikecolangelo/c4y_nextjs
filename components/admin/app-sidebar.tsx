"use client";

import type { ComponentType } from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components_shadcn/ui/sidebar";
import { Users, Settings, Package, Car, CreditCard, Cog, BarChart3 } from "lucide-react";
import type { RolePermissions } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Clave de módulo en la matriz de permisos. */
  module: string;
}

const navItems: NavItem[] = [
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
];

export function AppSidebar() {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await fetch("/api/permissions/me", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          setPermissions(data.data?.permissions || {});
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
        setPermissions({});
      }
    };
    fetchPermissions();
  }, []);

  // Mientras carga, no mostramos nada para evitar parpadeo de módulos no permitidos.
  const filteredNavItems = permissions
    ? navItems.filter((item) => permissions[item.module]?.canAccess)
    : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Aplicación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

