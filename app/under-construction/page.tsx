"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Construction, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { AdminLayout } from "@/components/admin/admin-layout";
import { typography } from "@/lib/design-system";

const MODULE_LABELS: Record<string, string> = {
  billing: "Facturación",
  calendar: "Calendario",
  dashboard: "Panel",
  users: "Contactos",
  "adm-services": "Servicios",
  stock: "Inventario",
  fleet: "Flota",
  deal: "Tratos",
  "service-orders": "Órdenes de servicio",
  notifications: "Notificaciones",
};

function UnderConstructionContent() {
  const searchParams = useSearchParams();
  const moduleKey = searchParams.get("module") || "";
  const label = MODULE_LABELS[moduleKey] || "Este módulo";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md w-full text-center shadow-sm ring-1 ring-inset ring-border/50">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Construction className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className={typography.h3}>{label} en construcción</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className={`${typography.body.base} text-muted-foreground`}>
            Estamos trabajando en este módulo. Estará disponible muy pronto.
          </p>
          <Button asChild className="mx-auto">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al panel
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function UnderConstructionPage() {
  return (
    <AdminLayout title="En construcción">
      <Suspense fallback={null}>
        <UnderConstructionContent />
      </Suspense>
    </AdminLayout>
  );
}
