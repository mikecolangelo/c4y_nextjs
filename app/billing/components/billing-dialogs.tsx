"use client";

import { Button } from "@/components_shadcn/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components_shadcn/ui/dialog";
import { Calendar as CalendarComponent } from "@/components_shadcn/ui/calendar";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Separator } from "@/components_shadcn/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components_shadcn/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components_shadcn/ui/popover";
import { Switch } from "@/components_shadcn/ui/switch";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Calendar, Receipt, Hash, Banknote, Calculator, CheckCircle, User, Search, Loader2 } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components_shadcn/ui/command";
import { Avatar, AvatarFallback } from "@/components_shadcn/ui/avatar";
import { spacing, typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { Dispatch, SetStateAction } from "react";
import { useState, useEffect, useCallback } from "react";
import type { BillingStatus } from "@/validations/types";

// Tipo para cliente simplificado
interface ClientOption {
  id: string;
  documentId: string;
  fullName: string;
  email?: string;
  phone?: string;
}

export interface CreateBillingFormData {
  invoiceNumber: string;
  amount: string;
  currency: string;
  status: BillingStatus;
  dueDate: string;
  paymentDate: string;
  notes: string;
  // Cliente
  clientId: string;
  clientDocumentId: string;
  clientName: string;
  // Nuevos campos Módulo 3
  receiptId: string;
  confirmationNumber: string;
  weeklyQuotaAmount: string;
  totalQuotas: string;
  currentQuotaNumber: string;
  advancePayment: string;
  verifiedInBank: boolean;
  comments: string;
}

interface CreateBillingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CreateBillingFormData;
  setFormData: Dispatch<SetStateAction<CreateBillingFormData>>;
  isCreating: boolean;
  isFormValid: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const currencies = [
  { value: "PAB", label: "PAB - Balboa panameño" },
  { value: "USD", label: "USD - Dólar estadounidense" },
  { value: "EUR", label: "EUR - Euro" },
];

const statusOptions: { value: BillingStatus; label: string; color: string }[] = [
  { value: "pendiente", label: "Pendiente", color: "text-yellow-600" },
  { value: "adelanto", label: "Adelanto", color: "text-blue-600" },
  { value: "pagado", label: "Pagado", color: "text-green-600" },
  { value: "retrasado", label: "Retrasado", color: "text-red-600" },
];

export function CreateBillingDialog({
  isOpen,
  onOpenChange,
  formData,
  setFormData,
  isCreating,
  isFormValid,
  onConfirm,
  onCancel,
}: CreateBillingDialogProps) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);

  // Cargar contactos del sistema cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return;
    
    const loadUsers = async () => {
      try {
        setIsLoadingClients(true);
        const response = await fetch("/api/user-profiles");
        if (response.ok) {
          const data = await response.json();
          // Mapear contactos del sistema al formato de ClientOption
          const mappedUsers: ClientOption[] = (data.data || []).map((user: { id: string; documentId: string; displayName?: string; email?: string; phone?: string }) => ({
            id: user.id,
            documentId: user.documentId,
            fullName: user.displayName || "Sin nombre",
            email: user.email,
            phone: user.phone,
          }));
          setClients(mappedUsers);
        } else {
          console.error("Error response:", response.status, response.statusText);
        }
      } catch (error) {
        console.error("Error loading users:", error);
      } finally {
        setIsLoadingClients(false);
      }
    };
    
    loadUsers();
  }, [isOpen]);

  const handleSelectClient = (client: ClientOption) => {
    setFormData((prev) => ({
      ...prev,
      clientId: client.id,
      clientDocumentId: client.documentId,
      clientName: client.fullName,
    }));
    setClientSearchOpen(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] p-0 !flex !flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className={typography.h2}>Registrar Pago Manual</DialogTitle>
          <DialogDescription>
            Completa los campos requeridos para registrar un nuevo pago en el sistema.
          </DialogDescription>
        </DialogHeader>

        <ScrollAreaPrimitive.Root className="relative flex-1 min-h-0 overflow-hidden">
          <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
            <div className="px-6">
              <div className={`flex flex-col ${spacing.gap.medium} py-6`}>
                {/* Selección de Cliente */}
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={`${typography.h4} flex items-center gap-2`}>
                    <User className="h-4 w-4" />
                    Cliente
                  </h3>
                  
                  <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between h-14 rounded-lg",
                          !formData.clientName && "text-muted-foreground"
                        )}
                      >
                        {formData.clientName ? (
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(formData.clientName)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{formData.clientName}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4" />
                            <span>Buscar cliente...</span>
                          </div>
                        )}
                        {isLoadingClients && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nombre, email o teléfono..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron contactos.</CommandEmpty>
                          <CommandGroup heading="Contactos del Sistema">
                            {clients.map((client) => (
                              <CommandItem
                                key={client.documentId}
                                value={`${client.fullName} ${client.email || ""} ${client.phone || ""}`}
                                onSelect={() => handleSelectClient(client)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-muted text-xs">
                                      {getInitials(client.fullName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className={typography.body.large}>{client.fullName}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {client.email || client.phone || "Sin contacto"}
                                    </span>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <Separator />

                {/* Información de la Factura */}
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={typography.h4}>Información de la Factura</h3>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="invoiceNumber" className={typography.label}>
                      Número de Factura <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="invoiceNumber"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                      placeholder="Ej: 2024-001"
                      className="rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="amount" className={typography.label}>
                        Monto <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="amount"
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                        placeholder="Ej: 350.00"
                        className="rounded-lg"
                        min={0}
                        step="0.01"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="currency" className={typography.label}>
                        Moneda
                      </Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, currency: value }))}
                      >
                        <SelectTrigger className="rounded-lg">
                          <SelectValue placeholder="Seleccionar moneda" />
                        </SelectTrigger>
                        <SelectContent className="z-[200]">
                          {currencies.map((currency) => (
                            <SelectItem key={currency.value} value={currency.value}>
                              {currency.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="status" className={typography.label}>
                      Estado <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as BillingStatus }))}
                    >
                      <SelectTrigger className="rounded-lg">
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {statusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            <span className={status.color}>{status.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Información de Cuotas */}
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={`${typography.h4} flex items-center gap-2`}>
                    <Calculator className="h-4 w-4" />
                    Información de Cuotas
                  </h3>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="weeklyQuotaAmount" className={typography.label}>
                        Letra Semanal
                      </Label>
                      <div className="relative">
                        <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="weeklyQuotaAmount"
                          type="number"
                          value={formData.weeklyQuotaAmount}
                          onChange={(e) => setFormData((prev) => ({ ...prev, weeklyQuotaAmount: e.target.value }))}
                          placeholder="225.00"
                          className="rounded-lg pl-9"
                          min={0}
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="currentQuotaNumber" className={typography.label}>
                        Cuota #
                      </Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="currentQuotaNumber"
                          type="number"
                          value={formData.currentQuotaNumber}
                          onChange={(e) => setFormData((prev) => ({ ...prev, currentQuotaNumber: e.target.value }))}
                          placeholder="1"
                          className="rounded-lg pl-9"
                          min={1}
                          step="1"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="totalQuotas" className={typography.label}>
                        Total Cuotas
                      </Label>
                      <Input
                        id="totalQuotas"
                        type="number"
                        value={formData.totalQuotas}
                        onChange={(e) => setFormData((prev) => ({ ...prev, totalQuotas: e.target.value }))}
                        placeholder="220"
                        className="rounded-lg"
                        min={1}
                        step="1"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="advancePayment" className={typography.label}>
                      Adelanto / Abono
                    </Label>
                    <div className="relative">
                      <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="advancePayment"
                        type="number"
                        value={formData.advancePayment}
                        onChange={(e) => setFormData((prev) => ({ ...prev, advancePayment: e.target.value }))}
                        placeholder="0.00"
                        className="rounded-lg pl-9"
                        min={0}
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Verificación Bancaria */}
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={`${typography.h4} flex items-center gap-2`}>
                    <Receipt className="h-4 w-4" />
                    Verificación Bancaria
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="receiptId" className={typography.label}>
                        ID de Recibo
                      </Label>
                      <Input
                        id="receiptId"
                        value={formData.receiptId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, receiptId: e.target.value }))}
                        placeholder="Ej: REC-2025-001"
                        className="rounded-lg"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="confirmationNumber" className={typography.label}>
                        # Confirmación
                      </Label>
                      <Input
                        id="confirmationNumber"
                        value={formData.confirmationNumber}
                        onChange={(e) => setFormData((prev) => ({ ...prev, confirmationNumber: e.target.value }))}
                        placeholder="Ej: 123456789"
                        className="rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className={cn(
                        "h-5 w-5",
                        formData.verifiedInBank ? "text-green-600" : "text-muted-foreground"
                      )} />
                      <div>
                        <Label htmlFor="verifiedInBank" className={typography.body.large}>
                          Verificado en Banco
                        </Label>
                        <p className={typography.body.small}>
                          Marcar si el pago fue verificado en el sistema bancario
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="verifiedInBank"
                      checked={formData.verifiedInBank}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, verifiedInBank: checked }))}
                    />
                  </div>
                </div>

                <Separator />

                {/* Fechas */}
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={typography.h4}>Fechas</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label className={typography.label}>
                        Fecha de Vencimiento
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-10 pl-3 rounded-lg",
                              !formData.dueDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {formData.dueDate ? (
                              format(
                                new Date(`${formData.dueDate}T00:00:00`),
                                "d 'de' MMMM, yyyy",
                                { locale: es }
                              )
                            ) : (
                              <span>Selecciona una fecha</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[200]" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={
                              formData.dueDate
                                ? new Date(`${formData.dueDate}T00:00:00`)
                                : undefined
                            }
                            onSelect={(date) => {
                              if (date) {
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, "0");
                                const day = String(date.getDate()).padStart(2, "0");
                                setFormData((prev) => ({ ...prev, dueDate: `${year}-${month}-${day}` }));
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className={typography.label}>
                        Fecha de Pago
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-10 pl-3 rounded-lg",
                              !formData.paymentDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {formData.paymentDate ? (
                              format(
                                new Date(`${formData.paymentDate}T00:00:00`),
                                "d 'de' MMMM, yyyy",
                                { locale: es }
                              )
                            ) : (
                              <span>Sin fecha de pago</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[200]" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={
                              formData.paymentDate
                                ? new Date(`${formData.paymentDate}T00:00:00`)
                                : undefined
                            }
                            onSelect={(date) => {
                              if (date) {
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, "0");
                                const day = String(date.getDate()).padStart(2, "0");
                                setFormData((prev) => ({ ...prev, paymentDate: `${year}-${month}-${day}` }));
                              } else {
                                setFormData((prev) => ({ ...prev, paymentDate: "" }));
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Notas y Comentarios */}
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={typography.h4}>Notas y Comentarios</h3>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="notes" className={typography.label}>
                      Notas Internas
                    </Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notas internas sobre este pago..."
                      rows={3}
                      className="rounded-lg resize-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="comments" className={typography.label}>
                      Comentarios para el Cliente
                    </Label>
                    <Textarea
                      id="comments"
                      value={formData.comments}
                      onChange={(e) => setFormData((prev) => ({ ...prev, comments: e.target.value }))}
                      placeholder="Comentarios visibles para el cliente..."
                      rows={2}
                      className="rounded-lg resize-none"
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
            {isCreating ? "Registrando..." : "Registrar Pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const initialBillingFormData: CreateBillingFormData = {
  invoiceNumber: "",
  amount: "",
  currency: "PAB",
  status: "pendiente",
  dueDate: "",
  paymentDate: "",
  notes: "",
  // Cliente
  clientId: "",
  clientDocumentId: "",
  clientName: "",
  // Nuevos campos Módulo 3
  receiptId: "",
  confirmationNumber: "",
  weeklyQuotaAmount: "",
  totalQuotas: "220",
  currentQuotaNumber: "",
  advancePayment: "",
  verifiedInBank: false,
  comments: "",
};

export function validateBillingForm(formData: CreateBillingFormData): boolean {
  // Permitir montos negativos para ajustes de multas manuales
  return (
    formData.invoiceNumber.trim() !== "" &&
    formData.amount.trim() !== "" &&
    !isNaN(parseFloat(formData.amount))
  );
}
