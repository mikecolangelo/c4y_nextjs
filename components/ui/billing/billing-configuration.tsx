"use client";

import { useState, useEffect } from "react";
import { Settings, Percent, Calendar, Save, Loader2 } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";

import { Label } from "@/components_shadcn/ui/label";
import { Slider } from "@/components_shadcn/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components_shadcn/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { Alert, AlertDescription } from "@/components_shadcn/ui/alert";
import { Badge } from "@/components_shadcn/ui/badge";
import { typography } from "@/lib/design-system";


interface BillingConfiguration {
  penaltyPercentage: number;
  billingDayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  paymentDeadlineDayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

export function BillingConfigurationDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [config, setConfig] = useState<BillingConfiguration>({
    penaltyPercentage: 10,
    billingDayOfWeek: 'tuesday',
    paymentDeadlineDayOfWeek: 'thursday',
  });

  // Cargar configuración actual
  useEffect(() => {
    if (open) {
      fetchConfiguration();
    }
  }, [open]);

  const fetchConfiguration = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/configuration?category=billing');
      
      if (!response.ok) {
        throw new Error('Error cargando configuración');
      }
      
      const data = await response.json();
      const configs = data.data || [];
      
      // Parsear configuración
      const penaltyConfig = configs.find((c: { key?: string; value?: string }) => c.key === 'billing-penalty-percentage');
      const billingDayConfig = configs.find((c: { key?: string; value?: string }) => c.key === 'billing-day');
      const deadlineDayConfig = configs.find((c: { key?: string; value?: string }) => c.key === 'billing-deadline-day');
      
      setConfig({
        penaltyPercentage: penaltyConfig?.value ? parseFloat(penaltyConfig.value) : 10,
        billingDayOfWeek: billingDayConfig?.value || 'tuesday',
        paymentDeadlineDayOfWeek: deadlineDayConfig?.value || 'thursday',
      });
    } catch (err) {
      console.error('Error cargando configuración:', err);
      // Usar valores por defecto
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Guardar cada configuración
      const configsToSave = [
        { key: 'billing-penalty-percentage', value: config.penaltyPercentage.toString(), category: 'billing' },
        { key: 'billing-day', value: config.billingDayOfWeek, category: 'billing' },
        { key: 'billing-deadline-day', value: config.paymentDeadlineDayOfWeek, category: 'billing' },
      ];
      
      for (const cfg of configsToSave) {
        // Buscar si ya existe la configuración
        const existingResponse = await fetch(`/api/configuration?key=${cfg.key}`);
        const existingData = await existingResponse.json();
        const existing = existingData.data?.[0];
        
        if (existing) {
          // Actualizar
          const response = await fetch(`/api/configuration/${existing.documentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: cfg }),
          });
          if (!response.ok) throw new Error(`Error actualizando: ${cfg.key}`);
        } else {
          // Crear nueva
          const response = await fetch('/api/configuration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: cfg }),
          });
          if (!response.ok) throw new Error(`Error creando: ${cfg.key}`);
        }
      }
      
      setSuccess(true);
      setTimeout(() => setOpen(false), 1500);
    } catch (err) {
      console.error('Error guardando configuración:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Configuración
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={typography.h3}>Configuración de Facturación</DialogTitle>
          <DialogDescription>
            Configura los parámetros del sistema de facturación automática y penalidades.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <AlertDescription className="text-green-700 dark:text-green-400">
                  Configuración guardada exitosamente
                </AlertDescription>
              </Alert>
            )}

            {/* Penalidad */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  Porcentaje de Penalidad
                </Label>
                <Badge variant="secondary">{config.penaltyPercentage}%</Badge>
              </div>
              <Slider
                value={[config.penaltyPercentage]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, penaltyPercentage: value }))}
                min={0}
                max={50}
                step={0.5}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Porcentaje aplicado sobre el monto de la cuota cuando la factura vence
              </p>
            </div>

            {/* Día de facturación */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Día de Facturación Automática
              </Label>
              <Select
                value={config.billingDayOfWeek}
                onValueChange={(value: string) => setConfig(prev => ({ ...prev, billingDayOfWeek: value as BillingConfiguration['billingDayOfWeek'] }))}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(day => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Día de la semana en que se generarán las facturas automáticamente
              </p>
            </div>

            {/* Día límite de pago */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Día Límite de Pago
              </Label>
              <Select
                value={config.paymentDeadlineDayOfWeek}
                onValueChange={(value: string) => setConfig(prev => ({ ...prev, paymentDeadlineDayOfWeek: value as BillingConfiguration['paymentDeadlineDayOfWeek'] }))}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(day => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Día límite para realizar el pago antes de aplicar la penalidad
              </p>
            </div>

            {/* Resumen */}
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-2">Resumen del ciclo:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Facturación: {DAYS_OF_WEEK.find(d => d.value === config.billingDayOfWeek)?.label}</li>
                <li>• Límite de pago: {DAYS_OF_WEEK.find(d => d.value === config.paymentDeadlineDayOfWeek)?.label}</li>
                <li>• Penalidad por mora: {config.penaltyPercentage}%</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BillingConfigurationDialog;
