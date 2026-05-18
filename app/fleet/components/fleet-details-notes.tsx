"use client";

import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Plus } from "lucide-react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { spacing, typography } from "@/lib/design-system";
import { FleetNote } from "@/components/ui/notes-timeline";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { NotesTimeline } from "@/components/ui/notes-timeline";

interface FleetDetailsNotesCardProps {
  notes: FleetNote[];
  isLoadingNotes: boolean;
  showNoteForm: boolean;
  noteValue: string;
  onAddNote: () => void;
  onCancelNote: () => void;
  onNoteChange: (value: string) => void;
  onSaveNote: () => void;
  onEditNote: (noteId: number | string, editContent: string) => Promise<void>;
  onDeleteNote: (noteId: number | string) => Promise<void>;
  vehicleId: string;
}

export function FleetDetailsNotesCard({
  notes,
  isLoadingNotes,
  showNoteForm,
  noteValue,
  onAddNote,
  onCancelNote,
  onNoteChange,
  onSaveNote,
  onEditNote,
  onDeleteNote,
  vehicleId,
}: FleetDetailsNotesCardProps) {
  return (
    <Card
      className="shadow-sm backdrop-blur-sm border rounded-lg"
      style={{
        backgroundColor: "color-mix(in oklch, var(--background) 50%, transparent)",
        borderColor: "color-mix(in oklch, var(--border) 85%, transparent)",
      }}
    >
      <CardHeader className="px-6 pt-6 pb-4 flex flex-row items-center justify-between">
        <CardTitle className={typography.h4}>Notas y Comentarios</CardTitle>
        {notes.length > 0 && !showNoteForm && (
          <Button onClick={onAddNote} size="sm" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Agregar Nota
          </Button>
        )}
      </CardHeader>
      <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
        {notes.length > 0 && (
          <ScrollAreaPrimitive.Root className="relative h-[400px] overflow-hidden">
            <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
              <NotesTimeline
                notes={notes}
                isLoading={isLoadingNotes}
                onEdit={onEditNote}
                onDelete={onDeleteNote}
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

        {notes.length === 0 && !showNoteForm && !isLoadingNotes && (
          <NotesTimeline
            notes={notes}
            isLoading={isLoadingNotes}
            onEdit={onEditNote}
            onDelete={onDeleteNote}
            vehicleId={vehicleId}
            onAddClick={onAddNote}
          />
        )}

        {showNoteForm && (
          <div className={`flex flex-col ${spacing.gap.small} ${notes.length > 0 ? "pt-4 border-t border-border" : ""}`}>
            <Textarea
              placeholder="Añadir una nota sobre el vehículo..."
              value={noteValue}
              onChange={(e) => onNoteChange(e.target.value)}
              rows={4}
              className="min-h-24 resize-y"
            />
            <div className="flex gap-2">
              <Button onClick={onCancelNote} variant="outline" size="lg" className="flex-1">
                Cancelar
              </Button>
              <Button onClick={onSaveNote} variant="default" size="lg" className="flex-1" disabled={!noteValue.trim()}>
                Guardar Nota
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

