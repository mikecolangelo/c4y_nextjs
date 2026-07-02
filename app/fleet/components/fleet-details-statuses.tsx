"use client";

import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import Image from "next/image";
import { spacing, typography } from "@/lib/design-system";
import type { VehicleState } from "@/validations/types";
import { Plus, Camera, X } from "lucide-react";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Label } from "@/components_shadcn/ui/label";
import { Input } from "@/components_shadcn/ui/input";
import { VehicleStatusTimeline } from "@/components/ui/vehicle-status-timeline";
import { MileageCounter } from "./mileage-counter";
import { Can } from "@/components/auth/can";
import type { ChangeEvent } from "react";

interface FleetDetailsStatusCardProps {
  vehicleStatuses: VehicleState[];
  isLoadingStatuses: boolean;
  loadingStatusId?: string | number | null;
  showStatusForm: boolean;
  statusImagePreviews: string[];
  statusImagesCount: number;
  statusComment: string;
  onStatusCommentChange: (value: string) => void;
  onAddStatus: () => void;
  onCancelStatus: () => void;
  onStatusImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveStatusImage: (index: number) => void;
  onSaveStatus: () => void;
  onEditStatus: (
    statusId: number | string,
    editComment: string,
    _imageIds?: number[],
    newImages?: File[]
  ) => Promise<void>;
  onDeleteStatus: (statusId: number | string) => Promise<void>;
  vehicleId: string;
  vehicleName?: string;
  currentMileage?: number;
  lastOilChangeMileage?: number;
  oilChangeInterval?: number;
  oilChangeNotificationSent?: boolean;
  onMileageUpdated?: () => void;
}

export function FleetDetailsStatusCard({
  vehicleStatuses,
  isLoadingStatuses,
  loadingStatusId,
  showStatusForm,
  statusImagePreviews,
  statusImagesCount,
  statusComment,
  onStatusCommentChange,
  onAddStatus,
  onCancelStatus,
  onStatusImageChange,
  onRemoveStatusImage,
  onSaveStatus,
  onEditStatus,
  onDeleteStatus,
  vehicleId,
  vehicleName,
  currentMileage,
  lastOilChangeMileage,
  oilChangeInterval,
  oilChangeNotificationSent,
  onMileageUpdated,
}: FleetDetailsStatusCardProps) {
  const handleEditAdapter = async (
    statusId: number | string,
    editComment: string,
    _imageIds?: number[],
    newImages?: File[]
  ) => {
    return onEditStatus(statusId, editComment, _imageIds, newImages);
  };
  return (
    <Card
      className="shadow-sm backdrop-blur-sm border rounded-lg"
      style={{
        backgroundColor: "color-mix(in oklch, var(--background) 50%, transparent)",
        borderColor: "color-mix(in oklch, var(--border) 85%, transparent)",
      }}
    >
      <CardHeader className="px-6 pt-6 pb-4 flex flex-row items-center justify-between">
        <CardTitle className={typography.h4}>Estados del Vehículo</CardTitle>
        {vehicleStatuses.length > 0 && !showStatusForm && (
          <Can module="fleet" action="canCreate">
            <Button onClick={onAddStatus} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Estado
            </Button>
          </Can>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-6 pb-6">
        {/* Contador de Kilometraje */}
        <MileageCounter
          vehicleId={vehicleId}
          vehicleName={vehicleName || "Vehículo"}
          currentMileage={currentMileage}
          lastOilChangeMileage={lastOilChangeMileage}
          oilChangeInterval={oilChangeInterval}
          oilChangeNotificationSent={oilChangeNotificationSent}
          onMileageUpdated={onMileageUpdated}
          variant="full"
        />

        {vehicleStatuses.length > 0 && (
          <ScrollAreaPrimitive.Root className="relative overflow-hidden">
            <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
              <VehicleStatusTimeline
                statuses={vehicleStatuses}
                isLoading={isLoadingStatuses}
                loadingStatusId={loadingStatusId}
                onEdit={handleEditAdapter}
                onDelete={onDeleteStatus}
                vehicleId={vehicleId}
              />
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.ScrollAreaScrollbar
              orientation="vertical"
              className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
            >
              <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
            </ScrollAreaPrimitive.ScrollAreaScrollbar>
            <ScrollAreaPrimitive.Corner />
          </ScrollAreaPrimitive.Root>
        )}

        {vehicleStatuses.length === 0 && !showStatusForm && !isLoadingStatuses && (
          <VehicleStatusTimeline
            statuses={vehicleStatuses}
            isLoading={isLoadingStatuses}
            loadingStatusId={loadingStatusId}
            onEdit={onEditStatus}
            onDelete={onDeleteStatus}
            vehicleId={vehicleId}
            onAddClick={onAddStatus}
          />
        )}

        {showStatusForm && (
          <Can module="fleet" action="canCreate">
            <div
              className={`flex flex-col ${spacing.gap.small} ${vehicleStatuses.length > 0 ? "pt-4 border-t border-border" : ""}`}
            >
              {statusImagePreviews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {statusImagePreviews.map((preview, index) => (
                    <div key={preview} className="relative group">
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                        <Image
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 33vw"
                          unoptimized
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onRemoveStatusImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label
                  htmlFor="status-images-upload"
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {statusImagesCount > 0
                    ? `Agregar más imágenes (${statusImagesCount} seleccionadas)`
                    : "Seleccionar imágenes del estado"}
                </Label>
                <Input
                  id="status-images-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={onStatusImageChange}
                />
              </div>

              <Textarea
                placeholder="Añadir un comentario sobre el estado del vehículo (opcional)..."
                value={statusComment}
                onChange={(e) => onStatusCommentChange(e.target.value)}
                rows={4}
                className="min-h-24 resize-y"
              />

              <div className="flex gap-2">
                <Button onClick={onCancelStatus} variant="outline" size="lg" className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={onSaveStatus}
                  variant="default"
                  size="lg"
                  className="flex-1"
                  disabled={!statusComment.trim() && statusImagesCount === 0}
                >
                  Guardar Estado
                </Button>
              </div>
            </div>
          </Can>
        )}
      </CardContent>
    </Card>
  );
}
