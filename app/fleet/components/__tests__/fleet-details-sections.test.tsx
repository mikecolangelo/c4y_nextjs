
import { describe, it, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FleetDetailsNotesCard } from "../fleet-details-notes";
import { FleetDetailsStatusCard } from "../fleet-details-statuses";
import { FleetDetailsRemindersCard } from "../fleet-details-reminders";
import { ReminderType, RecurrencePattern } from "@/validations/types";

vi.mock("@/components/ui/notes-timeline", () => ({
  NotesTimeline: () => <div data-testid="notes-timeline" />,
}));
vi.mock("@/components/ui/vehicle-status-timeline", () => ({
  VehicleStatusTimeline: () => <div data-testid="status-timeline" />,
}));
vi.mock("@/components/ui/fleet-reminders", () => ({
  FleetReminders: () => <div data-testid="fleet-reminders" />,
}));

describe("Fleet details sections", () => {
  it("renders notes card", () => {
    render(
      <FleetDetailsNotesCard
        notes={[]}
        isLoadingNotes={false}
        showNoteForm={false}
        noteValue=""
        onAddNote={vi.fn()}
        onCancelNote={vi.fn()}
        onNoteChange={vi.fn()}
        onSaveNote={vi.fn()}
        onEditNote={async () => undefined}
        onDeleteNote={async () => undefined}
        vehicleId="veh-1"
      />
    );
    expect(screen.getByText(/Notas y Comentarios/i)).toBeInTheDocument();
  });

  it("renders status card", () => {
    render(
      <FleetDetailsStatusCard
        vehicleStatuses={[]}
        isLoadingStatuses={false}
        loadingStatusId={null}
        showStatusForm={false}
        statusImagePreviews={[]}
        statusImagesCount={0}
        statusComment=""
        onStatusCommentChange={vi.fn()}
        onAddStatus={vi.fn()}
        onCancelStatus={vi.fn()}
        onStatusImageChange={vi.fn()}
        onRemoveStatusImage={vi.fn()}
        onSaveStatus={vi.fn()}
        onEditStatus={async () => undefined}
        onDeleteStatus={async () => undefined}
        vehicleId="veh-1"
      />
    );
    expect(screen.getByText(/Estados del Vehículo/i)).toBeInTheDocument();
  });

  it("renders reminders card", () => {
    render(
      <FleetDetailsRemindersCard
        vehicleReminders={[]}
        isLoadingReminders={false}
        showReminderForm={false}
        reminderTitle=""
        reminderDescription=""
        reminderType={"unique" as ReminderType}
        reminderScheduledDate=""
        reminderScheduledTime=""
        isAllDay={false}
        reminderRecurrencePattern={"daily" as RecurrencePattern}
        reminderRecurrenceEndDate=""
        selectedResponsables={[]}
        selectedAssignedDrivers={[]}
        isSavingReminder={false}
        availableUsers={[]}
        onAddReminder={vi.fn()}
        onCancelReminder={vi.fn()}
        onReminderTitleChange={vi.fn()}
        onReminderDescriptionChange={vi.fn()}
        onReminderTypeChange={vi.fn()}
        onReminderScheduledDateChange={vi.fn()}
        onReminderScheduledTimeChange={vi.fn()}
        onReminderIsAllDayChange={vi.fn()}
        onReminderRecurrencePatternChange={vi.fn()}
        onReminderRecurrenceEndDateChange={vi.fn()}
        onSelectedResponsablesChange={vi.fn()}
        onSelectedAssignedDriversChange={vi.fn()}
        editingReminderId={null}
        onSaveReminder={vi.fn()}
        onEditReminder={vi.fn()}
        onDeleteReminder={async () => undefined}
        onToggleReminderActive={async () => undefined}
        onToggleReminderCompleted={async () => undefined}
        vehicleId="veh-1"
      />
    );
    expect(screen.getByText(/Recordatorios del Vehículo/i)).toBeInTheDocument();
  });
});
