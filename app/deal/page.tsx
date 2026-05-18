"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components_shadcn/ui/separator";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { 
  MoreVertical, 
  Plus, 
  Upload, 
  Bell, 
  Eye, 
  Archive, 
  CheckCircle,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import { spacing, typography, commonClasses } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import { CreateDealDialog, UploadContractDialog, CreateDealFormData } from "./components/deal-dialogs";
import { toast } from "@/lib/toast";
import type { DealCard, DealStatus } from "@/validations/types";

const createInitialFormData = (): CreateDealFormData => ({
  title: "",
  type: "conduccion",
  price: "",
  paymentAgreement: "semanal",
  summary: "",
});

const getStatusBadge = (status: DealStatus) => {
  switch (status) {
    case "pendiente":
      return (
        <Badge className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
          Pendiente de Firma
        </Badge>
      );
    case "firmado":
      return (
        <Badge className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Firmado
        </Badge>
      );
    case "archivado":
      return (
        <Badge className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800">
          Archivado
        </Badge>
      );
  }
};

const getActionButton = (status: DealStatus) => {
  switch (status) {
    case "pendiente":
      return (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 rounded-lg bg-muted hover:bg-muted/80"
        >
          <Bell className="h-4 w-4" />
          Enviar Recordatorio
        </Button>
      );
    case "firmado":
      return (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 rounded-lg bg-muted hover:bg-muted/80"
        >
          <Eye className="h-4 w-4" />
          Ver Contrato
        </Button>
      );
    case "archivado":
      return (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 rounded-lg bg-muted hover:bg-muted/80"
        >
          <Archive className="h-4 w-4" />
          Desarchivar
        </Button>
      );
  }
};

const getDateLabel = (deal: DealCard): string => {
  if (deal.status === "firmado" && deal.signedAt) {
    return `Firmado: ${deal.signedAtLabel}`;
  }
  if (deal.status === "archivado" && deal.signedAt) {
    return `Archivado: ${deal.signedAtLabel}`;
  }
  if (deal.generatedAt) {
    return `Generado: ${deal.generatedAtLabel}`;
  }
  return "";
};

const DealCardSkeleton = () => (
  <Card className={commonClasses.card}>
    <CardContent className={`flex flex-col ${spacing.gap.base} ${spacing.card.padding}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-10 w-10 rounded" />
          <Skeleton className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
    </CardContent>
  </Card>
);

export default function DealPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [deals, setDeals] = useState<DealCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para el modal de crear contrato
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateDealFormData>(() => createInitialFormData());

  // Estados para el modal de subir contrato
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadDeals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/deal");
      if (!response.ok) {
        throw new Error("Error al cargar los contratos");
      }
      const result = await response.json();
      setDeals(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  const filteredDeals = deals.filter((deal) => {
    const query = searchQuery.toLowerCase();
    return (
      (deal.clientName?.toLowerCase().includes(query) ?? false) ||
      (deal.typeLabel?.toLowerCase().includes(query) ?? false) ||
      (deal.contractTypeName?.toLowerCase().includes(query) ?? false) ||
      (deal.vehicleName?.toLowerCase().includes(query) ?? false) ||
      (deal.vehiclePlaca?.toLowerCase().includes(query) ?? false)
    );
  });

  // Validar formulario de crear contrato
  const isFormValid = useMemo(() => {
    return formData.type !== null && formData.type !== undefined;
  }, [formData]);

  const resetForm = () => {
    setFormData(createInitialFormData());
  };

  const handleCreateDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleCancelCreateDialog = () => {
    setIsCreateDialogOpen(false);
    resetForm();
  };

  const handleCreateDeal = async () => {
    setIsCreating(true);
    try {
      const payload: Record<string, unknown> = {
        status: "pendiente",
        paymentAgreement: formData.paymentAgreement,
        generatedAt: new Date().toISOString().split("T")[0],
      };

      if (formData.title.trim()) {
        payload.title = formData.title.trim();
      }
      if (formData.price.trim()) {
        const price = parseFloat(formData.price);
        if (!isNaN(price) && price >= 0) {
          payload.price = price;
        }
      }
      if (formData.summary.trim()) {
        payload.summary = formData.summary.trim();
      }

      const response = await fetch("/api/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo crear el contrato");
      }

      const { data } = await response.json();
      toast.success("Contrato generado exitosamente");
      setIsCreateDialogOpen(false);
      resetForm();
      await loadDeals();
      router.push(`/deal/details/${data.documentId ?? data.id}`);
    } catch (err) {
      console.error("Error creating deal:", err);
      toast.error(err instanceof Error ? err.message : "No se pudo crear el contrato");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadDialogOpenChange = (open: boolean) => {
    setIsUploadDialogOpen(open);
    if (!open) {
      setSelectedFile(null);
    }
  };

  const handleCancelUploadDialog = () => {
    setIsUploadDialogOpen(false);
    setSelectedFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño (máximo 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error("El archivo es demasiado grande. El tamaño máximo es 10MB.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadContract = async () => {
    if (!selectedFile) {
      toast.error("Selecciona un archivo para subir");
      return;
    }

    setIsUploading(true);
    try {
      // Primero subir el archivo
      const uploadForm = new FormData();
      uploadForm.append("files", selectedFile);
      
      const uploadResponse = await fetch("/api/strapi/upload", {
        method: "POST",
        body: uploadForm,
      });

      if (!uploadResponse.ok) {
        throw new Error("No se pudo subir el archivo");
      }

      // Crear un contrato con el archivo subido
      const payload = {
        status: "firmado" as const,
        title: selectedFile.name.replace(/\.[^/.]+$/, ""),
        signedAt: new Date().toISOString().split("T")[0],
      };

      const response = await fetch("/api/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      if (!response.ok) {
        throw new Error("No se pudo crear el registro del contrato");
      }

      toast.success("Contrato subido exitosamente");
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      await loadDeals();
    } catch (err) {
      console.error("Error uploading contract:", err);
      toast.error(err instanceof Error ? err.message : "No se pudo subir el contrato");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Estás seguro de que deseas eliminar este contrato?")) {
      return;
    }
    try {
      const response = await fetch(`/api/deal/${dealId}`, { method: "DELETE" });
      if (response.ok) {
        setDeals((prev) => prev.filter((d) => d.documentId !== dealId && d.id !== dealId));
        toast.success("Contrato eliminado exitosamente");
      }
    } catch (err) {
      console.error("Error deleting deal:", err);
      toast.error("No se pudo eliminar el contrato");
    }
  };

  return (
    <AdminLayout title="Gestión de Contratos" showFilterAction>
      {/* Botones de acción principal */}
      <section className={`flex ${spacing.gap.small}`}>
        <Button
          variant="default"
          className="flex-1 flex items-center justify-center gap-2"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Generar Contrato
        </Button>
        <Button
          variant="outline"
          className="flex-1 flex items-center justify-center gap-2"
          onClick={() => setIsUploadDialogOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Subir Contrato
        </Button>
      </section>

      {/* Barra de búsqueda */}
      <section>
        <SearchInput
          variant="muted"
          placeholder="Buscar por cliente, vehículo, matrícula..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </section>

      <Separator />

      {/* Estado de error */}
      {error && (
        <section className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </section>
      )}

      {/* Lista de Contratos */}
      <section className={`flex flex-col ${spacing.gap.base} pb-24`}>
        {isLoading ? (
          <>
            <DealCardSkeleton />
            <DealCardSkeleton />
            <DealCardSkeleton />
          </>
        ) : filteredDeals.length === 0 ? (
          <Card className={commonClasses.card}>
            <CardContent className={`flex flex-col items-center justify-center ${spacing.card.padding} py-12`}>
              <p className={`${typography.body.large} text-muted-foreground`}>
                {searchQuery ? "No se encontraron contratos" : "No hay contratos registrados"}
              </p>
              <p className={`${typography.body.small} text-muted-foreground mt-1`}>
                {searchQuery ? "Intenta con otra búsqueda" : "Crea un nuevo contrato para comenzar"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDeals.map((deal) => (
            <Card
              key={deal.documentId}
              className={`${commonClasses.card} cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted`}
              onClick={() => router.push(`/deal/details/${deal.documentId}`)}
            >
              <CardContent className={`flex flex-col ${spacing.gap.base} ${spacing.card.padding}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className={`${typography.body.large} font-bold`}>
                      {deal.contractTypeName || deal.typeLabel || "Contrato"}
                    </p>
                    <p className={`${typography.body.small} mt-1 text-muted-foreground`}>
                      {deal.clientName ? `Cliente: ${deal.clientName}` : "Sin cliente asignado"}
                    </p>
                    {deal.vehicleName && (
                      <p className={`${typography.body.small} text-muted-foreground`}>
                        Vehículo: {deal.vehicleName} {deal.vehiclePlaca && `(${deal.vehiclePlaca})`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(deal.status)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-muted-foreground flex items-center justify-center"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/deal/details/${deal.documentId}`); }}>
                          Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Editar</DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive" 
                          onClick={(e) => handleDelete(deal.documentId, e)}
                        >
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`${typography.body.small} text-muted-foreground`}>
                    {getDateLabel(deal)}
                  </p>
                  <div onClick={(e) => e.stopPropagation()}>
                    {getActionButton(deal.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* Modal para crear contrato */}
      <CreateDealDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        formData={formData}
        setFormData={setFormData}
        isCreating={isCreating}
        isFormValid={isFormValid}
        onConfirm={handleCreateDeal}
        onCancel={handleCancelCreateDialog}
      />

      {/* Modal para subir contrato */}
      <UploadContractDialog
        isOpen={isUploadDialogOpen}
        onOpenChange={handleUploadDialogOpenChange}
        selectedFile={selectedFile}
        onFileChange={handleFileChange}
        isUploading={isUploading}
        onConfirm={handleUploadContract}
        onCancel={handleCancelUploadDialog}
      />
    </AdminLayout>
  );
}
