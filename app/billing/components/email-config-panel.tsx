"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Button } from "@/components_shadcn/ui/button";
import { Switch } from "@/components_shadcn/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components_shadcn/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components_shadcn/ui/tabs";
import { Separator } from "@/components_shadcn/ui/separator";
import { toast } from "sonner";
import {
  fetchEmailConfig,
  updateEmailConfig,
  sendTestEmail,
  DEFAULT_EMAIL_TEMPLATES,
  type EmailSmtpConfig,
  type EmailTemplate,
} from "@/lib/email-config";
import { EmailTemplateEditor } from "./email-template-editor";
import {
  Mail,
  Server,
  Save,
  Send,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

export function EmailConfigPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [smtp, setSmtp] = useState<Partial<EmailSmtpConfig>>({
    host: "",
    port: 465,
    user: "",
    from: "",
    secure: true,
    hasCustomConfig: false,
    hasPass: false,
  });
  const [smtpPass, setSmtpPass] = useState("");
  const [useSystemConfig, setUseSystemConfig] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_EMAIL_TEMPLATES);
  const [testEmail, setTestEmail] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testBody, setTestBody] = useState("<p>Este es un email de prueba desde Car4youpanama.</p>");

  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetchEmailConfig();
      const data = response.data;

      if (data.smtp) {
        setSmtp(data.smtp);
        setUseSystemConfig(!data.smtp.hasCustomConfig);
      }

      if (data.templates && data.templates.length > 0) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
      toast.error("No se pudo cargar la configuración de email");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const smtpPayload = useSystemConfig
        ? {
            host: "",
            port: 0,
            user: "",
            pass: "",
            from: "",
            secure: false,
          }
        : {
            host: smtp.host,
            port: smtp.port,
            user: smtp.user,
            pass: smtpPass || (smtp.hasPass ? undefined : ""),
            from: smtp.from,
            secure: smtp.secure,
          };

      await updateEmailConfig({
        smtp: smtpPayload,
        templates,
      });

      toast.success("Configuración guardada exitosamente");
      await loadConfig();
    } catch (error) {
      console.error("Error guardando:", error);
      toast.error(error instanceof Error ? error.message : "Error guardando configuración");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    try {
      setIsTesting(true);
      await sendTestEmail({
        to: testEmail || undefined,
        subject: testSubject || undefined,
        body: testBody || undefined,
      });
      toast.success("Email de prueba enviado exitosamente");
    } catch (error) {
      console.error("Error enviando prueba:", error);
      toast.error(error instanceof Error ? error.message : "Error enviando email de prueba");
    } finally {
      setIsTesting(false);
    }
  };

  const updateTemplate = (index: number, updated: EmailTemplate) => {
    const next = [...templates];
    next[index] = updated;
    setTemplates(next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Cargando configuración...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Configuración de Email</h2>
          <p className="text-sm text-muted-foreground">
            Administra el servidor SMTP y los templates de notificaciones del módulo de financiamiento.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadConfig} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Recargar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Guardar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="smtp" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="smtp">
            <Server className="h-4 w-4 mr-1.5" />
            Servidor SMTP
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Mail className="h-4 w-4 mr-1.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="test">
            <Send className="h-4 w-4 mr-1.5" />
            Prueba
          </TabsTrigger>
        </TabsList>

        {/* Tab SMTP */}
        <TabsContent value="smtp" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuración SMTP</CardTitle>
              <CardDescription>
                Define el servidor de correo para enviar notificaciones de financiamiento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Usar configuración del sistema</Label>
                  <p className="text-sm text-muted-foreground">
                    Utiliza las variables de entorno del servidor (SMTP_HOST, SMTP_USER, etc.)
                  </p>
                </div>
                <Switch checked={useSystemConfig} onCheckedChange={setUseSystemConfig} />
              </div>

              {!useSystemConfig && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-host">Host SMTP</Label>
                    <Input
                      id="smtp-host"
                      value={smtp.host}
                      onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">Puerto</Label>
                    <Input
                      id="smtp-port"
                      type="number"
                      value={smtp.port}
                      onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                      placeholder="465"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-user">Usuario</Label>
                    <Input
                      id="smtp-user"
                      value={smtp.user}
                      onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                      placeholder="correo@gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-pass">
                      Contraseña {smtp.hasPass && "(dejar en blanco para mantener actual)"}
                    </Label>
                    <Input
                      id="smtp-pass"
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-from">Email remitente (From)</Label>
                    <Input
                      id="smtp-from"
                      value={smtp.from}
                      onChange={(e) => setSmtp({ ...smtp, from: e.target.value })}
                      placeholder="noreply@car4youpanama.com"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      id="smtp-secure"
                      checked={smtp.secure}
                      onCheckedChange={(checked) => setSmtp({ ...smtp, secure: checked })}
                    />
                    <Label htmlFor="smtp-secure">Conexión segura (TLS/SSL)</Label>
                  </div>
                </div>
              )}

              {useSystemConfig && (
                <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>
                    Usando configuración del sistema. Si deseas personalizar el servidor SMTP para este módulo,
                    desactiva esta opción y completa los campos anteriores.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Templates */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Templates de Notificación</CardTitle>
              <CardDescription>
                Personaliza los emails enviados para cada evento del módulo de financiamiento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {templates.map((template, index) => (
                <div key={template.key}>
                  {index > 0 && <Separator className="my-6" />}
                  <EmailTemplateEditor
                    template={template}
                    onChange={(updated) => updateTemplate(index, updated)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Test */}
        <TabsContent value="test" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enviar Email de Prueba</CardTitle>
              <CardDescription>
                Verifica que la configuración SMTP funciona correctamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">Destinatario</Label>
                <Input
                  id="test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="tu-correo@ejemplo.com"
                />
                <p className="text-xs text-muted-foreground">
                  Si lo dejas en blanco, se enviará al email de tu cuenta.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-subject">Asunto (opcional)</Label>
                <Input
                  id="test-subject"
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  placeholder="Email de prueba — Car4youpanama"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-body">Cuerpo HTML (opcional)</Label>
                <textarea
                  id="test-body"
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <Button onClick={handleSendTest} disabled={isTesting} className="w-full">
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar email de prueba
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
