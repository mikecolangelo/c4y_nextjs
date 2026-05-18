"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components_shadcn/ui/card";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Alert, AlertDescription } from "@/components_shadcn/ui/alert";
import { Badge } from "@/components_shadcn/ui/badge";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import { AdminLayout } from "@/components/admin/admin-layout";
import { typography, spacing } from "@/lib/design-system";
import { 
  migrateDriverAssignments, 
  migrateVehicleRegistrations,
  fetchMigrationData,
  generateAssignmentsReport,
  type VehicleAssignment,
  type VehicleRegistration,
} from "@/lib/migrations/setup-driver-data";
import { Car, User, ArrowRightLeft, Database, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function MigrationPage() {
  const [strapiUrl, setStrapiUrl] = useState("http://localhost:1337");
  const [apiToken, setApiToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"config" | "review" | "migrating" | "done">("config");
  
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<number>>(new Set());
  
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const config = { strapiUrl, apiToken };
      const data = await fetchMigrationData(config);
      
      setVehicles(data.vehicles);
      setUsers(data.users);
      
      // Generar asignaciones sugeridas
      const suggested = generateAssignmentsReport(data.vehicles);
      setAssignments(suggested);
      
      // Seleccionar todas por defecto
      setSelectedAssignments(new Set(suggested.map((_, i) => i)));
      
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  const executeMigration = async () => {
    setLoading(true);
    setStep("migrating");
    setError(null);
    
    try {
      const config = { strapiUrl, apiToken };
      
      // Filtrar solo las asignaciones seleccionadas
      const toMigrate = assignments.filter((_, i) => selectedAssignments.has(i));
      
      const result = await migrateDriverAssignments(config, toMigrate);
      
      setResults(result);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en migración");
      setStep("review");
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignment = (index: number) => {
    const newSelected = new Set(selectedAssignments);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedAssignments(newSelected);
  };

  const toggleAll = () => {
    if (selectedAssignments.size === assignments.length) {
      setSelectedAssignments(new Set());
    } else {
      setSelectedAssignments(new Set(assignments.map((_, i) => i)));
    }
  };

  return (
    <AdminLayout title="Migración de Datos de Conductores">
      <section className={`flex flex-col ${spacing.gap.large}`}>
        {step === "config" && (
          <Card>
            <CardHeader>
              <CardTitle className={typography.h3}>Configuración de Migración</CardTitle>
              <CardDescription>
                Conecta con Strapi para migrar los datos de conductores existentes al nuevo sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label>URL de Strapi</Label>
                <Input 
                  value={strapiUrl} 
                  onChange={(e) => setStrapiUrl(e.target.value)}
                  placeholder="http://localhost:1337"
                />
              </div>
              
              <div className="space-y-2">
                <Label>API Token</Label>
                <Input 
                  type="password"
                  value={apiToken} 
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Tu API Token de Strapi"
                />
                <p className="text-sm text-muted-foreground">
                  El token necesita permisos para leer/escribir en fleet, driver-history y user-profiles.
                </p>
              </div>

              <Button 
                onClick={loadData} 
                disabled={loading || !strapiUrl || !apiToken}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Cargar Datos
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "review" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className={typography.h3}>Revisar Asignaciones</CardTitle>
                <CardDescription>
                  Se encontraron {vehicles.length} vehículos y {users.length} usuarios. 
                  {assignments.length} asignaciones sugeridas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Checkbox 
                    checked={selectedAssignments.size === assignments.length}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-sm font-medium">
                    Seleccionar todas ({selectedAssignments.size} de {assignments.length})
                  </span>
                </div>

                <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                  {assignments.map((assignment, index) => {
                    const vehicle = vehicles.find(v => 
                      (v.documentId || v.id) === assignment.vehicleId
                    );
                    const user = users.find(u => 
                      (u.documentId || u.id) === assignment.driverId
                    );
                    
                    return (
                      <div 
                        key={index} 
                        className="flex items-center gap-4 p-4 hover:bg-muted/50"
                      >
                        <Checkbox 
                          checked={selectedAssignments.has(index)}
                          onCheckedChange={() => toggleAssignment(index)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{vehicle?.name || assignment.vehicleId}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Asignado a
                            </span>
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{user?.displayName || assignment.driverId}</span>
                          </div>
                          {assignment.notes && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {assignment.notes}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">
                          {assignment.startDate}
                        </Badge>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => setStep("config")}>
                    Volver
                  </Button>
                  <Button 
                    onClick={executeMigration}
                    disabled={loading || selectedAssignments.size === 0}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Migrando...
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        Migrar {selectedAssignments.size} Asignaciones
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {step === "migrating" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className={typography.h4}>Ejecutando migración...</p>
              <p className="text-muted-foreground">Por favor no cierres esta página</p>
            </CardContent>
          </Card>
        )}

        {step === "done" && results && (
          <Card>
            <CardHeader>
              <CardTitle className={typography.h3}>Migración Completada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <div>
                  <p className={typography.body.large}>
                    {results.results.length} asignaciones migradas exitosamente
                  </p>
                  {results.errors.length > 0 && (
                    <p className="text-destructive">
                      {results.errors.length} errores
                    </p>
                  )}
                </div>
              </div>

              {results.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2">
                      {results.errors.map((err: string, i: number) => (
                        <li key={i} className="text-sm">{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("config")}>
                  Nueva Migración
                </Button>
                <Button onClick={() => window.location.href = "/users"}>
                  Ver Usuarios
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </AdminLayout>
  );
}
