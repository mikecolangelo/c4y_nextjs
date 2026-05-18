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

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/users",
    label: "Contactos",
    icon: Users,
  },
  {
    href: "/adm-services",
    label: "Servicios",
    icon: Settings,
  },
  {
    href: "/stock/dashboard",
    label: "Dashboard Inventario",
    icon: BarChart3,
  },
  {
    href: "/stock",
    label: "Inventario",
    icon: Package,
  },
  {
    href: "/fleet",
    label: "Flota",
    icon: Car,
    adminOnly: true,
  },
  {
    href: "/billing",
    label: "Facturación",
    icon: CreditCard,
  },
  {
    href: "/settings",
    label: "Configuración",
    icon: Cog,
    adminOnly: true,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch("/api/user-profile/me", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.data?.role || null);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };
    fetchUserRole();
  }, []);

  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly && userRole !== "admin") {
      return false;
    }
    return true;
  });

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

