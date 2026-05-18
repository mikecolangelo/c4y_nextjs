import { useCallback, useState, useEffect } from "react";

interface UseCurrentUserReturn {
  currentUserDocumentId: string | null;
  loadCurrentUserProfile: () => Promise<void>;
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [currentUserDocumentId, setCurrentUserDocumentId] = useState<string | null>(null);

  const loadCurrentUserProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/user-profile/me", { cache: "no-store" });
      if (response.ok) {
        const { data } = (await response.json()) as { data: { documentId?: string } };
        if (data?.documentId) {
          setCurrentUserDocumentId(data.documentId);
          console.log("✅ User-profile cargado, documentId:", data.documentId);
        } else {
          console.warn("⚠️ User-profile obtenido pero sin documentId:", data);
          setCurrentUserDocumentId(null);
        }
      } else {
        const errorText = await response.text();
        console.warn("⚠️ No se pudo obtener el user-profile del usuario actual:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        setCurrentUserDocumentId(null);
      }
    } catch (error) {
      console.error("❌ Error cargando user-profile:", error);
      setCurrentUserDocumentId(null);
    }
  }, []);

  useEffect(() => {
    loadCurrentUserProfile();
  }, [loadCurrentUserProfile]);

  return {
    currentUserDocumentId,
    loadCurrentUserProfile,
  };
}

