import { NextResponse } from "next/server";
import { requireModulePermission } from "@/lib/module-guard";
import { revalidateTag } from "next/cache";
import {
  deleteFleetVehicleInStrapi,
  fetchFleetVehicleByIdFromStrapi,
  fetchFleetVehicleRawFromStrapi,
  updateFleetVehicleInStrapi,
} from "@/lib/fleet";
import type { FleetVehicleUpdatePayload } from "@/validations/types";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    try {
      await requireModulePermission("fleet", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const { id } = await context.params;
    const url = new URL(request.url);
    const includeRaw = url.searchParams.get("includeRaw") === "true";

    if (includeRaw) {
      // Devolver datos raw para obtener el imageId
      const rawVehicle = await fetchFleetVehicleRawFromStrapi(id);
      if (!rawVehicle) {
        return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
      }
      return NextResponse.json({ data: rawVehicle });
    }

    const vehicle = await fetchFleetVehicleByIdFromStrapi(id);
    if (!vehicle) {
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ data: vehicle });
  } catch (error) {
    console.error("Error fetching fleet vehicle:", error);
    return NextResponse.json(
      { error: "No pudimos obtener la información del vehículo." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    try {
      await requireModulePermission("fleet", "canUpdate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const body = (await request.json()) as { data?: FleetVehicleUpdatePayload };
    if (!body?.data) {
      return NextResponse.json(
        { error: "Payload inválido. Envía los campos dentro de data." },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const updated = await updateFleetVehicleInStrapi(id, body.data);
    revalidateTag("fleet");
    return NextResponse.json({ data: updated });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error updating fleet vehicle:", error);
    return NextResponse.json(
      { error: `No pudimos actualizar el vehículo: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    try {
      await requireModulePermission("fleet", "canDelete");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const { id } = await context.params;
    await deleteFleetVehicleInStrapi(id);
    revalidateTag("fleet");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting fleet vehicle:", error);
    return NextResponse.json(
      { error: "No pudimos eliminar el vehículo. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
