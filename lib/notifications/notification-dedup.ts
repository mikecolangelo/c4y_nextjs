/**
 * Pure deduplication helpers shared by the notifications and reminders route
 * handlers. Reminders can arrive duplicated (same title + vehicle) due to race
 * conditions when they are created; these helpers collapse them to the most
 * recent entry. Kept side-effect free so they can be unit-tested in isolation.
 */

/** Loose shape of a reminder/notification record relevant to deduplication. */
export interface DedupRecord {
  id?: number | string;
  documentId?: string;
  title?: string;
  type?: string;
  createdAt?: string;
  fleetVehicle?: { id?: number | string; documentId?: string } | null;
  tags?: unknown;
  recipient?: unknown;
}

/** Safely parses a `tags` value that may be a JSON string or an object. */
export function parseTags(tags: unknown): Record<string, unknown> | null {
  if (tags === null || tags === undefined) {
    return null;
  }
  if (typeof tags === "string") {
    try {
      return JSON.parse(tags) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof tags === "object") {
    return tags as Record<string, unknown>;
  }
  return null;
}

/**
 * Returns true when a record is an individual reminder notification (one that
 * was fanned out to a specific recipient), which should be hidden in favour of
 * its parent reminder. Such records have a `recipient` or a `parentReminderId`
 * in their tags.
 */
export function isIndividualReminderNotification(record: DedupRecord): boolean {
  if (record.recipient !== undefined && record.recipient !== null) {
    return true;
  }
  const tags = parseTags(record.tags);
  return Boolean(tags && tags.parentReminderId !== undefined && tags.parentReminderId !== null);
}

/** Derives the dedup key (`title-vehicle`) for a reminder record. */
export function reminderKey(record: DedupRecord, fallbackVehicleId?: string | null): string {
  const normalizedTitle = (record.title?.trim() ?? "").toLowerCase();
  const vehicleId =
    record.fleetVehicle?.documentId ??
    (record.fleetVehicle?.id ? String(record.fleetVehicle.id) : null) ??
    fallbackVehicleId ??
    "unknown";
  return `${normalizedTitle}-${vehicleId}`;
}

/** Returns true when `candidate` is more recent than `current` (id or createdAt). */
export function isMoreRecent(candidate: DedupRecord, current: DedupRecord): boolean {
  const currentId = Number(current.id ?? 0);
  const candidateId = Number(candidate.id ?? 0);
  const currentDate = current.createdAt ? new Date(current.createdAt).getTime() : 0;
  const candidateDate = candidate.createdAt ? new Date(candidate.createdAt).getTime() : 0;
  return candidateId > currentId || candidateDate > currentDate;
}

/**
 * Collapses duplicate reminder records, keeping a single most-recent entry per
 * `title-vehicle` key. Records that are not reminders are passed through
 * untouched. Exact `documentId` duplicates are dropped.
 */
export function dedupeReminders<T extends DedupRecord>(records: readonly T[]): T[] {
  const byKey = new Map<string, T>();
  const seenDocumentIds = new Set<string>();
  const titleGroups = new Map<string, T[]>();
  const passthrough: T[] = [];

  for (const record of records) {
    if (record.documentId) {
      if (seenDocumentIds.has(record.documentId)) {
        continue;
      }
      seenDocumentIds.add(record.documentId);
    }

    if (record.type !== "reminder") {
      passthrough.push(record);
      continue;
    }

    const normalizedTitle = (record.title?.trim() ?? "").toLowerCase();
    const group = titleGroups.get(normalizedTitle) ?? [];
    group.push(record);
    titleGroups.set(normalizedTitle, group);

    // If this reminder lacks a vehicle but a same-title sibling has one, reuse
    // it so they collapse to the same key (data-inconsistency safety net).
    let fallbackVehicleId: string | null = null;
    if (!record.fleetVehicle?.documentId && !record.fleetVehicle?.id) {
      const sibling = group.find((r) => r.fleetVehicle?.documentId || r.fleetVehicle?.id);
      if (sibling) {
        fallbackVehicleId =
          sibling.fleetVehicle?.documentId ??
          (sibling.fleetVehicle?.id ? String(sibling.fleetVehicle.id) : null);
      }
    }

    const key = reminderKey(record, fallbackVehicleId);
    const existing = byKey.get(key);
    if (!existing || isMoreRecent(record, existing)) {
      byKey.set(key, record);
    }
  }

  return [...passthrough, ...Array.from(byKey.values())];
}
