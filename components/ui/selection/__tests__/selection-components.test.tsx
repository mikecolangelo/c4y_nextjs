import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkActionBar } from "../bulk-action-bar";
import { SelectAllAcrossPagesBanner } from "../select-all-across-pages-banner";

describe("BulkActionBar", () => {
  it("renders nothing when no rows are selected", () => {
    const { container } = render(<BulkActionBar selectionCount={0} onClear={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the count and wires clear + action slot", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <BulkActionBar selectionCount={3} onClear={onClear}>
        <button>Eliminar</button>
      </BulkActionBar>
    );
    expect(screen.getByText("3 seleccionados")).toBeInTheDocument();
    expect(screen.getByText("Eliminar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /limpiar/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("uses singular wording for one selection", () => {
    render(<BulkActionBar selectionCount={1} onClear={vi.fn()} />);
    expect(screen.getByText("1 seleccionado")).toBeInTheDocument();
  });
});

describe("SelectAllAcrossPagesBanner", () => {
  const base = {
    show: true,
    isAllFilteredSelected: false,
    pageCount: 10,
    totalFiltered: 42,
    onSelectAll: vi.fn(),
    onRevert: vi.fn(),
  };

  it("renders nothing when show is false and not all selected", () => {
    const { container } = render(<SelectAllAcrossPagesBanner {...base} show={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Gmail-style CTA when there are rows beyond the page", async () => {
    const user = userEvent.setup();
    const onSelectAll = vi.fn();
    render(<SelectAllAcrossPagesBanner {...base} onSelectAll={onSelectAll} />);
    expect(screen.getByText(/Has seleccionado los/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Seleccionar los 42/i }));
    expect(onSelectAll).toHaveBeenCalledOnce();
  });

  it("offers a revert affordance when everything is selected", async () => {
    const user = userEvent.setup();
    const onRevert = vi.fn();
    render(
      <SelectAllAcrossPagesBanner
        {...base}
        show={false}
        isAllFilteredSelected
        onRevert={onRevert}
      />
    );
    await user.click(screen.getByRole("button", { name: /Deshacer/i }));
    expect(onRevert).toHaveBeenCalledOnce();
  });
});
