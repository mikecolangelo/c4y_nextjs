import { useCallback, useState, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { toast } from "@/lib/toast";
import { compressImage } from "@/lib/image-compression";
import type {
  FleetVehicleCard,
  FleetVehicleCondition,
  FleetVehicleUpdatePayload,
  RecurrencePattern,
} from "@/validations/types";

interface FormData {
  name: string;
  vin: string;
  price: string;
  currentMileage: string;
  color: string;
  fuelType: string;
  transmission: string;
  condition: FleetVehicleCondition;
  brand: string;
  model: string;
  year: string;
  imageAlt: string;
  nextMaintenanceDate: string;
  placa: string;
  billingInitials: string;
}

interface UseVehicleFormReturn {
  isEditing: boolean;
  isSaving: boolean;
  formData: FormData;
  imagePreview: string | null;
  selectedImageFile: File | null;
  shouldRemoveImage: boolean;
  maintenanceScheduledDate: string;
  maintenanceScheduledTime: string;
  maintenanceIsAllDay: boolean;
  maintenanceRecurrencePattern: RecurrencePattern;
  maintenanceRecurrenceEndDate: string;
  selectedResponsables: number[];
  selectedAssignedDrivers: number[];
  selectedInterestedDrivers: number[];
  selectedCurrentDrivers: number[];
  isUploadingImage: boolean;
  setIsEditing: (editing: boolean) => void;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  setMaintenanceScheduledDate: (date: string) => void;
  setMaintenanceScheduledTime: (time: string) => void;
  setMaintenanceIsAllDay: (isAllDay: boolean) => void;
  setMaintenanceRecurrencePattern: (pattern: RecurrencePattern) => void;
  setMaintenanceRecurrenceEndDate: (date: string) => void;
  setSelectedResponsables: (ids: number[]) => void;
  setSelectedAssignedDrivers: (ids: number[]) => void;
  setSelectedInterestedDrivers: (ids: number[]) => void;
  setSelectedCurrentDrivers: (ids: number[]) => void;
  syncFormWithVehicle: (data: FleetVehicleCard) => Promise<void>;
  handleImageInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
  handleRestoreOriginalImage: (originalImageUrl: string | null) => void;
  handleCancelEdit: (vehicleData: FleetVehicleCard | null) => void;
  handleSaveChanges: (
    vehicleData: FleetVehicleCard | null,
    vehicleId: string,
    loadVehicle: () => Promise<FleetVehicleCard | null>,
    syncMaintenanceReminder: (
      date: string,
      time: string,
      isAllDay: boolean,
      pattern: RecurrencePattern,
      endDate?: string
    ) => Promise<void>,
    vehicleReminders: any[],
    loadVehicleReminders: () => Promise<any>,
    setErrorMessage: (msg: string | null) => void
  ) => Promise<void>;
}

const initialFormData: FormData = {
  name: "",
  vin: "",
  price: "",
  currentMileage: "",
  color: "",
  fuelType: "",
  transmission: "",
  condition: "nuevo" as FleetVehicleCondition,
  brand: "",
  model: "",
  year: "",
  imageAlt: "",
  nextMaintenanceDate: "",
  placa: "",
  billingInitials: "",
};

export function useVehicleForm(vehicleId: string): UseVehicleFormReturn {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [shouldRemoveImage, setShouldRemoveImage] = useState(false);
  const [maintenanceScheduledDate, setMaintenanceScheduledDate] = useState("");
  const [maintenanceScheduledTime, setMaintenanceScheduledTime] = useState("");
  const [maintenanceIsAllDay, setMaintenanceIsAllDay] = useState(false);
  const [maintenanceRecurrencePattern, setMaintenanceRecurrencePattern] =
    useState<RecurrencePattern>("monthly");
  const [maintenanceRecurrenceEndDate, setMaintenanceRecurrenceEndDate] = useState("");
  const [selectedResponsables, setSelectedResponsables] = useState<number[]>([]);
  const [selectedAssignedDrivers, setSelectedAssignedDrivers] = useState<number[]>([]);
  const [selectedInterestedDrivers, setSelectedInterestedDrivers] = useState<number[]>([]);
  const [selectedCurrentDrivers, setSelectedCurrentDrivers] = useState<number[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const previewObjectUrlRef = useRef<string | null>(null);

  const updateImagePreview = useCallback((value: string | null, isObjectUrl = false) => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }

    if (isObjectUrl && value) {
      previewObjectUrlRef.current = value;
    }

    setImagePreview(value);
  }, []);

  const syncFormWithVehicle = useCallback(
    async (data: FleetVehicleCard) => {
      setFormData({
        name: data.name,
        vin: data.vin,
        price: data.priceNumber.toString(),
        currentMileage: data.currentMileage?.toString() ?? "",
        color: data.color ?? "",
        fuelType: data.fuelType ?? "",
        transmission: data.transmission ?? "",
        condition: data.condition,
        brand: data.brand,
        model: data.model,
        year: data.year.toString(),
        imageAlt: data.imageAlt ?? "",
        nextMaintenanceDate: data.nextMaintenanceDate
          ? new Date(data.nextMaintenanceDate).toISOString().split("T")[0]
          : "",
        placa: (data as any).placa ?? "",
        billingInitials: data.billingInitials ?? "",
      });

      // Establecer valores de mantenimiento desde nextMaintenanceDate
      // Nota: Cuando se está editando, estos valores pueden ser sobrescritos por el recordatorio
      // en el useEffect de la página principal
      if (data.nextMaintenanceDate) {
        const maintenanceDate = new Date(data.nextMaintenanceDate);
        const year = maintenanceDate.getFullYear();
        const month = String(maintenanceDate.getMonth() + 1).padStart(2, "0");
        const day = String(maintenanceDate.getDate()).padStart(2, "0");
        setMaintenanceScheduledDate(`${year}-${month}-${day}`);

        const hours = String(maintenanceDate.getHours()).padStart(2, "0");
        const minutes = String(maintenanceDate.getMinutes()).padStart(2, "0");
        const timeValue = `${hours}:${minutes}`;
        setMaintenanceScheduledTime(timeValue);
        setMaintenanceIsAllDay(timeValue === "00:00");
      } else {
        // Si no hay fecha de mantenimiento, limpiar campos pero mantener patrón por defecto
        // Solo si no estamos en modo edición (para evitar limpiar valores que vienen del recordatorio)
        setMaintenanceScheduledDate("");
        setMaintenanceScheduledTime("");
        setMaintenanceIsAllDay(false);
        setMaintenanceRecurrencePattern("monthly");
        setMaintenanceRecurrenceEndDate("");
      }
      updateImagePreview(data.imageUrl ?? null);
      setSelectedImageFile(null);
      setShouldRemoveImage(false);

      // Sincronizar responsables, conductores asignados e interesados
      // Primero intentar con los datos normalizados
      if (data.responsables && data.responsables.length > 0) {
        const responsablesIds = data.responsables
          .map((r) => r.id)
          .filter((id): id is number => typeof id === "number" && !isNaN(id));
        if (responsablesIds.length > 0) {
          setSelectedResponsables(responsablesIds);
        } else {
          setSelectedResponsables([]);
        }
      } else {
        setSelectedResponsables([]);
      }

      if (data.assignedDrivers && data.assignedDrivers.length > 0) {
        const assignedDriversIds = data.assignedDrivers
          .map((d) => d.id)
          .filter((id): id is number => typeof id === "number" && !isNaN(id));
        if (assignedDriversIds.length > 0) {
          setSelectedAssignedDrivers(assignedDriversIds);
        } else {
          setSelectedAssignedDrivers([]);
        }
      } else {
        setSelectedAssignedDrivers([]);
      }

      if (data.interestedDrivers && data.interestedDrivers.length > 0) {
        const interestedDriversIds = data.interestedDrivers
          .map((d) => d.id)
          .filter((id): id is number => typeof id === "number" && !isNaN(id));
        if (interestedDriversIds.length > 0) {
          setSelectedInterestedDrivers(interestedDriversIds);
        } else {
          setSelectedInterestedDrivers([]);
        }
      } else {
        setSelectedInterestedDrivers([]);
      }

      if ((data as any).currentDrivers && (data as any).currentDrivers.length > 0) {
        const currentDriversIds = (data as any).currentDrivers
          .map((d: any) => d.id)
          .filter((id: any): id is number => typeof id === "number" && !isNaN(id));
        if (currentDriversIds.length > 0) {
          setSelectedCurrentDrivers(currentDriversIds);
        } else {
          setSelectedCurrentDrivers([]);
        }
      } else {
        setSelectedCurrentDrivers([]);
      }
    },
    [updateImagePreview, vehicleId]
  );

  const handleImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    updateImagePreview(objectUrl, true);
    setSelectedImageFile(file);
    setShouldRemoveImage(false);
  };

  const handleRemoveImage = () => {
    updateImagePreview(null);
    setSelectedImageFile(null);
    setShouldRemoveImage(true);
  };

  const handleRestoreOriginalImage = (originalImageUrl: string | null) => {
    if (!originalImageUrl) return;
    updateImagePreview(originalImageUrl);
    setSelectedImageFile(null);
    setShouldRemoveImage(false);
  };

  const handleCancelEdit = (vehicleData: FleetVehicleCard | null) => {
    if (vehicleData) {
      syncFormWithVehicle(vehicleData);
    }
    setIsEditing(false);
  };

  const handleSaveChanges = async (
    vehicleData: FleetVehicleCard | null,
    vehicleIdParam: string,
    loadVehicle: () => Promise<FleetVehicleCard | null>,
    syncMaintenanceReminder: (
      date: string,
      time: string,
      isAllDay: boolean,
      pattern: RecurrencePattern,
      endDate?: string
    ) => Promise<void>,
    vehicleReminders: any[],
    loadVehicleReminders: () => Promise<any>,
    setErrorMessage: (msg: string | null) => void
  ) => {
    if (!vehicleData) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      let uploadedImageId: number | null = null;
      if (selectedImageFile) {
        setIsUploadingImage(true);
        try {
          const validImageTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/gif",
            "image/webp",
          ];
          if (!validImageTypes.includes(selectedImageFile.type)) {
            throw new Error(
              `Tipo de archivo no válido. Solo se permiten imágenes: ${validImageTypes.join(", ")}`
            );
          }

          const maxSize = 10 * 1024 * 1024;
          if (selectedImageFile.size > maxSize) {
            throw new Error(`La imagen es demasiado grande. El tamaño máximo permitido es 10MB.`);
          }

          const uploadForm = new FormData();
          uploadForm.append("files", await compressImage(selectedImageFile));
          const uploadResponse = await fetch("/api/strapi/upload", {
            method: "POST",
            body: uploadForm,
          });
          if (!uploadResponse.ok) {
            let errorMessage = "No se pudo subir la imagen";
            try {
              const errorData = await uploadResponse.json();
              errorMessage = errorData?.error || errorMessage;
            } catch {
              // Usar mensaje por defecto
            }
            throw new Error(errorMessage);
          }
          const uploadPayload = (await uploadResponse.json()) as { data?: { id?: number } };
          uploadedImageId = uploadPayload?.data?.id ?? null;
          if (!uploadedImageId) {
            throw new Error("No se pudo obtener el ID de la imagen subida");
          }
        } finally {
          setIsUploadingImage(false);
        }
      }

      const payload: FleetVehicleUpdatePayload = {
        name: formData.name || vehicleData.name,
        vin: formData.vin || vehicleData.vin,
        price: Number(formData.price) || 0,
        currentMileage: formData.currentMileage ? Number(formData.currentMileage) : null,
        color: formData.color || null,
        fuelType: formData.fuelType || null,
        transmission: formData.transmission || null,
        condition: formData.condition,
        brand: formData.brand,
        model: formData.model,
        year: Number(formData.year) || vehicleData.year,
        imageAlt: formData.imageAlt || null,
        placa: formData.placa || null,
        billingInitials: formData.billingInitials || null,
        nextMaintenanceDate: maintenanceScheduledDate
          ? (() => {
              const timeToUse = maintenanceIsAllDay ? "00:00" : maintenanceScheduledTime || "00:00";
              return `${maintenanceScheduledDate}T${timeToUse}:00`;
            })()
          : null,
        responsables: selectedResponsables,
        assignedDrivers: selectedAssignedDrivers,
        interestedDrivers: selectedInterestedDrivers,
        currentDrivers: selectedCurrentDrivers,
      };

      if (uploadedImageId !== null) {
        payload.image = uploadedImageId;
      } else if (shouldRemoveImage) {
        payload.image = null;
      }

      const targetId = vehicleData.documentId ?? vehicleIdParam;
      const response = await fetch(`/api/fleet/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      if (!response.ok) {
        let errorMessage = "No se pudo guardar los cambios";
        try {
          const errorData = await response.json();
          errorMessage = errorData?.error || errorMessage;
        } catch {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      if (maintenanceScheduledDate) {
        await syncMaintenanceReminder(
          maintenanceScheduledDate,
          maintenanceScheduledTime,
          maintenanceIsAllDay,
          maintenanceRecurrencePattern,
          maintenanceRecurrenceEndDate
        );
      } else {
        const maintenanceReminder = vehicleReminders.find(
          (r: any) =>
            r.title.toLowerCase().includes("mantenimiento") ||
            r.title === "Mantenimiento completo del vehículo"
        );

        if (maintenanceReminder) {
          const reminderId = maintenanceReminder.documentId || String(maintenanceReminder.id);
          try {
            await fetch(`/api/fleet-reminders/${encodeURIComponent(reminderId)}`, {
              method: "DELETE",
            });
            await loadVehicleReminders();
          } catch (error) {
            console.error("Error eliminando recordatorio de mantenimiento:", error);
          }
        }
      }

      // Forzar recarga del vehículo con un pequeño delay para asegurar que Strapi procesó todo
      await new Promise((resolve) => setTimeout(resolve, 300));
      await loadVehicle();
      // Pequeño delay adicional para asegurar que los datos se actualizaron en el estado
      await new Promise((resolve) => setTimeout(resolve, 200));
      setIsEditing(false);
      toast.success("Vehículo actualizado correctamente");
    } catch (error) {
      console.error("Error guardando vehículo:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No pudimos guardar los cambios. Intenta nuevamente.";
      const isUploadError =
        errorMessage.includes("imagen") ||
        errorMessage.includes("archivo") ||
        errorMessage.includes("subir");

      if (isUploadError) {
        setErrorMessage(errorMessage);
        toast.error("Error al subir imagen", {
          description: errorMessage,
        });
      } else {
        setErrorMessage(errorMessage);
        toast.error("Error al guardar", {
          description: errorMessage,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
  }, []);

  return {
    isEditing,
    isSaving,
    formData,
    imagePreview,
    selectedImageFile,
    shouldRemoveImage,
    maintenanceScheduledDate,
    maintenanceScheduledTime,
    maintenanceIsAllDay,
    maintenanceRecurrencePattern,
    maintenanceRecurrenceEndDate,
    selectedResponsables,
    selectedAssignedDrivers,
    selectedInterestedDrivers,
    selectedCurrentDrivers,
    isUploadingImage,
    setIsEditing,
    setFormData,
    setMaintenanceScheduledDate,
    setMaintenanceScheduledTime,
    setMaintenanceIsAllDay,
    setMaintenanceRecurrencePattern,
    setMaintenanceRecurrenceEndDate,
    setSelectedResponsables,
    setSelectedAssignedDrivers,
    setSelectedInterestedDrivers,
    setSelectedCurrentDrivers,
    syncFormWithVehicle,
    handleImageInputChange,
    handleRemoveImage,
    handleRestoreOriginalImage,
    handleCancelEdit,
    handleSaveChanges,
  };
}
