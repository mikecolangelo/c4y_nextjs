import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    strapiBaseUrl: STRAPI_BASE_URL,
    checks: {} as Record<string, { status: string; responseTime?: number; error?: string }>,
  };

  // Check 1: Basic connectivity
  try {
    const start = Date.now();
    const response = await fetch(`${STRAPI_BASE_URL}/api/fleet-documents?limit=1`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Date.now() - start;
    
    results.checks["basic_connectivity"] = {
      status: response.status === 200 ? "ok" : `error_${response.status}`,
      responseTime,
    };
  } catch (error: any) {
    results.checks["basic_connectivity"] = {
      status: "failed",
      error: error.message || "Unknown error",
    };
  }

  // Check 2: Upload endpoint
  try {
    const start = Date.now();
    const response = await fetch(`${STRAPI_BASE_URL}/api/upload`, {
      method: "OPTIONS",
      signal: AbortSignal.timeout(5000),
    });
    const responseTime = Date.now() - start;
    
    results.checks["upload_endpoint"] = {
      status: response.ok ? "ok" : `error_${response.status}`,
      responseTime,
    };
  } catch (error: any) {
    results.checks["upload_endpoint"] = {
      status: "failed",
      error: error.message || "Unknown error",
    };
  }

  // Check 3: Document types endpoint
  try {
    const start = Date.now();
    const response = await fetch(`${STRAPI_BASE_URL}/api/fleet-document-types?limit=1`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Date.now() - start;
    
    results.checks["document_types"] = {
      status: response.status === 200 ? "ok" : `error_${response.status}`,
      responseTime,
    };
  } catch (error: any) {
    results.checks["document_types"] = {
      status: "failed",
      error: error.message || "Unknown error",
    };
  }

  const hasErrors = Object.values(results.checks).some((check: any) => 
    check.status !== "ok"
  );

  return NextResponse.json(results, { 
    status: hasErrors ? 503 : 200 
  });
}
