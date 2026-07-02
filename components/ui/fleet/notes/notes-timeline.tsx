"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import { typography, spacing } from "@/lib/design-system";
import { NoteItem } from "./note-item";
import { Can } from "@/components/auth/can";
import type { NotesTimelineProps } from "./types";

export function NotesTimeline({
  notes,
  isLoading,
  onEdit,
  onDelete,
  vehicleId,
  onAddClick,
}: NotesTimelineProps) {
  if (isLoading) {
    return (
      <div className={`flex flex-col ${spacing.gap.small} py-4`}>
        <p className={typography.body.small}>Cargando notas...</p>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 min-h-[300px] border-2 border-dashed border-border rounded-lg">
        <p className={`${typography.body.base} text-muted-foreground mb-6`}>
          Añade una nota a tu vehículo
        </p>
        {onAddClick && (
          <Can module="fleet" action="canCreate">
            <Button
              onClick={onAddClick}
              size="lg"
              className="h-16 w-16 rounded-full"
              variant="default"
            >
              <Plus className="h-8 w-8" />
            </Button>
          </Can>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${spacing.gap.base} py-2`}>
      {notes.map((note, index) => {
        const isLast = index === notes.length - 1;
        return (
          <NoteItem
            key={note.id || note.documentId}
            note={note}
            isLast={isLast}
            onEdit={onEdit}
            onDelete={onDelete}
            vehicleId={vehicleId}
          />
        );
      })}
    </div>
  );
}
