import { useCallback, useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import { toast } from "@/lib/toast";
import { optimizeUpload } from "@/lib/image-compression";
import type { FleetDocument, FleetDocumentType } from "@/validations/types";

interface UseVehicleDocumentsReturn {
  vehicleDocuments: FleetDocument[];
  isLoadingDocuments: boolean;
  isSavingDocument: boolean;
  documentType: FleetDocumentType;
  documentOtherDescription: string;
  documentFiles: File[];
  showDocumentForm: boolean;
  setDocumentType: (type: FleetDocumentType) => void;
  setDocumentOtherDescription: (description: string) => void;
  loadVehicleDocuments: () => Promise<void>;
  handleDocumentFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleRemoveDocumentFile: (index: number) => void;
  handleSaveDocument: (currentUserDocumentId: string | null) => Promise<void>;
  handleDeleteDocument: (documentId: number | string) => Promise<void>;
  handleOpenDocumentForm: () => void;
  handleCancelDocumentForm: () => void;
  setVehicleDocuments: React.Dispatch<React.SetStateAction<FleetDocument[]>>;
}

export function useVehicleDocuments(vehicleId: string): UseVehicleDocumentsReturn {
  const [vehicleDocuments, setVehicleDocuments] = useState<FleetDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [documentType, setDocumentType] = useState<FleetDocumentType>("poliza_seguro");
  const [documentOtherDescription, setDocumentOtherDescription] = useState("");
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [showDocumentForm, setShowDocumentForm] = useState(false);

  const handleOpenDocumentForm = () => setShowDocumentForm(true);

  const handleCancelDocumentForm = () => {
    setShowDocumentForm(false);
    setDocumentFiles([]);
    setDocumentType("poliza_seguro");
    setDocumentOtherDescription("");
  };

  const loadVehicleDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);
    try {
      const response = await fetch(`/api/fleet/${vehicleId}/documents`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No pudimos obtener los documentos");
      }
      const { data } = (await response.json()) as { data: FleetDocument[] };
      setVehicleDocuments(data || []);
    } catch (error) {
      console.error("Error cargando documentos:", error);
      toast.error("Error al cargar documentos", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [vehicleId]);

  const handleDocumentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    const invalidFiles = files.filter((file) => file.size > MAX_SIZE);

    if (invalidFiles.length > 0) {
      toast.error("Archivos demasiado grandes", {
        description: `Algunos archivos exceden el tamaño máximo de 5MB. Archivos rechazados: ${invalidFiles.map((f) => f.name).join(", ")}`,
      });
      const validFiles = files.filter((file) => file.size <= MAX_SIZE);
      setDocumentFiles((prev) => [...prev, ...validFiles]);
    } else {
      setDocumentFiles((prev) => [...prev, ...files]);
    }

    event.target.value = "";
  };

  const handleRemoveDocumentFile = (index: number) => {
    setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDocument = async (currentUserDocumentId: string | null) => {
    if (documentFiles.length === 0) {
      toast.error("Error", {
        description: "Debes seleccionar al menos un archivo",
      });
      return;
    }

    if (documentType === "otros" && !documentOtherDescription.trim()) {
      toast.error("Error", {
        description: "Debes describir el tipo de documento cuando seleccionas 'Otros'",
      });
      return;
    }

    setIsSavingDocument(true);
    try {
      const uploadedFileIds: number[] = [];
      for (const file of documentFiles) {
        const uploadForm = new FormData();
        uploadForm.append("files", await optimizeUpload(file));
        const uploadResponse = await fetch("/api/strapi/upload", {
          method: "POST",
          body: uploadForm,
        });
        if (!uploadResponse.ok) {
          throw new Error("Error al subir los archivos");
        }
        const uploadPayload = (await uploadResponse.json()) as { data?: { id?: number } };
        const fileId = uploadPayload?.data?.id;
        if (fileId) {
          uploadedFileIds.push(fileId);
        }
      }

      const requestBody: {
        data: {
          documentType: FleetDocumentType;
          files: number[];
          authorDocumentId?: string;
          otherDescription?: string;
        };
      } = {
        data: {
          documentType: documentType,
          files: uploadedFileIds,
        },
      };

      if (documentType === "otros" && documentOtherDescription.trim()) {
        requestBody.data.otherDescription = documentOtherDescription.trim();
      }

      if (currentUserDocumentId) {
        requestBody.data.authorDocumentId = currentUserDocumentId;
      }

      const response = await fetch(`/api/fleet/${vehicleId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorData;
        try {
          const errorText = await response.text();
          errorData = errorText ? JSON.parse(errorText) : { error: "Error desconocido" };
        } catch {
          errorData = { error: `Error ${response.status}: ${response.statusText}` };
        }

        if (response.status === 405) {
          throw new Error(
            "El método POST no está permitido en esta ruta. Por favor, reinicia el servidor de desarrollo."
          );
        }

        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      await loadVehicleDocuments();

      setDocumentFiles([]);
      setDocumentType("poliza_seguro");
      setDocumentOtherDescription("");
      setShowDocumentForm(false);

      toast.success("Documento guardado", {
        description: "El documento ha sido guardado correctamente",
      });
    } catch (error) {
      console.error("Error guardando documento:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al guardar documento", {
        description: errorMessage,
      });
    } finally {
      setIsSavingDocument(false);
    }
  };

  const handleDeleteDocument = async (documentId: number | string) => {
    try {
      const documentIdStr = String(documentId);
      const response = await fetch(`/api/fleet-documents/${encodeURIComponent(documentIdStr)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      setVehicleDocuments((prev) =>
        prev.filter((d) => d.id !== documentId && d.documentId !== documentId)
      );
      toast.success("Documento eliminado", {
        description: "El documento ha sido eliminado",
      });
    } catch (error) {
      console.error("Error eliminando documento:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al eliminar documento", {
        description: errorMessage,
      });
      throw error;
    }
  };

  useEffect(() => {
    loadVehicleDocuments();
  }, [loadVehicleDocuments]);

  return {
    vehicleDocuments,
    isLoadingDocuments,
    isSavingDocument,
    documentType,
    documentOtherDescription,
    documentFiles,
    showDocumentForm,
    setDocumentType,
    setDocumentOtherDescription,
    loadVehicleDocuments,
    handleDocumentFileChange,
    handleRemoveDocumentFile,
    handleSaveDocument,
    handleDeleteDocument,
    handleOpenDocumentForm,
    handleCancelDocumentForm,
    setVehicleDocuments,
  };
}
