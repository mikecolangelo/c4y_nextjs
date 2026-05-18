"use client";

import { useState, useEffect } from "react";
import { CreditCard, Percent, Calendar, Bell, Save, Loader2, Settings, Wrench } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import { Label } from "@/components_shadcn/ui/label";
import { Switch } from "@/components_shadcn/ui/switch";
import { Slider } from "@/components_shadcn/ui/slider";
import { Input } from "@/components_shadcn/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components_shadcn/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components_shadcn/ui/card";

import { Badge } from "@/components_shadcn/ui/badge";
import { toast } from "sonner";

interface BillingSettings {
  billingTestModeEnabled: boolean;
  penaltyPercentage: number;
  billingDayOfWeek: string;
  paymentDeadlineDayOfWeek: string;
  defaultQuotaCount: string;
  maintenanceIntervalKm: string;
}

interface ConfigItem {
  id: number;
  documentId: string;
  key: string;
  value: string;
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sábado" },
  { value: "sunday", label: "Domingo" },
];



export function BillingSettingsSection() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<ConfigItem[]>([]);

  const [settings, setSettings] = useState<BillingSettings>({
    billingTestModeEnabled: false,
    penaltyPercentage: 10,
    billingDayOfWeek: "tuesday",
    paymentDeadlineDayOfWeek: "thursday",
    defaultQuotaCount: "220",
    maintenanceIntervalKm: "5000",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/configuration");
      if (!res.ok) throw new Error("Error cargando");
      const data = await res.json();
      const allConfigs: ConfigItem[] = data.data || [];
      
      setConfigs(allConfigs);

      const get = (key: string, def: string) => {
        const c = allConfigs.find((x) => x.key === key);
        return c?.value ?? def;
      };

      setSettings({
        billingTestModeEnabled: get("billing-test-mode-enabled", "false") === "true",
        penaltyPercentage: parseFloat(get("billing-penalty-percentage", "10")),
        billingDayOfWeek: get("billing-day", "tuesday"),
        paymentDeadlineDayOfWeek: get("billing-deadline-day", "thursday"),
        defaultQuotaCount: get("DEFAULT_QUOTA_COUNT", "220"),
        maintenanceIntervalKm: get("MAINTENANCE_INTERVAL_KM", "5000"),
      });
    } catch (e) {
      console.error(e);
      toast.error("Error cargando configuracion");
    } finally {
      setLoading(false);
    }
  };

  const save = async (key: string, value: string, desc: string) => {
    const existing = configs.find((c) => c.key === key);

    if (existing) {
      // Actualizar via PUT enviando key en body
      const res = await fetch("/api/configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, description: desc }),
      });
      if (!res.ok) throw new Error(`Error actualizando ${key}`);
    } else {
      // Crear via POST
      const res = await fetch("/api/configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          key, 
          value, 
          description: desc, 
          category: "billing",
          isSecret: false 
        }),
      });
      if (!res.ok) throw new Error(`Error creando ${key}`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        save("billing-test-mode-enabled", String(settings.billingTestModeEnabled), "Modo pruebas"),
        save("billing-penalty-percentage", String(settings.penaltyPercentage), "Penalidad"),
        save("billing-day", settings.billingDayOfWeek, "Dia facturacion"),
        save("billing-deadline-day", settings.paymentDeadlineDayOfWeek, "Dia limite"),
        save("DEFAULT_QUOTA_COUNT", settings.defaultQuotaCount, "Cuotas default"),
        save("MAINTENANCE_INTERVAL_KM", settings.maintenanceIntervalKm, "Mantenimiento KM"),
      ]);
      toast.success("Configuracion guardada");
      await loadSettings();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Facturacion Automatica
          </CardTitle>
          <CardDescription>
            Configuracion del sistema de facturacion automatica
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Modo Pruebas */}
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-purple-600" />
                  Modo Pruebas de Facturacion
                </Label>
                <p className="text-sm text-muted-foreground">
                  Al activar, se mostraran botones de simulacion en el modulo de billing
                </p>
              </div>
              <Switch
                checked={settings.billingTestModeEnabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, billingTestModeEnabled: v }))}
              />
            </div>
          </div>

          {/* Penalidad */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                Porcentaje de Penalidad por Mora
              </Label>
              <span className="text-2xl font-semibold">{settings.penaltyPercentage}%</span>
            </div>
            <Slider
              value={[settings.penaltyPercentage]}
              onValueChange={([v]) => setSettings((s) => ({ ...s, penaltyPercentage: v }))}
              min={0}
              max={50}
              step={0.5}
            />
            <p className="text-sm text-muted-foreground">
              Porcentaje aplicado sobre el monto de la cuota cuando la factura vence
            </p>
          </div>

          {/* Dias */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Dia de Facturacion Automatica
              </Label>
              <Select
                value={settings.billingDayOfWeek}
                onValueChange={(v) => setSettings((s) => ({ ...s, billingDayOfWeek: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Dia Limite de Pago
              </Label>
              <Select
                value={settings.paymentDeadlineDayOfWeek}
                onValueChange={(v) => setSettings((s) => ({ ...s, paymentDeadlineDayOfWeek: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resumen */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium mb-2">Resumen del ciclo:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Facturacion: {DAYS_OF_WEEK.find(d => d.value === settings.billingDayOfWeek)?.label}</li>
              <li>• Limite de pago: {DAYS_OF_WEEK.find(d => d.value === settings.paymentDeadlineDayOfWeek)?.label}</li>
              <li>• Penalidad: {settings.penaltyPercentage}%</li>
              <li>• Modo pruebas: {settings.billingTestModeEnabled ? "Activado" : "Desactivado"}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Configuraciones Generales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuraciones Generales
          </CardTitle>
          <CardDescription>
            Parametros por defecto para contratos y pagos
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Cuotas por defecto */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">DEFAULT_QUOTA_COUNT</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Numero de cuotas por defecto para nuevos financiamientos
            </p>
            <Input
              type="number"
              min="1"
              max="520"
              value={settings.defaultQuotaCount}
              onChange={(e) => setSettings((s) => ({ ...s, defaultQuotaCount: e.target.value }))}
            />
          </div>

          {/* Mantenimiento KM */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary">MAINTENANCE_INTERVAL_KM</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Intervalo de mantenimiento en kilometros para los vehiculos
            </p>
            <Input
              type="number"
              min="1000"
              step="500"
              value={settings.maintenanceIntervalKm}
              onChange={(e) => setSettings((s) => ({ ...s, maintenanceIntervalKm: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : <><Save className="h-4 w-4" /> Guardar Configuracion</>}
      </Button>
    </div>
  );
}

export default BillingSettingsSection;
