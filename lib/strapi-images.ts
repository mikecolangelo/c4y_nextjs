import { NEXT_PUBLIC_STRAPI_BASE_URL } from "./config";
import type { StrapiImage } from "@/validations/types";

// Flag para activar/desactivar logs de debug
const DEBUG_IMAGES = process.env.NODE_ENV === 'development' || 
                     (typeof window !== 'undefined' && window.location.search.includes('debug-images'));

// Detectar la URL de Strapi en el cliente
const getClientStrapiURL = (): string => {
  // Si estamos en el servidor, usar la variable de entorno
  if (typeof window === "undefined") {
    return NEXT_PUBLIC_STRAPI_BASE_URL;
  }
  
  // Si la URL configurada no es localhost, usarla
  if (!NEXT_PUBLIC_STRAPI_BASE_URL.includes("localhost") && 
      !NEXT_PUBLIC_STRAPI_BASE_URL.includes("127.0.0.1")) {
    return NEXT_PUBLIC_STRAPI_BASE_URL;
  }
  
  // Si estamos en producción y la URL es localhost, usar el mismo host pero puerto 1337
  // o intentar con la ruta /api como proxy
  if (window.location.hostname !== "localhost" && 
      window.location.hostname !== "127.0.0.1") {
    // Usar el mismo protocolo y host pero puerto 1337
    return `${window.location.protocol}//${window.location.hostname}:1337`;
  }
  
  return NEXT_PUBLIC_STRAPI_BASE_URL;
};

export const strapiImages = {
  getURL(url: string | undefined | null, fallback = "/favicon.ico"): string {
    // Log de debug para troubleshooting
    if (DEBUG_IMAGES) {
      console.log('[strapiImages.getURL] Input:', { 
        url, 
        fallback, 
        NEXT_PUBLIC_STRAPI_BASE_URL,
        clientURL: typeof window !== 'undefined' ? getClientStrapiURL() : 'server-side'
      });
    }

    if (!url) {
      if (DEBUG_IMAGES) console.log('[strapiImages.getURL] No URL provided, returning fallback:', fallback);
      return fallback;
    }

    // URLs blob: o data: son locales del navegador, retornar sin modificar
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      if (DEBUG_IMAGES) console.log('[strapiImages.getURL] Returning local browser URL:', url);
      return url;
    }

    if (url.startsWith("http")) {
      // Si la URL es de localhost pero estamos en producción, reemplazarla
      if (typeof window !== "undefined" && 
          window.location.hostname !== "localhost" && 
          window.location.hostname !== "127.0.0.1") {
        if (url.includes("localhost:1337") || url.includes("127.0.0.1:1337")) {
          const strapiURL = getClientStrapiURL();
          const replacedUrl = url.replace(/https?:\/\/(localhost|127\.0\.0\.1):1337/, strapiURL);
          if (DEBUG_IMAGES) console.log('[strapiImages.getURL] Replaced localhost URL:', replacedUrl);
          return replacedUrl;
        }
      }
      if (DEBUG_IMAGES) console.log('[strapiImages.getURL] Returning absolute URL:', url);
      return url;
    }

    // URL relativa - agregar el base URL
    const finalUrl = `${getClientStrapiURL()}${url}`;
    if (DEBUG_IMAGES) console.log('[strapiImages.getURL] Built relative URL:', finalUrl);
    return finalUrl;
  },

  isObject(obj: any): obj is StrapiImage {
    const isValid = obj && typeof obj === "object" && !Array.isArray(obj) && "url" in obj;
    if (DEBUG_IMAGES && !isValid && obj) {
      console.log('[strapiImages.isObject] Invalid image object:', obj);
    }
    return isValid;
  },

  isArray(arr: any): arr is StrapiImage[] {
    return Array.isArray(arr) && arr.length > 0 && this.isObject(arr[0]);
  },

  process(data: any): any {
    if (!data || typeof data !== "object") return data;
    
    if (Array.isArray(data)) {
      return data.map(item => this.process(item));
    }
    
    return Object.entries(data).reduce((processed, [key, value]) => {
      if (this.isObject(value)) {
        processed[key] = { ...value, url: this.getURL(value.url) };
      } else if (this.isArray(value)) {
        processed[key] = value.map((img) => ({ ...img, url: this.getURL(img.url) }));
      } else {
        processed[key] = this.process(value);
      }
      return processed;
    }, {} as Record<string, any>);
  },

  // Nueva función para validar URLs de imagen
  validateImageUrl(url: string | undefined | null): { valid: boolean; error?: string; finalUrl?: string } {
    if (!url) {
      return { valid: false, error: 'URL is empty or null' };
    }

    try {
      const finalUrl = this.getURL(url);
      
      // Verificar si la URL es válida
      new URL(finalUrl);
      
      return { valid: true, finalUrl };
    } catch (e) {
      return { valid: false, error: `Invalid URL format: ${String(e)}`, finalUrl: url };
    }
  },
};
