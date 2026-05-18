import qs from "qs";
import { QUERY_DASHBOARD, QUERY_SINGIN, QUERY_SINGUP } from "./strapi-queries";
import { STRAPI_BASE_URL, STRAPI_API_TOKEN } from "./config";
import { strapiImages } from "./strapi-images";
import type { StrapiPageMetadata, StrapiResponse, SinginData, SinginFormData, SinginDataProcessed, SingupData, SingupFormData, SingupDataProcessed, DashboardData, DashboardDataProcessed, HeroSectionData } from "@/validations/types";

export async function getStrapiData(path: string): Promise<StrapiResponse | null> {
  // "use cache";
  try {
    const headers: Record<string, string> = {};
    if (STRAPI_API_TOKEN) {
      headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
    }
    
    const response = await fetch(`${STRAPI_BASE_URL}/api/${path}`, {
      headers,
      next: { revalidate: 0 }, // Sin cache para desarrollo (cambiar a 3600 en producción)
    });
    if (!response.ok) {
      // No lanzar error, solo loguear y retornar null
      console.warn(`Strapi API error for ${path}: HTTP ${response.status}`);
      return null;
    }
    const data = await response.json();
    
    return strapiImages.process(data) as StrapiResponse;
  } catch (error) {
    console.error(`Error fetching data from Strapi (${path}):`, error);
    return null;
  }
}

export async function getMetadata(strapiData: Readonly<StrapiPageMetadata> | null) {
  if (!strapiData) return null;
  const { title, description, favicon } = strapiData;
  return {
    title: title || "Default",
    description: description || "Default description",
    icons: {
      icon: favicon?.url || "/favicon.ico",
    },
  };
}

export async function getStrapiPage<T = any>(contentType: string, query?: Record<string, any>): Promise<T | null> {
  const queryString = query ? qs.stringify({ populate: query }) : "";
  const path = queryString ? `${contentType}?${queryString}` : contentType;
  const response = await getStrapiData(path);
  
  return response?.data ? (response.data as T) : null;
} 

export async function registerUserService (userData: object) {
  const url = `${STRAPI_BASE_URL}/api/auth/local/register`

  try {
    // Crear un AbortController para timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Error desconocido del servidor' } }))
      return errorData
    }

    const data = await response.json()
    
    // Si el registro fue exitoso, actualizar el usuario para establecer confirmed: false
    if (data.user && data.user.id && !data.error) {
      await updateUserConfirmedStatus(data.user.id, false)
    }
    
    return data
  } catch (error) {
    // Manejar diferentes tipos de errores
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('aborted')) {
        console.error('Error registering user: Timeout al conectar con Strapi')
        return { error: { message: 'El servidor tardó demasiado en responder. Verifica que Strapi esté corriendo.' } }
      }
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        console.error('Error registering user: No se pudo conectar con Strapi en', STRAPI_BASE_URL)
        return { error: { message: `No se pudo conectar con el servidor. Verifica que Strapi esté corriendo en ${STRAPI_BASE_URL}` } }
      }
    }
    console.error('Error registering user:', error)
    return { error: { message: 'Error al intentar registrarse. Intenta nuevamente.' } }
  }
}

export async function loginUserService(userData: { identifier: string; password: string }) {
  const url = `${STRAPI_BASE_URL}/api/auth/local`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Error desconocido del servidor' } }))
      return errorData
    }

    const data = await response.json()
    return data
  } catch (error) {
    // Manejar diferentes tipos de errores
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('aborted')) {
        console.error('Error logging in user: Timeout al conectar con Strapi')
        return { error: { message: 'El servidor tardó demasiado en responder. Verifica que Strapi esté corriendo.' } }
      }
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        console.error('Error logging in user: No se pudo conectar con Strapi en', STRAPI_BASE_URL)
        return { error: { message: `No se pudo conectar con el servidor. Verifica que Strapi esté corriendo en ${STRAPI_BASE_URL}` } }
      }
    }
    console.error('Error logging in user:', error)
    return { error: { message: 'Error al intentar iniciar sesión. Intenta nuevamente.' } }
  }
}

/**
 * Actualiza el estado de confirmed de un usuario usando el token de API de Strapi
 * Esta función solo se ejecuta en el servidor y nunca expone el token al cliente
 */
async function updateUserConfirmedStatus(userId: number, confirmed: boolean) {
  if (!STRAPI_API_TOKEN) {
    console.error('STRAPI_API_TOKEN is not set, cannot update user confirmed status')
    return
  }

  try {
    const url = `${STRAPI_BASE_URL}/api/users/${userId}`
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`
      },
      body: JSON.stringify({
        confirmed
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Error updating user confirmed status:', errorData)
      return
    }

    const updatedUser = await response.json()
    console.log('User confirmed status updated successfully:', updatedUser)
  } catch (error) {
    console.error('Error updating user confirmed status:', error)
  }
}

/**
 * Crea un user-profile para un usuario recién registrado con rol "driver"
 * Esta función solo se ejecuta en el servidor y nunca expone el token al cliente
 */
export async function createUserProfile(userId: number, displayName: string, email: string) {
  if (!STRAPI_API_TOKEN) {
    console.error('STRAPI_API_TOKEN is not set, cannot create user profile')
    return null
  }

  try {
    const url = `${STRAPI_BASE_URL}/api/user-profiles`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`
      },
      body: JSON.stringify({
        data: {
          displayName,
          role: 'driver',
          email
        }
      }),
      cache: 'no-store'
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }))
      console.error('Error creating user profile:', errorData)
      return null
    }

    const userProfile = await response.json()
    console.log('User profile created successfully with role "driver":', userProfile)
    return userProfile
  } catch (error) {
    console.error('Error creating user profile:', error)
    return null
  }
}

export async function getDashboard(): Promise<DashboardDataProcessed | null> {
  const data = await getStrapiPage<DashboardData>("dashboard", QUERY_DASHBOARD.populate);
  if (!data) return null;
  
  // Procesar las secciones de la dynamic zone
  const sections = data.sections
    ?.filter((section) => section.__component === "layout.hero-section")
    .map((section) => {
      const { __component, ...sectionData } = section;
      return sectionData as HeroSectionData;
    }) || [];
  
  return {
    title: data.title,
    description: data.description,
    favicon: data.favicon,
    sections,
  };
}

export async function getSingin(): Promise<SinginDataProcessed | null> {
  const data = await getStrapiPage<SinginData>("singin", QUERY_SINGIN.populate);
  if (!data) {
    console.warn("⚠️ No se encontraron datos de singin desde Strapi");
    return null;
  }
  
  // Encontrar el componente singin-form en la dynamic zone
  const singinForm = data.sections?.find(
    (section) => section.__component === "layout.singin-form"
  ) as SinginFormData | undefined;
  
  if (!singinForm) {
    console.warn("⚠️ No se encontró el componente singin-form en las secciones");
    console.log("Secciones disponibles:", data.sections?.map(s => s.__component));
    return null;
  }
  
  // Debug: ver qué datos están llegando
  console.log("SinginForm data:", JSON.stringify(singinForm, null, 2));
  
  return {
    title: data.title,
    description: data.description,
    header: data.header,
    singinForm,
  };
}

export async function getSingup(): Promise<SingupDataProcessed | null> {
  const data = await getStrapiPage<SingupData>("signup", QUERY_SINGUP.populate);
  if (!data) return null;
  
  // Encontrar el componente singup-form en la dynamic zone
  const singupForm = data.sections?.find(
    (section) => section.__component === "layout.singup-form"
  ) as SingupFormData | undefined;
  
  if (!singupForm) return null;
  
  // Debug: ver qué datos están llegando
  console.log("SingupForm data:", JSON.stringify(singupForm, null, 2));
  
  // header es repeatable, tomar el primer elemento
  const header = Array.isArray(data.header) ? data.header[0] : data.header;
  
  return {
    title: data.Title || "",
    description: data.Description || "",
    header: header || { title: "", description: "" },
    singupForm,
  };
}