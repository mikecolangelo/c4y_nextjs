/**
 * Helper functions for managing driver history
 */

export interface DriverHistoryEntry {
  id?: number;
  documentId?: string;
  driver: number | string;
  vehicle: number | string;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "suspended";
  notes?: string;
  mileageStart?: number;
  mileageEnd?: number;
}

/**
 * Assign a driver to a vehicle and create a history entry
 */
export async function assignDriverToVehicle(
  driverId: string | number,
  vehicleId: string | number,
  options?: {
    mileageStart?: number;
    notes?: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // First, close any existing active history entries for this vehicle
    const closeResponse = await fetch(`/api/driver-history?vehicle=${vehicleId}&status=active`);
    if (closeResponse.ok) {
      const { data: activeEntries } = await closeResponse.json();
      
      // Close each active entry
      for (const entry of activeEntries) {
        await fetch(`/api/driver-history/${entry.documentId || entry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: {
              status: "completed",
              endDate: new Date().toISOString().split("T")[0],
            },
          }),
        });
      }
    }

    // Normalizar IDs a numéricos para Strapi v5 (las relaciones en POST requieren ID numérico)
    const numericDriverId = typeof driverId === "number" ? driverId : Number(driverId);
    const numericVehicleId = typeof vehicleId === "number" ? vehicleId : Number(vehicleId);

    if (isNaN(numericDriverId) || isNaN(numericVehicleId)) {
      throw new Error("driverId y vehicleId deben ser IDs numéricos válidos.");
    }

    // Create new history entry
    const historyEntry: Partial<DriverHistoryEntry> = {
      driver: numericDriverId,
      vehicle: numericVehicleId,
      startDate: new Date().toISOString().split("T")[0],
      status: "active",
      mileageStart: options?.mileageStart,
      notes: options?.notes,
    };

    const response = await fetch("/api/driver-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: historyEntry }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error creating history entry");
    }

    const { data } = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error assigning driver:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Remove a driver from a vehicle (complete the history entry)
 */
export async function removeDriverFromVehicle(
  historyId: string | number,
  options?: {
    mileageEnd?: number;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/driver-history/${historyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          status: "completed",
          endDate: new Date().toISOString().split("T")[0],
          mileageEnd: options?.mileageEnd,
          notes: options?.notes,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error updating history entry");
    }

    return { success: true };
  } catch (error) {
    console.error("Error removing driver:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get driver history for a specific user
 */
export async function getDriverHistory(
  driverId: string | number
): Promise<{ success: boolean; data?: DriverHistoryEntry[]; error?: string }> {
  try {
    const response = await fetch(`/api/driver-history?driver=${driverId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error fetching history");
    }

    const { data } = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching driver history:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if a driver is currently assigned to a vehicle
 */
export async function isDriverCurrentlyAssigned(
  driverId: string | number
): Promise<{ assigned: boolean; vehicleId?: string | number }> {
  try {
    const response = await fetch(`/api/driver-history?driver=${driverId}&status=active`);
    
    if (!response.ok) {
      return { assigned: false };
    }

    const { data } = await response.json();
    if (data && data.length > 0) {
      return { assigned: true, vehicleId: data[0].vehicle };
    }

    return { assigned: false };
  } catch (error) {
    console.error("Error checking driver assignment:", error);
    return { assigned: false };
  }
}
