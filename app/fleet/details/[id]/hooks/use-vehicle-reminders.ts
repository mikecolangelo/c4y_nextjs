import { useCallback, useState, useEffect, useRef } from "react";
import { toast } from "@/lib/toast";
import { REMINDER_EVENTS, emitReminderCreated, emitReminderUpdated, emitReminderDeleted, emitReminderToggleCompleted, emitReminderToggleActive } from "@/lib/reminder-events";
import type { FleetReminder, ReminderType, RecurrencePattern } from "@/validations/types";

interface AvailableUser {
  id: number;
  documentId?: string;
  displayName?: string;
  email?: string;
  role?: string;
  avatar?: { url?: string; alternativeText?: string };
}

interface UseVehicleRemindersReturn {
  vehicleReminders: FleetReminder[];
  isLoadingReminders: boolean;
  isSavingReminder: boolean;
  reminderTitle: string;
  reminderDescription: string;
  reminderType: ReminderType;
  reminderScheduledDate: string;
  reminderScheduledTime: string;
  isAllDay: boolean;
  reminderRecurrencePattern: RecurrencePattern;
  reminderRecurrenceEndDate: string;
  selectedResponsables: number[];
  selectedAssignedDrivers: number[];
  showReminderForm: boolean;
  editingReminderId: number | string | null;
  availableUsers: AvailableUser[];
  isLoadingUsers: boolean;
  setReminderTitle: (title: string) => void;
  setReminderDescription: (description: string) => void;
  setReminderType: (type: ReminderType) => void;
  setReminderScheduledDate: (date: string) => void;
  setReminderScheduledTime: (time: string) => void;
  setIsAllDay: (isAllDay: boolean) => void;
  setReminderRecurrencePattern: (pattern: RecurrencePattern) => void;
  setReminderRecurrenceEndDate: (date: string) => void;
  setSelectedResponsables: (ids: number[]) => void;
  setSelectedAssignedDrivers: (ids: number[]) => void;
  loadVehicleReminders: () => Promise<FleetReminder[]>;
  loadAvailableUsers: () => Promise<void>;
  handleSaveReminder: (currentUserDocumentId: string | null, loadVehicle: () => Promise<unknown>) => Promise<void>;
  handleEditReminder: (reminder: FleetReminder) => void;
  handleDeleteReminder: (reminderId: number | string, loadVehicle: () => Promise<unknown>) => Promise<void>;
  handleToggleReminderActive: (reminderId: number | string, isActive: boolean, loadVehicle?: () => Promise<unknown>) => Promise<void>;
  handleToggleReminderCompleted: (reminderId: number | string, isCompleted: boolean, loadVehicle?: () => Promise<unknown>) => Promise<void>;
  handleOpenReminderForm: () => void;
  handleCancelReminderForm: () => void;
  setVehicleReminders: React.Dispatch<React.SetStateAction<FleetReminder[]>>;
}

export function useVehicleReminders(vehicleId: string): UseVehicleRemindersReturn {
  const [vehicleReminders, setVehicleReminders] = useState<FleetReminder[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const isSavingRef = useRef(false); // Ref para prevenir condiciones de carrera
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDescription, setReminderDescription] = useState("");
  const [reminderType, setReminderType] = useState<ReminderType>("unique");
  const [reminderScheduledDate, setReminderScheduledDate] = useState("");
  const [reminderScheduledTime, setReminderScheduledTime] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [reminderRecurrencePattern, setReminderRecurrencePattern] = useState<RecurrencePattern>("daily");
  const [reminderRecurrenceEndDate, setReminderRecurrenceEndDate] = useState("");
  const [selectedResponsables, setSelectedResponsables] = useState<number[]>([]);
  const [selectedAssignedDrivers, setSelectedAssignedDrivers] = useState<number[]>([]);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<number | string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const handleOpenReminderForm = () => setShowReminderForm(true);
  
  const handleCancelReminderForm = () => {
    setShowReminderForm(false);
    setReminderTitle("");
    setReminderDescription("");
    setReminderScheduledDate("");
    setReminderScheduledTime("");
    setIsAllDay(false);
    setReminderType("unique");
    setReminderRecurrencePattern("daily");
    setReminderRecurrenceEndDate("");
    setSelectedResponsables([]);
    setSelectedAssignedDrivers([]);
    setEditingReminderId(null);
  };

  const loadAvailableUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch(`/api/user-profiles`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No pudimos obtener los usuarios");
      }
      const { data } = (await response.json()) as { data: AvailableUser[] };
      setAvailableUsers(data || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      toast.error("Error al cargar usuarios", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const loadVehicleReminders = useCallback(async (): Promise<FleetReminder[]> => {
    if (!vehicleId) {
      console.warn("No hay vehicleId disponible para cargar recordatorios");
      setIsLoadingReminders(false);
      return [];
    }
    
    setIsLoadingReminders(true);
    
    const controller = new AbortController();
    const signal = controller.signal;
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      // Crear un timeout para evitar que se quede cargando indefinidamente
      timeoutId = setTimeout(() => {
        console.warn("Timeout cargando recordatorios para vehículo:", vehicleId);
        controller.abort();
        setIsLoadingReminders(false);
        toast.error("Tiempo de espera agotado", {
          description: "El servidor está tardando en responder. Intenta recargar la página.",
        });
      }, 20000); // 20 segundos de timeout
      
      const response = await fetch(`/api/fleet/${vehicleId}/reminders`, { 
        cache: "no-store",
        signal,
      });
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error en respuesta de recordatorios:", {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        throw new Error(`Error ${response.status}: No se pudieron obtener los recordatorios`);
      }
      
      const { data } = (await response.json()) as { data: FleetReminder[] };
      const reminders = data || [];
      setVehicleReminders(reminders);
      return reminders;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (error instanceof Error && error.name === "AbortError") {
        console.error("Timeout/Petición abortada cargando recordatorios para vehículo:", vehicleId);
        // No mostrar toast aquí porque ya se mostró en el timeout
      } else {
        console.error("Error cargando recordatorios:", error);
        toast.error("Error al cargar recordatorios", {
          description: error instanceof Error ? error.message : "Error desconocido",
        });
      }
      return [];
    } finally {
      setIsLoadingReminders(false);
    }
  }, [vehicleId]);

  // Cargar recordatorios al montar el componente
  useEffect(() => {
    loadVehicleReminders();
  }, [loadVehicleReminders]);

  // Escuchar eventos de recordatorios para recargar automáticamente
  // NOTA: No recargar en DELETE porque ya se maneja explícitamente en handleDeleteReminder
  useEffect(() => {
    const handleReminderChange = () => {
      loadVehicleReminders();
    };

    window.addEventListener(REMINDER_EVENTS.CREATED, handleReminderChange);
    window.addEventListener(REMINDER_EVENTS.UPDATED, handleReminderChange);
    // NO escuchar REMINDER_EVENTS.DELETED aquí porque ya se maneja en handleDeleteReminder
    // window.addEventListener(REMINDER_EVENTS.DELETED, handleReminderChange);
    window.addEventListener(REMINDER_EVENTS.TOGGLE_COMPLETED, handleReminderChange);
    window.addEventListener(REMINDER_EVENTS.TOGGLE_ACTIVE, handleReminderChange);

    return () => {
      window.removeEventListener(REMINDER_EVENTS.CREATED, handleReminderChange);
      window.removeEventListener(REMINDER_EVENTS.UPDATED, handleReminderChange);
      // window.removeEventListener(REMINDER_EVENTS.DELETED, handleReminderChange);
      window.removeEventListener(REMINDER_EVENTS.TOGGLE_COMPLETED, handleReminderChange);
      window.removeEventListener(REMINDER_EVENTS.TOGGLE_ACTIVE, handleReminderChange);
    };
  }, [loadVehicleReminders]);

  const handleSaveReminder = async (currentUserDocumentId: string | null, loadVehicle: () => Promise<unknown>) => {
    if (!reminderTitle?.trim() || !reminderScheduledDate) {
      toast.error("Error", {
        description: "El título y la fecha programada son requeridos",
      });
      return;
    }

    const allAssignedUserIds = [
      ...selectedResponsables,
      ...selectedAssignedDrivers,
    ].filter((id, index, self) => self.indexOf(id) === index); // Eliminar duplicados

    if (allAssignedUserIds.length === 0) {
      toast.error("Error", {
        description: "Debes asignar al menos un responsable o conductor al recordatorio",
      });
      return;
    }
    
    const timeToUse = isAllDay ? "00:00" : (reminderScheduledTime || "00:00");
    const scheduledDateTime = `${reminderScheduledDate}T${timeToUse}:00`;

    if (reminderType === "recurring" && !reminderRecurrencePattern) {
      toast.error("Error", {
        description: "El patrón de recurrencia es requerido para recordatorios recurrentes",
      });
      return;
    }

    // Prevenir doble submit usando ref para evitar condiciones de carrera
    if (isSavingRef.current || isSavingReminder) {
      console.warn("⚠️ Ya hay una operación de guardado en progreso, ignorando solicitud duplicada", {
        isSavingRef: isSavingRef.current,
        isSavingReminder,
      });
      return;
    }
    
    isSavingRef.current = true;
    setIsSavingReminder(true);
    try {
      const baseData: {
        title: string;
        description?: string;
        reminderType: ReminderType;
        scheduledDate: string;
        recurrencePattern?: RecurrencePattern;
        recurrenceEndDate?: string;
      } = {
        title: reminderTitle?.trim() || "",
        reminderType: reminderType,
        scheduledDate: scheduledDateTime,
      };

      if (reminderDescription.trim()) {
        baseData.description = reminderDescription.trim();
      }

      if (reminderType === "recurring") {
        baseData.recurrencePattern = reminderRecurrencePattern;
        if (reminderRecurrenceEndDate) {
          baseData.recurrenceEndDate = reminderRecurrenceEndDate;
        }
      }

      if (editingReminderId) {
        const reminderIdStr = String(editingReminderId);
        const updateBody = {
          data: {
            ...baseData,
            // Para actualización directa en notifications, usar assignedUsers
            assignedUsers: allAssignedUserIds,
          },
        };
        const response = await fetch(`/api/notifications/${encodeURIComponent(reminderIdStr)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateBody),
        });

        if (!response.ok) {
          let errorData;
          try {
            const errorText = await response.text();
            errorData = errorText ? JSON.parse(errorText) : { error: "Error desconocido" };
          } catch {
            errorData = { error: `Error ${response.status}: ${response.statusText}` };
          }
          
          throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
        }

        const { data: updatedReminder } = (await response.json()) as { data: FleetReminder };
        
        // Emitir evento ANTES de actualizar para que otros componentes se enteren
        emitReminderUpdated(updatedReminder);
        
        // Recargar recordatorios PRIMERO para que se actualice en la lista antes de actualizar nextMaintenanceDate
        // Esto evita que el useEffect de limpieza se ejecute antes de que el recordatorio esté disponible
        await loadVehicleReminders();
        
        // Pequeño delay para asegurar que los recordatorios se hayan cargado completamente
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const isMaintenanceReminder = updatedReminder.title.toLowerCase().includes("mantenimiento") || 
                                      updatedReminder.title === "Mantenimiento completo del vehículo";
        
        if (isMaintenanceReminder && vehicleId) {
          try {
            // Para recordatorios recurrentes, usar nextTrigger; para únicos, usar scheduledDate
            const maintenanceDate = updatedReminder.reminderType === "recurring" 
              ? updatedReminder.nextTrigger 
              : updatedReminder.scheduledDate;
            await fetch(`/api/fleet/${vehicleId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                data: {
                  nextMaintenanceDate: maintenanceDate,
                },
              }),
            });
            // Recargar el vehículo para actualizar nextMaintenanceDate en la UI
            await loadVehicle();
          } catch (error) {
            console.error("Error actualizando fecha de mantenimiento del vehículo:", error);
          }
        }
        
        handleCancelReminderForm();
        
        toast.success("Recordatorio actualizado", {
          description: "El recordatorio ha sido actualizado correctamente",
        });
      } else {
        const createBody: {
          data: typeof baseData & {
            assignedUserIds: number[];
            authorDocumentId?: string;
          };
        } = {
          data: {
            ...baseData,
            assignedUserIds: allAssignedUserIds,
          },
        };

        if (currentUserDocumentId) {
          createBody.data.authorDocumentId = currentUserDocumentId;
        }

        // Log para depuración
        if (process.env.NODE_ENV === 'development') {
          console.log("📤 Enviando petición POST para crear recordatorio:", {
            title: baseData.title,
            reminderType: baseData.reminderType,
            scheduledDate: baseData.scheduledDate,
            assignedUsersCount: allAssignedUserIds.length,
            isEditing: !!editingReminderId,
          });
        }
        
        const response = await fetch(`/api/fleet/${vehicleId}/reminders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createBody),
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
            throw new Error("El método POST no está permitido en esta ruta. Por favor, reinicia el servidor de desarrollo.");
          }
          
          throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
        }

        const { data: createdReminder } = (await response.json()) as { data: FleetReminder };
        
        // Emitir evento ANTES de actualizar para que otros componentes se enteren
        emitReminderCreated(createdReminder);
        
        // Recargar recordatorios PRIMERO para que aparezca en la lista antes de actualizar nextMaintenanceDate
        // Esto evita que el useEffect de limpieza se ejecute antes de que el recordatorio esté disponible
        await loadVehicleReminders();
        
        // Pequeño delay para asegurar que los recordatorios se hayan cargado completamente
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const isMaintenanceReminder = createdReminder.title.toLowerCase().includes("mantenimiento") || 
                                      createdReminder.title === "Mantenimiento completo del vehículo";
        
        if (isMaintenanceReminder && vehicleId) {
          try {
            // Para recordatorios recurrentes, usar nextTrigger; para únicos, usar scheduledDate
            const maintenanceDate = createdReminder.reminderType === "recurring" 
              ? createdReminder.nextTrigger 
              : createdReminder.scheduledDate;
            await fetch(`/api/fleet/${vehicleId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                data: {
                  nextMaintenanceDate: maintenanceDate,
                },
              }),
            });
            // Recargar el vehículo para actualizar nextMaintenanceDate en la UI
            await loadVehicle();
          } catch (error) {
            console.error("Error actualizando fecha de mantenimiento del vehículo:", error);
          }
        }
        
        handleCancelReminderForm();
        
        toast.success("Recordatorio creado", {
          description: "El recordatorio ha sido creado correctamente",
        });
      }
    } catch (error) {
      console.error("Error guardando recordatorio:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al guardar recordatorio", {
        description: errorMessage,
      });
    } finally {
      isSavingRef.current = false;
      setIsSavingReminder(false);
    }
  };

  const handleDeleteReminder = async (reminderId: number | string, loadVehicle: () => Promise<unknown>) => {
    try {
      const reminderIdStr = String(reminderId);
      
      // Log para depuración
      if (process.env.NODE_ENV === 'development') {
        console.log("🗑️ Intentando eliminar recordatorio:", {
          reminderId,
          reminderIdStr,
          vehicleRemindersCount: vehicleReminders.length,
        });
      }
      
      const reminderToDelete = vehicleReminders.find(
        (r) => String(r.id) === reminderIdStr || r.documentId === reminderIdStr
      );
      
      if (!reminderToDelete) {
        console.error("❌ Recordatorio no encontrado en la lista local para eliminar:", {
          reminderId,
          reminderIdStr,
          availableIds: vehicleReminders.map(r => ({ id: r.id, documentId: r.documentId })),
        });
        throw new Error("Recordatorio no encontrado en la lista local");
      }
      
      // Log del recordatorio encontrado
      if (process.env.NODE_ENV === 'development') {
        console.log("✅ Recordatorio encontrado para eliminar:", {
          id: reminderToDelete.id,
          documentId: reminderToDelete.documentId,
          title: reminderToDelete.title,
        });
      }
      
      const isMaintenanceReminder = reminderToDelete?.title.toLowerCase().includes("mantenimiento") || 
                                    reminderToDelete?.title === "Mantenimiento completo del vehículo";
      
      // Usar el ID numérico si está disponible, sino usar documentId
      const idToUse = (reminderToDelete.id && typeof reminderToDelete.id === 'number') 
        ? String(reminderToDelete.id) 
        : (reminderToDelete.documentId || reminderIdStr);
      
      if (process.env.NODE_ENV === 'development') {
        console.log("🔄 Enviando petición DELETE con ID:", idToUse);
      }
      
      const response = await fetch(`/api/notifications/${encodeURIComponent(idToUse)}`, {
        method: "DELETE",
      });

      if (process.env.NODE_ENV === 'development') {
        console.log("📡 Respuesta DELETE recibida:", {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          idToUse,
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try {
          errorData = errorText ? JSON.parse(errorText) : { error: "Error desconocido" };
        } catch {
          errorData = { error: errorText || `Error ${response.status}: ${response.statusText}` };
        }
        
        const errorMessage = errorData?.error || errorData?.message || errorText || `Error ${response.status}: ${response.statusText}`;
        
        console.error("❌ Error eliminando recordatorio:", {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData || {},
          errorText: errorText || 'Sin texto de error',
          reminderId,
          idToUse,
          errorMessage,
        });
        
        throw new Error(errorMessage);
      }

      // Verificar que la respuesta sea exitosa antes de actualizar el estado
      const responseData = await response.json().catch(() => ({}));
      
      if (process.env.NODE_ENV === 'development') {
        console.log("✅ Eliminación exitosa, respuesta:", responseData);
      }

      // Actualizar estado local optimistamente
      setVehicleReminders((prev) => {
        const filtered = prev.filter((r) => {
          const matchesById = r.id && String(r.id) === reminderIdStr;
          const matchesByDocumentId = r.documentId && r.documentId === reminderIdStr;
          return !matchesById && !matchesByDocumentId;
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log("🔄 Estado actualizado después de eliminar:", {
            antes: prev.length,
            después: filtered.length,
            eliminado: reminderIdStr,
            recordatoriosRestantes: filtered.map(r => ({ id: r.id, documentId: r.documentId, title: r.title })),
          });
        }
        
        return filtered;
      });
      
      // Emitir evento con el ID correcto (preferir documentId si está disponible)
      const reminderIdToEmit = reminderToDelete?.documentId || reminderIdStr;
      emitReminderDeleted(reminderIdToEmit);
      
      // Esperar un momento antes de recargar para asegurar que la eliminación se complete en el servidor
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Recargar recordatorios desde el servidor para asegurar sincronización
      const reloadedReminders = await loadVehicleReminders();
      
      if (process.env.NODE_ENV === 'development') {
        console.log("🔄 Recordatorios después de recargar:", {
          cantidad: reloadedReminders?.length || 0,
          recordatorios: reloadedReminders?.map(r => ({ id: r.id, documentId: r.documentId, title: r.title })) || [],
        });
      }
      
      if (isMaintenanceReminder && vehicleId) {
        try {
          const updateResponse = await fetch(`/api/fleet/${vehicleId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: {
                nextMaintenanceDate: null,
              },
            }),
          });

          if (updateResponse.ok) {
            await loadVehicle();
            toast.success("Recordatorio eliminado", {
              description: "El recordatorio de mantenimiento y la fecha han sido eliminados",
            });
          } else {
            toast.success("Recordatorio eliminado", {
              description: "El recordatorio ha sido eliminado",
            });
          }
        } catch {
          toast.success("Recordatorio eliminado", {
            description: "El recordatorio ha sido eliminado",
          });
        }
      } else {
        toast.success("Recordatorio eliminado", {
          description: "El recordatorio ha sido eliminado",
        });
      }
    } catch (error) {
      // Extraer información útil del error
      let errorMessage = "Error desconocido al eliminar el recordatorio";
      let errorDetails: any = {};
      
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
        errorDetails = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      } else if (typeof error === 'object' && error !== null) {
        errorDetails = error;
        errorMessage = (error as any).message || (error as any).error || errorMessage;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      console.error("❌ Error eliminando recordatorio:", {
        error,
        errorMessage,
        errorDetails,
        reminderId,
        reminderIdStr: String(reminderId),
        vehicleRemindersCount: vehicleReminders.length,
      });
      
      toast.error("Error al eliminar recordatorio", {
        description: errorMessage,
      });
      
      // No relanzar el error para evitar que se propague y rompa la UI
      // El error ya se mostró al usuario con el toast
    }
  };

  const handleToggleReminderActive = async (reminderId: number | string, isActive: boolean, loadVehicle?: () => Promise<unknown>) => {
    const reminderIdStr = String(reminderId);
    const newActiveState = !isActive;
    
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(reminderIdStr)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            isActive: newActiveState,
          },
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          const errorText = await response.text();
          errorData = errorText ? JSON.parse(errorText) : { error: "Error desconocido" };
        } catch {
          errorData = { error: `Error ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const { data } = (await response.json()) as { data: FleetReminder };
      
      const isMaintenanceReminder = data.title.toLowerCase().includes("mantenimiento") || 
                                    data.title === "Mantenimiento completo del vehículo";
      
      // Si es un recordatorio de mantenimiento y está activo, actualizar nextMaintenanceDate
      if (isMaintenanceReminder && newActiveState && vehicleId) {
        try {
          const maintenanceDate = data.reminderType === "recurring" 
            ? data.nextTrigger 
            : data.scheduledDate;
          await fetch(`/api/fleet/${vehicleId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: {
                nextMaintenanceDate: maintenanceDate,
              },
            }),
          });
          if (loadVehicle) {
            await loadVehicle();
          }
        } catch (error) {
          console.error("Error actualizando fecha de mantenimiento del vehículo:", error);
        }
      }
      
      setVehicleReminders((prev) => {
        return prev.map((r) => {
          const matchesById = r.id && data.id && r.id === data.id;
          const matchesByDocumentId = r.documentId && data.documentId && r.documentId === data.documentId;
          const matchesByReminderId = String(r.id) === reminderIdStr || r.documentId === reminderIdStr;
          
          if (matchesById || matchesByDocumentId || matchesByReminderId) {
            return { ...data };
          }
          return r;
        });
      });
      
      emitReminderToggleActive(reminderId, newActiveState);
      
      toast.success(newActiveState ? "Recordatorio activado" : "Recordatorio desactivado", {
        description: `El recordatorio ha sido ${newActiveState ? "activado" : "desactivado"} correctamente`,
      });
    } catch (error) {
      console.error("❌ Error cambiando estado del recordatorio:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al cambiar estado", {
        description: errorMessage,
      });
      throw error;
    }
  };

  const handleToggleReminderCompleted = async (reminderId: number | string, isCompleted: boolean, loadVehicle?: () => Promise<unknown>) => {
    const reminderIdStr = String(reminderId);
    const newCompletedState = !isCompleted;
    
    // Validar que tenemos un ID válido
    if (!reminderIdStr || reminderIdStr === 'null' || reminderIdStr === 'undefined') {
      console.error("❌ ID de recordatorio inválido:", reminderIdStr);
      toast.error("Error al cambiar estado", {
        description: "No se pudo identificar el recordatorio. Por favor, recarga la página.",
      });
      return;
    }
    
    try {
      // Log para depuración
      if (process.env.NODE_ENV === 'development') {
        console.log("🔄 Actualizando estado de completado del recordatorio:", {
          reminderId: reminderIdStr,
          isCompleted,
          newCompletedState,
        });
      }

      let response: Response;
      try {
        response = await fetch(`/api/notifications/${encodeURIComponent(reminderIdStr)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: {
              isCompleted: newCompletedState,
            },
          }),
        });
      } catch (fetchError) {
        // Error de red o conexión
        const networkError = fetchError instanceof Error 
          ? fetchError.message 
          : "Error de conexión. Verifica tu conexión a internet.";
        throw new Error(`Error de red: ${networkError}`);
      }

      if (!response.ok) {
        let errorData: any = null;
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              errorData = JSON.parse(errorText);
              // Intentar obtener el mensaje de error de diferentes formas
              errorMessage = errorData.error?.message || 
                           errorData.message || 
                           errorData.error || 
                           errorText || 
                           errorMessage;
            } catch {
              // Si no es JSON, usar el texto directamente
              errorMessage = errorText || errorMessage;
            }
          }
        } catch (parseError) {
          console.error("Error parseando respuesta de error:", parseError);
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }

        // Si es un error 404, NO recargar la lista automáticamente porque puede causar que el recordatorio desaparezca
        // En su lugar, solo mostrar el error y dejar que el usuario decida si quiere recargar
        if (response.status === 404) {
          console.warn("⚠️ Recordatorio no encontrado (404). No se recargará la lista automáticamente para evitar pérdida de datos.");
          // NO llamar a loadVehicleReminders() aquí porque puede eliminar el recordatorio de la UI
        }

        throw new Error(errorMessage);
      }

      let responseData: any;
      try {
        const responseText = await response.text();
        if (!responseText) {
          throw new Error("Respuesta vacía del servidor");
        }
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Error parseando respuesta del servidor: ${parseError instanceof Error ? parseError.message : 'Error desconocido'}`);
      }

      const data = responseData?.data as FleetReminder;
      
      if (!data) {
        throw new Error("No se recibieron datos del servidor en la respuesta");
      }
      
      setVehicleReminders((prev) => {
        return prev.map((r) => {
          const matchesById = r.id && data.id && r.id === data.id;
          const matchesByDocumentId = r.documentId && data.documentId && r.documentId === data.documentId;
          const matchesByReminderId = String(r.id) === reminderIdStr || r.documentId === reminderIdStr;
          
          if (matchesById || matchesByDocumentId || matchesByReminderId) {
            return { ...data };
          }
          return r;
        });
      });
      
      emitReminderToggleCompleted(reminderId, newCompletedState);
      
      toast.success(newCompletedState ? "Recordatorio marcado como completado" : "Recordatorio marcado como pendiente", {
        description: `El recordatorio ha sido ${newCompletedState ? "marcado como completado" : "marcado como pendiente"} correctamente`,
      });
    } catch (error) {
      // Mejorar el manejo de errores para obtener información útil
      let errorMessage = "Error desconocido";
      let errorDetails: any = {};
      
      // Verificar si el error es realmente un objeto vacío
      const isErrorEmpty = error !== null && 
                          typeof error === 'object' && 
                          Object.keys(error).length === 0;
      
      if (error instanceof Error) {
        errorMessage = error.message || "Error desconocido";
        errorDetails = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      } else if (typeof error === 'object' && error !== null) {
        // Si es un objeto, intentar extraer información
        errorDetails = error;
        
        // Verificar si tiene propiedades
        const errorKeys = Object.keys(error);
        if (errorKeys.length > 0) {
          // Intentar obtener mensaje de diferentes propiedades
          if ('message' in error && typeof error.message === 'string') {
            errorMessage = error.message;
          } else if ('error' in error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (typeof error.error === 'object' && error.error !== null && 'message' in error.error) {
              errorMessage = String(error.error.message);
            }
          } else {
            // Intentar convertir el objeto a string
            try {
              errorMessage = JSON.stringify(error);
            } catch {
              errorMessage = `Error al actualizar recordatorio (ID: ${reminderIdStr})`;
            }
          }
        } else {
          // Objeto vacío - crear mensaje descriptivo
          errorMessage = `Error al actualizar recordatorio (ID: ${reminderIdStr}). La respuesta del servidor fue vacía.`;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (isErrorEmpty) {
        errorMessage = `Error al actualizar recordatorio (ID: ${reminderIdStr}). El servidor devolvió un error vacío.`;
      }
      
      // Asegurar que siempre tengamos un mensaje de error válido
      if (!errorMessage || errorMessage === "Error desconocido") {
        errorMessage = `Error al actualizar recordatorio (ID: ${reminderIdStr}). Por favor, intenta nuevamente o recarga la página.`;
      }
      
      // Log detallado para depuración - SIEMPRE mostrar información útil
      // Primero mostrar el mensaje de error de forma clara
      console.error(`❌ Error cambiando estado de completado del recordatorio (ID: ${reminderIdStr}):`, errorMessage);
      
      // Luego mostrar información detallada si está disponible
      const logInfo: any = {
        reminderId: reminderIdStr,
        isCompleted,
        newCompletedState,
        errorType: typeof error,
        isErrorEmpty,
        errorMessage,
      };
      
      // Agregar información adicional solo si está disponible
      if (errorDetails && Object.keys(errorDetails).length > 0) {
        logInfo.errorDetails = errorDetails;
      }
      
      if (error !== null && typeof error === 'object') {
        try {
          const errorStr = JSON.stringify(error);
          if (errorStr !== '{}') {
            logInfo.errorJSON = errorStr;
          } else {
            logInfo.errorJSON = "(objeto vacío)";
          }
        } catch {
          logInfo.errorJSON = "(error al serializar)";
        }
      }
      
      // SIEMPRE mostrar el error original al final para depuración
      logInfo.originalError = error;
      
      console.error("❌ Detalles del error:", logInfo);
      
      // Mensajes más específicos según el tipo de error
      let userMessage = errorMessage;
      if (errorMessage.includes("no encontrada") || errorMessage.includes("eliminada") || errorMessage.includes("404")) {
        userMessage = "El recordatorio no se encontró. Puede haber sido eliminado o el ID es inválido.";
        // NO recargar automáticamente para evitar que desaparezcan recordatorios válidos
        // El usuario puede recargar manualmente si es necesario
      } else if (errorMessage.includes("Error desconocido")) {
        userMessage = `No se pudo actualizar el recordatorio. Por favor, intenta nuevamente.`;
      }
      
      toast.error("Error al cambiar estado", {
        description: userMessage,
      });
      
      // No lanzar el error para evitar que se propague y rompa la UI
      // throw error;
    }
  };

  const handleEditReminder = (reminder: FleetReminder) => {
    if (!reminder) {
      console.error("❌ No se recibió el recordatorio");
      return;
    }
    
    const reminderId = reminder.documentId || String(reminder.id);
    
    const formatDateLocal = (dateString: string): string => {
      if (!dateString) return "";
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      
      return `${year}-${month}-${day}`;
    };
    
    const formatTimeLocal = (dateString: string): string => {
      if (!dateString) return "";
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      
      return `${hours}:${minutes}`;
    };
    
    const title = reminder.title || "";
    const description = reminder.description || "";
    const type = (reminder.reminderType || "unique") as ReminderType;
    const scheduledDateValue = formatDateLocal(reminder.scheduledDate);
    const scheduledTimeValue = formatTimeLocal(reminder.scheduledDate);
    const allDayValue = scheduledTimeValue === "00:00";
    const recurrencePattern = (reminder.recurrencePattern || "daily") as RecurrencePattern;
    const recurrenceEndDate = formatDateLocal(reminder.recurrenceEndDate || "");
    
    const userIds = reminder.assignedUsers?.map((u) => {
      if (u.id) return u.id;
      if (u.documentId && availableUsers.length > 0) {
        const foundUser = availableUsers.find(au => au.documentId === u.documentId);
        if (foundUser?.id) return foundUser.id;
      }
      return null;
    }).filter((id): id is number => id !== null) || [];
    
    // Separar en responsables y conductores basándose en el vehículo
    // Por ahora, asignamos todos a responsables (se puede mejorar después con lógica más específica)
    // TODO: Mejorar esta lógica para distinguir entre responsables y conductores del vehículo
    setEditingReminderId(reminderId);
    setReminderTitle(title);
    setReminderDescription(description);
    setReminderType(type);
    setReminderScheduledDate(scheduledDateValue);
    setReminderScheduledTime(scheduledTimeValue);
    setIsAllDay(allDayValue);
    setReminderRecurrencePattern(recurrencePattern);
    setReminderRecurrenceEndDate(recurrenceEndDate);
    // Por ahora, asignamos todos a responsables. Se puede mejorar con lógica del vehículo
    setSelectedResponsables(userIds);
    setSelectedAssignedDrivers([]);
    setShowReminderForm(true);
  };

  useEffect(() => {
    loadVehicleReminders();
    loadAvailableUsers();
  }, [loadVehicleReminders, loadAvailableUsers]);

  useEffect(() => {
    if (editingReminderId && availableUsers.length > 0) {
      const reminder = vehicleReminders.find(
        r => (r.documentId || String(r.id)) === editingReminderId
      );
      
      if (reminder?.assignedUsers && reminder.assignedUsers.length > 0) {
        const userIds = reminder.assignedUsers.map((u) => {
          if (u.id) return u.id;
          if (u.documentId) {
            const foundUser = availableUsers.find(au => au.documentId === u.documentId);
            if (foundUser?.id) return foundUser.id;
          }
          return null;
        }).filter((id): id is number => id !== null);
        
        // Por ahora, asignamos todos a responsables. Se puede mejorar con lógica del vehículo
        setSelectedResponsables(userIds);
        setSelectedAssignedDrivers([]);
      }
    }
  }, [availableUsers, editingReminderId, vehicleReminders]);

  return {
    vehicleReminders,
    isLoadingReminders,
    isSavingReminder,
    reminderTitle,
    reminderDescription,
    reminderType,
    reminderScheduledDate,
    reminderScheduledTime,
    isAllDay,
    reminderRecurrencePattern,
    reminderRecurrenceEndDate,
    selectedResponsables,
    selectedAssignedDrivers,
    showReminderForm,
    editingReminderId,
    availableUsers,
    isLoadingUsers,
    setReminderTitle,
    setReminderDescription,
    setReminderType,
    setReminderScheduledDate,
    setReminderScheduledTime,
    setIsAllDay,
    setReminderRecurrencePattern,
    setReminderRecurrenceEndDate,
    setSelectedResponsables,
    setSelectedAssignedDrivers,
    loadVehicleReminders,
    loadAvailableUsers,
    handleSaveReminder,
    handleEditReminder,
    handleDeleteReminder,
    handleToggleReminderActive,
    handleToggleReminderCompleted,
    handleOpenReminderForm,
    handleCancelReminderForm,
    setVehicleReminders,
  };
}

