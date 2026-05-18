"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import { typography } from "@/lib/design-system";
import { StatusItem } from "./status-item";
import type { VehicleStatusTimelineProps } from "./types";

export function VehicleStatusTimeline({ 
  statuses, 
  isLoading, 
  loadingStatusId, 
  onEdit, 
  onDelete, 
  vehicleId, 
  onAddClick, 
}: VehicleStatusTimelineProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 py-4">
        <p className={typography.body.small}>Cargando estados...</p>
      </div>
    );
  }

  if (statuses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 min-h-[300px] border-2 border-dashed border-border rounded-lg">
        <p className={`${typography.body.base} text-muted-foreground mb-6`}>
          Añade un estado a tu vehículo
        </p>
        {onAddClick && (
          <Button
            onClick={onAddClick}
            size="lg"
            className="h-16 w-16 rounded-full"
            variant="default"
          >
            <Plus className="h-8 w-8" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-0.5">
      {statuses.map((status, index) => {
        const isLast = index === statuses.length - 1;
        const statusId = status.documentId || String(status.id);
        const isStatusLoading = loadingStatusId !== null && (
          (typeof loadingStatusId === 'string' && statusId === loadingStatusId) ||
          (typeof loadingStatusId === 'number' && String(status.id) === String(loadingStatusId))
        );
        return (
          <StatusItem
            key={status.id || status.documentId}
            status={status}
            isLast={isLast}
            isLoading={isStatusLoading}
            onEdit={onEdit}
            onDelete={onDelete}
            vehicleId={vehicleId}
          />
        );
      })}
    </div>
  );
}

















