/**
 * Pure helpers for the mileage counter so the core logic can be unit-tested
 * independently of the React component.
 */

export type MileageUpdateMode = "set" | "add";

/**
 * Computes the absolute new mileage from the dialog input.
 *
 * - In "add" mode the input is a delta added to the current mileage.
 * - In "set" mode the input is the absolute new total.
 *
 * Returns `null` when the input is invalid: not a number, negative, a non-positive
 * delta in "add" mode, or a result lower than the current mileage.
 */
export function computeNewMileage(
  mode: MileageUpdateMode,
  rawInput: number,
  current: number
): number | null {
  if (typeof rawInput !== "number" || isNaN(rawInput) || rawInput < 0) return null;
  if (mode === "add" && rawInput <= 0) return null;
  const value = mode === "add" ? current + rawInput : rawInput;
  if (value < current) return null;
  return value;
}

/**
 * Picks the history entry key (documentId or numeric id as string) whose
 * `newMileage` is closest to the target mileage. Used to highlight/scroll to the
 * history item that corresponds to a vehicle status anchored at a given mileage.
 *
 * Returns `null` when there is no target or the history is empty.
 */
export function pickHistoryHighlightKey(
  history: Array<{ id: number; documentId?: string; newMileage: number }>,
  targetMileage: number | null
): string | null {
  if (targetMileage == null || history.length === 0) return null;
  let best = history[0];
  let bestDiff = Math.abs((best.newMileage ?? 0) - targetMileage);
  for (const h of history) {
    const diff = Math.abs((h.newMileage ?? 0) - targetMileage);
    if (diff < bestDiff) {
      best = h;
      bestDiff = diff;
    }
  }
  return best.documentId ?? String(best.id);
}
