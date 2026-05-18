import { type NextRequest, NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "./lib/config";

const ALLOWED_ROLES = ["admin", "super-admin"];

/**
 * Obtiene el rol del usuario desde Strapi usando el JWT.
 * Retorna null si no se puede determinar.
 */
async function getUserRoleFromJwt(jwt: string): Promise<string | null> {
  try {
    // 1. Obtener usuario actual
    const userRes = await fetch(`${STRAPI_BASE_URL}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!userRes.ok) return null;
    const userData = await userRes.json();
    const email = userData?.email;
    if (!email) return null;

    // 2. Buscar user-profile por email usando JWT del usuario
    const profileUrl = `${STRAPI_BASE_URL}/api/user-profiles?filters[email][$eq]=${encodeURIComponent(email)}&fields[0]=role`;
    const profileRes = await fetch(profileUrl, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!profileRes.ok) return null;
    const profileData = await profileRes.json();
    return profileData.data?.[0]?.role || null;
  } catch {
    return null;
  }
}

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

    // ─── Autorización por rol para el módulo Flota ───
    const isFleetRoute = currentPath === '/fleet' || currentPath.startsWith('/fleet/');
    if (isFleetRoute) {
      const userRole = await getUserRoleFromJwt(jwt);
      if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
        const redirect = NextResponse.redirect(new URL('/dashboard-user', request.url));
        redirect.cookies.set('access_denied', 'fleet_admin_required', {
          maxAge: 10,
          path: '/',
          httpOnly: false,
        });
        return redirect;
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
  ],
};

