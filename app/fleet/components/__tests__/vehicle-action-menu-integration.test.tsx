import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/components/auth/can", () => ({
  Can: ({ children }: { children: React.ReactNode }) => children,
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
];

const createBaseProps = () => ({
  paginatedVehicles: vehicles,
  filteredVehiclesLength: vehicles.length,
  totalPages: 1,
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

describe("VehicleActionMenu - Pruebas de integración en vistas", () => {
  // PRUEBA 1: Vista de lista - menú funciona
  it("Vista LISTA: El menú de opciones se abre y ejecuta acciones", async () => {
    const user = userEvent.setup();
    const props = createBaseProps();
    render(<FleetVehicleViews {...props} viewMode="list" />);

    const menuButton = screen.getByLabelText(/opciones del vehículo/i);
    await user.click(menuButton);

    // Verificar que el menú se abre
    await waitFor(() => {
      expect(screen.getByText(/ver detalles/i)).toBeInTheDocument();
    });

    // Clic en editar
    await user.click(screen.getByText(/editar/i));
    expect(props.onNavigateToEdit).toHaveBeenCalledWith("doc-1");
  });

  // PRUEBA 2: Vista de grid - menú funciona
  it("Vista GRID: El menú de opciones se abre y ejecuta acciones", async () => {
    const user = userEvent.setup();
    const props = createBaseProps();
    render(<FleetVehicleViews {...props} viewMode="grid" />);

    const menuButton = screen.getByLabelText(/opciones del vehículo/i);
    await user.click(menuButton);

    // Verificar que el menú se abre
    await waitFor(() => {
      expect(screen.getByText(/ver detalles/i)).toBeInTheDocument();
    });

    // Clic en duplicar
    await user.click(screen.getByText(/duplicar/i));
    expect(props.onDuplicateVehicle).toHaveBeenCalledWith(vehicles[0]);
  });

  // PRUEBA 3: Vista de tabla - menú funciona
  it("Vista TABLA: El menú de opciones se abre y ejecuta acciones", async () => {
    const user = userEvent.setup();
    const props = createBaseProps();
    render(<FleetVehicleViews {...props} viewMode="table" />);

    const menuButton = screen.getByLabelText(/opciones del vehículo/i);
    await user.click(menuButton);

    // Verificar que el menú se abre
    await waitFor(() => {
      expect(screen.getByText(/ver detalles/i)).toBeInTheDocument();
    });

    // Clic en eliminar
    await user.click(screen.getByText(/eliminar/i));
    expect(props.onRequestDeleteVehicle).toHaveBeenCalledWith(vehicles[0]);
  });

  // PRUEBA 4: stopPropagation previene la navegación al hacer clic en el menú
  it("El clic en el menú NO propaga al contenedor del vehículo", async () => {
    const user = userEvent.setup();
    const props = createBaseProps();
    render(<FleetVehicleViews {...props} viewMode="list" />);

    const menuButton = screen.getByLabelText(/opciones del vehículo/i);
    await user.click(menuButton);

    // Esperar a que el menú se abra
    await waitFor(() => {
      expect(screen.getByText(/ver detalles/i)).toBeInTheDocument();
    });

    // Clic en una opción del menú
    await user.click(screen.getByText(/ver detalles/i));

    // onNavigateToDetails debería ser llamado SOLO por el menú, no por propagación
    expect(props.onNavigateToDetails).toHaveBeenCalledTimes(1);
    expect(props.onNavigateToDetails).toHaveBeenCalledWith("doc-1");
  });

  // PRUEBA 5: Menú funciona con múltiples vehículos
  it("Funciona correctamente con múltiples vehículos", async () => {
    const user = userEvent.setup();
    const multiVehicles: FleetVehicleCard[] = [
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

    const props = {
      ...createBaseProps(),
      paginatedVehicles: multiVehicles,
      filteredVehiclesLength: multiVehicles.length,
    };

    render(<FleetVehicleViews {...props} viewMode="list" />);

    // Debería haber 2 botones de menú
    const menuButtons = screen.getAllByLabelText(/opciones del vehículo/i);
    expect(menuButtons).toHaveLength(2);

    // Abrir el segundo menú
    await user.click(menuButtons[1]);

    await waitFor(() => {
      expect(screen.getByText(/ver detalles/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/editar/i));
    expect(props.onNavigateToEdit).toHaveBeenCalledWith("doc-2");
  });
});
