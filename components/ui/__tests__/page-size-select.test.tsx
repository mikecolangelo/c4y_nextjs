/**
 * Tests for PageSizeSelect.
 *
 * NOTE: the underlying Radix Select renders its options into a portal that only
 * mounts on open, and Radix's pointer-driven open flow is not reliably
 * exercisable in jsdom. We therefore smoke-test the closed (trigger) state:
 * the "Mostrar:" label and the current value are rendered. Open/selection
 * interaction is covered by E2E.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PageSizeSelect } from "@/components/ui/page-size-select";

describe("PageSizeSelect", () => {
  it("renders the 'Mostrar:' label", () => {
    render(<PageSizeSelect value={20} onChange={() => {}} />);
    expect(screen.getByText("Mostrar:")).toBeInTheDocument();
  });

  it("renders the current value in the trigger", () => {
    render(<PageSizeSelect value={50} onChange={() => {}} />);
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("renders a combobox trigger", () => {
    render(<PageSizeSelect value={10} onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("accepts a custom options list without throwing", () => {
    expect(() =>
      render(<PageSizeSelect value={25} options={[25, 75]} onChange={() => {}} />)
    ).not.toThrow();
    expect(screen.getByText("25")).toBeInTheDocument();
  });
});
