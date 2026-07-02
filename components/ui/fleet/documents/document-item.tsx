"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Trash2, Download, Pencil } from "lucide-react";
import Image from "next/image";
import { Card } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { typography, spacing } from "@/lib/design-system";
import { Can } from "@/components/auth/can";
import type { DocumentItemProps } from "./types";

function formatFileSize(bytes?: number) {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isImage(mime?: string) {
  return mime?.startsWith("image/") || false;
}

export function DocumentItem({ document, onDelete, onEdit }: DocumentItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const documentId = document.documentId || String(document.id);
  const files = document.files || [];
  const date = new Date(document.createdAt);
  const formattedDate = format(date, "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es });
  const authorName = document.author?.displayName || document.author?.email || "Usuario";

  // El tipo de documento ahora es un objeto con name
  const documentTypeName = document.documentType?.name || "Documento";

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(documentId);
    } catch (error) {
      console.error("Error eliminando documento:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    if (!onEdit) return;
    onEdit(document);
  };

  return (
    <Card className="shadow-sm ring-1 ring-inset ring-border/50 relative">
      {(onDelete || onEdit) && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {onEdit && (
            <Can module="fleet" action="canUpdate">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </Can>
          )}
          {onDelete && (
            <Can module="fleet" action="canDelete">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Can>
          )}
        </div>
      )}

      <div className={`flex flex-col ${spacing.gap.small} p-4 ${onDelete ? "pr-12" : ""}`}>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-background">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`${typography.body.small} font-semibold`}>{documentTypeName}</p>
            {document.otherDescription && (
              <p className={`${typography.body.small} text-foreground mt-1.5 italic`}>
                {document.otherDescription}
              </p>
            )}
            <p
              className={`${typography.body.small} text-muted-foreground ${document.otherDescription ? "mt-1.5" : "mt-1"}`}
            >
              Subido por {authorName} el {formattedDate}
            </p>
          </div>
        </div>

        {files.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {files.map((file, index) => (
              <div key={index} className="relative group">
                {isImage(file.mime) && file.url ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                    <Image
                      src={file.url}
                      alt={file.alternativeText || file.name || `Archivo ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 rounded-b-lg">
                  <p className={`${typography.body.small} truncate`} title={file.name}>
                    {file.name || `Archivo ${index + 1}`}
                  </p>
                  <p className={`${typography.body.small} text-xs text-muted-foreground`}>
                    {formatFileSize(file.size)}
                  </p>
                </div>
                {file.url && (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Button variant="secondary" size="icon" className="h-6 w-6">
                      <Download className="h-3 w-3" />
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
