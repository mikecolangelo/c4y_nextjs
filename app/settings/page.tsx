"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components_shadcn/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Label } from "@/components_shadcn/ui/label";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { Badge } from "@/components_shadcn/ui/badge";
import { spacing, typography } from "@/lib/design-system";
import { toast } from "@/lib/toast";
import { Building2, MessageSquare, Calendar, CreditCard, Save, Eye, EyeOff, Loader2 } from "lucide-react";
import { BillingSettingsSection } from "./components/billing-settings-section";

interface Configuration {
  id: number;
  documentId: string;
  key: string;
  value: string;
  description: string;
  category: string;
  isSecret: boolean;
}

interface CompanyInfo {
  id?: number;
  documentId?: string;
  companyName: string;
  legalRepName: string;
  legalRepNationality: string;
  legalRepMaritalStatus: string;
  legalRepPassport: string;
  companyAddress: string;
  registryInfo: string;
  phone: string;
  email: string;
  logo?: {
    url: string;
    alternativeText?: string;
  };
}

const defaultCompanyInfo: CompanyInfo = {
  companyName: "",
  legalRepName: "",
  legalRepNationality: "",
  legalRepMaritalStatus: "",
  legalRepPassport: "",
  companyAddress: "",
  registryInfo: "",
  phone: "",
  email: "",
};

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(defaultCompanyInfo);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [editedConfigs, setEditedConfigs] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configResponse, companyResponse] = await Promise.all([
        fetch("/api/configuration", { cache: "no-store" }),
        fetch("/api/company-info", { cache: "no-store" }),
      ]);

      if (configResponse.ok) {
        const configData = await configResponse.json();
        setConfigurations(configData.data || []);
      }

      if (companyResponse.ok) {
        const companyData = await companyResponse.json();
        if (companyData.data) {
          setCompanyInfo({ ...defaultCompanyInfo, ...companyData.data });
        }
      }
    } catch (error) {
      console.error("Error cargando configuraciones:", error);
      toast.error("Error al cargar las configuraciones");
    } finally {
      setIsLoading(false);
    }
  };

  const saveCompanyInfo = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/company-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyInfo),
      });

      if (!response.ok) {
        throw new Error("Error guardando información");
      }

      toast.success("Información de empresa guardada");
    } catch (error) {
      console.error("Error guardando información:", error);
      toast.error("Error al guardar la información");
    } finally {
      setIsSaving(false);
    }
  };

  const saveConfiguration = async (key: string, value: string) => {
    try {
      const response = await fetch("/api/configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });

      if (!response.ok) {
        throw new Error("Error guardando configuración");
      }

      toast.success(`Configuración "${key}" guardada`);
      await loadData();
    } catch (error) {
      console.error("Error guardando configuración:", error);
      toast.error("Error al guardar la configuración");
    }
  };

  const createConfiguration = async (key: string, category: string, description: string, isSecret: boolean = false) => {
    try {
      const response = await fetch("/api/configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: "", description, category, isSecret }),
      });

      if (!response.ok) {
        throw new Error("Error creando configuración");
      }

      toast.success(`Configuración "${key}" creada`);
      await loadData();
    } catch (error) {
      console.error("Error creando configuración:", error);
      toast.error("Error al crear la configuración");
    }
  };

  const getConfigsByCategory = (category: string) => {
    return configurations.filter((c) => c.category === category);
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfigChange = (key: string, value: string) => {
    setEditedConfigs((prev) => ({ ...prev, [key]: value }));
  };

  const getConfigValue = (key: string, originalValue: string) => {
    return editedConfigs[key] !== undefined ? editedConfigs[key] : originalValue;
  };

  if (isLoading) {
    return (
      <AdminLayout title="Configuración">
        <section className={`flex flex-col ${spacing.gap.large}`}>
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Configuración">
      <Tabs defaultValue="company" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0 mb-6">
          <TabsTrigger value="company" className="gap-2 data-[state=active]:bg-primary/10">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Empresa</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2 data-[state=active]:bg-primary/10">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2 data-[state=active]:bg-primary/10">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Google</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2 data-[state=active]:bg-primary/10">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Facturación</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Información de Empresa */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className={typography.h3}>Información de la Empresa</CardTitle>
              <CardDescription>
                Datos legales y de contacto para contratos y documentos oficiales
              </CardDescription>
            </CardHeader>
            <CardContent className={`flex flex-col ${spacing.gap.medium}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre de la Empresa *</Label>
                  <Input
                    id="companyName"
                    value={companyInfo.companyName}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, companyName: e.target.value })}
                    placeholder="CAR 4 YOU PANAMA, S.A."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={companyInfo.email}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                    placeholder="contacto@car4you.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={companyInfo.phone}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                    placeholder="+507 6000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalRepName">Representante Legal *</Label>
                  <Input
                    id="legalRepName"
                    value={companyInfo.legalRepName}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, legalRepName: e.target.value })}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalRepNationality">Nacionalidad</Label>
                  <Input
                    id="legalRepNationality"
                    value={companyInfo.legalRepNationality}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, legalRepNationality: e.target.value })}
                    placeholder="estadounidense"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalRepMaritalStatus">Estado Civil</Label>
                  <Input
                    id="legalRepMaritalStatus"
                    value={companyInfo.legalRepMaritalStatus}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, legalRepMaritalStatus: e.target.value })}
                    placeholder="casado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalRepPassport">Pasaporte</Label>
                  <Input
                    id="legalRepPassport"
                    value={companyInfo.legalRepPassport}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, legalRepPassport: e.target.value })}
                    placeholder="A80537445"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Dirección</Label>
                <Textarea
                  id="companyAddress"
                  value={companyInfo.companyAddress}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, companyAddress: e.target.value })}
                  placeholder="Dirección completa de la empresa"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registryInfo">Información del Registro</Label>
                <Textarea
                  id="registryInfo"
                  value={companyInfo.registryInfo}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, registryInfo: e.target.value })}
                  placeholder="Inscrita a ficha, documento, de la Sección Mercantil del Registro Público"
                  rows={2}
                />
              </div>
              <Button onClick={saveCompanyInfo} disabled={isSaving} className="w-full sm:w-auto">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Guardar Información
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: WhatsApp API */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className={typography.h3}>WhatsApp Business API</CardTitle>
              <CardDescription>
                Credenciales para la integración con WhatsApp Business
              </CardDescription>
            </CardHeader>
            <CardContent className={`flex flex-col ${spacing.gap.medium}`}>
              <ConfigurationSection
                category="whatsapp"
                configs={getConfigsByCategory("whatsapp")}
                showSecrets={showSecrets}
                editedConfigs={editedConfigs}
                onToggleSecret={toggleShowSecret}
                onConfigChange={handleConfigChange}
                onSaveConfig={saveConfiguration}
                onCreateConfig={createConfiguration}
                defaultConfigs={[
                  { key: "WHATSAPP_PHONE_NUMBER_ID", description: "ID del número de teléfono de WhatsApp Business", isSecret: false },
                  { key: "WHATSAPP_ACCESS_TOKEN", description: "Token de acceso de la API de WhatsApp", isSecret: true },
                  { key: "WHATSAPP_BUSINESS_ACCOUNT_ID", description: "ID de la cuenta de WhatsApp Business", isSecret: false },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Google Calendar */}
        <TabsContent value="google">
          <Card>
            <CardHeader>
              <CardTitle className={typography.h3}>Google Calendar API</CardTitle>
              <CardDescription>
                Credenciales para la sincronización con Google Calendar
              </CardDescription>
            </CardHeader>
            <CardContent className={`flex flex-col ${spacing.gap.medium}`}>
              <ConfigurationSection
                category="google"
                configs={getConfigsByCategory("google")}
                showSecrets={showSecrets}
                editedConfigs={editedConfigs}
                onToggleSecret={toggleShowSecret}
                onConfigChange={handleConfigChange}
                onSaveConfig={saveConfiguration}
                onCreateConfig={createConfiguration}
                defaultConfigs={[
                  { key: "GOOGLE_CLIENT_ID", description: "ID de cliente de Google OAuth", isSecret: false },
                  { key: "GOOGLE_CLIENT_SECRET", description: "Secreto de cliente de Google OAuth", isSecret: true },
                  { key: "GOOGLE_CALENDAR_ID", description: "ID del calendario de Google a sincronizar", isSecret: false },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Facturación */}
        <TabsContent value="billing">
          <BillingSettingsSection />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

// Componente auxiliar para secciones de configuración
interface ConfigurationSectionProps {
  category: string;
  configs: Configuration[];
  showSecrets: Record<string, boolean>;
  editedConfigs: Record<string, string>;
  onToggleSecret: (key: string) => void;
  onConfigChange: (key: string, value: string) => void;
  onSaveConfig: (key: string, value: string) => Promise<void>;
  onCreateConfig: (key: string, category: string, description: string, isSecret: boolean) => Promise<void>;
  defaultConfigs: { key: string; description: string; isSecret: boolean }[];
}

function ConfigurationSection({
  category,
  configs,
  showSecrets,
  editedConfigs,
  onToggleSecret,
  onConfigChange,
  onSaveConfig,
  onCreateConfig,
  defaultConfigs,
}: ConfigurationSectionProps) {
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});

  const handleSave = async (key: string, value: string) => {
    setSavingKeys((prev) => ({ ...prev, [key]: true }));
    await onSaveConfig(key, value);
    setSavingKeys((prev) => ({ ...prev, [key]: false }));
  };

  const existingKeys = configs.map((c) => c.key);
  const missingConfigs = defaultConfigs.filter((dc) => !existingKeys.includes(dc.key));

  return (
    <div className="space-y-4">
      {configs.map((config) => (
        <div key={config.key} className="flex flex-col gap-2 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="font-mono text-sm">{config.key}</Label>
              {config.isSecret && (
                <Badge variant="secondary" className="text-xs">Secreto</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {config.isSecret && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggleSecret(config.key)}
                >
                  {showSecrets[config.key] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => handleSave(config.key, editedConfigs[config.key] ?? config.value)}
                disabled={savingKeys[config.key]}
              >
                {savingKeys[config.key] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{config.description}</p>
          <Input
            type={config.isSecret && !showSecrets[config.key] ? "password" : "text"}
            value={editedConfigs[config.key] ?? (config.isSecret && config.value === "••••••••" ? "" : config.value)}
            onChange={(e) => onConfigChange(config.key, e.target.value)}
            placeholder={config.isSecret ? "Ingresa el valor secreto" : "Ingresa un valor"}
          />
        </div>
      ))}

      {missingConfigs.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <p className="text-sm text-muted-foreground mb-3">
            Configuraciones sugeridas pendientes de crear:
          </p>
          <div className="flex flex-wrap gap-2">
            {missingConfigs.map((dc) => (
              <Button
                key={dc.key}
                variant="outline"
                size="sm"
                onClick={() => onCreateConfig(dc.key, category, dc.description, dc.isSecret)}
              >
                + {dc.key}
              </Button>
            ))}
          </div>
        </div>
      )}

      {configs.length === 0 && missingConfigs.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          No hay configuraciones en esta categoría
        </p>
      )}
    </div>
  );
}
