"use client";

import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Badge } from "@/components_shadcn/ui/badge";
import { Plus, Upload, FileText, X, Calendar, ImageIcon } from "lucide-react";
import Image from "next/image";
import { spacing, typography } from "@/lib/design-system";
import type { VehicleDocument, VehicleDocumentCategory } from "@/validations/types";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import type { ChangeEvent } from "react";
import { DocumentCategoryManager } from "@/app/fleet/components/vehicle-documents-dnd/document-category-manager";
import { Can } from "@/components/auth/can";

const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
];

interface VehicleDocumentsCardProps {
  documents: VehicleDocument[];
  categories: VehicleDocumentCategory[];
  isLoadingDocuments: boolean;
  isLoadingCategories: boolean;
  isSaving: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  showForm: boolean;
  editingDocument: VehicleDocument | null;
  selectedCategory: VehicleDocumentCategory | null;
  description: string;
  expirationDate: string;
  legalFiles: File[];
  photoFiles: File[];
  setSelectedCategory: (cat: VehicleDocumentCategory | null) => void;
  setDescription: (value: string) => void;
  setExpirationDate: (value: string) => void;
  handleLegalFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleRemoveLegalFile: (index: number) => void;
  handlePhotoFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleRemovePhotoFile: (index: number) => void;
  onAddDocument: () => void;
  onCancelForm: () => void;
  onEditDocument: (doc: VehicleDocument) => void;
  onCancelEdit: () => void;
  onSaveDocument: () => void;
  onUpdateDocument: () => void;
  onDeleteDocument: (docId: string | number) => void;

  isCreatingCategory: boolean;
  isUpdatingCategory: boolean;
  isDeletingCategory: boolean;
  onCreateCategory: (data: {
    name: string;
    description?: string;
    isActive: boolean;
    order: number;
  }) => Promise<void>;
  onUpdateCategory: (
    id: string | number,
    data: { name?: string; description?: string; isActive?: boolean; order?: number }
  ) => Promise<void>;
  onDeleteCategory: (id: string | number) => Promise<void>;
  onReorderCategory?: (categories: VehicleDocumentCategory[]) => Promise<void>;
}

function formatDate(dateString?: string): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export function VehicleDocumentsCard({
  documents,
  categories,
  isLoadingDocuments,
  isLoadingCategories,
  isSaving,
  isUpdating,
  isDeleting,
  showForm,
  editingDocument,
  selectedCategory,
  description,
  expirationDate,
  legalFiles,
  photoFiles,
  setSelectedCategory,
  setDescription,
  setExpirationDate,
  handleLegalFileChange,
  handleRemoveLegalFile,
  handlePhotoFileChange,
  handleRemovePhotoFile,
  onAddDocument,
  onCancelForm,
  onEditDocument,
  onCancelEdit,
  onSaveDocument,
  onUpdateDocument,
  onDeleteDocument,
  isCreatingCategory,
  isUpdatingCategory,
  isDeletingCategory,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategory,
}: VehicleDocumentsCardProps) {
  const activeCategories = categories
    .filter((cat) => cat.isActive)
    .sort((a, b) => a.order - b.order);

  const renderFilePreview = (
    file: File,
    index: number,
    onRemove: (index: number) => void,
    keyPrefix: string
  ) => (
    <div key={`${keyPrefix}-${file.name}-${index}`} className="relative group">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
        {file.type.startsWith("image/") ? (
          <Image
            src={URL.createObjectURL(file)}
            alt={file.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <FileText className="h-12 w-12 text-muted-foreground" />
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 rounded-b-lg">
        <p className={`${typography.body.small} truncate`} title={file.name}>
          {file.name}
        </p>
        <p className={`${typography.body.small} text-xs text-white/70`}>
          {(file.size / (1024 * 1024)).toFixed(2)} MB
        </p>
      </div>
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onRemove(index)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );

  return (
    <Card
      className="shadow-sm backdrop-blur-sm border rounded-lg"
      style={{
        backgroundColor: "color-mix(in oklch, var(--background) 50%, transparent)",
        borderColor: "color-mix(in oklch, var(--border) 85%, transparent)",
      }}
    >
      <CardHeader className="px-6 pt-6 pb-4 flex flex-row items-center justify-between">
        <CardTitle className={typography.h4}>Documentos del Vehículo</CardTitle>
        <div className="flex items-center gap-2">
          <DocumentCategoryManager
            categories={categories}
            isLoading={isLoadingCategories}
            isCreating={isCreatingCategory}
            isUpdating={isUpdatingCategory}
            isDeleting={isDeletingCategory}
            onCreate={onCreateCategory}
            onUpdate={onUpdateCategory}
            onDelete={onDeleteCategory}
            onReorder={onReorderCategory || (async () => {})}
          />
          {documents.length > 0 && !showForm && !editingDocument && (
            <Can module="fleet" action="canCreate">
              <Button onClick={onAddDocument} size="sm" variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar Documento
              </Button>
            </Can>
          )}
        </div>
      </CardHeader>

      <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
        {documents.length === 0 && !showForm && !editingDocument && !isLoadingDocuments && (
          <div
            className={`flex flex-col items-center justify-center py-10 ${spacing.gap.base} text-center`}
          >
            <div className="rounded-full bg-muted p-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className={typography.body.large}>No hay documentos registrados</p>
              <p className={`${typography.body.small} text-muted-foreground`}>
                Comienza agregando el primer documento de este vehículo.
              </p>
            </div>
            <Can module="fleet" action="canCreate">
              <Button onClick={onAddDocument} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar tu primer documento
              </Button>
            </Can>
          </div>
        )}

        {documents.length > 0 && !showForm && !editingDocument && (
          <div className={`flex flex-col ${spacing.gap.large}`}>
            {documents.map((doc) => (
              <div key={doc.id} className="relative rounded-lg border border-border bg-card p-4">
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <Can module="fleet" action="canUpdate">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => onEditDocument(doc)}
                      disabled={isDeleting}
                    >
                      Editar
                    </Button>
                  </Can>
                  <Can module="fleet" action="canDelete">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={() => onDeleteDocument(doc.documentId || doc.id)}
                      disabled={isDeleting}
                    >
                      Eliminar
                    </Button>
                  </Can>
                </div>

                <div className={`flex flex-col ${spacing.gap.small} pr-24`}>
                  {doc.category && (
                    <Badge variant="secondary" className="w-fit">
                      {doc.category.name}
                    </Badge>
                  )}
                  {doc.description && <p className={typography.body.base}>{doc.description}</p>}
                  {doc.expirationDate && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className={typography.body.small}>
                        Vence: {formatDate(doc.expirationDate)}
                      </span>
                    </div>
                  )}
                </div>

                {doc.files && doc.files.length > 0 && (
                  <div className={`mt-4 flex flex-col ${spacing.gap.small}`}>
                    <p className={`${typography.body.small} font-medium text-muted-foreground`}>
                      Archivos
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {doc.files.map((file, idx) => (
                        <div key={`doc-${doc.id}-file-${idx}`} className="relative">
                          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
                            {file.mime?.startsWith("image/") && file.url ? (
                              <Image
                                src={file.url}
                                alt={file.name || `Archivo ${idx + 1}`}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 50vw, 33vw"
                                unoptimized
                              />
                            ) : (
                              <FileText className="h-12 w-12 text-muted-foreground" />
                            )}
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 rounded-b-lg">
                            <p className={`${typography.body.small} truncate`} title={file.name}>
                              {file.name || `Archivo ${idx + 1}`}
                            </p>
                            {file.url && (
                              <a
                                href={file.url}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                Descargar
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {doc.photos && doc.photos.length > 0 && (
                  <div className={`mt-4 flex flex-col ${spacing.gap.small}`}>
                    <p className={`${typography.body.small} font-medium text-muted-foreground`}>
                      Fotos
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {doc.photos.map((photo, idx) => (
                        <div
                          key={`doc-${doc.id}-photo-${idx}`}
                          className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted"
                        >
                          {photo.url ? (
                            <Image
                              src={photo.url}
                              alt={photo.alternativeText || photo.name || `Foto ${idx + 1}`}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 50vw, 33vw"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showForm && !editingDocument && (
          <Can module="fleet" action="canCreate">
            <div
              className={`flex flex-col ${spacing.gap.small} ${documents.length > 0 ? "pt-4 border-t border-border" : ""}`}
            >
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="document-category">Categoría</Label>
                <Select
                  value={selectedCategory?.id?.toString() || ""}
                  onValueChange={(value) => {
                    const cat = activeCategories.find((c) => c.id.toString() === value);
                    setSelectedCategory(cat || null);
                  }}
                >
                  <SelectTrigger id="document-category">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {isLoadingCategories ? (
                      <SelectItem value="loading" disabled>
                        Cargando categorías...
                      </SelectItem>
                    ) : activeCategories.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        No hay categorías disponibles
                      </SelectItem>
                    ) : (
                      activeCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {!isLoadingCategories && activeCategories.length === 0 && (
                  <p className="text-xs text-destructive">
                    No hay categorías activas. Haz clic en &quot;Gestionar Categorías&quot; para
                    crear una.
                  </p>
                )}
                {selectedCategory?.templateFile?.url && (
                  <a
                    href={selectedCategory.templateFile.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Descargar plantilla
                  </a>
                )}
              </div>

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="document-description">Descripción</Label>
                <Input
                  id="document-description"
                  type="text"
                  placeholder="Ej: Póliza vigente hasta 2025"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="document-expiration">Fecha de vencimiento</Label>
                <Input
                  id="document-expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>

              {legalFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {legalFiles.map((file, index) =>
                    renderFilePreview(file, index, handleRemoveLegalFile, "legal")
                  )}
                </div>
              )}

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label
                  htmlFor="legal-files-upload"
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-primary/40 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/10 hover:border-primary/60"
                >
                  <Upload className="mr-2 h-5 w-5" />
                  {legalFiles.length > 0
                    ? `Agregar más archivos (${legalFiles.length} seleccionados)`
                    : "Haz clic para seleccionar archivos"}
                </Label>
                <Input
                  id="legal-files-upload"
                  type="file"
                  accept={ALLOWED_EXTENSIONS.join(",")}
                  multiple
                  className="sr-only"
                  onChange={handleLegalFileChange}
                />
                <p className={`${typography.body.small} text-muted-foreground text-xs text-center`}>
                  O arrastra y suelta archivos aquí
                </p>
              </div>

              {photoFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {photoFiles.map((file, index) =>
                    renderFilePreview(file, index, handleRemovePhotoFile, "photo")
                  )}
                </div>
              )}

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label
                  htmlFor="photo-files-upload"
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-primary/40 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/10 hover:border-primary/60"
                >
                  <Upload className="mr-2 h-5 w-5" />
                  {photoFiles.length > 0
                    ? `Agregar más fotos (${photoFiles.length} seleccionadas)`
                    : "Haz clic para seleccionar fotos"}
                </Label>
                <Input
                  id="photo-files-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.svg"
                  multiple
                  className="sr-only"
                  onChange={handlePhotoFileChange}
                />
                <p className={`${typography.body.small} text-muted-foreground text-xs text-center`}>
                  Máx. 5 fotos
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={onCancelForm}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={onSaveDocument}
                  variant="default"
                  size="lg"
                  className="flex-1"
                  disabled={isSaving || !selectedCategory}
                >
                  {isSaving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          </Can>
        )}

        {editingDocument && (
          <Can module="fleet" action="canUpdate">
            <div className={`flex flex-col ${spacing.gap.small} pt-4 border-t border-border`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-primary">Editando documento</span>
                <span className="text-xs text-muted-foreground">
                  (ID: {editingDocument.documentId || editingDocument.id})
                </span>
              </div>

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="edit-document-category">Categoría</Label>
                <Select
                  value={selectedCategory?.id?.toString() || selectedCategory?.documentId || ""}
                  onValueChange={(value) => {
                    const cat = categories.find(
                      (c) => c.id.toString() === value || c.documentId === value
                    );
                    setSelectedCategory(cat || null);
                  }}
                >
                  <SelectTrigger id="edit-document-category">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {isLoadingCategories ? (
                      <SelectItem value="loading" disabled>
                        Cargando categorías...
                      </SelectItem>
                    ) : categories.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Sin categorías definidas
                      </SelectItem>
                    ) : (
                      categories
                        .sort((a, b) => a.order - b.order)
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.documentId || cat.id.toString()}>
                            {cat.name} {!cat.isActive && "(Inactiva)"}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="edit-document-description">Descripción</Label>
                <Input
                  id="edit-document-description"
                  type="text"
                  placeholder="Ej: Póliza vigente hasta 2025"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="edit-document-expiration">Fecha de vencimiento</Label>
                <Input
                  id="edit-document-expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>

              {editingDocument.files && editingDocument.files.length > 0 && (
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label>Archivos actuales ({editingDocument.files.length})</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 opacity-75">
                    {editingDocument.files.map((file, idx) => (
                      <div key={`edit-existing-file-${idx}`} className="relative">
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
                          {file.mime?.startsWith("image/") && file.url ? (
                            <Image
                              src={file.url}
                              alt={file.name || `Archivo ${idx + 1}`}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 50vw, 33vw"
                              unoptimized
                            />
                          ) : (
                            <FileText className="h-12 w-12 text-muted-foreground" />
                          )}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 rounded-b-lg">
                          <p className={`${typography.body.small} truncate`} title={file.name}>
                            {file.name || `Archivo ${idx + 1}`}
                          </p>
                          {file.url && (
                            <a
                              href={file.url}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              Descargar
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editingDocument.photos && editingDocument.photos.length > 0 && (
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label>Fotos actuales ({editingDocument.photos.length})</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 opacity-75">
                    {editingDocument.photos.map((photo, idx) => (
                      <div
                        key={`edit-existing-photo-${idx}`}
                        className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted"
                      >
                        {photo.url ? (
                          <Image
                            src={photo.url}
                            alt={photo.alternativeText || photo.name || `Foto ${idx + 1}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 33vw"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className={`${typography.body.small} text-muted-foreground text-xs`}>
                Los archivos existentes se reemplazarán solo si seleccionas nuevos.
              </p>

              {legalFiles.length > 0 && (
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label>Nuevos archivos legales ({legalFiles.length})</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {legalFiles.map((file, index) =>
                      renderFilePreview(file, index, handleRemoveLegalFile, "edit-legal")
                    )}
                  </div>
                </div>
              )}

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label
                  htmlFor="edit-legal-files-upload"
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {legalFiles.length > 0
                    ? `Cambiar archivos legales (${legalFiles.length} seleccionados)`
                    : "Seleccionar nuevos archivos legales (opcional)"}
                </Label>
                <Input
                  id="edit-legal-files-upload"
                  type="file"
                  accept={ALLOWED_EXTENSIONS.join(",")}
                  multiple
                  className="sr-only"
                  onChange={handleLegalFileChange}
                />
              </div>

              {photoFiles.length > 0 && (
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label>Nuevas fotos ({photoFiles.length})</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {photoFiles.map((file, index) =>
                      renderFilePreview(file, index, handleRemovePhotoFile, "edit-photo")
                    )}
                  </div>
                </div>
              )}

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label
                  htmlFor="edit-photo-files-upload"
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {photoFiles.length > 0
                    ? `Cambiar fotos (${photoFiles.length} seleccionadas)`
                    : "Seleccionar nuevas fotos (opcional)"}
                </Label>
                <Input
                  id="edit-photo-files-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.svg"
                  multiple
                  className="sr-only"
                  onChange={handlePhotoFileChange}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={onCancelEdit}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  disabled={isUpdating}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={onUpdateDocument}
                  variant="default"
                  size="lg"
                  className="flex-1"
                  disabled={isUpdating || !selectedCategory}
                >
                  {isUpdating ? "Actualizando..." : "Actualizar"}
                </Button>
              </div>
            </div>
          </Can>
        )}
      </CardContent>
    </Card>
  );
}
