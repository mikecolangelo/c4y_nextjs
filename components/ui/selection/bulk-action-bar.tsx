"use client";

import { Button } from "@/components_shadcn/ui/button";
import { X } from "lucide-react";

export interface BulkActionBarProps {
  /** Number of currently selected rows. */
  selectionCount: number;
  /** Clear the whole selection. */
  onClear: () => void;
  /** Optional label for the "select current page" affordance. */
  onSelectCurrentPage?: () => void;
  /** Count of rows on the current page (shown next to the select-page button). */
  currentPageCount?: number;
  /** Slot for actions (e.g. a Delete button). */
  children?: React.ReactNode;
}

/**
 * Presentational bulk-action bar: shows "N seleccionados", a clear button and a
 * slot for actions. No business logic lives here.
 */
export function BulkActionBar({
  selectionCount,
  onClear,
  onSelectCurrentPage,
  currentPageCount,
  children,
}: BulkActionBarProps) {
  if (selectionCount === 0) return null;

  return (
    <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-lg px-4 py-2 mb-2">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-primary">
          {selectionCount} seleccionado{selectionCount !== 1 ? "s" : ""}
        </span>
        {onSelectCurrentPage && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSelectCurrentPage}>
            Seleccionar todos en esta página
            {typeof currentPageCount === "number" ? ` (${currentPageCount})` : ""}
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
          <X className="h-3 w-3 mr-1" />
          Limpiar
        </Button>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
