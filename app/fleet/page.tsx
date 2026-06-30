"use client";

import { Separator } from "@/components_shadcn/ui/separator";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/admin-layout";
import type { FleetVehicleCard, FleetVehicleCondition } from "@/validations/types";
import { toast } from "@/lib/toast";
import { FleetHeaderActions, FleetViewMode } from "./components/fleet-header-actions";
import { FleetFiltersSheet } from "./components/fleet-filters-sheet";
import { FleetVehiclesSection } from "./components/fleet-vehicles-section";
import {
  AddVehicleButton,
  CreateVehicleDialog,
  DeleteMultipleVehiclesDialog,
  DeleteVehicleDialog,
  CreateVehicleFormData,
} from "./components/fleet-dialogs";
import { compressImage } from "@/lib/image-compression";
import { usePaginatedSelection } from "@/hooks/use-paginated-selection";
import { useBatchDelete } from "@/hooks/use-batch-delete";

const conditions: FleetVehicleCondition[] = ["nuevo", "usado", "seminuevo"];

const createInitialFormData = (): CreateVehicleFormData => ({
  name: "",
  vin: "",
  price: "",
  condition: "nuevo",
  brand: "",
  model: "",
  year: "",
  color: "",
  currentMileage: "",
  oilChangeInterval: "",
  fuelType: "",
  transmission: "",
  imageAlt: "",
  placa: "",
});

export default function FleetPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<FleetVehicleCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [skeletonCount, setSkeletonCount] = useState(3);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<FleetVehicleCondition | null>(null);
  const [filterSelectedResponsables, setFilterSelectedResponsables] = useState<number[]>([]);
  const [filterSelectedDrivers, setFilterSelectedDrivers] = useState<number[]>([]);

  // Estados para paginación
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  // Estados para vista y filtros
  const [viewMode, setViewMode] = useState<FleetViewMode>("list");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Selección múltiple (patrón reutilizable)
  const selection = usePaginatedSelection();
  const selectedVehicles = selection.selectedIds;
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Estados para el diálogo de agregar vehículo
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateVehicleFormData>(() => createInitialFormData());
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [selectedResponsables, setSelectedResponsables] = useState<number[]>([]);
  const [selectedAssignedDrivers, setSelectedAssignedDrivers] = useState<number[]>([]);
  const [availableUsers, setAvailableUsers] = useState<
    Array<{
      id: number;
      documentId?: string;
      displayName?: string;
      email?: string;
      avatar?: { url?: string; alternativeText?: string };
    }>
  >([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Estados para el diálogo de eliminar vehículo
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<FleetVehicleCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para el diálogo de eliminar múltiples vehículos
  const [deleteMultipleDialogOpen, setDeleteMultipleDialogOpen] = useState(false);

  const normalizeUserSelection = useCallback(
    (values: Array<number | string>) =>
      values
        .map((value) => (typeof value === "number" ? value : Number(value)))
        .filter((id) => !isNaN(id)),
    []
  );

  const handleResponsablesChange = useCallback(
    (values: Array<number | string>) => {
      setSelectedResponsables(normalizeUserSelection(values));
    },
    [normalizeUserSelection]
  );

  const handleDriversChange = useCallback(
    (values: Array<number | string>) => {
      setSelectedAssignedDrivers(normalizeUserSelection(values));
    },
    [normalizeUserSelection]
  );

  const loadVehicles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/fleet", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Fleet request failed");
      }
      const { data } = (await response.json()) as { data?: FleetVehicleCard[] };
      setVehicles(Array.isArray(data) ? data : []);
      setErrorMessage(null);
    } catch (error) {
      console.error("Error loading fleet:", error);
      setErrorMessage("No pudimos cargar la flota. Intenta nuevamente.");
      setVehicles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  // Cargar usuarios disponibles cuando se abre el modal
  const loadAvailableUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch(`/api/user-profiles?excludeLeads=true`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No pudimos obtener los usuarios");
      }
      const { data } = (await response.json()) as {
        data: Array<{
          id: number;
          documentId?: string;
          displayName?: string;
          email?: string;
          role?: string;
          avatar?: { url?: string; alternativeText?: string };
        }>;
      };
      // Filtrar Leads: no pueden ser asignados como conductores o responsables de vehículos
      setAvailableUsers((data || []).filter((u) => u.role !== "lead"));
    } catch (error) {
      console.error("Error cargando usuarios:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (isDialogOpen) {
      loadAvailableUsers();
    }
  }, [isDialogOpen, loadAvailableUsers]);

  // Cargar usuarios cuando se abre el sheet de filtros
  useEffect(() => {
    if (isFilterSheetOpen) {
      loadAvailableUsers();
    }
  }, [isFilterSheetOpen, loadAvailableUsers]);

  // Calcular cantidad de skeletons según el tamaño de la pantalla
  useEffect(() => {
    const calculateSkeletonCount = () => {
      if (typeof window === "undefined") return;

      // Altura aproximada de cada tarjeta (incluyendo gap): ~120px en mobile, ~140px en desktop
      const cardHeight = window.innerWidth < 640 ? 120 : 140;
      const gap = 12; // spacing.gap.medium = 12px (gap-3)

      // Altura disponible aproximada (viewport height menos header, search, filtros, separadores)
      // Header: ~64px, Search: ~48px, Filtros: ~48px, Separador: ~1px, Padding: ~32px
      const reservedHeight = 64 + 48 + 48 + 1 + 32;
      const availableHeight = window.innerHeight - reservedHeight;

      // Calcular cuántas tarjetas caben
      const count = Math.max(Math.floor(availableHeight / (cardHeight + gap)), 3);
      setSkeletonCount(Math.min(count, 10)); // Máximo 10 skeletons
    };

    calculateSkeletonCount();
    window.addEventListener("resize", calculateSkeletonCount);
    return () => window.removeEventListener("resize", calculateSkeletonCount);
  }, []);

  const brands = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.brand))).sort(),
    [vehicles]
  );
  const models = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.model))).sort(),
    [vehicles]
  );
  const years = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.year))).sort((a, b) => b - a),
    [vehicles]
  );

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const matchesSearch =
        vehicle.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vehicle.vin?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBrand = !selectedBrand || vehicle.brand === selectedBrand;
      const matchesModel = !selectedModel || vehicle.model === selectedModel;
      const matchesYear = !selectedYear || vehicle.year === selectedYear;
      const matchesCondition = !selectedCondition || vehicle.condition === selectedCondition;
      const matchesResponsable =
        filterSelectedResponsables.length === 0 ||
        (vehicle.responsables &&
          vehicle.responsables.some(
            (r) =>
              filterSelectedResponsables.includes(r.id) ||
              filterSelectedResponsables.includes(Number(r.id))
          ));
      const matchesDriver =
        filterSelectedDrivers.length === 0 ||
        (vehicle.assignedDrivers &&
          vehicle.assignedDrivers.some(
            (d) =>
              filterSelectedDrivers.includes(d.id) || filterSelectedDrivers.includes(Number(d.id))
          ));
      return (
        matchesSearch &&
        matchesBrand &&
        matchesModel &&
        matchesYear &&
        matchesCondition &&
        matchesResponsable &&
        matchesDriver
      );
    });
  }, [
    vehicles,
    searchQuery,
    selectedBrand,
    selectedModel,
    selectedYear,
    selectedCondition,
    filterSelectedResponsables,
    filterSelectedDrivers,
  ]);

  // Calcular paginación
  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);
  const paginatedVehicles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredVehicles.slice(startIndex, endIndex);
  }, [filteredVehicles, currentPage, itemsPerPage]);

  // Resetear a página 1 cuando cambian los filtros o itemsPerPage
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    selectedBrand,
    selectedModel,
    selectedYear,
    selectedCondition,
    filterSelectedResponsables,
    filterSelectedDrivers,
    itemsPerPage,
  ]);

  const clearFilters = () => {
    setSelectedBrand(null);
    setSelectedModel(null);
    setSelectedYear(null);
    setSelectedCondition(null);
    setFilterSelectedResponsables([]);
    setFilterSelectedDrivers([]);
  };

  const activeFiltersCount =
    (selectedBrand ? 1 : 0) +
    (selectedModel ? 1 : 0) +
    (selectedYear ? 1 : 0) +
    (selectedCondition ? 1 : 0) +
    (filterSelectedResponsables.length > 0 ? 1 : 0) +
    (filterSelectedDrivers.length > 0 ? 1 : 0);
  const hasActiveFilters = activeFiltersCount > 0;

  // Validar si todos los campos requeridos están llenos
  const isFormValid = useMemo(() => {
    const year = Number(formData.year);
    const price = Number(formData.price);

    return (
      formData.name.trim() !== "" &&
      formData.vin.trim() !== "" &&
      formData.brand.trim() !== "" &&
      formData.model.trim() !== "" &&
      formData.year.trim() !== "" &&
      !isNaN(year) &&
      year >= 1900 &&
      year <= 2100 &&
      formData.price.trim() !== "" &&
      !isNaN(price) &&
      price > 0 &&
      formData.condition !== null &&
      formData.condition !== undefined
    );
  }, [formData]);

  const resetForm = () => {
    setFormData(createInitialFormData());
    setSelectedImageFile(null);
    setImagePreview(null);
    setSelectedResponsables([]);
    setSelectedAssignedDrivers([]);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleCancelCreateDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    setIsDeleting(true);
    try {
      const targetId = vehicleToDelete.documentId ?? vehicleToDelete.id;
      const response = await fetch(`/api/fleet/${targetId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("delete_failed");
      }
      toast.success("Vehículo eliminado exitosamente");
      setDeleteDialogOpen(false);
      setVehicleToDelete(null);
      await loadVehicles();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      toast.error("No pudimos eliminar el vehículo. Intenta nuevamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Stable id used for selection (mirrors the keys rendered by the views).
  const vehicleKey = (v: FleetVehicleCard) => v.documentId ?? v.id;
  const pageVehicleIds = useMemo(() => paginatedVehicles.map(vehicleKey), [paginatedVehicles]);
  const allFilteredVehicleIds = useMemo(() => filteredVehicles.map(vehicleKey), [filteredVehicles]);
  const vehicleBanner = selection.getAcrossPagesBanner(pageVehicleIds, allFilteredVehicleIds);

  const handleToggleVehicleSelection = (vehicleId: string) => {
    selection.toggle(vehicleId);
  };

  const toggleSelectMode = () => {
    setIsSelectMode((prev) => {
      if (prev) {
        selection.clearAll();
      }
      return !prev;
    });
  };

  const handleSelectAll = () => {
    // Toggle the current page: clear it if fully selected, otherwise union it in.
    if (selection.isCurrentPageAllSelected(pageVehicleIds)) {
      selection.clearCurrentPage(pageVehicleIds);
    } else {
      selection.selectCurrentPage(pageVehicleIds);
    }
  };

  const handleDeleteMultiple = () => {
    if (selectedVehicles.size === 0) return;
    setDeleteMultipleDialogOpen(true);
  };

  // Batch delete via shared hook: it owns isDeleting + success/partial/error toasts.
  // Transport deletes each vehicle individually; count fulfilled vs rejected.
  const { isDeleting: isBatchDeleting, runDelete: runBatchDelete } = useBatchDelete({
    deleteBatch: async (ids) => {
      const results = await Promise.allSettled(
        ids.map(async (vehicleId) => {
          const response = await fetch(`/api/fleet/${vehicleId}`, { method: "DELETE" });
          if (!response.ok) {
            throw new Error(`Error eliminando vehículo ${vehicleId}`);
          }
          return vehicleId;
        })
      );
      const deletedCount = results.filter((r) => r.status === "fulfilled").length;
      const failedCount = results.length - deletedCount;
      return { deletedCount, failedCount };
    },
    labels: { singular: "vehículo", plural: "vehículos" },
    onSuccess: () => {
      selection.clearAll();
      setIsSelectMode(false);
      setDeleteMultipleDialogOpen(false);
      loadVehicles();
    },
  });

  const handleConfirmDeleteMultiple = async () => {
    if (selectedVehicles.size === 0) return;
    await runBatchDelete(Array.from(selectedVehicles));
  };

  const handleDuplicateVehicle = async (vehicle: FleetVehicleCard) => {
    try {
      // Obtener los datos raw del vehículo para acceder al imageId
      const targetId = vehicle.documentId ?? vehicle.id;

      // Hacer una llamada a la API para obtener los datos raw con la imagen
      const vehicleResponse = await fetch(`/api/fleet/${targetId}?includeRaw=true`);
      if (!vehicleResponse.ok) {
        throw new Error("No se pudo obtener los datos del vehículo");
      }
      const vehicleData = (await vehicleResponse.json()) as { data?: any };

      // Generar un nuevo VIN único agregando un sufijo
      const timestamp = Date.now().toString().slice(-4);
      const newVin = `${vehicle.vin}-COPY-${timestamp}`;

      // Extraer el imageId del vehículo original si existe
      // La estructura puede ser: attributes.image.data.id o image.data.id dependiendo de cómo Strapi devuelva los datos
      let imageId: number | null = null;
      const rawData = vehicleData.data;
      if (rawData) {
        const attributes = rawData.attributes || rawData;
        const imageData = attributes.image;
        if (imageData) {
          if (imageData.data?.id) {
            imageId = imageData.data.id;
          } else if (imageData.id) {
            imageId = imageData.id;
          } else if (typeof imageData === "number") {
            imageId = imageData;
          }
        }
      }

      // Crear el payload con los datos del vehículo original
      const payload = {
        name: `${vehicle.name} (Copia)`,
        vin: newVin,
        price: vehicle.priceNumber, // Usar priceNumber en lugar de price
        condition: vehicle.condition,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color || null,
        currentMileage: vehicle.currentMileage !== undefined ? vehicle.currentMileage : null,
        fuelType: vehicle.fuelType || null,
        transmission: vehicle.transmission || null,
        image: imageId,
        imageAlt: vehicle.imageAlt || null,
      };

      const response = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData?.error || "No se pudo duplicar el vehículo");
      }

      toast.success("Vehículo duplicado exitosamente");
      await loadVehicles();
    } catch (error) {
      console.error("Error duplicating vehicle:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No pudimos duplicar el vehículo. Intenta nuevamente.";
      toast.error(errorMessage);
    }
  };

  const handleNavigateToDetails = (vehicleId: string) => {
    router.push(`/fleet/details/${vehicleId}`);
  };

  const handleNavigateToEdit = (vehicleId: string) => {
    router.push(`/fleet/details/${vehicleId}?edit=true`);
  };

  const handleRequestDeleteVehicle = (vehicle: FleetVehicleCard) => {
    setVehicleToDelete(vehicle);
    setDeleteDialogOpen(true);
  };

  const handleCreateVehicle = async () => {
    // Validar campos requeridos
    if (
      !formData.name ||
      !formData.vin ||
      !formData.price ||
      !formData.brand ||
      !formData.model ||
      !formData.year
    ) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    // Validar año
    const year = Number(formData.year);
    if (isNaN(year) || year < 1900 || year > 2100) {
      toast.error("El año debe estar entre 1900 y 2100");
      return;
    }

    // Validar precio
    const price = Number(formData.price);
    if (isNaN(price) || price <= 0) {
      toast.error("El precio debe ser un número válido mayor a 0");
      return;
    }

    // Validar currentMileage si está presente
    if (
      formData.currentMileage &&
      (isNaN(Number(formData.currentMileage)) || Number(formData.currentMileage) < 0)
    ) {
      toast.error("El kilometraje debe ser un número válido mayor o igual a 0");
      return;
    }

    setIsCreating(true);
    try {
      let uploadedImageId: number | null = null;

      // Subir imagen si hay una seleccionada
      if (selectedImageFile) {
        // Validar tipo de archivo
        const validImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
        if (!validImageTypes.includes(selectedImageFile.type)) {
          throw new Error(
            `Tipo de archivo no válido. Solo se permiten imágenes: ${validImageTypes.join(", ")}`
          );
        }

        // Validar tamaño (máximo 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB en bytes
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
            // Si no se puede parsear el JSON, usar el mensaje por defecto
          }
          throw new Error(errorMessage);
        }
        const uploadPayload = (await uploadResponse.json()) as { data?: { id?: number } };
        uploadedImageId = uploadPayload?.data?.id ?? null;
        if (!uploadedImageId) {
          throw new Error("No se pudo obtener el ID de la imagen subida");
        }
      }

      const payload = {
        name: formData.name,
        vin: formData.vin,
        price: price,
        condition: formData.condition,
        brand: formData.brand,
        model: formData.model,
        year: year,
        color: formData.color || null,
        currentMileage: formData.currentMileage ? Number(formData.currentMileage) : null,
        oilChangeInterval: formData.oilChangeInterval ? Number(formData.oilChangeInterval) : null,
        fuelType: formData.fuelType || null,
        transmission: formData.transmission || null,
        image: uploadedImageId,
        imageAlt: formData.imageAlt || null,
        placa: formData.placa || null,
        responsables: selectedResponsables.length > 0 ? selectedResponsables : [],
        assignedDrivers: selectedAssignedDrivers.length > 0 ? selectedAssignedDrivers : [],
      };

      const response = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo crear el vehículo");
      }

      const { data } = (await response.json()) as { data: FleetVehicleCard };

      // El mantenimiento se gestiona por kilometraje (oilChangeInterval), no por
      // fecha: no se crea ningún recordatorio programado al alta del vehículo.

      toast.success("Vehículo creado exitosamente");
      setIsDialogOpen(false);
      resetForm();
      await loadVehicles();
      // Navegar al detalle del vehículo creado
      router.push(`/fleet/details/${data.documentId ?? data.id}`);
    } catch (error) {
      console.error("Error creating vehicle:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo crear el vehículo");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AdminLayout
      title="Flota"
      showFilterAction
      onFilterActionClick={() => setIsFilterSheetOpen(true)}
    >
      <FleetHeaderActions
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={(mode) => setViewMode(mode)}
        isSelectMode={isSelectMode}
        toggleSelectMode={toggleSelectMode}
        selectedVehiclesCount={selectedVehicles.size}
        onDeleteMultiple={handleDeleteMultiple}
        isDeleting={isBatchDeleting}
        hasActiveFilters={hasActiveFilters}
        activeFiltersCount={activeFiltersCount}
        onOpenFilters={() => setIsFilterSheetOpen(true)}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(value) => setItemsPerPage(value)}
      />
      <FleetFiltersSheet
        isOpen={isFilterSheetOpen}
        onOpenChange={setIsFilterSheetOpen}
        brands={brands}
        models={models}
        years={years}
        conditions={conditions}
        selectedBrand={selectedBrand}
        selectedModel={selectedModel}
        selectedYear={selectedYear}
        selectedCondition={selectedCondition}
        onBrandChange={setSelectedBrand}
        onModelChange={setSelectedModel}
        onYearChange={setSelectedYear}
        onConditionChange={setSelectedCondition}
        filterSelectedResponsables={filterSelectedResponsables}
        filterSelectedDrivers={filterSelectedDrivers}
        onResponsablesChange={setFilterSelectedResponsables}
        onDriversChange={setFilterSelectedDrivers}
        availableUsers={availableUsers}
        isLoadingUsers={isLoadingUsers}
        clearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />
      <Separator />
      <FleetVehiclesSection
        isLoading={isLoading}
        skeletonCount={skeletonCount}
        errorMessage={errorMessage}
        filteredVehiclesLength={filteredVehicles.length}
        paginatedVehicles={paginatedVehicles}
        viewMode={viewMode}
        totalPages={totalPages}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        isSelectMode={isSelectMode}
        selectedVehicles={selectedVehicles}
        onToggleVehicleSelection={handleToggleVehicleSelection}
        onSelectAll={handleSelectAll}
        acrossPagesBanner={vehicleBanner}
        onSelectAllAcrossPages={() => selection.selectAllAcrossPages(allFilteredVehicleIds)}
        onRevertAcrossPages={() => selection.setSelectedIds(new Set(pageVehicleIds))}
        onNavigateToDetails={handleNavigateToDetails}
        onNavigateToEdit={handleNavigateToEdit}
        onDuplicateVehicle={handleDuplicateVehicle}
        onRequestDeleteVehicle={handleRequestDeleteVehicle}
        onPageChange={(page) => setCurrentPage(page)}
        onRetry={loadVehicles}
        onRefresh={loadVehicles}
      />

      <AddVehicleButton onClick={() => setIsDialogOpen(true)} />

      <CreateVehicleDialog
        isOpen={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        formData={formData}
        setFormData={setFormData}
        handleImageChange={handleImageChange}
        imagePreview={imagePreview}
        isCreating={isCreating}
        isFormValid={isFormValid}
        onConfirm={handleCreateVehicle}
        onCancel={handleCancelCreateDialog}
        availableUsers={availableUsers}
        isLoadingUsers={isLoadingUsers}
        selectedResponsables={selectedResponsables}
        selectedAssignedDrivers={selectedAssignedDrivers}
        onResponsablesChange={handleResponsablesChange}
        onDriversChange={handleDriversChange}
        conditions={conditions}
      />

      <DeleteVehicleDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        vehicleName={vehicleToDelete?.name}
        isDeleting={isDeleting}
        onDelete={handleDeleteVehicle}
      />

      <DeleteMultipleVehiclesDialog
        open={deleteMultipleDialogOpen}
        onOpenChange={setDeleteMultipleDialogOpen}
        selectedCount={selectedVehicles.size}
        isDeleting={isBatchDeleting}
        onConfirm={handleConfirmDeleteMultiple}
      />
    </AdminLayout>
  );
}
