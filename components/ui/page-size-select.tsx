"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { Label } from "@/components_shadcn/ui/label";
import { cn } from "@/lib/utils";

export interface PageSizeSelectProps {
  /** Current page size. */
  value: number;
  /** Called with the newly selected page size. */
  onChange: (size: number) => void;
  /** Selectable page sizes. Defaults to [10, 20, 50, 100]. */
  options?: number[];
  /** Optional extra classes for the wrapper. */
  className?: string;
}

const DEFAULT_OPTIONS = [10, 20, 50, 100];

/**
 * Presentational "Mostrar: {n}" page-size selector wrapping the shadcn Select.
 *
 * Mirrors the inline control previously duplicated in list pages. The parent
 * owns the page-size state; this component only renders the current value and
 * the available options.
 */
export function PageSizeSelect({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  className,
}: PageSizeSelectProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label htmlFor="page-size-select" className="whitespace-nowrap text-sm text-muted-foreground">
        Mostrar:
      </Label>
      <Select value={value.toString()} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger
          id="page-size-select"
          className="h-8 w-20 rounded-lg"
          suppressHydrationWarning
        >
          <SelectValue>{value}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((n) => (
            <SelectItem key={n} value={n.toString()}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
