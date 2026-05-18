"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ChangeEvent } from "react";
import { toast } from "@/lib/toast";

export interface UseVehicleImageReturn {
  // Estados
  imagePreview: string | null;
  selectedImageFile: File | null;
  shouldRemoveImage: boolean;
  isUploading: boolean;
  uploadProgress: number;
  
  // Métodos
  handleImageInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
  handleRestoreOriginalImage: (originalImageUrl: string | null) => void;
  uploadImage: () => Promise<number | null>;
  resetImageState: (newImageUrl?: string | null) => void;
  clearSelection: () => void;
}

// Tipos de imagen permitidos
const VALID_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Tamaño máximo: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function useVehicleImage(initialImageUrl?: string | null): UseVehicleImageReturn {
  const [imagePreview, setImagePreview] = useState<string | null>(initialImageUrl ?? null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [shouldRemoveImage, setShouldRemoveImage] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Ref para limpiar objectURLs
  const objectUrlRef = useRef<string | null>(null);

  // Limpiar objectURL al desmontar
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  /**
   * Crear preview de imagen desde File
   */
  const createImagePreview = useCallback((file: File): string => {
    // Limpiar URL anterior si existe
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    return objectUrl;
  }, []);

  /**
   * Validar archivo de imagen
   */
  const validateImageFile = useCallback((file: File): string | null => {
    // Validar tipo
    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      return `Tipo de archivo no válido: ${file.type}. Solo se permiten: JPG, PNG, GIF, WebP.`;
    }
    
    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return `Archivo demasiado grande: ${(file.size / 1024 / 1024).toFixed(2)}MB. Máximo: 10MB.`;
    }
    
    return null;
  }, []);

  /**
   * Manejar selección de imagen desde input file
   */
  const handleImageInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      console.log("[useVehicleImage] No se seleccionó ningún archivo");
      return;
    }

    console.log("[useVehicleImage] Archivo seleccionado:", {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(2)}KB`,
    });

    // Validar
    const error = validateImageFile(file);
    if (error) {
      toast.error("Error de validación", { description: error });
      event.target.value = ""; // Limpiar input
      return;
    }

    // Crear preview y guardar archivo
    const preview = createImagePreview(file);
    setImagePreview(preview);
    setSelectedImageFile(file);
    setShouldRemoveImage(false);
    
    toast.success("Imagen seleccionada", {
      description: `${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
    });

    // Limpiar input para permitir seleccionar el mismo archivo de nuevo
    event.target.value = "";
  }, [validateImageFile, createImagePreview]);

  /**
   * Marcar imagen para eliminar
   */
  const handleRemoveImage = useCallback(() => {
    console.log("[useVehicleImage] Marcando imagen para eliminar");
    
    // Limpiar preview si es objectURL
    if (objectUrlRef.current && imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    
    setImagePreview(null);
    setSelectedImageFile(null);
    setShouldRemoveImage(true);
  }, [imagePreview]);

  /**
   * Restaurar imagen original
   */
  const handleRestoreOriginalImage = useCallback((originalImageUrl: string | null) => {
    console.log("[useVehicleImage] Restaurando imagen original:", originalImageUrl);
    
    // Limpiar objectURL si existe
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    
    setImagePreview(originalImageUrl);
    setSelectedImageFile(null);
    setShouldRemoveImage(false);
  }, []);

  /**
   * Subir imagen a Strapi
   * Retorna el ID de la imagen subida o null
   */
  const uploadImage = useCallback(async (): Promise<number | null> => {
    // Si no hay archivo seleccionado, retornar null
    if (!selectedImageFile) {
      console.log("[useVehicleImage] No hay archivo para subir");
      return null;
    }

    // Si ya se subió anteriormente (por ejemplo, en reintento), usar ese ID
    if (typeof selectedImageFile === "object" && "uploadedId" in selectedImageFile) {
      return (selectedImageFile as any).uploadedId;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("files", selectedImageFile);
      
      console.log("[useVehicleImage] Iniciando subida...", {
        fileName: selectedImageFile.name,
        fileSize: selectedImageFile.size,
        fileType: selectedImageFile.type,
      });

      const response = await fetch("/api/strapi/upload", {
        method: "POST",
        body: formData,
      });

      console.log("[useVehicleImage] Respuesta del servidor:", {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        let errorMessage = `Error ${response.status}: No se pudo subir la imagen`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData?.error || errorMessage;
          console.error("[useVehicleImage] Error del servidor:", errorData);
        } catch {
          // Usar mensaje por defecto
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("[useVehicleImage] Subida exitosa:", result);

      if (!result.data?.id) {
        throw new Error("El servidor no devolvió el ID de la imagen");
      }

      // Guardar el ID en el archivo para futuros reintentos
      (selectedImageFile as any).uploadedId = result.data.id;

      toast.success("Imagen subida correctamente");
      return result.data.id;

    } catch (error) {
      console.error("[useVehicleImage] Error subiendo imagen:", error);
      
      const message = error instanceof Error ? error.message : "Error desconocido al subir imagen";
      toast.error("Error al subir imagen", { description: message });
      
      throw error;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedImageFile]);

  /**
   * Resetear estado de imagen
   */
  const resetImageState = useCallback((newImageUrl?: string | null) => {
    console.log("[useVehicleImage] Resetear estado:", newImageUrl);
    
    // Limpiar objectURL si existe
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    
    setImagePreview(newImageUrl ?? null);
    setSelectedImageFile(null);
    setShouldRemoveImage(false);
    setIsUploading(false);
    setUploadProgress(0);
  }, []);

  /**
   * Limpiar selección actual sin afectar la imagen guardada
   */
  const clearSelection = useCallback(() => {
    if (objectUrlRef.current && imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    
    setSelectedImageFile(null);
    setShouldRemoveImage(false);
  }, [imagePreview]);

  return {
    // Estados
    imagePreview,
    selectedImageFile,
    shouldRemoveImage,
    isUploading,
    uploadProgress,
    
    // Métodos
    handleImageInputChange,
    handleRemoveImage,
    handleRestoreOriginalImage,
    uploadImage,
    resetImageState,
    clearSelection,
  };
}
