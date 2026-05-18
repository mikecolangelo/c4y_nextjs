import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";

/**
 * Endpoint para subir archivos a Strapi
 * POST /api/strapi/upload
 * 
 * Recibe:
 * - files: File (multipart/form-data)
 * - ref?: string (opcional, referencia al content-type)
 * - refId?: string (opcional, ID del documento)
 * - field?: string (opcional, nombre del campo)
 * 
 * Retorna:
 * - { data: { id: number, url: string, ... } }
 * - { error: string } en caso de error
 */
export async function POST(request: Request) {
  try {
    // 0. Obtener token de sesión del usuario desde cookies
    const cookieStore = await cookies();
    const jwt = cookieStore.get("jwt")?.value;
    
    // Usar JWT del usuario si está disponible, sino fallback al API Token
    const token = jwt || STRAPI_API_TOKEN;
    
    console.log("[Upload] Token usado:", jwt ? "JWT (usuario autenticado)" : "API Token (fallback)");

    // 1. Obtener FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      console.error("[Upload] Error parseando FormData:", error);
      return NextResponse.json(
        { error: "Formato de solicitud inválido. Se requiere multipart/form-data." },
        { status: 400 }
      );
    }

    // 2. Validar que hay archivos
    const files = formData.getAll("files");
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No se encontró ningún archivo. Envía los archivos en el campo 'files'." },
        { status: 400 }
      );
    }

    // 3. Validar tipos de archivo permitidos (imágenes y documentos)
    const validImageTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];

    const validDocumentTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
    ];

    const validTypes = [...validImageTypes, ...validDocumentTypes];
    const maxSize = 10 * 1024 * 1024; // 10MB

    for (const file of files) {
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Uno de los archivos no es válido." },
          { status: 400 }
        );
      }

      // Algunos navegadores reportan MIME type vacío - detectar por extensión
      let fileType = file.type;
      if (!fileType && file.name) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const extToMime: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'ppt': 'application/vnd.ms-powerpoint',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'txt': 'text/plain',
          'csv': 'text/csv',
        };
        if (ext && extToMime[ext]) {
          fileType = extToMime[ext];
        }
      }

      console.log("[Upload] Validando archivo:", file.name, "tipo:", fileType || file.type || "desconocido");

      // Validar tipo (permitir imágenes y documentos)
      if (!validTypes.includes(fileType)) {
        return NextResponse.json(
          { 
            error: `Tipo de archivo no permitido: ${file.type || file.name.split('.').pop() || "desconocido"}. Se permiten imágenes (JPG, PNG, GIF, WebP) y documentos (PDF, Word, Excel).` 
          },
          { status: 400 }
        );
      }

      // Validar tamaño
      if (file.size > maxSize) {
        return NextResponse.json(
          { 
            error: `Archivo demasiado grande: ${(file.size / 1024 / 1024).toFixed(2)}MB. Máximo permitido: 10MB.` 
          },
          { status: 400 }
        );
      }
    }

    // 4. Preparar FormData para Strapi
    const strapiFormData = new FormData();
    
    for (const file of files) {
      if (file instanceof File) {
        // Acortar nombre si es muy largo
        let fileName = file.name;
        if (fileName.length > 200) {
          const ext = fileName.split(".").pop() || "";
          fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
        }
        
        strapiFormData.append("files", new File([file], fileName, { 
          type: file.type,
          lastModified: file.lastModified,
        }));
      }
    }

    // 5. Agregar metadatos opcionales si se proporcionan
    const ref = formData.get("ref")?.toString();
    const refId = formData.get("refId")?.toString();
    const field = formData.get("field")?.toString();
    
    if (ref) strapiFormData.append("ref", ref);
    if (refId) strapiFormData.append("refId", refId);
    if (field) strapiFormData.append("field", field);

    console.log("[Upload] Subiendo a Strapi:", {
      url: `${STRAPI_BASE_URL}/api/upload`,
      files: files.map((f) => f instanceof File ? { name: f.name, type: f.type, size: f.size } : null),
      ref,
      refId,
      field,
    });

    // 6. Enviar a Strapi con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos para upload
    
    let response;
    try {
      response = await fetch(`${STRAPI_BASE_URL}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: strapiFormData,
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error("[Upload] Timeout: La subida tardó más de 30 segundos");
        return NextResponse.json(
          { error: "La subida del archivo tardó demasiado. Intenta con un archivo más pequeño o verifica la conexión con el servidor." },
          { status: 504 }
        );
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    // 7. Manejar errores de Strapi
    if (!response.ok) {
      let errorMessage = `Error ${response.status}: No se pudo subir el archivo`;
      let errorDetails = null;

      try {
        const errorText = await response.text();
        console.error("[Upload] Error de Strapi:", errorText);
        
        try {
          errorDetails = JSON.parse(errorText);
          if (errorDetails?.error?.message) {
            errorMessage = errorDetails.error.message;
          } else if (typeof errorDetails?.error === "string") {
            errorMessage = errorDetails.error;
          }
        } catch {
          errorMessage = errorText || errorMessage;
        }
      } catch (e) {
        console.error("[Upload] Error leyendo respuesta:", e);
      }

      return NextResponse.json(
        { error: errorMessage, details: errorDetails },
        { status: response.status }
      );
    }

    // 8. Procesar respuesta exitosa
    const uploadResult = await response.json();
    console.log("[Upload] Éxito:", uploadResult);

    // Strapi devuelve un array de archivos subidos
    if (!Array.isArray(uploadResult) || uploadResult.length === 0) {
      return NextResponse.json(
        { error: "Strapi no devolvió información del archivo subido." },
        { status: 500 }
      );
    }

    const uploadedFile = uploadResult[0];
    
    if (!uploadedFile.id) {
      return NextResponse.json(
        { error: "Strapi no devolvió el ID del archivo." },
        { status: 500 }
      );
    }

    // 9. Retornar datos del archivo subido
    return NextResponse.json({
      data: {
        id: uploadedFile.id,
        url: uploadedFile.url,
        name: uploadedFile.name,
        mime: uploadedFile.mime,
        size: uploadedFile.size,
        formats: uploadedFile.formats,
        alternativeText: uploadedFile.alternativeText,
        caption: uploadedFile.caption,
      },
    });

  } catch (error) {
    console.error("[Upload] Error interno:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar la subida." },
      { status: 500 }
    );
  }
}
