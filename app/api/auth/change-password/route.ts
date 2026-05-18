import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/auth/change-password`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      let errorPayload: any = {};
      try {
        errorPayload = await response.json();
      } catch {
        errorPayload = { message: response.statusText };
      }

      const errorMessage =
        typeof errorPayload.error?.message === "string"
          ? errorPayload.error.message
          : typeof errorPayload.message === "string"
            ? errorPayload.message
            : typeof errorPayload.error === "string"
              ? errorPayload.error
              : "Error del servidor";

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error cambiando contraseña:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
