import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";

export async function GET() {
  const results: {
    config: {
      baseUrlConfigured: boolean;
      baseUrl: string | undefined;
      tokenConfigured: boolean;
      tokenLength: number;
      tokenPrefix: string | null;
    };
    tests: {
      appointmentsEndpoint?: {
        status: number;
        statusText: string;
        ok: boolean;
        error?: string;
        dataCount?: number;
      };
      publicEndpoint?: {
        status: number;
        statusText: string;
        ok: boolean;
        error?: string;
      };
      withContentType?: {
        status: number;
        statusText: string;
        ok: boolean;
        error?: string;
      };
    };
  } = {
    config: {
      baseUrlConfigured: !!STRAPI_BASE_URL,
      baseUrl: STRAPI_BASE_URL,
      tokenConfigured: !!STRAPI_API_TOKEN,
      tokenLength: STRAPI_API_TOKEN?.length || 0,
      tokenPrefix: STRAPI_API_TOKEN ? `${STRAPI_API_TOKEN.substring(0, 20)}...` : null,
    },
    tests: {},
  };

  // Test 1: Verificar conexión básica
  try {
    const healthCheck = await fetch(`${STRAPI_BASE_URL}/api/appointments?pagination[pageSize]=1`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });
    
    results.tests.appointmentsEndpoint = {
      status: healthCheck.status,
      statusText: healthCheck.statusText,
      ok: healthCheck.ok,
    };

    if (!healthCheck.ok) {
      const errorText = await healthCheck.text();
      results.tests.appointmentsEndpoint.error = errorText;
    } else {
      const data = await healthCheck.json();
      results.tests.appointmentsEndpoint.dataCount = data.data?.length || 0;
    }
  } catch (error) {
    results.tests.appointmentsEndpoint = {
      error: error instanceof Error ? error.message : "Error desconocido",
      type: "connection_error",
    };
  }

  // Test 2: Verificar endpoint público de Strapi
  try {
    const publicCheck = await fetch(`${STRAPI_BASE_URL}/api/users-permissions/roles`, {
      cache: "no-store",
    });
    
    results.tests.publicEndpoint = {
      status: publicCheck.status,
      statusText: publicCheck.statusText,
      ok: publicCheck.ok,
    };
  } catch (error) {
    results.tests.publicEndpoint = {
      error: error instanceof Error ? error.message : "Error desconocido",
      type: "connection_error",
    };
  }

  // Test 3: Probar con Content-Type header
  try {
    const withContentType = await fetch(`${STRAPI_BASE_URL}/api/appointments?pagination[pageSize]=1`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    
    results.tests.withContentType = {
      status: withContentType.status,
      statusText: withContentType.statusText,
      ok: withContentType.ok,
    };
  } catch (error) {
    results.tests.withContentType = {
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }

  return NextResponse.json(results);
}

export const dynamic = "force-dynamic";
