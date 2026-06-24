import { describe, expect, it } from "vitest";
import {
  dedupeReminders,
  isIndividualReminderNotification,
  isMoreRecent,
  parseTags,
  reminderKey,
  type DedupRecord,
} from "./notification-dedup";

describe("parseTags", () => {
  it("returns null for null/undefined", () => {
    expect(parseTags(null)).toBeNull();
    expect(parseTags(undefined)).toBeNull();
  });

  it("parses a JSON string", () => {
    expect(parseTags('{"parentReminderId":5}')).toEqual({ parentReminderId: 5 });
  });

  it("returns null for malformed JSON", () => {
    expect(parseTags("{not json")).toBeNull();
  });

  it("passes through an object unchanged", () => {
    const obj = { parentReminderId: 3 };
    expect(parseTags(obj)).toBe(obj);
  });
});

describe("isIndividualReminderNotification", () => {
  it("flags records with a recipient", () => {
    expect(isIndividualReminderNotification({ recipient: { id: 1 } })).toBe(true);
  });

  it("flags records with a parentReminderId tag", () => {
    expect(isIndividualReminderNotification({ tags: { parentReminderId: 9 } })).toBe(true);
    expect(isIndividualReminderNotification({ tags: '{"parentReminderId":9}' })).toBe(true);
  });

  it("does not flag a plain parent reminder", () => {
    expect(isIndividualReminderNotification({ title: "Oil", tags: { module: "fleet" } })).toBe(
      false
    );
  });
});

describe("reminderKey", () => {
  it("builds a normalized title + vehicle key", () => {
    expect(reminderKey({ title: "  Oil Change ", fleetVehicle: { documentId: "veh1" } })).toBe(
      "oil change-veh1"
    );
  });

  it("uses 'unknown' when there is no vehicle", () => {
    expect(reminderKey({ title: "Oil" })).toBe("oil-unknown");
  });

  it("falls back to the provided vehicle id", () => {
    expect(reminderKey({ title: "Oil" }, "fallback")).toBe("oil-fallback");
  });
});

describe("isMoreRecent", () => {
  it("compares by id then createdAt", () => {
    expect(isMoreRecent({ id: 2 }, { id: 1 })).toBe(true);
    expect(isMoreRecent({ id: 1 }, { id: 2 })).toBe(false);
    expect(isMoreRecent({ createdAt: "2024-01-02" }, { createdAt: "2024-01-01" })).toBe(true);
  });
});

describe("dedupeReminders", () => {
  it("collapses duplicate reminders to the most recent per title+vehicle", () => {
    const records: DedupRecord[] = [
      { id: 1, type: "reminder", title: "Oil", fleetVehicle: { id: 7 }, createdAt: "2024-01-01" },
      { id: 2, type: "reminder", title: "Oil", fleetVehicle: { id: 7 }, createdAt: "2024-01-05" },
    ];
    const result = dedupeReminders(records);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("drops exact documentId duplicates", () => {
    const records: DedupRecord[] = [
      { id: 1, documentId: "abc", type: "reminder", title: "A", fleetVehicle: { id: 1 } },
      { id: 2, documentId: "abc", type: "reminder", title: "A", fleetVehicle: { id: 1 } },
    ];
    expect(dedupeReminders(records)).toHaveLength(1);
  });

  it("passes non-reminder notifications through untouched", () => {
    const records: DedupRecord[] = [
      { id: 1, type: "lead", title: "New lead" },
      { id: 2, type: "sale", title: "Sale closed" },
    ];
    const result = dedupeReminders(records);
    expect(result).toHaveLength(2);
  });

  it("collapses a same-title reminder missing its vehicle into the one that has it", () => {
    const records: DedupRecord[] = [
      {
        id: 1,
        type: "reminder",
        title: "Oil",
        fleetVehicle: { documentId: "veh1" },
        createdAt: "2024-01-01",
      },
      { id: 2, type: "reminder", title: "Oil", createdAt: "2024-01-02" },
    ];
    const result = dedupeReminders(records);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("keeps distinct reminders for different vehicles", () => {
    const records: DedupRecord[] = [
      { id: 1, type: "reminder", title: "Oil", fleetVehicle: { id: 1 } },
      { id: 2, type: "reminder", title: "Oil", fleetVehicle: { id: 2 } },
    ];
    expect(dedupeReminders(records)).toHaveLength(2);
  });
});
