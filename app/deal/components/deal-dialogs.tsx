"use client";

import { Button } from "@/components_shadcn/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components_shadcn/ui/dialog";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Separator } from "@/components_shadcn/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components_shadcn/ui/select";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { Upload, FileText } from "lucide-react";
import { spacing, typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { Dispatch, SetStateAction, ChangeEvent } from "react";
import type { DealType, DealPaymentAgreement } from "@/validations/types";

export interface CreateDealFormData {
  title: string;
  type: DealType;
  price: string;
  paymentAgreement: DealPaymentAgreement;
  summary: string;
}

interface CreateDealDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CreateDealFormData;
  setFormData: Dispatch<SetStateAction<CreateDealFormData>>;
  isCreating: boolean;
  isFormValid: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

interface UploadContractDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFile: File | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const dealTypes: { value: DealType; label: string }[] = [
  { value: "conduccion", label: "Contrato de Conducción" },
  { value: "arrendamiento", label: "Contrato de Arrendamiento" },
  { value: "servicio", label: "Contrato de Servicio" },
];

const paymentAgreements: { value: DealPaymentAgreement; label: string }[] = [
  { value: "semanal", label: "Semanal" },
  { value: "quincenal", label: "Quincenal" },
];

export function CreateDealDialog({
  isOpen,
  onOpenChange,
  formData,
  setFormData,
  isCreating,
  isFormValid,
  onConfirm,
  onCancel,
}: CreateDealDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-auto max-h-[90vh] p-0 !flex !flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className={typography.h2}>Generar Nuevo Contrato</DialogTitle>
          <DialogDescription>
            Completa los campos para generar un nuevo contrato.
          </DialogDescription>
        </DialogHeader>

        <ScrollAreaPrimitive.Root className="relative flex-1 min-h-0 overflow-hidden">
          <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
            <div className="px-6">
              <div className={`flex flex-col ${spacing.gap.medium} py-6`}>
                {/* Tipo de Contrato */}
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={typography.h4}>Información del Contrato</h3>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="deal-type" className={typography.label}>
                      Tipo de Contrato <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value as DealType }))}
                    >
                      <SelectTrigger id="deal-type" className="rounded-lg">
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {dealTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="deal-title" className={typography.label}>
                      Título (opcional)
                    </Label>
                    <Input
                      id="deal-title"
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Ej: Contrato de arrendamiento mensual"
                      className="rounded-lg"
                    />
                  </div>
                </div>

                <Separator />

                {/* Términos Financieros */}
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={typography.h4}>Términos Financieros</h3>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="deal-price" className={typography.label}>
                      Precio (PAB)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <Input
                        id="deal-price"
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                        placeholder="Ej: 25000"
                        className="rounded-lg pl-7"
                        min={0}
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="deal-payment" className={typography.label}>
                      Acuerdo de Pago
                    </Label>
                    <Select
                      value={formData.paymentAgreement}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentAgreement: value as DealPaymentAgreement }))}
                    >
                      <SelectTrigger id="deal-payment" className="rounded-lg">
                        <SelectValue placeholder="Selecciona el acuerdo" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {paymentAgreements.map((agreement) => (
                          <SelectItem key={agreement.value} value={agreement.value}>
                            {agreement.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Notas */}
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={typography.h4}>Notas Adicionales</h3>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="deal-summary" className={typography.label}>
                      Resumen / Notas
                    </Label>
                    <Textarea
                      id="deal-summary"
                      value={formData.summary}
                      onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
                      placeholder="Añade notas o resumen del contrato..."
                      rows={4}
                      className="rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollAreaPrimitive.Viewport>
          <ScrollAreaPrimitive.ScrollAreaScrollbar
            orientation="vertical"
            className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
          >
            <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
          </ScrollAreaPrimitive.ScrollAreaScrollbar>
          <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onCancel} disabled={isCreating}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isCreating || !isFormValid}
            className={cn(
              "font-semibold shadow-md hover:shadow-lg transition-all duration-200",
              !isCreating && isFormValid && "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 !opacity-100",
              (isCreating || !isFormValid) && "!opacity-50 cursor-not-allowed"
            )}
          >
            {isCreating ? "Creando..." : "Generar Contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UploadContractDialog({
  isOpen,
  onOpenChange,
  selectedFile,
  onFileChange,
  isUploading,
  onConfirm,
  onCancel,
}: UploadContractDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 !flex !flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className={typography.h2}>Subir Contrato</DialogTitle>
          <DialogDescription>
            Sube un contrato ya existente en formato PDF o imagen.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-6">
          <div className={`flex flex-col ${spacing.gap.medium}`}>
            <div className="flex flex-col gap-4">
              <Input
                id="contract-file"
                type="file"
                accept=".pdf,image/*"
                onChange={onFileChange}
                className="hidden"
              />
              <Label
                htmlFor="contract-file"
                className={cn(
                  "flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                  selectedFile ? "border-primary bg-primary/5" : "hover:bg-muted hover:border-muted-foreground/50"
                )}
              >
                {selectedFile ? (
                  <>
                    <FileText className="h-10 w-10 text-primary" />
                    <div className="text-center">
                      <p className={`${typography.body.base} font-medium`}>{selectedFile.name}</p>
                      <p className={`${typography.body.small} text-muted-foreground mt-1`}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <span className={`${typography.body.small} text-primary`}>
                      Clic para cambiar archivo
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div className="text-center">
                      <p className={`${typography.body.base} font-medium`}>
                        Arrastra un archivo o haz clic para seleccionar
                      </p>
                      <p className={`${typography.body.small} text-muted-foreground mt-1`}>
                        PDF o imágenes (máx. 10MB)
                      </p>
                    </div>
                  </>
                )}
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onCancel} disabled={isUploading}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isUploading || !selectedFile}
            className={cn(
              "font-semibold shadow-md hover:shadow-lg transition-all duration-200",
              !isUploading && selectedFile && "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 !opacity-100",
              (isUploading || !selectedFile) && "!opacity-50 cursor-not-allowed"
            )}
          >
            {isUploading ? "Subiendo..." : "Subir Contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
