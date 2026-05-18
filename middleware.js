/**
 * Middleware de emergencia para corregir llamadas API a Strapi v5
 * 
 * Este middleware intercepta las llamadas que usan el antiguo formato de filtros
 * y las redirige al formato correcto de Strapi v5 (endpoint directo).
 */

import { NextResponse } from 'next/server';

const STRAPI_BASE_URL = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.STRAPI_BASE_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Solo interceptar rutas API de fleet
  if (!pathname.match(/^\/api\/fleet\/[^\/]+\/(reminder|document)$/)) {
    return NextResponse.next();
  }

  // Extraer el documentId del vehículo de la URL
  const match = pathname.match(/^\/api\/fleet\/([^\/]+)\/(reminder|document)$/);
  if (!match) {
    return NextResponse.next();
  }

  const vehicleDocumentId = match[1];
  const endpoint = match[2];

  console.log(`[Middleware] Interceptando ${pathname} para vehículo ${vehicleDocumentId}`);

  // Llamar directamente a Strapi v5 con el endpoint correcto
  try {
    // Obtener vehículo usando endpoint directo (Strapi v5)
    const vehicleResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleets/${vehicleDocumentId}?fields=id`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
      }
    );

    if (!vehicleResponse.ok) {
      if (vehicleResponse.status === 404) {
        return NextResponse.json(
          { error: 'Vehículo no encontrado' },
          { status: 404 }
        );
      }
      throw new Error(`Strapi error: ${vehicleResponse.status}`);
    }

    const vehicleData = await vehicleResponse.json();
    const vehicleId = vehicleData.data?.id;

    if (!vehicleId) {
      return NextResponse.json(
        { error: 'No se pudo obtener el ID del vehículo' },
        { status: 404 }
      );
    }

    // Guardar el vehicleId en headers para que la API route lo use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-vehicle-id', String(vehicleId));
    requestHeaders.set('x-vehicle-document-id', vehicleDocumentId);

    // Continuar con la request modificada
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('[Middleware] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export const config = {
  matcher: ['/api/fleet/:id/reminder', '/api/fleet/:id/document'],
};
