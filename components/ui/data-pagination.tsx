"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components_shadcn/ui/button";

export interface DataPaginationProps {
  /** Current 1-based page. */
  currentPage: number;
  /** Total number of pages. */
  totalPages: number;
  /** Called with the next page when Prev/Next is clicked. */
  onPageChange: (page: number) => void;
  /** Optional extra classes for the wrapper. */
  className?: string;
}

/**
 * Presentational Prev/Next pagination control with a "Página X de Y" indicator.
 *
 * Mirrors the inline control previously duplicated in list pages. Returns null
 * when there is a single page (or fewer). Prev is disabled on the first page
 * and Next on the last; the parent owns the page state.
 */
export function DataPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: DataPaginationProps) {
  if (totalPages <= 1) return null;

  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  return (
    <div className={cn("flex items-center justify-center gap-3 pt-2", className)}>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 rounded-lg"
        disabled={isFirst}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </Button>
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        Página {currentPage} de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 rounded-lg"
        disabled={isLast}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      >
        Siguiente
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
