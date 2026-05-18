import React from "react";
import { describe, expect, it } from "vitest";
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
  const React = require("react");
  return {
    Sheet: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet">{children}</div>,
    SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SheetContent: ({ children, ...props }: any) => (
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
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard-user", label: "Dashboard Users" },
      { href: "/users", label: "Contactos" },
      { href: "/adm-services", label: "Servicios" },
      { href: "/calendar", label: "Calendario" },
      { href: "/stock", label: "Inventario" },
      { href: "/fleet", label: "Flota" },
      { href: "/deal", label: "Contratos" },
      { href: "/notifications", label: "Notificaciones" },
      { href: "/billing", label: "Facturación" },
    ];

    const received = adminNavSections[0]?.items.map(({ href, label }) => ({ href, label })) ?? [];
    expect(received).toEqual(expected);
  });
});

describe("MobileMenu", () => {
  it("muestra todos los enlaces y resalta el activo", () => {
    render(<MobileMenu />);

    adminNavSections[0]?.items.forEach((item) => {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    });

    const activeLink = screen.getByRole("link", { name: "Flota" });
    expect(activeLink.className).toContain("bg-accent");
    expect(activeLink.className).toContain("text-accent-foreground");
  });
});

