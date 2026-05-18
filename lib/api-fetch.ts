/**
 * Wrapper para fetch que incluye credentials: 'include' por defecto
 * para asegurar que las cookies (JWT) se envíen con cada petición.
 */

export interface ApiFetchOptions extends RequestInit {
  // Opciones adicionales específicas de la API si son necesarias
}

export async function apiFetch(url: string, options: ApiFetchOptions = {}) {
  const defaultOptions: RequestInit = {
    credentials: 'include', // Importante: envía cookies HttpOnly
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Merge de opciones
  const mergedOptions: RequestInit = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  const response = await fetch(url, mergedOptions);
  
  // Si es 401, redirigir a login (sesión inválida/expirada)
  if (response.status === 401) {
    window.location.href = '/signin';
    return Promise.reject(new Error('Unauthorized'));
  }
  
  // Si es 403, no redirigir, solo rechazar con el error (sin permisos, pero sesión válida)
  if (response.status === 403) {
    return Promise.reject(new Error('Forbidden'));
  }
  
  return response;
}
