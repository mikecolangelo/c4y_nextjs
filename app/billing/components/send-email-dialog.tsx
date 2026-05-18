"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components_shadcn/ui/dialog";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { Card, CardContent } from "@/components_shadcn/ui/card";
import { toast } from "sonner";
import {
  sendFinancingEmail,
  renderEmailTemplate,
  type EmailTemplate,
} from "@/lib/email-config";
import { Send, Loader2, Eye, EyeOff } from "lucide-react";

interface SendEmailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  financingId: string;
  financingNumber: string;
  clientEmail?: string;
  clientName?: string;
  templates: EmailTemplate[];
}

export function SendEmailDialog({
  isOpen,
  onOpenChange,
  financingId,
  financingNumber,
  clientEmail,
  clientName,
  templates,
}: SendEmailDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [to, setTo] = useState(clientEmail || "");
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  const selectedTpl = templates.find((t) => t.key === selectedTemplate);

  const previewSubject = useCustom
    ? customSubject
    : selectedTpl
    ? renderEmailTemplate(selectedTpl.subject, {
        clientName: clientName || "Cliente",
        financingNumber,
      })
    : "";

  const previewBody = useCustom
    ? customBody
    : selectedTpl
    ? renderEmailTemplate(selectedTpl.body, {
        clientName: clientName || "Cliente",
        financingNumber,
        totalAmount: "15000.00",
        currentBalance: "8500.00",
        quotaAmount: "277.78",
        paidQuotas: "24",
        totalQuotas: "54",
        nextDueDate: "2024-02-15",
        paymentFrequency: "semanal",
        lateQuotasCount: "0",
        totalLateFees: "0.00",
        totalPaid: "6500.00",
        status: "activo",
        startDate: "2024-01-15",
        vehicleInfo: "Toyota RAV4 2022",
        vehiclePlate: "AB12345",
        companyName: "Car4youpanama",
        currentDate: "15 de enero de 2024",
      })
    : "";

  const handleSend = async () => {
    if (!to) {
      toast.error("El destinatario es requerido");
      return;
    }

    try {
      setIsSending(true);
      await sendFinancingEmail(financingId, {
        templateKey: useCustom ? undefined : selectedTemplate,
        to,
        customSubject: useCustom ? customSubject : undefined,
        customBody: useCustom ? customBody : undefined,
      });
      toast.success("Email enviado exitosamente");
      onOpenChange(false);
    } catch (error) {
      console.error("Error enviando email:", error);
      toast.error(error instanceof Error ? error.message : "Error enviando email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar Email</DialogTitle>
          <DialogDescription>
            Envía una notificación al cliente del financiamiento {financingNumber}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Destinatario */}
          <div className="space-y-2">
            <Label htmlFor="send-to">Destinatario</Label>
            <Input
              id="send-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="cliente@ejemplo.com"
            />
          </div>

          {/* Selección de template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Template</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => setUseCustom(!useCustom)}
              >
                {useCustom ? "Usar template" : "Mensaje personalizado"}
              </Button>
            </div>

            {!useCustom ? (
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates
                    .filter((t) => t.enabled)
                    .map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="Asunto..."
                />
                <textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  placeholder="<p>Cuerpo del mensaje HTML...</p>"
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}
          </div>

          {/* Preview */}
          {(selectedTemplate || useCustom) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Vista previa</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPreview ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
              {showPreview && (
                <Card className="border-dashed">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Asunto: {previewSubject}
                    </p>
                    <div className="border rounded-lg p-3 bg-white dark:bg-gray-950">
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: previewBody }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || (!selectedTemplate && !useCustom) || !to}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
