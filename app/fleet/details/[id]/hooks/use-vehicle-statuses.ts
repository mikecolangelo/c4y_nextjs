import { useCallback, useState, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { toast } from "@/lib/toast";
import { compressImages } from "@/lib/image-compression";
import type { VehicleState } from "@/validations/types";

interface UseVehicleStatesReturn {
  vehicleStatuses: VehicleState[];
  isLoadingStatuses: boolean;
  isSavingStatus: boolean;
  statusComment: string;
  statusImages: File[];
  statusImagePreviews: string[];
  showStatusForm: boolean;
  setStatusComment: (comment: string) => void;
  loadVehicleStatuses: () => Promise<void>;
  handleStatusImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleRemoveStatusImage: (index: number) => void;
  handleSaveStatus: (currentUserDocumentId: string | null) => Promise<void>;
  handleEditStatus: (statusId: number | string, editComment: string, _imageIds?: number[], newImages?: File[]) => Promise<void>;
  handleDeleteStatus: (statusId: number | string) => Promise<void>;
  handleOpenStatusForm: () => void;
  handleCancelStatusForm: () => void;
  setVehicleStates: React.Dispatch<React.SetStateAction<VehicleState[]>>;
}

const MAX_IMAGES = 10;

export function useVehicleStatuses(vehicleId: string): UseVehicleStatesReturn {
  const [vehicleStates, setVehicleStates] = useState<VehicleState[]>([]);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [statusComment, setStatusComment] = useState("");
  const [statusImages, setStatusImages] = useState<File[]>([]);
  const [statusImagePreviews, setStatusImagePreviews] = useState<string[]>([]);
  const [showStatusForm, setShowStatusForm] = useState(false);
  const statusImagePreviewRefs = useRef<string[]>([]);

  const handleOpenStatusForm = () => setShowStatusForm(true);

  const handleCancelStatusForm = () => {
    setShowStatusForm(false);
    setStatusImages([]);
    setStatusImagePreviews([]);
    statusImagePreviewRefs.current.forEach((url) => URL.revokeObjectURL(url));
    statusImagePreviewRefs.current = [];
    setStatusComment("");
  };

  const loadVehicleStatuses = useCallback(async () => {
    setIsLoadingStatuses(true);
    try {
      const response = await fetch(`/api/fleet/${vehicleId}/vehicle-states`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 404) {
          setVehicleStates([]);
          return;
        }
        throw new Error("Error obteniendo estados");
      }
      const { data } = (await response.json()) as { data: VehicleState[] };
      setVehicleStates(data || []);
    } catch (error) {
      console.error("Error cargando estados:", error);
      setVehicleStates([]);
    } finally {
      setIsLoadingStatuses(false);
    }
  }, [vehicleId]);

  const handleStatusImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const currentTotal = statusImages.length;
    if (currentTotal + files.length > MAX_IMAGES) {
      toast.error(`Máximo ${MAX_IMAGES} imágenes por estado`, {
        description: `Ya tienes ${currentTotal} seleccionadas. Puedes agregar ${MAX_IMAGES - currentTotal} más.`,
      });
      return;
    }

    try {
      const compressed = await compressImages(files);
      const newPreviews: string[] = [];
      compressed.forEach((file) => {
        const objectUrl = URL.createObjectURL(file);
        newPreviews.push(objectUrl);
        statusImagePreviewRefs.current.push(objectUrl);
      });

      setStatusImages((prev) => [...prev, ...compressed]);
      setStatusImagePreviews((prev) => [...prev, ...newPreviews]);
    } catch (error) {
      console.error("Error procesando imágenes:", error);
      toast.error("Error al procesar las imágenes seleccionadas");
    }
  };

  const handleRemoveStatusImage = (index: number) => {
    if (statusImagePreviewRefs.current[index]) {
      URL.revokeObjectURL(statusImagePreviewRefs.current[index]);
    }

    const newImages = statusImages.filter((_, i) => i !== index);
    const newPreviews = statusImagePreviews.filter((_, i) => i !== index);
    const newRefs = statusImagePreviewRefs.current.filter((_, i) => i !== index);

    setStatusImages(newImages);
    setStatusImagePreviews(newPreviews);
    statusImagePreviewRefs.current = newRefs;
  };

  const uploadImages = async (files: File[]): Promise<number[]> => {
    const uploadedIds: number[] = [];
    for (const file of files) {
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      if (!validTypes.includes(file.type)) {
        throw new Error(`Tipo de archivo no válido. Solo imágenes: ${validTypes.join(", ")}`);
      }
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error("La imagen es demasiado grande. Máximo 10MB.");
      }

      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/strapi/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo subir una imagen");
      }
      const payload = (await res.json()) as { data?: { id?: number } };
      const imageId = payload?.data?.id;
      if (!imageId) throw new Error("No se pudo obtener el ID de una imagen subida");
      uploadedIds.push(imageId);
    }
    return uploadedIds;
  };

  const handleSaveStatus = async (currentUserDocumentId: string | null) => {
    if (statusImages.length === 0 && !statusComment.trim()) {
      toast.error("Debes proporcionar al menos una imagen o un comentario");
      return;
    }

    setIsSavingStatus(true);
    try {
      let imageIds: number[] = [];
      if (statusImages.length > 0) {
        imageIds = await uploadImages(statusImages);
      }

      const requestBody: { data: { comment?: string; images?: number[]; authorDocumentId?: string } } = {
        data: {},
      };
      if (statusComment.trim()) requestBody.data.comment = statusComment.trim();
      if (imageIds.length > 0) requestBody.data.images = imageIds;
      if (currentUserDocumentId) requestBody.data.authorDocumentId = currentUserDocumentId;

      const response = await fetch(`/api/fleet/${vehicleId}/vehicle-states`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${response.status}`);
      }

      const { data: created } = (await response.json()) as { data: VehicleState };
      setVehicleStates((prev) => [created, ...prev]);

      // Limpiar formulario
      setStatusComment("");
      setStatusImages([]);
      setStatusImagePreviews([]);
      setShowStatusForm(false);
      statusImagePreviewRefs.current.forEach((url) => URL.revokeObjectURL(url));
      statusImagePreviewRefs.current = [];

      toast.success("Estado guardado con éxito");
    } catch (error) {
      console.error("Error guardando estado:", error);
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al guardar estado", { description: msg });
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleEditStatus = async (
    statusId: number | string,
    editComment: string,
    _imageIds?: number[],
    newImages?: File[]
  ) => {
    try {
      const status = vehicleStates.find((s) => s.id === statusId || s.documentId === statusId);
      const existingImagesCount = status?.images?.length || 0;
      let uploadedIds: number[] = [];
      if (newImages && newImages.length > 0) {
        if (existingImagesCount + newImages.length > MAX_IMAGES) {
          throw new Error(`No se permiten más de ${MAX_IMAGES} imágenes por estado`);
        }
        uploadedIds = await uploadImages(newImages);
      }

      const payload: { data: { comment?: string; images?: number[] } } = { data: {} };
      if (editComment.trim()) payload.data.comment = editComment.trim();
      if (uploadedIds.length > 0) payload.data.images = uploadedIds;

      const response = await fetch(`/api/vehicle-state/${encodeURIComponent(String(statusId))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${response.status}`);
      }

      const { data } = (await response.json()) as { data: VehicleState };
      setVehicleStates((prev) => prev.map((s) => (s.id === data.id || s.documentId === data.documentId ? data : s)));
      toast.success("Estado actualizado");
    } catch (error) {
      console.error("Error editando estado:", error);
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al actualizar estado", { description: msg });
      throw error;
    }
  };

  const handleDeleteStatus = async (statusId: number | string) => {
    try {
      const response = await fetch(`/api/vehicle-state/${encodeURIComponent(String(statusId))}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${response.status}`);
      }

      setVehicleStates((prev) => prev.filter((s) => s.id !== statusId && s.documentId !== statusId));
      toast.success("Estado eliminado");
    } catch (error) {
      console.error("Error eliminando estado:", error);
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al eliminar estado", { description: msg });
      throw error;
    }
  };

  useEffect(() => {
    loadVehicleStatuses();
  }, [loadVehicleStatuses]);

  useEffect(() => {
    return () => {
      statusImagePreviewRefs.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  return {
    vehicleStatuses: vehicleStates,
    isLoadingStatuses,
    isSavingStatus,
    statusComment,
    statusImages,
    statusImagePreviews,
    showStatusForm,
    setStatusComment,
    loadVehicleStatuses,
    handleStatusImageChange,
    handleRemoveStatusImage,
    handleSaveStatus,
    handleEditStatus,
    handleDeleteStatus,
    handleOpenStatusForm,
    handleCancelStatusForm,
    setVehicleStates,
  };
}
