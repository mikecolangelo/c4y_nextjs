import { NextResponse } from "next/server";
import { fetchFleetVehiclesFromStrapi, createFleetVehicleInStrapi, updateFleetVehicleInStrapi, type FleetVehicleCreatePayload } from "@/lib/fleet";
import { requireAdmin } from "@/lib/admin-guard";
import { revalidateTag } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limiter";
import { headers } from "next/headers";

export async function GET() {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const vehicles = await fetchFleetVehiclesFromStrapi();
    return NextResponse.json({ data: vehicles });
  } catch (error) {
    console.error("Error fetching fleet data:", error);
    return NextResponse.json(
      { error: "No se pudo obtener la flota desde Strapi." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const body = (await request.json()) as { data?: FleetVehicleCreatePayload };
    
    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos del vehículo son requeridos." },
        { status: 400 }
      );
    }

    const { data } = body;

    // Sanitizar: eliminar claves inválidas que puedan venir de extensiones/autofill
    const sanitizedData: any = { ...data };
    if ('mileage' in sanitizedData) {
      if ((sanitizedData.currentMileage === undefined || sanitizedData.currentMileage === null) && sanitizedData.mileage !== undefined) {
        sanitizedData.currentMileage = sanitizedData.mileage;
      }
      delete sanitizedData.mileage;
    }

    // Validar campos requeridos
    if (!sanitizedData.name || !sanitizedData.vin || !sanitizedData.price || !sanitizedData.condition || !sanitizedData.brand || !sanitizedData.model || !sanitizedData.year) {
      return NextResponse.json(
        { error: "Todos los campos requeridos deben estar presentes." },
        { status: 400 }
      );
    }

    // Validar año
    if (sanitizedData.year < 1900 || sanitizedData.year > 2100) {
      return NextResponse.json(
        { error: "El año debe estar entre 1900 y 2100." },
        { status: 400 }
      );
    }

    // Validar condición
    if (!["nuevo", "usado", "seminuevo"].includes(sanitizedData.condition)) {
      return NextResponse.json(
        { error: "La condición debe ser 'nuevo', 'usado' o 'seminuevo'." },
        { status: 400 }
      );
    }

    // Validar currentMileage si está presente
    if (sanitizedData.currentMileage !== undefined && sanitizedData.currentMileage !== null && sanitizedData.currentMileage < 0) {
      return NextResponse.json(
        { error: "El kilometraje no puede ser negativo." },
        { status: 400 }
      );
    }

    // Separar relaciones manyToMany del payload de creación porque Strapi
    // puede rechazarlas directamente en create en algunas configuraciones
    const {
      responsables,
      assignedDrivers,
      interestedDrivers,
      currentDrivers,
      ...createData
    } = sanitizedData;

    let vehicle = await createFleetVehicleInStrapi(createData as FleetVehicleCreatePayload);

    // Aplicar relaciones en un segundo paso si existen
    const targetId = vehicle.documentId || vehicle.id;
    if (
      targetId &&
      (
        (responsables && responsables.length > 0) ||
        (assignedDrivers && assignedDrivers.length > 0) ||
        (interestedDrivers && interestedDrivers.length > 0) ||
        (currentDrivers && currentDrivers.length > 0)
      )
    ) {
      const relations: any = {};
      if (responsables && responsables.length > 0) relations.responsables = responsables;
      if (assignedDrivers && assignedDrivers.length > 0) relations.assignedDrivers = assignedDrivers;
      if (interestedDrivers && interestedDrivers.length > 0) relations.interestedDrivers = interestedDrivers;
      if (currentDrivers && currentDrivers.length > 0) relations.currentDrivers = currentDrivers;
      try {
        vehicle = await updateFleetVehicleInStrapi(targetId, relations);
      } catch (updateError) {
        console.error("Error aplicando relaciones después de crear vehículo:", updateError);
      }
    }

    revalidateTag("fleet");
    return NextResponse.json({ data: vehicle }, { status: 201 });
  } catch (error) {
    console.error("Error creating fleet vehicle:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo crear el vehículo.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}




