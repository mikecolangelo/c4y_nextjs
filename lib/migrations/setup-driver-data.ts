/**
 * Script de migración para configurar datos de conductores y vehículos
 * 
 * Este script ayuda a:
 * 1. Asignar vehículos existentes a conductores
 * 2. Crear entradas de historial para asignaciones actuales
 * 3. Marcar quién registró cada vehículo
 * 
 * Ejecutar desde la consola del navegador o como script Node
 */

export interface MigrationConfig {
  strapiUrl: string;
  apiToken: string;
}

export interface VehicleAssignment {
  vehicleId: string;
  driverId: string;
  startDate?: string;
  notes?: string;
}

export interface VehicleRegistration {
  vehicleId: string;
  registeredById: string;
}

/**
 * Migra asignaciones de conductores existentes al nuevo sistema de historial
 */
export async function migrateDriverAssignments(
  config: MigrationConfig,
  assignments: VehicleAssignment[]
): Promise<{ success: boolean; results: any[]; errors: string[] }> {
  const results: any[] = [];
  const errors: string[] = [];

  for (const assignment of assignments) {
    try {
      // 1. Crear entrada en driver-history
      const historyResponse = await fetch(`${config.strapiUrl}/api/driver-histories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiToken}`,
        },
        body: JSON.stringify({
          data: {
            driver: assignment.driverId,
            vehicle: assignment.vehicleId,
            startDate: assignment.startDate || new Date().toISOString().split("T")[0],
            status: "active",
            notes: assignment.notes || "Migración inicial",
          },
        }),
      });

      if (!historyResponse.ok) {
        const errorText = await historyResponse.text();
        throw new Error(`Error creando historial: ${errorText}`);
      }

      const historyData = await historyResponse.json();

      // 2. Actualizar el vehículo para agregarlo a currentDrivers
      const updateResponse = await fetch(`${config.strapiUrl}/api/fleets/${assignment.vehicleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiToken}`,
        },
        body: JSON.stringify({
          data: {
            currentDrivers: {
              connect: [assignment.driverId],
            },
          },
        }),
      });

      if (!updateResponse.ok) {
        console.warn(`Advertencia: No se pudo actualizar currentDrivers para vehículo ${assignment.vehicleId}`);
      }

      results.push({
        vehicleId: assignment.vehicleId,
        driverId: assignment.driverId,
        historyId: historyData.data?.id,
        status: "success",
      });

      console.log(`✅ Vehículo ${assignment.vehicleId} asignado a conductor ${assignment.driverId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error desconocido";
      errors.push(`Vehículo ${assignment.vehicleId}: ${errorMsg}`);
      console.error(`❌ Error con vehículo ${assignment.vehicleId}:`, errorMsg);
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors,
  };
}

/**
 * Asigna quién registró cada vehículo
 */
export async function migrateVehicleRegistrations(
  config: MigrationConfig,
  registrations: VehicleRegistration[]
): Promise<{ success: boolean; results: any[]; errors: string[] }> {
  const results: any[] = [];
  const errors: string[] = [];

  for (const reg of registrations) {
    try {
      const response = await fetch(`${config.strapiUrl}/api/fleets/${reg.vehicleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiToken}`,
        },
        body: JSON.stringify({
          data: {
            createdBy: reg.registeredById,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error actualizando vehículo: ${errorText}`);
      }

      results.push({
        vehicleId: reg.vehicleId,
        registeredById: reg.registeredById,
        status: "success",
      });

      console.log(`✅ Vehículo ${reg.vehicleId} marcado como registrado por ${reg.registeredById}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error desconocido";
      errors.push(`Vehículo ${reg.vehicleId}: ${errorMsg}`);
      console.error(`❌ Error con vehículo ${reg.vehicleId}:`, errorMsg);
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors,
  };
}

/**
 * Obtiene todos los vehículos y usuarios para facilitar la migración
 */
export async function fetchMigrationData(config: MigrationConfig): Promise<{
  vehicles: any[];
  users: any[];
}> {
  // Obtener vehículos
  const vehiclesResponse = await fetch(
    `${config.strapiUrl}/api/fleets?fields[0]=id&fields[1]=documentId&fields[2]=name&populate[currentDrivers][fields][0]=id&populate[currentDrivers][fields][1]=displayName`,
    {
      headers: {
        "Authorization": `Bearer ${config.apiToken}`,
      },
    }
  );

  const vehiclesData = await vehiclesResponse.json();

  // Obtener usuarios
  const usersResponse = await fetch(
    `${config.strapiUrl}/api/user-profiles?fields[0]=id&fields[1]=documentId&fields[2]=displayName&fields[3]=role`,
    {
      headers: {
        "Authorization": `Bearer ${config.apiToken}`,
      },
    }
  );

  const usersData = await usersResponse.json();

  return {
    vehicles: vehiclesData.data || [],
    users: usersData.data || [],
  };
}

/**
 * Genera un reporte de asignaciones actuales para revisión
 */
export function generateAssignmentsReport(vehicles: any[]): VehicleAssignment[] {
  const assignments: VehicleAssignment[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.currentDrivers && vehicle.currentDrivers.length > 0) {
      for (const driver of vehicle.currentDrivers) {
        assignments.push({
          vehicleId: vehicle.documentId || vehicle.id,
          driverId: driver.documentId || driver.id,
          startDate: new Date().toISOString().split("T")[0],
          notes: "Asignación existente - migración automática",
        });
      }
    }
  }

  return assignments;
}

// Ejemplo de uso desde consola del navegador:
/*
const config = {
  strapiUrl: "http://localhost:1337",
  apiToken: "tu-api-token-aqui"
};

// 1. Obtener datos actuales
const { vehicles, users } = await fetchMigrationData(config);
console.log("Vehículos:", vehicles);
console.log("Usuarios:", users);

// 2. Generar asignaciones desde currentDrivers existentes
const assignments = generateAssignmentsReport(vehicles);
console.log("Asignaciones a migrar:", assignments);

// 3. Ejecutar migración
const result = await migrateDriverAssignments(config, assignments);
console.log("Resultado:", result);
*/
