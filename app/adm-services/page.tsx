"use client";

import { useState, useEffect, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Card, CardContent } from "@/ui/card";
import { Calendar, Wrench } from "lucide-react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { ServiceCalendar } from "@/components/service-v2/service-calendar-wrapper";
import { ServiceCatalog } from "@/components/service/service-catalog";
import { ServiceOrders } from "@/components/service-v2/service-orders";
import type { AppointmentCard } from "@/validations/types";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";

type TabValue = "catalog" | "calendar";

// Componente interno que usa useSearchParams
function AdmServicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabValue>("catalog");

  // Leer parámetros de URL para cambiar al tab correcto
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "calendar") {
      setActiveTab("calendar");
    }
  }, [searchParams]);

  const handleEventClick = (appointment: AppointmentCard) => {
    // Navegar al detalle de la orden de servicio asociada a la cita
    if (appointment.serviceOrderDocumentId) {
      router.push(`/service-orders-v2/${appointment.serviceOrderDocumentId}`);
    } else {
      toast.error("Esta cita no tiene una orden de servicio asociada.");
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as TabValue)}
      className="w-full"
    >
      <Card className="shadow-sm ring-1 ring-inset ring-border/50 mb-4">
        <CardContent className="p-2">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger
              value="catalog"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Catálogo</span>
              <span className="sm:hidden">Catálogo</span>
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendario</span>
              <span className="sm:hidden">Calendario</span>
            </TabsTrigger>
          </TabsList>
        </CardContent>
      </Card>

      {/* Tab Catálogo - Vista completa */}
      <TabsContent value="catalog" className="mt-0">
        <ServiceCatalog />
      </TabsContent>

      {/* Tab Calendario - Layout 2 columnas: Timeline izquierda + Calendario derecha */}
      <TabsContent value="calendar" className="mt-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Columna izquierda (2/3): Timeline de órdenes */}
          <div className="lg:col-span-2 order-2 lg:order-1 h-full">
            <ServiceOrders compact tall />
          </div>

          {/* Columna derecha (1/3): Calendario cuadrado perfecto - más pequeño */}
          <div className="lg:col-span-1 order-1 lg:order-2 flex flex-col items-center h-full">
            <div className="w-full max-w-[280px] h-full">
              <ServiceCalendar
                onEventClick={handleEventClick}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// Loading fallback para Suspense
function AdmServicesLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

// Página principal envuelta en Suspense
export default function AdmServicesPage() {
  return (
    <AdminLayout title="Gestión de Servicios" showFilterAction>
      <Suspense fallback={<AdmServicesLoading />}>
        <AdmServicesContent />
      </Suspense>
    </AdminLayout>
  );
}
