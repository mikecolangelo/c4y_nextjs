import { NextResponse } from "next/server";
import { fetchServicesFromStrapi, createServiceInStrapi } from "@/features/services";
import { requireModulePermission } from "@/lib/module-guard";
import type { ServiceCreatePayload } from "@/validations/types";

export async function GET() {
  try {
    try {
      await requireModulePermission("adm-services", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const services = await fetchServicesFromStrapi();
    return NextResponse.json({ data: services });
  } catch (error) {
    console.error("Error fetching services data:", error);
    return NextResponse.json(
      { error: "No se pudo obtener los servicios desde Strapi." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    try {
      await requireModulePermission("adm-services", "canCreate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const body = (await request.json()) as { data?: ServiceCreatePayload };

    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos del servicio son requeridos." },
        { status: 400 }
      );
    }

    const { data } = body;

    // Validar campos requeridos
    if (!data.name) {
      return NextResponse.json({ error: "El nombre del servicio es requerido." }, { status: 400 });
    }

    // Validar precio
    if (data.price === undefined || data.price === null) {
      return NextResponse.json({ error: "El precio del servicio es requerido." }, { status: 400 });
    }

    if (typeof data.price !== "number" || data.price < 0) {
      return NextResponse.json(
        { error: "El precio debe ser un número válido mayor o igual a 0." },
        { status: 400 }
      );
    }

    // Validar cobertura
    if (!data.coverage || !["cliente", "empresa"].includes(data.coverage)) {
      return NextResponse.json(
        { error: "La cobertura debe ser 'cliente' o 'empresa'." },
        { status: 400 }
      );
    }

    // Normalizar basePrice y agencyCost a números para evitar validación de tipo en Strapi
    const payload: ServiceCreatePayload = {
      ...data,
      basePrice: typeof data.basePrice === "number" ? data.basePrice : 0,
      agencyCost: typeof data.agencyCost === "number" ? data.agencyCost : 0,
    };

    const service = await createServiceInStrapi(payload);
    return NextResponse.json({ data: service }, { status: 201 });
  } catch (error) {
    console.error("Error creating service:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo crear el servicio.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
