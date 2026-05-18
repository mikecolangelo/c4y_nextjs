"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "@/lib/toast";
import type { VehicleDocument, VehicleDocumentCategory } from "@/validations/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTOS = 5;
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

interface UseVehicleDocumentsV2Return {
  documents: VehicleDocument[];
  categories: VehicleDocumentCategory[];
  isLoadingDocuments: boolean;
  isLoadingCategories: boolean;
  isSaving: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  showForm: boolean;
  editingDocument: VehicleDocument | null;
  selectedCategory: VehicleDocumentCategory | null;
  description: string;
  expirationDate: string;
  legalFiles: File[];
  photoFiles: File[];

  setSelectedCategory: (cat: VehicleDocumentCategory | null) => void;
  setDescription: (value: string) => void;
  setExpirationDate: (value: string) => void;
  handleLegalFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleRemoveLegalFile: (index: number) => void;
  handlePhotoFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleRemovePhotoFile: (index: number) => void;

  openForm: () => void;
  cancelForm: () => void;
  startEdit: (doc: VehicleDocument) => void;
  cancelEdit: () => void;
  saveDocument: () => Promise<void>;
  updateDocument: () => Promise<void>;
  deleteDocument: (docId: string | number) => Promise<void>;
  refresh: () => Promise<void>;

  // Category management (inline admin)
  isCreatingCategory: boolean;
  isUpdatingCategory: boolean;
  isDeletingCategory: boolean;
  createCategory: (data: { name: string; description?: string; isActive: boolean; order: number }) => Promise<void>;
  updateCategory: (id: string | number, data: Partial<VehicleDocumentCategory>) => Promise<void>;
  deleteCategory: (id: string | number) => Promise<void>;
  reorderCategories: (reorderedList: VehicleDocumentCategory[]) => Promise<void>;
}

export function useVehicleDocumentsV2(vehicleId: string): UseVehicleDocumentsV2Return {
  // ── Documents ──
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Categories ──
  const [categories, setCategories] = useState<VehicleDocumentCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // ── Form state ──
  const [showForm, setShowForm] = useState(false);
  const [editingDocument, setEditingDocument] = useState<VehicleDocument | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<VehicleDocumentCategory | null>(null);
  const [description, setDescription] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [legalFiles, setLegalFiles] = useState<File[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  const resetForm = useCallback(() => {
    setSelectedCategory(null);
    setDescription("");
    setExpirationDate("");
    setLegalFiles([]);
    setPhotoFiles([]);
    setEditingDocument(null);
  }, []);

  const openForm = useCallback(() => {
    resetForm();
    setShowForm(true);
  }, [resetForm]);

  const cancelForm = useCallback(() => {
    setShowForm(false);
    resetForm();
  }, [resetForm]);

  const startEdit = useCallback((doc: VehicleDocument) => {
    setEditingDocument(doc);
    setSelectedCategory(doc.category || null);
    setDescription(doc.description || "");
    setExpirationDate(doc.expirationDate || "");
    setLegalFiles([]);
    setPhotoFiles([]);
    setShowForm(false);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingDocument(null);
    resetForm();
  }, [resetForm]);

  // ── Loaders ──
  const fetchDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);
    try {
      const res = await fetch(
        `/api/vehicle-documents-v2?vehicleDocumentId=${encodeURIComponent(vehicleId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Error cargando documentos");
      const json = await res.json();
      setDocuments(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error("[useVehicleDocumentsV2] fetchDocuments error:", err);
      toast.error("No se pudieron cargar los documentos");
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [vehicleId]);

  const fetchCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const res = await fetch("/api/vehicle-document-categories-v2", { cache: "no-store" });
      if (!res.ok) throw new Error("Error cargando categorías");
      const json = await res.json();
      setCategories(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error("[useVehicleDocumentsV2] fetchCategories error:", err);
      toast.error("No se pudieron cargar las categorías");
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchDocuments(), fetchCategories()]);
  }, [fetchDocuments, fetchCategories]);

  useEffect(() => {
    if (vehicleId) {
      refresh();
    }
  }, [vehicleId, refresh]);

  // ── File helpers ──
  const validateFiles = (files: FileList | null, currentCount: number, type: "legal" | "photo") => {
    if (!files || files.length === 0) return [];
    const arr = Array.from(files);
    const valid: File[] = [];

    if (type === "photo" && currentCount + arr.length > MAX_PHOTOS) {
      toast.error(`Máximo ${MAX_PHOTOS} fotos permitidas`);
      return valid;
    }

    for (const file of arr) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" excede el límite de 5 MB`);
        continue;
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" tiene un formato no permitido`);
        continue;
      }
      valid.push(file);
    }
    return valid;
  };

  const handleLegalFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const valid = validateFiles(e.target.files, legalFiles.length, "legal");
      if (valid.length) setLegalFiles((prev) => [...prev, ...valid]);
      e.target.value = "";
    },
    [legalFiles.length]
  );

  const handleRemoveLegalFile = useCallback((index: number) => {
    setLegalFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePhotoFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const valid = validateFiles(e.target.files, photoFiles.length, "photo");
      if (valid.length) setPhotoFiles((prev) => [...prev, ...valid]);
      e.target.value = "";
    },
    [photoFiles.length]
  );

  const handleRemovePhotoFile = useCallback((index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Upload to Strapi ──
  const uploadFiles = async (files: File[]): Promise<number[]> => {
    if (files.length === 0) return [];
    const ids: number[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/strapi/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Error subiendo ${file.name}`);
      }
      const json = await res.json();
      const uploaded = json.data;
      if (Array.isArray(uploaded)) {
        uploaded.forEach((u) => u.id && ids.push(u.id));
      } else if (uploaded?.id) {
        ids.push(uploaded.id);
      }
    }
    return ids;
  };

  // ── CRUD Documents ──
  const saveDocument = async () => {
    if (!selectedCategory) {
      toast.error("Selecciona una categoría");
      return;
    }
    if (legalFiles.length === 0 && photoFiles.length === 0) {
      toast.error("Adjunta al menos un archivo o foto");
      return;
    }

    setIsSaving(true);
    try {
      const [legalIds, photoIds] = await Promise.all([
        uploadFiles(legalFiles),
        uploadFiles(photoFiles),
      ]);

      const payload: Record<string, unknown> = {
        vehicleDocumentId: vehicleId,
        category: selectedCategory.id,
        description: description.trim() || undefined,
        expirationDate: expirationDate || undefined,
      };
      if (legalIds.length) payload.files = legalIds;
      if (photoIds.length) payload.photos = photoIds;

      const res = await fetch("/api/vehicle-documents-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error guardando documento");
      }

      toast.success("Documento guardado");
      await fetchDocuments();
      cancelForm();
    } catch (err) {
      console.error("[useVehicleDocumentsV2] saveDocument error:", err);
      toast.error(err instanceof Error ? err.message : "Error guardando documento");
    } finally {
      setIsSaving(false);
    }
  };

  const updateDocument = async () => {
    if (!editingDocument) return;
    if (!selectedCategory) {
      toast.error("Selecciona una categoría");
      return;
    }

    setIsUpdating(true);
    try {
      const [legalIds, photoIds] = await Promise.all([
        uploadFiles(legalFiles),
        uploadFiles(photoFiles),
      ]);

      const payload: Record<string, unknown> = {
        vehicleDocumentId: vehicleId,
        category: selectedCategory.id,
        description: description.trim() || undefined,
        expirationDate: expirationDate || undefined,
      };

      // Solo enviar files/photos si se seleccionaron nuevos archivos (reemplazo total)
      if (legalIds.length) payload.files = legalIds;
      if (photoIds.length) payload.photos = photoIds;

      const docId = editingDocument.documentId || editingDocument.id;
      const res = await fetch(`/api/vehicle-documents-v2/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error actualizando documento");
      }

      toast.success("Documento actualizado");
      await fetchDocuments();
      cancelEdit();
    } catch (err) {
      console.error("[useVehicleDocumentsV2] updateDocument error:", err);
      toast.error(err instanceof Error ? err.message : "Error actualizando documento");
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteDocument = async (docId: string | number) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/vehicle-documents-v2/${docId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error eliminando documento");
      }
      toast.success("Documento eliminado");
      await fetchDocuments();
    } catch (err) {
      console.error("[useVehicleDocumentsV2] deleteDocument error:", err);
      toast.error(err instanceof Error ? err.message : "Error eliminando documento");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── CRUD Categories ──
  const createCategory = async (data: {
    name: string;
    description?: string;
    isActive: boolean;
    order: number;
  }) => {
    setIsCreatingCategory(true);
    try {
      const res = await fetch("/api/vehicle-document-categories-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error creando categoría");
      }
      toast.success("Categoría creada");
      await fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creando categoría");
      throw err;
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const updateCategory = async (id: string | number, data: Partial<VehicleDocumentCategory>) => {
    setIsUpdatingCategory(true);
    try {
      const res = await fetch(`/api/vehicle-document-categories-v2/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error actualizando categoría");
      }
      toast.success("Categoría actualizada");
      await fetchCategories();
      // Si la categoría editada está seleccionada, refrescarla
      if (selectedCategory && (selectedCategory.id === id || selectedCategory.documentId === id)) {
        const updated = categories.find((c) => c.id === id || c.documentId === id);
        if (updated) setSelectedCategory(updated);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error actualizando categoría");
      throw err;
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  const deleteCategory = async (id: string | number) => {
    setIsDeletingCategory(true);
    try {
      const res = await fetch(`/api/vehicle-document-categories-v2/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error eliminando categoría");
      }
      toast.success("Categoría eliminada");
      await fetchCategories();
      if (selectedCategory && (selectedCategory.id === id || selectedCategory.documentId === id)) {
        setSelectedCategory(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error eliminando categoría");
      throw err;
    } finally {
      setIsDeletingCategory(false);
    }
  };

  // ── Reorder Categories ──
  const reorderCategories = async (reorderedList: VehicleDocumentCategory[]) => {
    setIsUpdatingCategory(true);
    try {
      const updates = reorderedList
        .map((cat, index) => {
          const newOrder = index + 1;
          const id = cat.documentId || cat.id;
          if (cat.order !== newOrder) {
            return fetch(`/api/vehicle-document-categories-v2/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data: { order: newOrder } }),
            });
          }
          return Promise.resolve(new Response(null, { status: 200 }));
        });

      const results = await Promise.all(updates);
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        throw new Error("Algunas categorías no pudieron actualizarse");
      }

      toast.success("Orden actualizado");
      await fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error reordenando categorías");
      throw err;
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  return {
    documents,
    categories,
    isLoadingDocuments,
    isLoadingCategories,
    isSaving,
    isUpdating,
    isDeleting,
    showForm,
    editingDocument,
    selectedCategory,
    description,
    expirationDate,
    legalFiles,
    photoFiles,
    setSelectedCategory,
    setDescription,
    setExpirationDate,
    handleLegalFileChange,
    handleRemoveLegalFile,
    handlePhotoFileChange,
    handleRemovePhotoFile,
    openForm,
    cancelForm,
    startEdit,
    cancelEdit,
    saveDocument,
    updateDocument,
    deleteDocument,
    refresh,
    isCreatingCategory,
    isUpdatingCategory,
    isDeletingCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  };
}
