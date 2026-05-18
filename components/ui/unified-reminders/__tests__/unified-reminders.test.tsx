import { describe, it, vi, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedReminders } from "../unified-reminders";
import { UnifiedReminderItem } from "../unified-reminder-item";
import type { FleetReminder } from "@/validations/types";

// Mock de date-fns
vi.mock("date-fns", async () => {
  const actual = await vi.importActual("date-fns");
  return {
    ...actual,
    format: () => "12 de diciembre, 2025",
  };
});

// Mock de date-fns/locale
vi.mock("date-fns/locale", () => ({
  es: {},
}));

const mockReminders: FleetReminder[] = [
  {
    id: 1,
    documentId: "reminder-1",
    title: "Mantenimiento del vehículo",
    description: "Revisar aceite y filtros",
    reminderType: "unique",
    module: "fleet",
    scheduledDate: "2025-12-15T10:00:00Z",
    nextTrigger: "2025-12-15T10:00:00Z",
    isActive: true,
    isCompleted: false,
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2025-12-01T00:00:00Z",
    author: {
      id: 1,
      displayName: "Test User",
    },
    vehicle: {
      id: 1,
      name: "Ford Mustang 2023",
    },
  },
  {
    id: 2,
    documentId: "reminder-2",
    title: "Pago de seguro",
    description: "Renovar póliza anual",
    reminderType: "recurring",
    recurrencePattern: "monthly",
    module: "billing",
    scheduledDate: "2025-12-20T09:00:00Z",
    nextTrigger: "2025-12-20T09:00:00Z",
    isActive: true,
    isCompleted: false,
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2025-12-01T00:00:00Z",
    author: {
      id: 1,
      displayName: "Test User",
    },
  },
  {
    id: 3,
    documentId: "reminder-3",
    title: "Recordatorio pausado",
    reminderType: "unique",
    module: "services",
    scheduledDate: "2025-12-25T00:00:00Z",
    nextTrigger: "2025-12-25T00:00:00Z",
    isActive: false,
    isCompleted: false,
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2025-12-01T00:00:00Z",
  },
  {
    id: 4,
    documentId: "reminder-4",
    title: "Recordatorio completado",
    reminderType: "unique",
    module: "contracts",
    scheduledDate: "2025-12-10T00:00:00Z",
    nextTrigger: "2025-12-10T00:00:00Z",
    isActive: true,
    isCompleted: true,
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2025-12-01T00:00:00Z",
  },
];

describe("UnifiedReminders", () => {
  it("muestra el estado de carga", () => {
    render(
      <UnifiedReminders
        reminders={[]}
        isLoading={true}
        onToggleCompleted={vi.fn()}
        onToggleActive={vi.fn()}
      />
    );
    expect(screen.getByText(/cargando recordatorios/i)).toBeInTheDocument();
  });

  it("muestra mensaje cuando no hay recordatorios", () => {
    render(
      <UnifiedReminders
        reminders={[]}
        isLoading={false}
        onToggleCompleted={vi.fn()}
        onToggleActive={vi.fn()}
      />
    );
    expect(screen.getByText(/aún no hay recordatorios/i)).toBeInTheDocument();
  });

  it("muestra los recordatorios activos", () => {
    render(
      <UnifiedReminders
        reminders={mockReminders}
        isLoading={false}
        showModuleTags={true}
        onToggleCompleted={vi.fn()}
        onToggleActive={vi.fn()}
      />
    );
    
    expect(screen.getByText("Mantenimiento del vehículo")).toBeInTheDocument();
    expect(screen.getByText("Pago de seguro")).toBeInTheDocument();
  });

  it("muestra los tabs de activos y pausados", () => {
    render(
      <UnifiedReminders
        reminders={mockReminders}
        isLoading={false}
        showArchivedTab={true}
        onToggleCompleted={vi.fn()}
        onToggleActive={vi.fn()}
      />
    );
    
    expect(screen.getByText("Activos")).toBeInTheDocument();
    expect(screen.getByText("Pausados")).toBeInTheDocument();
  });

  it("muestra los tags de módulo", () => {
    render(
      <UnifiedReminders
        reminders={mockReminders}
        isLoading={false}
        showModuleTags={true}
        onToggleCompleted={vi.fn()}
        onToggleActive={vi.fn()}
      />
    );
    
    expect(screen.getByText("Flota")).toBeInTheDocument();
    expect(screen.getByText("Facturación")).toBeInTheDocument();
  });
});

describe("UnifiedReminderItem", () => {
  it("renderiza el recordatorio correctamente", () => {
    render(
      <UnifiedReminderItem
        reminder={mockReminders[0]}
        showModule={true}
        onToggleCompleted={vi.fn()}
        onToggleActive={vi.fn()}
      />
    );
    
    expect(screen.getByText("Mantenimiento del vehículo")).toBeInTheDocument();
    expect(screen.getByText("Flota")).toBeInTheDocument();
  });

  it("muestra el checkbox de completado", () => {
    const handleToggleCompleted = vi.fn();
    render(
      <UnifiedReminderItem
        reminder={mockReminders[0]}
        onToggleCompleted={handleToggleCompleted}
      />
    );
    
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
  });

  it("muestra badge de pausado cuando isActive es false", () => {
    render(
      <UnifiedReminderItem
        reminder={mockReminders[2]}
        showModule={true}
      />
    );
    
    expect(screen.getByText("Pausado")).toBeInTheDocument();
  });

  it("muestra badge de recurrencia para recordatorios recurrentes", () => {
    render(
      <UnifiedReminderItem
        reminder={mockReminders[1]}
        showModule={true}
        compact={false}
      />
    );
    
    expect(screen.getByText("Mensual")).toBeInTheDocument();
  });

  it("aplica estilo de completado cuando isCompleted es true", () => {
    render(
      <UnifiedReminderItem
        reminder={mockReminders[3]}
        showModule={true}
      />
    );
    
    const title = screen.getByText("Recordatorio completado");
    expect(title).toHaveClass("line-through");
  });
});















