import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VehicleActionMenu } from "../vehicle-action-menu";
import type { FleetVehicleCard } from "@/validations/types";

vi.mock("@/components/auth/can", () => ({
  Can: ({ children }: { children: React.ReactNode }) => children,
}));

const mockVehicle: FleetVehicleCard = {
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
};

const createMockHandlers = () => ({
  onNavigateToDetails: vi.fn(),
  onNavigateToEdit: vi.fn(),
  onDuplicateVehicle: vi.fn(),
  onRequestDeleteVehicle: vi.fn(),
});

describe("VehicleActionMenu - Pruebas de funcionalidad", () => {
  let handlers: ReturnType<typeof createMockHandlers>;

  beforeEach(() => {
    handlers = createMockHandlers();
  });

  // PRUEBA 1: El menú se renderiza correctamente
  it("Prueba 1: Renderiza el botón de menú correctamente", () => {
    render(<VehicleActionMenu vehicle={mockVehicle} vehicleId="doc-1" {...handlers} />);

    const button = screen.getByLabelText(/opciones del vehículo/i);
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  // PRUEBA 2: El menú se abre al hacer clic
  it("Prueba 2: El menú se abre al hacer clic en el botón", async () => {
    const user = userEvent.setup();
    render(<VehicleActionMenu vehicle={mockVehicle} vehicleId="doc-1" {...handlers} />);

    const button = screen.getByLabelText(/opciones del vehículo/i);
    await user.click(button);

    // Verificar que el menú está visible
    await waitFor(() => {
      expect(screen.getByText(/ver detalles/i)).toBeInTheDocument();
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
      expect(screen.getByText(/duplicar/i)).toBeInTheDocument();
      expect(screen.getByText(/eliminar/i)).toBeInTheDocument();
    });
  });

  // PRUEBA 3: "Ver detalles" ejecuta la acción correcta
  it("Prueba 3: La opción 'Ver detalles' llama a onNavigateToDetails", async () => {
    const user = userEvent.setup();
    render(<VehicleActionMenu vehicle={mockVehicle} vehicleId="doc-1" {...handlers} />);

    const button = screen.getByLabelText(/opciones del vehículo/i);
    await user.click(button);

    const detailsOption = await screen.findByText(/ver detalles/i);
    await user.click(detailsOption);

    expect(handlers.onNavigateToDetails).toHaveBeenCalledTimes(1);
    expect(handlers.onNavigateToDetails).toHaveBeenCalledWith("doc-1");
  });

  // PRUEBA 4: "Editar" ejecuta la acción correcta
  it("Prueba 4: La opción 'Editar' llama a onNavigateToEdit", async () => {
    const user = userEvent.setup();
    render(<VehicleActionMenu vehicle={mockVehicle} vehicleId="doc-1" {...handlers} />);

    const button = screen.getByLabelText(/opciones del vehículo/i);
    await user.click(button);

    const editOption = await screen.findByText(/editar/i);
    await user.click(editOption);

    expect(handlers.onNavigateToEdit).toHaveBeenCalledTimes(1);
    expect(handlers.onNavigateToEdit).toHaveBeenCalledWith("doc-1");
  });

  // PRUEBA 5: "Duplicar" ejecuta la acción correcta
  it("Prueba 5: La opción 'Duplicar' llama a onDuplicateVehicle", async () => {
    const user = userEvent.setup();
    render(<VehicleActionMenu vehicle={mockVehicle} vehicleId="doc-1" {...handlers} />);

    const button = screen.getByLabelText(/opciones del vehículo/i);
    await user.click(button);

    const duplicateOption = await screen.findByText(/duplicar/i);
    await user.click(duplicateOption);

    expect(handlers.onDuplicateVehicle).toHaveBeenCalledTimes(1);
    expect(handlers.onDuplicateVehicle).toHaveBeenCalledWith(mockVehicle);
  });

  // PRUEBA BONUS: "Eliminar" ejecuta la acción correcta
  it("Prueba BONUS: La opción 'Eliminar' llama a onRequestDeleteVehicle", async () => {
    const user = userEvent.setup();
    render(<VehicleActionMenu vehicle={mockVehicle} vehicleId="doc-1" {...handlers} />);

    const button = screen.getByLabelText(/opciones del vehículo/i);
    await user.click(button);

    const deleteOption = await screen.findByText(/eliminar/i);
    await user.click(deleteOption);

    expect(handlers.onRequestDeleteVehicle).toHaveBeenCalledTimes(1);
    expect(handlers.onRequestDeleteVehicle).toHaveBeenCalledWith(mockVehicle);
  });

  // PRUEBA: El botón puede estar deshabilitado
  it("Prueba: El botón respeta el estado disabled", () => {
    render(
      <VehicleActionMenu vehicle={mockVehicle} vehicleId="doc-1" {...handlers} disabled={true} />
    );

    const button = screen.getByLabelText(/opciones del vehículo/i);
    expect(button).toBeDisabled();
  });
});
