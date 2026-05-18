"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import { typography, spacing } from "@/lib/design-system";
import { DocumentItem } from "./document-item";
import type { FleetDocumentsProps } from "./types";

export function FleetDocuments({ 
  documents, 
  isLoading, 
  onDelete, 
  onEdit,
  editingDocumentId,
  onAddClick, 
}: FleetDocumentsProps) {
  if (isLoading) {
    return (
      <div className={`flex flex-col ${spacing.gap.small} py-4`}>
        <p className={typography.body.small}>Cargando documentos...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 min-h-[300px] border-2 border-dashed border-border rounded-lg">
        <p className={`${typography.body.base} text-muted-foreground mb-6`}>
          Añade un documento a tu vehículo
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
    <div className={`flex flex-col ${spacing.gap.base} py-2`}>
      {documents.map((document) => (
        <DocumentItem
          key={document.id || document.documentId}
          document={document}
          onDelete={onDelete}
          onEdit={onEdit}
          isEditing={editingDocumentId === (document.documentId || document.id)}
        />
      ))}
    </div>
  );
}

















