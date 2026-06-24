import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/ui/status-badge";

describe("StatusBadge", () => {
  it("renders its children", () => {
    render(<StatusBadge tone="success">Activo</StatusBadge>);
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("applies the tone's color classes", () => {
    render(<StatusBadge tone="danger">Vencido</StatusBadge>);
    const el = screen.getByText("Vencido");
    expect(el.className).toContain("text-red-700");
  });

  it("defaults to the neutral tone when none is given", () => {
    render(<StatusBadge>Sin estado</StatusBadge>);
    const el = screen.getByText("Sin estado");
    expect(el.className).toContain("text-muted-foreground");
  });

  it("merges a custom className", () => {
    render(
      <StatusBadge tone="info" className="ml-2">
        En proceso
      </StatusBadge>
    );
    expect(screen.getByText("En proceso").className).toContain("ml-2");
  });
});
