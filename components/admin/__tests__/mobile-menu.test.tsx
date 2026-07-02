import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileMenu, adminNavSections } from "../mobile-menu";

vi.mock("next/navigation", () => ({
  usePathname: () => "/fleet",
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components_shadcn/ui/sheet", () => {
  return {
    Sheet: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="sheet">{children}</div>
    ),
    SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SheetContent: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => (
      <div data-testid="sheet-content" {...props}>
        {children}
      </div>
    ),
    SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  };
});

describe("adminNavSections", () => {
  it("mantiene el orden y labels aprobados", () => {
    const expected = [
      { href: "/dashboard", label: "Panel", module: "dashboard" },
      { href: "/users", label: "Contactos", module: "users" },
      { href: "/adm-services", label: "Servicios", module: "adm-services" },
      { href: "/stock", label: "Inventario", module: "stock" },
      { href: "/fleet", label: "Flota", module: "fleet" },
      { href: "/billing", label: "Facturación", module: "billing" },
      { href: "/notifications", label: "Notificaciones", module: "notifications" },
      { href: "/calendar", label: "Calendario", module: "calendar" },
      { href: "/settings", label: "Configuración", module: "settings" },
    ];

    const received =
      adminNavSections[0]?.items.map(({ href, label, module }) => ({ href, label, module })) ?? [];
    expect(received).toEqual(expected);
  });

  it("cada item declara su clave de módulo", () => {
    adminNavSections[0]?.items.forEach((item) => {
      expect(item.module).toBeTruthy();
    });
  });
});

function mockPermissions(role: string, permissions: Record<string, unknown>) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { role, permissions } }),
  }) as unknown as typeof fetch;
}

describe("MobileMenu — admin", () => {
  beforeEach(() => {
    // Mock de permisos: admin con acceso a todos los módulos del menú.
    const permissions = Object.fromEntries(
      adminNavSections[0].items.map((item) => [
        item.module,
        { canAccess: true, canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      ])
    );
    mockPermissions("admin", permissions);
  });

  it("muestra los enlaces permitidos y resalta el activo", async () => {
    render(<MobileMenu />);

    for (const item of adminNavSections[0].items) {
      const link = await screen.findByRole("link", { name: item.label });
      expect(link).toHaveAttribute("href", item.href);
    }

    const activeLink = await screen.findByRole("link", { name: "Flota" });
    expect(activeLink.className).toContain("bg-accent");
    expect(activeLink.className).toContain("text-accent-foreground");
  });
});

describe("MobileMenu — driver", () => {
  beforeEach(() => {
    // El conductor solo tiene acceso al módulo dashboard (su panel).
    mockPermissions("driver", {
      dashboard: {
        canAccess: true,
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      },
    });
  });

  it("muestra solo 'Panel' y enlaza al panel del conductor", async () => {
    render(<MobileMenu />);

    // El item dashboard apunta a /dashboard-user para el conductor.
    const panel = await screen.findByRole("link", { name: "Panel" });
    expect(panel).toHaveAttribute("href", "/dashboard-user");

    // No debe ver módulos de admin.
    expect(screen.queryByRole("link", { name: "Flota" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Contactos" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Configuración" })).toBeNull();
  });
});
