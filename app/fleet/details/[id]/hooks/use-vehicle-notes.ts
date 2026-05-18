import { useCallback, useState, useEffect } from "react";
import { toast } from "@/lib/toast";
import type { FleetNote } from "@/components/ui/notes-timeline";

interface UseVehicleNotesReturn {
  notes: FleetNote[];
  isLoadingNotes: boolean;
  isSavingNote: boolean;
  note: string;
  showNoteForm: boolean;
  setNote: (note: string) => void;
  loadNotes: () => Promise<void>;
  handleSaveNote: (currentUserDocumentId: string | null, loadCurrentUserProfile: () => Promise<void>) => Promise<void>;
  handleEditNote: (noteId: number | string, editContent: string) => Promise<void>;
  handleDeleteNote: (noteId: number | string) => Promise<void>;
  handleOpenNoteForm: () => void;
  handleCancelNoteForm: () => void;
  setNotes: React.Dispatch<React.SetStateAction<FleetNote[]>>;
}

export function useVehicleNotes(vehicleId: string): UseVehicleNotesReturn {
  const [notes, setNotes] = useState<FleetNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [note, setNote] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);

  const handleOpenNoteForm = () => setShowNoteForm(true);
  
  const handleCancelNoteForm = () => {
    setShowNoteForm(false);
    setNote("");
  };

  const loadNotes = useCallback(async () => {
    setIsLoadingNotes(true);
    try {
      const response = await fetch(`/api/fleet/${vehicleId}/notes`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No pudimos obtener las notas");
      }
      const { data } = (await response.json()) as { data: FleetNote[] };
      setNotes(data || []);
    } catch (error) {
      console.error("Error cargando notas:", error);
    } finally {
      setIsLoadingNotes(false);
    }
  }, [vehicleId]);

  const handleSaveNote = async (currentUserDocumentId: string | null, loadCurrentUserProfile: () => Promise<void>) => {
    if (!note.trim()) return;
    
    if (!currentUserDocumentId) {
      console.warn("⚠️ No hay currentUserDocumentId, intentando cargarlo...");
      await loadCurrentUserProfile();
    }
    
    setIsSavingNote(true);
    try {
      const requestBody: { data: { content: string; authorDocumentId?: string } } = {
        data: {
          content: note.trim(),
        },
      };
      
      if (currentUserDocumentId) {
        requestBody.data.authorDocumentId = currentUserDocumentId;
        console.log("📤 Enviando nota con authorDocumentId:", currentUserDocumentId);
      } else {
        console.log("📤 Enviando nota sin authorDocumentId (el backend lo obtendrá)");
      }
      
      const response = await fetch(`/api/fleet/${vehicleId}/notes`, {
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
        
        let errorMsg = `Error ${response.status}: ${response.statusText}`;
        if (errorData?.error) {
          errorMsg = typeof errorData.error === "string" 
            ? errorData.error 
            : errorData.error.message || errorMsg;
        } else if (errorData?.message) {
          errorMsg = errorData.message;
        }
        
        throw new Error(errorMsg);
      }

      const { data } = (await response.json()) as { data: FleetNote };
      setNotes((prev) => [data, ...prev]);
      setNote("");
      setShowNoteForm(false);
      
      toast.success("Nota guardada con éxito", {
        description: "Tu comentario ha sido agregado al timeline",
      });
    } catch (error) {
      console.error("Error guardando nota:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al guardar nota", {
        description: errorMessage,
      });
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleEditNote = async (noteId: number | string, editContent: string) => {
    try {
      const noteIdStr = String(noteId);
      const url = `/api/fleet-notes/${encodeURIComponent(noteIdStr)}`;
      
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            content: editContent,
            vehicleId: vehicleId,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = errorText ? JSON.parse(errorText) : null;
        } catch {
          errorData = null;
        }
        
        const errorMessage = errorData?.error || 
                            errorText || 
                            `Error ${response.status}: ${response.statusText}`;
        
        throw new Error(errorMessage);
      }

      const { data } = (await response.json()) as { data: FleetNote };
      setNotes((prev) => prev.map((n) => (n.id === data.id || n.documentId === data.documentId ? data : n)));
      toast.success("Nota actualizada", {
        description: "Tu comentario ha sido actualizado",
      });
    } catch (error) {
      console.error("Error editando nota:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al actualizar nota", {
        description: errorMessage,
      });
      throw error;
    }
  };

  const handleDeleteNote = async (noteId: number | string) => {
    try {
      const noteIdStr = String(noteId);
      const response = await fetch(`/api/fleet-notes/${encodeURIComponent(noteIdStr)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      setNotes((prev) => prev.filter((n) => n.id !== noteId && n.documentId !== noteId));
      toast.success("Nota eliminada", {
        description: "El comentario ha sido eliminado",
      });
    } catch (error) {
      console.error("Error eliminando nota:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al eliminar nota", {
        description: errorMessage,
      });
      throw error;
    }
  };

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  return {
    notes,
    isLoadingNotes,
    isSavingNote,
    note,
    showNoteForm,
    setNote,
    loadNotes,
    handleSaveNote,
    handleEditNote,
    handleDeleteNote,
    handleOpenNoteForm,
    handleCancelNoteForm,
    setNotes,
  };
}

