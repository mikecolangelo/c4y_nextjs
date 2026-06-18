import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpotlightSearch } from "../spotlight-search";
import { adminNavSections } from "../mobile-menu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// jsdom no implementa scrollIntoView (lo usa el callback de selección).
Element.prototype.scrollIntoView = vi.fn();

function mockPermissions(role: string, permissions: Record<string, unknown>) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { role, permissions } }),
  }) as unknown as typeof fetch;
}

describe("SpotlightSearch — admin", () => {
  beforeEach(() => {
    const permissions = Object.fromEntries(
      adminNavSections[0].items.map((item) => [
        item.module,
        { canAccess: true, canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      ])
    );
    mockPermissions("admin", permissions);
  });

  it("renderiza el botón de búsqueda global", () => {
    render(<SpotlightSearch />);
    expect(screen.getByRole("button", { name: /buscar/i })).toBeInTheDocument();
  });

  it("abre el diálogo y muestra las rutas permitidas", async () => {
    const user = userEvent.setup();
    render(<SpotlightSearch />);

    await user.click(screen.getByRole("button", { name: /buscar/i }));
    expect(await screen.findByText("Panel")).toBeInTheDocument();
    expect(screen.getByText("Flota")).toBeInTheDocument();
  });

  it("navega a la ruta seleccionada", async () => {
    const user = userEvent.setup();
    render(<SpotlightSearch />);

    await user.click(screen.getByRole("button", { name: /buscar/i }));
    const routeLink = await screen.findByRole("link", { name: /Flota/ });

    expect(routeLink).toHaveAttribute("href", "/fleet");
  });
});

describe("SpotlightSearch — driver", () => {
  beforeEach(() => {
    // El conductor solo tiene acceso al módulo dashboard.
    mockPermissions("driver", {
      dashboard: { canAccess: true, canRead: true, canCreate: false, canUpdate: false, canDelete: false },
    });
  });

  it("solo muestra el panel del conductor y oculta módulos admin", async () => {
    const user = userEvent.setup();
    render(<SpotlightSearch />);

    await user.click(screen.getByRole("button", { name: /buscar/i }));

    const panel = await screen.findByRole("link", { name: /Panel/ });
    expect(panel).toHaveAttribute("href", "/dashboard-user");

    expect(screen.queryByText("Flota")).toBeNull();
    expect(screen.queryByText("Configuración")).toBeNull();
  });
});
