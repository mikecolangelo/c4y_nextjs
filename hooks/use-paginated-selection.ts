"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Reusable multi-selection hook for paginated lists.
 *
 * Encapsulates the "select per page", "select across all filtered pages" and
 * "Gmail-style across-pages banner" semantics so every module that needs
 * bulk-selection shares one implementation instead of re-deriving it inline.
 *
 * Ids are always handled as strings (callers should pass `documentId ?? String(id)`).
 */
export interface UsePaginatedSelectionResult {
  /** The currently selected ids (accumulates across pages). */
  selectedIds: Set<string>;
  /** Number of selected ids. */
  selectionCount: number;
  /** Whether a given id is selected. */
  isSelected: (id: string) => boolean;
  /** Toggle a single id on/off. */
  toggle: (id: string) => void;
  /** Union the current page ids into the selection. */
  selectCurrentPage: (pageIds: string[]) => void;
  /** Remove only the current-page ids from the selection. */
  clearCurrentPage: (pageIds: string[]) => void;
  /** Clear the whole selection. */
  clearAll: () => void;
  /** Select every filtered row across all pages. */
  selectAllAcrossPages: (allFilteredIds: string[]) => void;
  /** Whether every id on the current page is selected. */
  isCurrentPageAllSelected: (pageIds: string[]) => boolean;
  /** Replace the selection wholesale (escape hatch for callers that own the state shape). */
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  /**
   * Derived helper for the "select all across pages" banner.
   *
   * @param pageIds        Ids visible on the current page.
   * @param allFilteredIds Ids of every filtered row across all pages.
   */
  getAcrossPagesBanner: (
    pageIds: string[],
    allFilteredIds: string[]
  ) => {
    /** Whether the banner should be shown. */
    show: boolean;
    /** Whether every filtered row is already selected. */
    isAllFilteredSelected: boolean;
    /** Count of rows on the current page. */
    pageCount: number;
    /** Count of every filtered row across all pages. */
    totalFiltered: number;
    /** Filtered rows that exist beyond the current page. */
    remaining: number;
  };
}

export function usePaginatedSelection(initial?: Iterable<string>): UsePaginatedSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initial));

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectCurrentPage = useCallback((pageIds: string[]) => {
    setSelectedIds((prev) => new Set([...prev, ...pageIds]));
  }, []);

  const clearCurrentPage = useCallback((pageIds: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAllAcrossPages = useCallback((allFilteredIds: string[]) => {
    setSelectedIds(new Set(allFilteredIds));
  }, []);

  const isCurrentPageAllSelected = useCallback(
    (pageIds: string[]) => pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id)),
    [selectedIds]
  );

  const getAcrossPagesBanner = useCallback(
    (pageIds: string[], allFilteredIds: string[]) => {
      const pageCount = pageIds.length;
      const totalFiltered = allFilteredIds.length;
      const remaining = totalFiltered - pageCount;
      const currentPageAllSelected = pageCount > 0 && pageIds.every((id) => selectedIds.has(id));
      const isAllFilteredSelected =
        totalFiltered > 0 && allFilteredIds.every((id) => selectedIds.has(id));

      // Banner appears ONLY when the current page is fully selected AND there are
      // more filtered rows beyond the current page that are not yet all selected.
      const show = currentPageAllSelected && remaining > 0 && !isAllFilteredSelected;

      return { show, isAllFilteredSelected, pageCount, totalFiltered, remaining };
    },
    [selectedIds]
  );

  const selectionCount = selectedIds.size;

  return useMemo(
    () => ({
      selectedIds,
      selectionCount,
      isSelected,
      toggle,
      selectCurrentPage,
      clearCurrentPage,
      clearAll,
      selectAllAcrossPages,
      isCurrentPageAllSelected,
      setSelectedIds,
      getAcrossPagesBanner,
    }),
    [
      selectedIds,
      selectionCount,
      isSelected,
      toggle,
      selectCurrentPage,
      clearCurrentPage,
      clearAll,
      selectAllAcrossPages,
      isCurrentPageAllSelected,
      getAcrossPagesBanner,
    ]
  );
}
