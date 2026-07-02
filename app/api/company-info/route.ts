import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { requireModulePermission } from "@/lib/module-guard";
import qs from "qs";

// GET - Obtener información de la empresa
export async function GET() {
  try {
    try {
      await requireModulePermission("settings", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }

    const query = qs.stringify({
      populate: {
        logo: {
          fields: ["url", "alternativeText", "name"],
        },
      },
    });

    const response = await fetch(`${STRAPI_BASE_URL}/api/company-info?${query}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No hay datos todavía, retornar objeto vacío
        return NextResponse.json({ data: null });
      }
      const errorText = await response.text();
      throw new Error(`Error obteniendo información de empresa: ${errorText}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Error parseando respuesta de Strapi:", text.substring(0, 200));
      throw new Error("Respuesta inválida del servidor");
    }
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error("Error obteniendo información de empresa:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar información de la empresa
export async function PUT(request: Request) {
  try {
    try {
      await requireModulePermission("settings", "canUpdate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      companyName,
      legalRepName,
      legalRepNationality,
      legalRepMaritalStatus,
      legalRepPassport,
      companyAddress,
      registryInfo,
      phone,
      email,
      logo,
    } = body;

    const updateData: any = {};
    if (companyName !== undefined) updateData.companyName = companyName;
    if (legalRepName !== undefined) updateData.legalRepName = legalRepName;
    if (legalRepNationality !== undefined) updateData.legalRepNationality = legalRepNationality;
    if (legalRepMaritalStatus !== undefined)
      updateData.legalRepMaritalStatus = legalRepMaritalStatus;
    if (legalRepPassport !== undefined) updateData.legalRepPassport = legalRepPassport;
    if (companyAddress !== undefined) updateData.companyAddress = companyAddress;
    if (registryInfo !== undefined) updateData.registryInfo = registryInfo;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (logo !== undefined) updateData.logo = logo;

    const response = await fetch(`${STRAPI_BASE_URL}/api/company-info`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: updateData }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error actualizando información de empresa: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error("Error actualizando información de empresa:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
