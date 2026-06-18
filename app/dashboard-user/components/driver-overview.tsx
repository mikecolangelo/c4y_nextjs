"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import {
  Car,
  Receipt,
  Construction,
  MessageCircle,
  Mail,
  Phone,
  Instagram,
  Facebook,
  Music2,
} from "lucide-react";
import { typography } from "@/lib/design-system";

interface ContactInfo {
  phone1: string;
  phone2: string;
  email: string;
  tiktok: string;
  instagram: string;
  facebook: string;
}

const WHATSAPP_MESSAGE =
  "Hola, quiero notificar un pago / consultar el estado de mi financiamiento.";

function toWhatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}

function ConstructionCard({
  title,
  icon: Icon,
  hint,
}: {
  title: string;
  icon: typeof Car;
  hint: string;
}) {
  return (
    <Card className="shadow-sm ring-1 ring-inset ring-border/50">
      <CardHeader className="px-6 pt-6 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-2 px-6 pb-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <Construction className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-sm font-medium">En construcción</p>
        <p className={`${typography.body.small} text-muted-foreground max-w-xs`}>{hint}</p>
      </CardContent>
    </Card>
  );
}

export function DriverOverview() {
  const [contact, setContact] = useState<ContactInfo | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/contact-info", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setContact(json.data);
        }
      } catch (error) {
        console.error("Error cargando contacto:", error);
      }
    };
    load();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ConstructionCard
          title="Mi vehículo"
          icon={Car}
          hint="Aquí verás el estado de tu auto. Disponible cuando se habilite el módulo."
        />
        <ConstructionCard
          title="Próximo pago"
          icon={Receipt}
          hint="Tu próxima cuota de financiamiento. Depende de Facturación, en construcción."
        />
      </div>

      {/* Contacto con la administración (datos reales y configurables) */}
      <Card className="shadow-sm ring-1 ring-inset ring-border/50">
        <CardHeader className="px-6 pt-6 pb-3">
          <CardTitle className="text-base font-semibold">Contactar a la administración</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-6 pb-6">
          <p className={`${typography.body.small} text-muted-foreground`}>
            Notifica tus pagos o resuelve dudas con nosotros.
          </p>

          {contact === null ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <div className="flex flex-col gap-3">
              {contact.phone1 && (
                <Button
                  asChild
                  className="w-full justify-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <a href={toWhatsAppLink(contact.phone1)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    Escribir por WhatsApp
                  </a>
                </Button>
              )}

              <div className="flex flex-wrap gap-2">
                {contact.phone1 && (
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <a href={`tel:${contact.phone1.replace(/\s/g, "")}`}>
                      <Phone className="h-4 w-4" />
                      {contact.phone1}
                    </a>
                  </Button>
                )}
                {contact.phone2 && (
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <a href={`tel:${contact.phone2.replace(/\s/g, "")}`}>
                      <Phone className="h-4 w-4" />
                      {contact.phone2}
                    </a>
                  </Button>
                )}
                {contact.email && (
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <a href={`mailto:${contact.email}`}>
                      <Mail className="h-4 w-4" />
                      {contact.email}
                    </a>
                  </Button>
                )}
              </div>

              {(contact.tiktok || contact.instagram || contact.facebook) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className={`${typography.body.small} text-muted-foreground`}>Síguenos:</span>
                  {contact.instagram && (
                    <Button asChild variant="ghost" size="icon" className="h-9 w-9">
                      <a href={contact.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                        <Instagram className="h-5 w-5" />
                      </a>
                    </Button>
                  )}
                  {contact.facebook && (
                    <Button asChild variant="ghost" size="icon" className="h-9 w-9">
                      <a href={contact.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                        <Facebook className="h-5 w-5" />
                      </a>
                    </Button>
                  )}
                  {contact.tiktok && (
                    <Button asChild variant="ghost" size="icon" className="h-9 w-9">
                      <a href={contact.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                        <Music2 className="h-5 w-5" />
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
