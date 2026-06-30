"use client";

import { Button } from "@/components_shadcn/ui/button";

/** Derived state returned by `usePaginatedSelection().getAcrossPagesBanner`. */
export interface AcrossPagesBannerState {
  show: boolean;
  isAllFilteredSelected: boolean;
  pageCount: number;
  totalFiltered: number;
  remaining: number;
}

export interface SelectAllAcrossPagesBannerProps {
  /** Whether the banner should render (from `getAcrossPagesBanner().show`). */
  show: boolean;
  /** Whether every filtered row is already selected. */
  isAllFilteredSelected: boolean;
  /** Count of rows on the current page. */
  pageCount: number;
  /** Count of every filtered row across all pages. */
  totalFiltered: number;
  /** Select every filtered row across all pages. */
  onSelectAll: () => void;
  /** Revert to only the current-page selection. */
  onRevert: () => void;
}

/**
 * Gmail-style "select all across pages" banner.
 *
 * Renders ONLY when `show` is true: the current page is fully selected AND there
 * are more filtered rows beyond the current page. It must not appear when
 * everything fits on a single page or there is nothing beyond the current page.
 */
export function SelectAllAcrossPagesBanner({
  show,
  isAllFilteredSelected,
  pageCount,
  totalFiltered,
  onSelectAll,
  onRevert,
}: SelectAllAcrossPagesBannerProps) {
  // Only meaningful when there are rows beyond the current page; on a single-page
  // list selecting "all" is just the normal page selection, so no banner applies.
  const hasRowsBeyondPage = totalFiltered > pageCount;

  // Once everything is selected, offer the revert affordance instead of the CTA —
  // but only if the selection actually spans more than the current page.
  if (isAllFilteredSelected && hasRowsBeyondPage) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-1 bg-primary/5 border border-primary/10 rounded-lg px-4 py-2 mb-2 text-center text-sm">
        <span className="text-muted-foreground">
          Has seleccionado los <strong>{totalFiltered}</strong> registros de todas las páginas.
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs underline"
          onClick={onRevert}
        >
          Deshacer selección
        </Button>
      </div>
    );
  }

  if (!show) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 bg-primary/5 border border-primary/10 rounded-lg px-4 py-2 mb-2 text-center text-sm">
      <span className="text-muted-foreground">
        Has seleccionado los <strong>{pageCount}</strong> de esta página.
      </span>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs underline"
        onClick={onSelectAll}
      >
        Seleccionar los {totalFiltered}
      </Button>
    </div>
  );
}
