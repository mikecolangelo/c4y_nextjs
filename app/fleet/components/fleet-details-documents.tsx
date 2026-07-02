"use client";

import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Plus, Upload, FileText, X } from "lucide-react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import Image from "next/image";
import { spacing, typography } from "@/lib/design-system";
import { FleetDocument, FleetDocumentType } from "@/validations/types";
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
import { FleetDocuments } from "@/components/ui/fleet-documents";
import { Can } from "@/components/auth/can";

interface FleetDetailsDocumentsCardProps {
  vehicleDocuments: FleetDocument[];
  isLoadingDocuments: boolean;
  showDocumentForm: boolean;
  documentFiles: File[];
  documentType: FleetDocumentType;
  documentOtherDescription: string;
  documentFilesCount: number;
  isSavingDocument: boolean;
  onAddDocument: () => void;
  onCancelDocument: () => void;
  onDocumentFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveDocumentFile: (index: number) => void;
  onDocumentTypeChange: (value: FleetDocumentType) => void;
  onDocumentOtherDescriptionChange: (value: string) => void;
  onSaveDocument: () => void;
  onDeleteDocument: (documentId: number | string) => Promise<void>;
  vehicleId: string;
}

export function FleetDetailsDocumentsCard({
  vehicleDocuments,
  isLoadingDocuments,
  showDocumentForm,
  documentFiles,
  documentType,
  documentOtherDescription,
  documentFilesCount,
  isSavingDocument,
  onAddDocument,
  onCancelDocument,
  onDocumentFileChange,
  onRemoveDocumentFile,
  onDocumentTypeChange,
  onDocumentOtherDescriptionChange,
  onSaveDocument,
  onDeleteDocument,
  vehicleId,
}: FleetDetailsDocumentsCardProps) {
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
        {vehicleDocuments.length > 0 && !showDocumentForm && (
          <Can module="fleet" action="canCreate">
            <Button onClick={onAddDocument} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Documento
            </Button>
          </Can>
        )}
      </CardHeader>
      <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
        {vehicleDocuments.length > 0 && (
          <ScrollAreaPrimitive.Root className="relative overflow-hidden h-[600px]">
            <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
              <FleetDocuments
                documents={vehicleDocuments}
                isLoading={isLoadingDocuments}
                onDelete={onDeleteDocument}
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

        {vehicleDocuments.length === 0 && !showDocumentForm && !isLoadingDocuments && (
          <FleetDocuments
            documents={vehicleDocuments}
            isLoading={isLoadingDocuments}
            onDelete={onDeleteDocument}
            vehicleId={vehicleId}
            onAddClick={onAddDocument}
          />
        )}

        {showDocumentForm && (
          <Can module="fleet" action="canCreate">
            <div
              className={`flex flex-col ${spacing.gap.small} ${vehicleDocuments.length > 0 ? "pt-4 border-t border-border" : ""}`}
            >
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="document-type">Tipo de Documento</Label>
                <Select
                  value={documentType}
                  onValueChange={(value) => onDocumentTypeChange(value as FleetDocumentType)}
                >
                  <SelectTrigger id="document-type">
                    <SelectValue placeholder="Selecciona el tipo de documento" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="poliza_seguro">Póliza de Seguro del Vehículo</SelectItem>
                    <SelectItem value="ficha_tecnica">Ficha Técnica del Vehículo</SelectItem>
                    <SelectItem value="tarjeta_propiedad">
                      Tarjeta de Propiedad Vehicular
                    </SelectItem>
                    <SelectItem value="contrato_compraventa">Contrato Compraventa</SelectItem>
                    <SelectItem value="matricula_vehicular">Matrícula Vehicular Vigente</SelectItem>
                    <SelectItem value="certificado_revisado">
                      Certificado de Revisado Vehicular
                    </SelectItem>
                    <SelectItem value="otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {documentType === "otros" && (
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label htmlFor="document-other-description">
                    Describe el tipo de documento <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="document-other-description"
                    type="text"
                    placeholder="Ej: Permiso de circulación"
                    value={documentOtherDescription}
                    onChange={(e) => onDocumentOtherDescriptionChange(e.target.value)}
                  />
                  <p className={`${typography.body.small} text-muted-foreground text-xs`}>
                    Especifica qué tipo de documento estás subiendo
                  </p>
                </div>
              )}

              {documentFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {documentFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="relative group">
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
                        <p className={`${typography.body.small} text-xs text-muted-foreground`}>
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onRemoveDocumentFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label
                  htmlFor="document-files-upload"
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {documentFilesCount > 0
                    ? `Agregar más archivos (${documentFilesCount} seleccionados)`
                    : "Seleccionar archivos (máx. 5MB cada uno)"}
                </Label>
                <Input
                  id="document-files-upload"
                  type="file"
                  accept="*/*"
                  multiple
                  className="sr-only"
                  onChange={onDocumentFileChange}
                />
                <p className={`${typography.body.small} text-muted-foreground text-xs`}>
                  Puedes subir múltiples archivos. Tamaño máximo por archivo: 5MB
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={onCancelDocument}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  disabled={isSavingDocument}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={onSaveDocument}
                  variant="default"
                  size="lg"
                  className="flex-1"
                  disabled={
                    documentFilesCount === 0 ||
                    isSavingDocument ||
                    (documentType === "otros" && !documentOtherDescription.trim())
                  }
                >
                  Guardar Documento
                </Button>
              </div>
            </div>
          </Can>
        )}
      </CardContent>
    </Card>
  );
}
