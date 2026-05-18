"use client";

import { Card } from "@/components_shadcn/ui/card";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { spacing } from "@/lib/design-system";

interface StatusItemSkeletonProps {
  isLast: boolean;
}

export function StatusItemSkeleton({ isLast }: StatusItemSkeletonProps) {
  return (
    <div className="relative flex gap-4">
      {!isLast && (
        <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
      )}
      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-background">
        <div className="h-2 w-2 rounded-full bg-primary" />
      </div>
      <div className="flex-1 pb-6">
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <div className={`flex flex-col ${spacing.gap.small} p-4`}>
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </Card>
      </div>
    </div>
  );
}

















