/**
 * Tests for FleetHeaderActions.
 *
 * The page-size control now delegates to the shared PageSizeSelect (Radix
 * Select). Radix's pointer-driven open flow is not reliably exercisable in
 * jsdom, so we smoke-test the closed state (label + current value + combobox)
 * and cover the bulk-delete affordances that this component owns directly.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FleetHeaderActions } from "../fleet-header-actions";

const createBaseProps = () => ({
  searchQuery: "",
  onSearchChange: vi.fn(),
  viewMode: "list" as const,
  onViewModeChange: vi.fn(),
  isSelectMode: false,
  toggleSelectMode: vi.fn(),
  selectedVehiclesCount: 0,
  onDeleteMultiple: vi.fn(),
  isDeleting: false,
  hasActiveFilters: false,
  activeFiltersCount: 0,
  onOpenFilters: vi.fn(),
  itemsPerPage: 5,
  onItemsPerPageChange: vi.fn(),
  onAddVehicle: vi.fn(),
});

describe("FleetHeaderActions", () => {
  it("renders the shared page-size select with the current value", () => {
    const props = createBaseProps();
    render(<FleetHeaderActions {...props} itemsPerPage={20} />);

    expect(screen.getByText("Mostrar:")).toBeInTheDocument();
    // The shared PageSizeSelect reflects the current itemsPerPage value.
    expect(screen.getByRole("combobox")).toHaveTextContent("20");
  });

  it("does not render the bulk delete button outside select mode", () => {
    const props = createBaseProps();
    render(<FleetHeaderActions {...props} selectedVehiclesCount={2} />);

    expect(screen.queryByRole("button", { name: /eliminar \(2\)/i })).not.toBeInTheDocument();
  });

  it("shows the bulk delete button reflecting the isDeleting flag", () => {
    const props = createBaseProps();
    const { rerender } = render(
      <FleetHeaderActions {...props} isSelectMode selectedVehiclesCount={2} isDeleting={false} />
    );

    expect(screen.getByRole("button", { name: /eliminar \(2\)/i })).toBeEnabled();

    rerender(<FleetHeaderActions {...props} isSelectMode selectedVehiclesCount={2} isDeleting />);
    expect(screen.getByRole("button", { name: /eliminar \(2\)/i })).toBeDisabled();
  });
});
