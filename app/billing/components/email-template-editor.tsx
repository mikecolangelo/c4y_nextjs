"use client";

import { useState } from "react";
import { Input } from "@/components_shadcn/ui/input";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Label } from "@/components_shadcn/ui/label";
import { Switch } from "@/components_shadcn/ui/switch";
import { Badge } from "@/components_shadcn/ui/badge";
import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent } from "@/components_shadcn/ui/card";
import {
  FINANCING_EMAIL_VARIABLES,
  renderEmailTemplate,
  type EmailTemplate,
} from "@/lib/email-config";
import { Eye, EyeOff, Variable } from "lucide-react";

interface EmailTemplateEditorProps {
  template: EmailTemplate;
  onChange: (template: EmailTemplate) => void;
}

export function EmailTemplateEditor({ template, onChange }: EmailTemplateEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  const handleChange = (field: keyof EmailTemplate, value: string | boolean) => {
    onChange({ ...template, [field]: value });
  };

  const previewHtml = renderEmailTemplate(template.body, {
    clientName: "Juan Pérez",
    clientEmail: "juan@example.com",
    clientPhone: "+507 6000-0000",
    clientCedula: "8-123-456",
    clientAddress: "Ciudad de Panamá",
    financingNumber: "FIN-2024-001",
    totalAmount: "15000.00",
    currentBalance: "8500.00",
    totalPaid: "6500.00",
    quotaAmount: "277.78",
    paidQuotas: "24",
    totalQuotas: "54",
    status: "activo",
    startDate: "2024-01-15",
    nextDueDate: "2024-02-15",
    paymentFrequency: "semanal",
    lateQuotasCount: "0",
    totalLateFees: "0.00",
    vehicleInfo: "Toyota RAV4 2022",
    vehiclePlate: "AB12345",
    vehicleVin: "JTMBK32V795123456",
    companyName: "Car4youpanama",
    currentDate: "15 de enero de 2024",
  });

  const insertVariable = (key: string) => {
    const textarea = document.getElementById(`template-body-${template.key}`) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = template.body;
    const before = current.substring(0, start);
    const after = current.substring(end);
    const newBody = `${before}{{${key}}}${after}`;

    handleChange("body", newBody);

    // Restaurar foco y cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + key.length + 4, start + key.length + 4);
    }, 0);
  };

  return (
    <div className="space-y-4">
      {/* Activo */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-base font-semibold">{template.name}</Label>
          <p className="text-sm text-muted-foreground">
            Evento: <code className="text-xs bg-muted px-1 py-0.5 rounded">{template.key}</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {template.enabled ? "Activo" : "Inactivo"}
          </span>
          <Switch
            checked={template.enabled}
            onCheckedChange={(checked) => handleChange("enabled", checked)}
          />
        </div>
      </div>

      {/* Asunto */}
      <div className="space-y-2">
        <Label htmlFor={`template-subject-${template.key}`}>Asunto</Label>
        <Input
          id={`template-subject-${template.key}`}
          value={template.subject}
          onChange={(e) => handleChange("subject", e.target.value)}
          placeholder="Asunto del email..."
          disabled={!template.enabled}
        />
      </div>

      {/* Cuerpo */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`template-body-${template.key}`}>Cuerpo del mensaje (HTML)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? "Ocultar preview" : "Ver preview"}
          </Button>
        </div>
        <Textarea
          id={`template-body-${template.key}`}
          value={template.body}
          onChange={(e) => handleChange("body", e.target.value)}
          placeholder="<p>Hola {{clientName}},</p>..."
          rows={8}
          disabled={!template.enabled}
          className="font-mono text-sm"
        />
      </div>

      {/* Variables disponibles */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Variable className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm text-muted-foreground">Variables disponibles (clic para insertar)</Label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FINANCING_EMAIL_VARIABLES.map((v) => (
            <Badge
              key={v.key}
              variant="secondary"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => insertVariable(v.key)}
            >
              {v.key}
            </Badge>
          ))}
        </div>
      </div>

      {/* Preview */}
      {showPreview && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview con datos de ejemplo:</p>
            <div className="border rounded-lg p-4 bg-white dark:bg-gray-950">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Asunto: {renderEmailTemplate(template.subject, {
                  clientName: "Juan Pérez",
                  financingNumber: "FIN-2024-001",
                })}
              </p>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
