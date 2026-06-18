// Server-side Strapi configuration
// These variables are only used server-side and never exposed to the client

// Read from environment variables with fallbacks for development
export const STRAPI_BASE_URL = process.env.STRAPI_BASE_URL || "http://localhost:1337";
// El token real vive en .env.local (no versionado). Sin fallback hardcodeado.
export const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

// Database configuration (server-side only)
export const DATABASE_HOST = process.env.DATABASE_HOST || "127.0.0.1";
export const DATABASE_PORT = parseInt(process.env.DATABASE_PORT || "5432", 10);
export const DATABASE_NAME = process.env.DATABASE_NAME || "strapi_db";
export const DATABASE_USERNAME = process.env.DATABASE_USERNAME || "strapi_user";
export const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || "";

// Public Strapi URL for client-side image rendering
// NEXT_PUBLIC_* variables are exposed to the browser
export const NEXT_PUBLIC_STRAPI_BASE_URL = process.env.NEXT_PUBLIC_STRAPI_BASE_URL || STRAPI_BASE_URL || "http://localhost:1337";

// Derived URL components
export const STRAPI_BASE_URL_PROTOCOL = STRAPI_BASE_URL.split("://")[0];
export const STRAPI_BASE_URL_HOSTNAME = STRAPI_BASE_URL.split("://")[1]?.split(":")[0] || "";
export const STRAPI_BASE_URL_PORT = STRAPI_BASE_URL.split("://")[1]?.split(":")[1] || (STRAPI_BASE_URL_PROTOCOL === "https" ? "443" : "80");

// Validation - only throw in production to prevent misconfiguration
// Solo ejecutar en el servidor (typeof window === 'undefined')
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  if (!STRAPI_BASE_URL || STRAPI_BASE_URL === "http://localhost:1337") {
    console.warn("WARNING: STRAPI_BASE_URL is not set or using localhost default in production");
  }
  if (!STRAPI_API_TOKEN) {
    console.warn("WARNING: STRAPI_API_TOKEN is not set in production");
  }
}

// if the STRAPI_BASE_URL_PROTOCOL is not set, throw an error and log the error in the console
if (!STRAPI_BASE_URL_PROTOCOL) {
  throw new Error("STRAPI_BASE_URL_PROTOCOL is not set. Please set STRAPI_BASE_URL in your .env file");
}

// if the STRAPI_BASE_URL_HOSTNAME is not set, throw an error and log the error in the console
if (!STRAPI_BASE_URL_HOSTNAME) {
  throw new Error("STRAPI_BASE_URL_HOSTNAME is not set. Please set STRAPI_BASE_URL in your .env file");
}

// if the STRAPI_BASE_URL_PORT is not set, throw an error and log the error in the console
if (!STRAPI_BASE_URL_PORT) {
  throw new Error("STRAPI_BASE_URL_PORT is not set. Please set STRAPI_BASE_URL in your .env file");
}
