"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Car, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { strapiImages } from "@/lib/strapi-images";

interface VehicleImageProps {
  src?: string | null;
  alt?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  containerClassName?: string;
  fallbackClassName?: string;
  sizes?: string;
  priority?: boolean;
  onError?: () => void;
  onLoad?: () => void;
}

/**
 * Componente de imagen de vehículo con manejo de errores y fallback visual.
 * 
 * Características:
 * - Muestra un placeholder mientras carga
 * - Si la imagen falla, muestra un icono de coche
 * - Logs de debug en desarrollo
 * - Validación de URL antes de cargar
 */
export function VehicleImage({
  src,
  alt = "Vehículo",
  fill = false,
  width,
  height,
  className,
  containerClassName,
  fallbackClassName,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  priority = false,
  onError,
  onLoad,
}: VehicleImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Validar y construir la URL de la imagen
  const imageUrl = src ? strapiImages.getURL(src) : null;
  
  // Verificar si es una URL blob (preview local)
  const isBlobImage = imageUrl?.startsWith("blob:") ?? false;

  const handleError = useCallback(() => {
    console.warn(`[VehicleImage] Failed to load image: ${imageUrl}`);
    setError(true);
    setLoading(false);
    onError?.();
  }, [imageUrl, onError]);

  const handleLoad = useCallback(() => {
    setLoading(false);
    onLoad?.();
  }, [onLoad]);

  // Si no hay URL o hubo error, mostrar fallback
  if (!imageUrl || error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted",
          fill && "absolute inset-0",
          fallbackClassName
        )}
        style={!fill ? { width, height } : undefined}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Car className="h-12 w-12" />
          {error && (
            <span className="text-xs flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Error al cargar
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", fill && "w-full h-full", containerClassName)}>
      {/* Placeholder de carga */}
      {loading && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-muted/50 animate-pulse",
            fallbackClassName
          )}
        >
          <Car className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}
      
      {/* Imagen */}
      <Image
        src={imageUrl}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        className={cn(
          "object-cover transition-opacity duration-300",
          loading ? "opacity-0" : "opacity-100",
          className
        )}
        sizes={sizes}
        priority={priority}
        unoptimized={isBlobImage}
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  );
}

/**
 * Hook para manejar el estado de carga de imágenes de vehículos
 */
export function useVehicleImage(src?: string | null) {
  const [state, setState] = useState<{
    loading: boolean;
    error: boolean;
    url: string | null;
  }>({
    loading: true,
    error: false,
    url: src ? strapiImages.getURL(src) : null,
  });

  const handleError = useCallback(() => {
    setState((prev) => ({ ...prev, error: true, loading: false }));
  }, []);

  const handleLoad = useCallback(() => {
    setState((prev) => ({ ...prev, loading: false }));
  }, []);

  const reset = useCallback((newSrc?: string | null) => {
    setState({
      loading: true,
      error: false,
      url: newSrc ? strapiImages.getURL(newSrc) : null,
    });
  }, []);

  return {
    ...state,
    handleError,
    handleLoad,
    reset,
    isBlob: state.url?.startsWith("blob:") ?? false,
  };
}
