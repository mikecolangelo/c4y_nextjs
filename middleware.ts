import { type NextRequest, NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "./lib/config";
import { fetchMyPermissions, moduleForPath, landingForRole, isUnderConstruction } from "./lib/permissions";

const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

// Rutas base que no siguen el patrón de módulos
const baseRoutes = [
  "/dashboard",
  "/dashboard_user",
  "/notifications",
];

// Sub-rutas adicionales por módulo que no siguen el patrón estándar
const moduleSubRoutes: Record<string, string[]> = {
  stock: ["/stock/supplies", "/stock/dashboard"],
};

// Módulos que siguen el patrón estándar
const modules = [
  "billing",
  "fleet",
  "users",
  "adm-services",
  "calendar",
  "stock",
  "deal",
];

// Acciones disponibles para los detalles de cada módulo
const detailActions = [
  "edit",
  "delete",
  "send-reminder",
  "save-changes",
  "delete-document",
  "upload-document",
];

// Genera las rutas para un módulo
function generateModuleRoutes(module: string): string[] {
  const routes = [
    `/${module}`,
    `/${module}/details`,
    `/${module}/details/:id`,
  ];
  
  // Agrega las rutas de acciones
  detailActions.forEach((action) => {
    routes.push(`/${module}/details/:id/${action}`);
  });
  
  return routes;
}

// Genera todas las rutas protegidas
const protectedRoutes = [
  ...baseRoutes,
  ...modules.flatMap(generateModuleRoutes),
  // Agregar sub-rutas adicionales de módulos
  ...Object.values(moduleSubRoutes).flat(),
  // Service Orders V2 (nueva ruta de detalle de órdenes)
  "/service-orders-v2",
  "/service-orders-v2/:id",
];

function checkIsProtectedRoute(path: string): boolean {
  // Verifica coincidencia exacta primero
  if (protectedRoutes.includes(path)) {
    return true;
  }
  
  // Verifica patrones dinámicos (rutas con :id)
  return protectedRoutes.some((route) => {
    // Convierte el patrón de ruta a expresión regular
    // Reemplaza :id con un patrón que coincida con cualquier ID
    const pattern = route.replace(/:id/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(path);
  });
}

// Rutas públicas donde no se requiere autenticación
const publicRoutes = ['/signin', '/signup', '/'];

function isPublicRoute(path: string): boolean {
  return publicRoutes.includes(path) || path.startsWith('/signin') || path.startsWith('/signup');
}

export default async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;

  // Interceptar rutas API de fleet (lógica proveniente del antiguo middleware.js)
  if (currentPath.match(/^\/api\/fleet\/[^\/]+\/(reminder|document)$/)) {
    const match = currentPath.match(/^\/api\/fleet\/([^\/]+)\/(reminder|document)$/);
    if (match) {
      const vehicleDocumentId = match[1];
      const endpoint = match[2];

      console.log(`[Middleware] Interceptando ${currentPath} para vehículo ${vehicleDocumentId}`);

      try {
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

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-vehicle-id', String(vehicleId));
        requestHeaders.set('x-vehicle-document-id', vehicleDocumentId);

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
  }

  // Redirigir página principal a signin
  if (currentPath === '/') {
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  const isProtectedRoute = checkIsProtectedRoute(currentPath);
  const isPublic = isPublicRoute(currentPath);

  const jwt = request.cookies.get('jwt')?.value;

  // Si estamos en una ruta pública, limpiar siempre el admin-theme y verificar el JWT
  if (isPublic) {
    const response = NextResponse.next();
    
    // Siempre limpiar admin-theme en rutas públicas para evitar que persista
    response.cookies.delete('admin-theme');
    
    // Si hay JWT, verificar si es válido
    if (jwt) {
      try {
        const apiResponse = await fetch(`${STRAPI_BASE_URL}/api/users/me`, { 
          headers: { 
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000), // 5 segundos de timeout
        });

        // Si el token no es válido, limpiar también el JWT
        if (!apiResponse.ok) {
          response.cookies.delete('jwt');
        }
      } catch (error) {
        // Si hay error al verificar, limpiar el JWT por seguridad
        response.cookies.delete('jwt');
      }
    }
    
    // Continuar a la ruta pública sin redirigir
    return response;
  }

  // Si no es una ruta protegida, continuar sin verificar
  if (!isProtectedRoute) return NextResponse.next();

  try {

    if (!jwt) {
      // Limpiar cookies si no hay JWT
      const response = NextResponse.redirect(new URL('/signin', request.url));
      response.cookies.delete('jwt');
      response.cookies.delete('admin-theme');
      return response;
    }
    
    let response;
    try {
      response = await fetch(`${STRAPI_BASE_URL}/api/users/me`, { 
        headers: { 
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        // Agregar timeout y opciones de conexión
        signal: AbortSignal.timeout(10000), // 10 segundos de timeout
      });
    } catch (fetchError) {
      console.error('Error conectando a Strapi:', {
        error: fetchError,
        url: `${STRAPI_BASE_URL}/api/users/me`,
        message: fetchError instanceof Error ? fetchError.message : 'Error desconocido',
      });
      
      // Si es un error de conexión, verificar si Strapi está corriendo
      if (fetchError instanceof Error && (fetchError.message.includes('ECONNREFUSED') || fetchError.message.includes('fetch failed'))) {
        console.error('⚠️  Strapi no está disponible. Asegúrate de que el servidor esté corriendo en', STRAPI_BASE_URL);
        // Limpiar cookies en caso de error de conexión
        const response = NextResponse.redirect(new URL('/signin?error=server_unavailable', request.url));
        response.cookies.delete('jwt');
        response.cookies.delete('admin-theme');
        // Permitir continuar si es una ruta que no requiere autenticación estricta
        // o redirigir a una página de error
        return response;
      }
      throw fetchError;
    }

    if (!response.ok) {
      console.warn('Respuesta no OK de Strapi:', response.status, response.statusText);
      
      // Solo limpiar cookies y redirigir en 401 (no autorizado), no en 403 (forbidden)
      if (response.status === 401) {
        const responseRedirect = NextResponse.redirect(new URL('/signin', request.url));
        responseRedirect.cookies.delete('jwt');
        responseRedirect.cookies.delete('admin-theme');
        return responseRedirect;
      }
      
      // En 403 u otros errores, no limpiar la sesión, solo devolver error
      return NextResponse.json(
        { error: "No tiene permisos para acceder a este recurso" },
        { status: response.status }
      );
    }

    const userResponese = await response.json();
    console.log('userResponese', userResponese);
    if (!userResponese) {
      // Limpiar cookies cuando no hay respuesta de usuario
      const responseRedirect = NextResponse.redirect(new URL('/signin', request.url));
      responseRedirect.cookies.delete('jwt');
      responseRedirect.cookies.delete('admin-theme');
      return responseRedirect;
    }
    
    // if (!userResponese?.data?.isActive) return NextResponse.redirect(new URL('/signin', request.url));

    // ─── Autorización por permisos (matriz rol×módulo) ───
    const moduleKey = moduleForPath(currentPath);
    if (moduleKey) {
      const myPermissions = await fetchMyPermissions(jwt, STRAPI_BASE_URL);
      const role = myPermissions?.role ?? 'lead';
      const allowed = !!myPermissions?.permissions?.[moduleKey]?.canAccess;

      if (!allowed) {
        const landing = landingForRole(role);
        // Evitar bucle de redirección si el destino tampoco está permitido.
        if (currentPath === landing) {
          return NextResponse.next();
        }
        const redirect = NextResponse.redirect(new URL(landing, request.url));
        redirect.cookies.set('access_denied', moduleKey, {
          maxAge: 10,
          path: '/',
          httpOnly: false,
        });
        return redirect;
      }

      // Módulos rotos: mostrar pantalla "en construcción" en vez de la vista que falla.
      if (isUnderConstruction(moduleKey)) {
        return NextResponse.redirect(
          new URL(`/under-construction?module=${moduleKey}`, request.url)
        );
      }
    }

    console.log('all is ok, continue to the requested page');
    return NextResponse.next();

    
  } catch (error) {
    console.error(error);
    // Limpiar cookies en caso de cualquier error
    const responseRedirect = NextResponse.redirect(new URL('/signin', request.url));
    responseRedirect.cookies.delete('jwt');
    responseRedirect.cookies.delete('admin-theme');
    return responseRedirect;
  }

}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    '/dashboard',
    '/dashboard/:path*',
    '/dashboard_user',
    '/dashboard_user/:path*',
    '/api/fleet/:id/reminder',
    '/api/fleet/:id/document',
  ],
};

