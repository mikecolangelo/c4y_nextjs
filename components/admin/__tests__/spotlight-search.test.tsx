import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpotlightSearch } from "../spotlight-search";

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

describe("SpotlightSearch", () => {
  it("renderiza el botón de búsqueda global", () => {
    render(<SpotlightSearch />);
    expect(screen.getByRole("button", { name: /búsqueda global/i })).toBeInTheDocument();
  });

  it("abre el diálogo y muestra las rutas disponibles", async () => {
    const user = userEvent.setup();
    render(<SpotlightSearch />);

    await user.click(screen.getByRole("button", { name: /búsqueda global/i }));
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Flota")).toBeInTheDocument();
  });

  it("navega a la ruta seleccionada", async () => {
    const user = userEvent.setup();
    render(<SpotlightSearch />);

    await user.click(screen.getByRole("button", { name: /búsqueda global/i }));
    const routeLink = await screen.findByRole("link", { name: /Flota/ });

    expect(routeLink).toHaveAttribute("href", "/fleet");
  });
});
