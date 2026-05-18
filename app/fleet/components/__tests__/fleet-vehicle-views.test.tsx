import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FleetVehicleViews } from "../fleet-vehicle-views";
import type { FleetVehicleCard } from "@/validations/types";

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    const { fill, ...rest } = props;
    return <img {...rest} alt={props.alt} />;
  },
}));

const vehicles: FleetVehicleCard[] = [
  {
    id: "1",
    documentId: "doc-1",
    numericId: 1,
    name: "Ford Mustang",
    vin: "VIN1234",
    priceNumber: 40000,
    priceLabel: "$40,000",
    condition: "nuevo",
    brand: "Ford",
    model: "Mustang",
    year: 2023,
    imageUrl: "https://example.com/car-1.jpg",
    assignedDrivers: [],
    responsables: [],
    interestedDrivers: [],
    interestedPersons: [],
  },
  {
    id: "2",
    documentId: "doc-2",
    numericId: 2,
    name: "Chevy Camaro",
    vin: "VIN5678",
    priceNumber: 35000,
    priceLabel: "$35,000",
    condition: "usado",
    brand: "Chevrolet",
    model: "Camaro",
    year: 2021,
    imageUrl: "https://example.com/car-2.jpg",
    assignedDrivers: [],
    responsables: [],
    interestedDrivers: [],
    interestedPersons: [],
  },
];


const createBaseProps = () => ({
  paginatedVehicles: vehicles,
  filteredVehiclesLength: vehicles.length,
  totalPages: 3,
  currentPage: 1,
  itemsPerPage: 5,
  isSelectMode: false,
  selectedVehicles: new Set<string>(),
  onToggleVehicleSelection: vi.fn(),
  onSelectAll: vi.fn(),
  onNavigateToDetails: vi.fn(),
  onNavigateToEdit: vi.fn(),
  onDuplicateVehicle: vi.fn(),
  onRequestDeleteVehicle: vi.fn(),
  onPageChange: vi.fn(),
});

describe("FleetVehicleViews", () => {
  it("muestra el botón de selección en la vista de lista", () => {
    const props = createBaseProps();
    render(<FleetVehicleViews {...props} viewMode="list" isSelectMode={true} />);
    expect(screen.getByRole("button", { name: /seleccionar todos/i })).toBeInTheDocument();
    expect(screen.getByText("Ford Mustang")).toBeInTheDocument();
  });

  it("muestra los botones de opciones en la vista de cuadrícula", () => {
    const props = createBaseProps();
    render(<FleetVehicleViews {...props} viewMode="grid" />);
    expect(screen.getAllByLabelText(/opciones del vehículo/i)).not.toHaveLength(0);
    expect(screen.getByText(/Chevy Camaro/i)).toBeInTheDocument();
  });

  it("renderiza la tabla y dispara paginación", async () => {
    const user = userEvent.setup();
    const props = createBaseProps();
    render(<FleetVehicleViews {...props} viewMode="table" isSelectMode={true} />);

    expect(screen.getByRole("columnheader", { name: /VIN/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(props.onPageChange).toHaveBeenCalledWith(2);
  });
});
