"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Edit2, Trash2, X, Check } from "lucide-react";
import Image from "next/image";
import { Card } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { typography, spacing } from "@/lib/design-system";
import { strapiImages } from "@/lib/strapi-images";
import type { NoteItemProps } from "./types";

export function NoteItem({
  note,
  isLast,
  onEdit,
  onDelete,
}: NoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const date = new Date(note.createdAt);
  const updatedDate = new Date(note.updatedAt);
  const isEdited = note.createdAt !== note.updatedAt;
  const formattedDate = format(date, "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es });
  const formattedUpdatedDate = format(updatedDate, "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es });
  const authorName = note.author?.displayName || note.author?.email || "Usuario";
  const noteId = note.documentId || String(note.id);

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !onEdit) return;
    setIsSaving(true);
    try {
      await onEdit(noteId, editContent.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("Error guardando edición:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(note.content);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(noteId);
    } catch (error) {
      console.error("Error eliminando nota:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative flex gap-4">
      {!isLast && (
        <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
      )}
      
      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-background">
        <div className="h-2 w-2 rounded-full bg-primary" />
      </div>

      <div className="flex-1 pb-6">
        <Card className="shadow-sm ring-1 ring-inset ring-border/50 relative">
          {!isEditing && (onEdit || onDelete) && (
            <div className="absolute top-2 right-2 flex gap-1">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsEditing(true)}
                  disabled={isDeleting}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={isDeleting || isSaving}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          <div className={`flex flex-col ${spacing.gap.small} p-4 ${onEdit || onDelete ? "pr-12" : ""}`}>
            <div className="flex items-start gap-3">
              {note.author?.avatar?.url ? (
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                  <Image
                    src={strapiImages.getURL(note.author.avatar.url)}
                    alt={note.author.avatar.alternativeText || authorName}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                </div>
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-background">
                  <span className={`${typography.body.small} font-semibold text-primary`}>
                    {authorName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <p className={`${typography.body.small} font-semibold`}>
                  {authorName}
                </p>
                <p className={`${typography.body.small} text-muted-foreground`}>
                  {formattedDate}
                  {isEdited && (
                    <span className="ml-2 text-xs italic">
                      (editado el {formattedUpdatedDate})
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            {isEditing ? (
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className="min-h-20 resize-y"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!editContent.trim() || isSaving}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {isSaving ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className={`${typography.body.base} whitespace-pre-wrap break-words`}>
                {note.content}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

















