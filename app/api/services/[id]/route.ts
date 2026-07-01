import { NextResponse } from "next/server";
import {
  fetchServiceByIdFromStrapi,
  updateServiceInStrapi,
  deleteServiceInStrapi,
} from "@/features/services";
import { requireAdmin } from "@/lib/admin-guard";
import type { ServiceUpdatePayload } from "@/validations/types";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const service = await fetchServiceByIdFromStrapi(id);

    if (!service) {
      return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ data: service });
  } catch (error) {
    console.error("Error fetching service:", error);
    return NextResponse.json(
      { error: "No pudimos obtener la información del servicio." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = (await request.json()) as { data?: ServiceUpdatePayload };

    if (!body?.data) {
      return NextResponse.json(
        { error: "Payload inválido. Envía los campos dentro de data." },
        { status: 400 }
      );
    }

    const { id } = await context.params;

    // Validar precio si está presente
    if (body.data.price !== undefined) {
      if (typeof body.data.price !== "number" || body.data.price < 0) {
        return NextResponse.json(
          { error: "El precio debe ser un número válido mayor o igual a 0." },
          { status: 400 }
        );
      }
    }

    // Validar cobertura si está presente
    if (body.data.coverage !== undefined) {
      if (!["cliente", "empresa"].includes(body.data.coverage)) {
        return NextResponse.json(
          { error: "La cobertura debe ser 'cliente' o 'empresa'." },
          { status: 400 }
        );
      }
    }

    // Validar basePrice y agencyCost si están presentes
    const hasRestrictedFields =
      body.data.basePrice !== undefined || body.data.agencyCost !== undefined;

    if (hasRestrictedFields) {
      try {
        await requireAdmin();
      } catch {
        return NextResponse.json(
          {
            error:
              "No tienes permisos para modificar el precio base o el costo de agencia. Solo administradores pueden realizar esta acción.",
          },
          { status: 403 }
        );
      }

      if (body.data.basePrice !== undefined) {
        if (typeof body.data.basePrice !== "number" || body.data.basePrice < 0) {
          return NextResponse.json(
            { error: "El precio base debe ser un número válido mayor o igual a 0." },
            { status: 400 }
          );
        }
      }
      if (body.data.agencyCost !== undefined) {
        if (typeof body.data.agencyCost !== "number" || body.data.agencyCost < 0) {
          return NextResponse.json(
            { error: "El costo de agencia debe ser un número válido mayor o igual a 0." },
            { status: 400 }
          );
        }
      }
    }

    const updated = await updateServiceInStrapi(id, body.data);
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating service:", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el servicio. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  // PUT funciona igual que PATCH para compatibilidad
  return PATCH(request, context);
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteServiceInStrapi(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting service:", error);
    return NextResponse.json(
      { error: "No pudimos eliminar el servicio. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
