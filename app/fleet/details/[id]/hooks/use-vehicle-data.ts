import { useCallback, useState, useEffect } from "react";
import type { FleetVehicleCard } from "@/validations/types";

interface UseVehicleDataReturn {
  vehicleData: FleetVehicleCard | null;
  isLoading: boolean;
  errorMessage: string | null;
  setErrorMessage: (message: string | null) => void;
  loadVehicle: () => Promise<FleetVehicleCard | null>;
  setVehicleData: React.Dispatch<React.SetStateAction<FleetVehicleCard | null>>;
}

export function useVehicleData(vehicleId: string): UseVehicleDataReturn {
  const [vehicleData, setVehicleData] = useState<FleetVehicleCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadVehicle = useCallback(async () => {
    setIsLoading(true);
    try {
      // Agregar timestamp para evitar caché
      const timestamp = Date.now();
      const response = await fetch(`/api/fleet/${vehicleId}?t=${timestamp}`, { 
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!response.ok) {
        throw new Error("No pudimos obtener el vehículo");
      }
      const { data } = (await response.json()) as { data: FleetVehicleCard };
      
      if (process.env.NODE_ENV === 'development') {
        console.log("📥 Datos recibidos en loadVehicle:", {
          assignedDrivers: data.assignedDrivers,
          responsables: data.responsables,
          interestedDrivers: data.interestedDrivers,
          nextMaintenanceDate: data.nextMaintenanceDate,
          assignedDriversLength: data.assignedDrivers?.length || 0,
          responsablesLength: data.responsables?.length || 0,
          interestedDriversLength: data.interestedDrivers?.length || 0,
          hasAssignedDrivers: !!data.assignedDrivers,
          hasResponsables: !!data.responsables,
          hasInterestedDrivers: !!data.interestedDrivers,
        });
      }
      
      setVehicleData(data);
      setErrorMessage(null);
      return data;
    } catch (error) {
      console.error("Error cargando vehículo:", error);
      setErrorMessage("No pudimos obtener la información de este vehículo.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  return {
    vehicleData,
    isLoading,
    errorMessage,
    setErrorMessage,
    loadVehicle,
    setVehicleData,
  };
}

