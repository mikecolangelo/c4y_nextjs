"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ChangeEvent } from "react";
import Image from "next/image";
import { ContactCommentsTimeline } from "./components/contact-comments-timeline";
import { useRouter, useParams } from "next/navigation";
import { compressImage } from "@/lib/image-compression";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components_shadcn/ui/avatar";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import {
  ArrowLeft,
  MoreVertical,
  Phone,
  Mail,
  Edit,
  X,
  Calendar,
  Car,
  Shield,
  Briefcase,
  User as UserIcon,
  Bell,
  Camera,
  MapPin,
  Clock,
  FileText,
  Linkedin,
  AlertCircle,
  Eye,
  EyeOff,
  History,
  Plus,
  ClipboardList,
  Banknote,
  TrendingUp,
  Activity,
  UserPlus,
  Copy,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { spacing, typography } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import { BackButton } from "@/components/admin/back-button";
import { strapiImages } from "@/lib/strapi-images";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { toast } from "@/lib/toast";
import { getInitials } from "@/lib/format";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FleetReminders } from "@/components/ui/fleet-reminders";
import type { FleetReminder } from "@/validations/types";
import { emitReminderToggleCompleted } from "@/lib/reminder-events";
import { AssignDriverDialog } from "@/components/ui/assign-driver-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components_shadcn/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components_shadcn/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components_shadcn/ui/dialog";

interface Vehicle {
  id: number;
  documentId?: string;
  name: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  currentMileage?: number;
  image?: {
    url?: string;
    alternativeText?: string;
  };
}

interface DriverHistory {
  id: number;
  documentId?: string;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "suspended";
  notes?: string;
  mileageStart?: number;
  mileageEnd?: number;
  vehicle: Vehicle;
}

interface ServiceNote {
  id: number;
  documentId?: string;
  content: string;
  type: string;
  createdAt: string;
  vehicle?: Vehicle;
}

interface Deal {
  id: number;
  documentId?: string;
  status: string;
  salePrice?: number;
  createdAt: string;
  updatedAt: string;
  vehicle?: Vehicle;
  client?: {
    id: number;
    documentId?: string;
    firstName: string;
    lastName: string;
  };
}

interface UserProfile {
  id: number;
  documentId?: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: "admin" | "driver" | "lead";
  department?: string;
  bio?: string;
  address?: string;
  dateOfBirth?: string;
  hireDate?: string;
  identificationNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  linkedin?: string;
  workSchedule?: string;
  specialties?: string;
  driverLicense?: string;
  billingName?: string;
  billingAddress?: string;
  billingTaxId?: string;
  billingPhone?: string;
  avatar?: {
    url?: string;
    alternativeText?: string;
  };
  assignedVehicles?: Vehicle[];
  interestedVehicles?: Vehicle[];
  assignedReminders?: FleetReminder[];
  driverHistories?: DriverHistory[];
  registeredVehicles?: Array<
    Vehicle & {
      createdAt: string;
      currentDrivers?: Array<{ id: number; documentId?: string; displayName: string }>;
    }
  >;
  serviceNotes?: ServiceNote[];
  deals?: Deal[];
  userAccount?: {
    id: number;
    email?: string;
    isValidated?: boolean;
    validatedAt?: string;
    validationMethod?: string;
  };
}

const roleConfig = {
  admin: {
    label: "Administrador",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100",
    icon: Shield,
  },
  driver: {
    label: "Conductor",
    className: "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
    icon: Car,
  },
  lead: {
    label: "Lead",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
    icon: UserPlus,
  },
};

export default function UserDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertTargetRole, setConvertTargetRole] = useState<"admin" | "driver">("driver");
  const [convertPassword, setConvertPassword] = useState("");
  const [showConvertPassword, setShowConvertPassword] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [convertedPassword, setConvertedPassword] = useState("");
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [isAlreadyConverted, setIsAlreadyConverted] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [showResetPasswordInput, setShowResetPasswordInput] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [shouldRemoveImage, setShouldRemoveImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phone: "",
    role: "driver" as "admin" | "driver" | "lead",
    department: "",
    bio: "",
    address: "",
    dateOfBirth: "",
    hireDate: "",
    identificationNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    linkedin: "",
    workSchedule: "",
    specialties: "",
    driverLicense: "",
    billingName: "",
    billingAddress: "",
    billingTaxId: "",
    billingPhone: "",
  });

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

  useEffect(() => {
    if (userId && userId !== "new") {
      loadUser();
    } else if (userId === "new") {
      setIsLoading(false);
    }
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadUser = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/user-profiles/${userId}`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 404) {
          setError("Contacto no encontrado");
          setIsLoading(false);
          return;
        }
        // Intentar obtener más información del error
        let errorMessage = "Error al cargar contacto";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Si no es JSON, intentar leer como texto
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText;
            }
          } catch {
            // Si falla todo, usar el mensaje por defecto
          }
        }
        console.error("Error cargando contacto:", {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
        });
        setError(errorMessage);
        toast.error(errorMessage);
        setIsLoading(false);
        return;
      }
      const responseData = await response.json();

      // Verificar que la respuesta tenga la estructura esperada
      if (!responseData || !responseData.data) {
        throw new Error("La respuesta del servidor no tiene el formato esperado");
      }

      const { data } = responseData;
      setUser(data);
      setFormData({
        displayName: data.displayName || "",
        email: data.email || "",
        phone: data.phone || "",
        role: data.role || "driver",
        department: data.department || "",
        bio: data.bio || "",
        address: data.address || "",
        dateOfBirth: data.dateOfBirth ? format(new Date(data.dateOfBirth), "yyyy-MM-dd") : null,
        hireDate: data.hireDate ? format(new Date(data.hireDate), "yyyy-MM-dd") : null,
        identificationNumber: data.identificationNumber || "",
        emergencyContactName: data.emergencyContactName || "",
        emergencyContactPhone: data.emergencyContactPhone || "",
        linkedin: data.linkedin || "",
        workSchedule: data.workSchedule || "",
        specialties: data.specialties || "",
        driverLicense: data.driverLicense || "",
        billingName: data.billingName || "",
        billingAddress: data.billingAddress || "",
        billingTaxId: data.billingTaxId || "",
        billingPhone: data.billingPhone || "",
      });
      // Cargar preview de imagen si existe
      if (data.avatar?.url) {
        updateImagePreview(strapiImages.getURL(data.avatar.url));
      } else {
        updateImagePreview(null);
      }
      setSelectedImageFile(null);
      setShouldRemoveImage(false);
    } catch (err) {
      console.error("Error cargando contacto:", err);
      const errorMessage = err instanceof Error ? err.message : "No se pudo cargar el contacto";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Validar tipo de archivo
    const validImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validImageTypes.includes(file.type)) {
      toast.error(
        `Tipo de archivo no válido. Solo se permiten imágenes: ${validImageTypes.join(", ")}`
      );
      return;
    }

    // Validar tamaño (máximo 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error("El archivo es demasiado grande. El tamaño máximo es 10MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    updateImagePreview(objectUrl, true);
    setSelectedImageFile(file);
    setShouldRemoveImage(false);

    // Si no está en modo edición, guardar automáticamente la imagen
    if (!isEditing && user) {
      await handleSaveImageOnly(file);
    }
  };

  const handleSaveImageOnly = async (file: File) => {
    if (!user) return;
    setIsUploadingImage(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("files", await compressImage(file));

      const uploadResponse = await fetch("/api/strapi/upload", {
        method: "POST",
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || "Error al subir la imagen");
      }

      const uploadData = await uploadResponse.json();
      const uploadedImageId = uploadData.data?.id || null;

      if (uploadedImageId) {
        const response = await fetch(`/api/user-profiles/${user.documentId || user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { avatar: uploadedImageId } }),
        });
        if (!response.ok) {
          throw new Error("Error al guardar");
        }
        await loadUser();
        toast.success("Imagen de perfil actualizada correctamente");
      }
    } catch (err) {
      console.error("Error guardando imagen:", err);
      const errorMessage = err instanceof Error ? err.message : "Error al guardar la imagen";
      toast.error("Error al guardar imagen", {
        description: errorMessage,
      });
      // Restaurar imagen original en caso de error
      if (user.avatar?.url) {
        updateImagePreview(strapiImages.getURL(user.avatar.url));
      } else {
        updateImagePreview(null);
      }
      setSelectedImageFile(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    updateImagePreview(null);
    setSelectedImageFile(null);
    setShouldRemoveImage(true);
  };

  const handleRestoreOriginalImage = () => {
    if (!user?.avatar?.url) return;
    updateImagePreview(strapiImages.getURL(user.avatar.url));
    setSelectedImageFile(null);
    setShouldRemoveImage(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      let uploadedImageId: number | null = null;

      // Subir imagen si hay una nueva
      if (selectedImageFile) {
        setIsUploadingImage(true);
        try {
          const uploadFormData = new FormData();
          uploadFormData.append("files", await compressImage(selectedImageFile));

          const uploadResponse = await fetch("/api/strapi/upload", {
            method: "POST",
            body: uploadFormData,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || "Error al subir la imagen");
          }

          const uploadData = await uploadResponse.json();
          uploadedImageId = uploadData.data?.id || null;
        } catch (uploadError) {
          console.error("Error subiendo imagen:", uploadError);
          const errorMessage =
            uploadError instanceof Error ? uploadError.message : "Error al subir la imagen";
          toast.error("Error al subir imagen", {
            description: errorMessage,
          });
          setIsUploadingImage(false);
          setIsSaving(false);
          return;
        } finally {
          setIsUploadingImage(false);
        }
      }

      // Preparar datos para actualizar
      const updateData: any = { ...formData };

      if (uploadedImageId !== null) {
        updateData.avatar = uploadedImageId;
      } else if (shouldRemoveImage) {
        updateData.avatar = null;
      }

      const response = await fetch(`/api/user-profiles/${user.documentId || user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: updateData }),
      });
      if (!response.ok) {
        let errorMessage = "Error al guardar contacto";
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage =
              typeof errorData.error === "string"
                ? errorData.error
                : JSON.stringify(errorData.error);
          }
        } catch {
          errorMessage = `Error al guardar contacto (HTTP ${response.status})`;
        }
        throw new Error(errorMessage);
      }
      await loadUser();
      setIsEditing(false);
      toast.success("Contacto actualizado correctamente");
    } catch (err) {
      console.error("Error guardando contacto:", err);
      const errorMessage = err instanceof Error ? err.message : "Error al guardar contacto";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/user-profiles/${user.documentId || user.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Error al eliminar");
      }
      toast.success("Contacto eliminado correctamente");
      router.push("/users");
    } catch (err) {
      console.error("Error eliminando contacto:", err);
      toast.error("Error al eliminar contacto");
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const generateSecurePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleResetPassword = async () => {
    if (!user) return;
    const trimmed = resetPasswordValue.trim();
    if (trimmed.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setIsResettingPassword(true);
    try {
      const response = await fetch(`/api/user-profiles/${user.documentId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: trimmed }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          typeof errorData.error === "string"
            ? errorData.error
            : typeof errorData.message === "string"
              ? errorData.message
              : "Error al restablecer contraseña";
        throw new Error(errorMessage);
      }
      setShowResetPasswordDialog(false);
      setResetPasswordValue("");
      toast.success("Contraseña restablecida correctamente");
    } catch (err) {
      console.error("Error restableciendo contraseña:", err);
      toast.error(err instanceof Error ? err.message : "Error al restablecer contraseña");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleConvert = async () => {
    if (!user) return;
    const trimmedPassword = convertPassword.trim();
    if (trimmedPassword && trimmedPassword.length < 6) {
      toast.error("La contraseña personalizada debe tener al menos 6 caracteres");
      return;
    }
    setIsConverting(true);
    try {
      const response = await fetch(`/api/user-profiles/${user.documentId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole: convertTargetRole,
          customPassword: trimmedPassword || undefined,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          typeof errorData.error === "string"
            ? errorData.error
            : typeof errorData.message === "string"
              ? errorData.message
              : "Error al convertir lead";
        throw new Error(errorMessage);
      }
      const result = await response.json();
      const rawTempPassword =
        result.meta?.tempPassword ??
        result.meta?.temporaryPassword ??
        result.data?.temporaryPassword ??
        result.data?.tempPassword ??
        result.temporaryPassword ??
        result.tempPassword ??
        null;
      const isReused = result.data?.alreadyConverted === true || rawTempPassword === null;
      setConvertedPassword(rawTempPassword || "N/A");
      setIsAlreadyConverted(isReused);
      setCopiedToClipboard(false);
      setShowConvertDialog(false);
      setShowResultDialog(true);
      toast.success(`Lead promovido a ${roleConfig[convertTargetRole].label}`);
    } catch (err) {
      console.error("Error convirtiendo lead:", err);
      toast.error(err instanceof Error ? err.message : "Error al convertir lead");
    } finally {
      setIsConverting(false);
    }
  };

  const backButton = <BackButton fallbackHref="/users" />;

  if (isLoading) {
    return (
      <AdminLayout title="Cargando contacto..." showFilterAction leftActions={backButton}>
        <section className={`flex flex-col ${spacing.gap.large}`}>
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardContent className={`flex flex-col items-center ${spacing.gap.base} p-6`}>
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        </section>
      </AdminLayout>
    );
  }

  if (error || !user) {
    return (
      <AdminLayout title="Contacto no encontrado" showFilterAction leftActions={backButton}>
        <section
          className={`flex flex-col items-center justify-center ${spacing.gap.base} min-h-[400px]`}
        >
          <p className={typography.body.large}>{error || "El contacto solicitado no existe."}</p>
          <Button onClick={() => router.push("/users")}>Volver a Contactos</Button>
        </section>
      </AdminLayout>
    );
  }

  const roleInfo = roleConfig[user.role];
  const RoleIcon = roleInfo.icon;

  return (
    <AdminLayout title={user.displayName} showFilterAction leftActions={backButton}>
      <section className={`flex flex-col ${spacing.gap.large}`}>
        {/* Información del Contacto */}
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardContent className={`flex flex-col items-center ${spacing.gap.base} p-6 relative`}>
            {/* Acciones del contacto. La navegación "volver" vive en el menú
                (header), no en la tarjeta, para no duplicar el control. */}
            <div className="absolute top-4 right-4 flex items-center justify-end z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full flex items-center justify-center"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? "Cancelar edición" : "Editar Contacto"}
                  </DropdownMenuItem>
                  {(user.role === "driver" || user.role === "admin") && (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <AssignDriverDialog
                        userId={user.documentId || user.id}
                        userName={user.displayName}
                        currentVehicles={user.assignedVehicles}
                        onAssigned={loadUser}
                        trigger={
                          <span className="flex items-center gap-2">
                            <Car className="h-4 w-4" /> Asignar Vehículo
                          </span>
                        }
                      />
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    variant="destructive"
                    className="cursor-pointer"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    Eliminar Contacto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Avatar - Aseguramos que se muestre completo */}
            <div className="relative group">
              <Avatar className="h-24 w-24 shrink-0 rounded-full overflow-hidden ring-2 ring-background">
                {imagePreview ? (
                  <AvatarImage
                    src={imagePreview}
                    alt={user.avatar?.alternativeText || `Avatar de ${user.displayName}`}
                    className="rounded-full object-cover w-full h-full"
                  />
                ) : user.avatar?.url ? (
                  <AvatarImage
                    src={strapiImages.getURL(user.avatar.url)}
                    alt={user.avatar.alternativeText || `Avatar de ${user.displayName}`}
                    className="rounded-full object-cover w-full h-full"
                  />
                ) : null}
                <AvatarFallback className="rounded-full text-xl w-full h-full flex items-center justify-center bg-muted">
                  {getInitials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              {/* Overlay y botón para cambiar imagen - visible al hacer hover */}
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-full bg-background/80 text-foreground hover:bg-background"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  title="Cambiar imagen de perfil"
                >
                  <Camera className="h-5 w-5" />
                </Button>
              </div>
              {/* Botones de acción cuando hay cambios en la imagen y está en modo edición */}
              {isEditing && (selectedImageFile || shouldRemoveImage) && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 bg-background rounded-full p-1 shadow-lg border border-border">
                  {selectedImageFile && (
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7 rounded-full"
                      onClick={handleRemoveImage}
                      disabled={isUploadingImage}
                      title="Eliminar imagen"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  {shouldRemoveImage && user.avatar?.url && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 rounded-full"
                      onClick={handleRestoreOriginalImage}
                      disabled={isUploadingImage}
                      title="Restaurar imagen original"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
              {/* Indicador de carga al subir imagen */}
              {isUploadingImage && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {/* Input file oculto */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageInputChange}
                className="hidden"
              />
            </div>

            {/* Nombre */}
            {isEditing ? (
              <div className="flex flex-col items-center w-full max-w-2xl gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="w-full">
                    <Label>Nombre</Label>
                    <Input
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-full">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-full">
                    <Label>Teléfono</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-full">
                    <Label>Cédula</Label>
                    <Input
                      value={formData.identificationNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, identificationNumber: e.target.value })
                      }
                      className="mt-1"
                      placeholder="e.g. 8-888-8888"
                    />
                  </div>
                  <div className="w-full">
                    <Label>Rol</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: "admin" | "driver" | "lead") =>
                        setFormData({ ...formData, role: value })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="driver">Conductor</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full">
                    <Label>Departamento</Label>
                    <Input
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-full">
                    <Label>Fecha de Nacimiento</Label>
                    <Input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-full">
                    <Label>Fecha de Contratación</Label>
                    <Input
                      type="date"
                      value={formData.hireDate}
                      onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-full">
                    <Label>Horario de Trabajo</Label>
                    <Input
                      value={formData.workSchedule}
                      onChange={(e) => setFormData({ ...formData, workSchedule: e.target.value })}
                      className="mt-1"
                      placeholder="Lunes a Viernes 9:00 - 18:00"
                    />
                  </div>
                  {user.role === "driver" && (
                    <div className="w-full">
                      <Label>Licencia de Conducir</Label>
                      <Input
                        value={formData.driverLicense}
                        onChange={(e) =>
                          setFormData({ ...formData, driverLicense: e.target.value })
                        }
                        className="mt-1"
                        placeholder="B, C, D"
                      />
                    </div>
                  )}
                  <div className="w-full">
                    <Label>Nombre de Facturación</Label>
                    <Input
                      value={formData.billingName}
                      onChange={(e) => setFormData({ ...formData, billingName: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-full">
                    <Label>Dirección de Facturación</Label>
                    <Input
                      value={formData.billingAddress}
                      onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-full">
                    <Label>RUC / Cédula de Facturación</Label>
                    <Input
                      value={formData.billingTaxId}
                      onChange={(e) => setFormData({ ...formData, billingTaxId: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-full">
                    <Label>Teléfono de Facturación</Label>
                    <Input
                      value={formData.billingPhone}
                      onChange={(e) => setFormData({ ...formData, billingPhone: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="w-full">
                  <Label>Dirección</Label>
                  <Textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="mt-1"
                    rows={2}
                    placeholder="Dirección completa"
                  />
                </div>
                <div className="w-full">
                  <Label>Biografía</Label>
                  <Textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="mt-1"
                    rows={4}
                    placeholder="Escribe una breve biografía..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="w-full">
                    <Label>Contacto de Emergencia - Nombre</Label>
                    <Input
                      value={formData.emergencyContactName}
                      onChange={(e) =>
                        setFormData({ ...formData, emergencyContactName: e.target.value })
                      }
                      className="mt-1"
                      placeholder="Nombre del contacto"
                    />
                  </div>
                  <div className="w-full">
                    <Label>Contacto de Emergencia - Teléfono</Label>
                    <Input
                      value={formData.emergencyContactPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, emergencyContactPhone: e.target.value })
                      }
                      className="mt-1"
                      placeholder="+34 600 123 456"
                    />
                  </div>
                  <div className="w-full">
                    <Label>LinkedIn</Label>
                    <Input
                      type="url"
                      value={formData.linkedin}
                      onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                      className="mt-1"
                      placeholder="https://linkedin.com/in/tu-perfil"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || isUploadingImage}
                    size="lg"
                    className="flex-1 min-h-[44px]"
                  >
                    {isSaving || isUploadingImage ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditing(false);
                      // Restaurar imagen original si se canceló
                      if (user.avatar?.url) {
                        updateImagePreview(strapiImages.getURL(user.avatar.url));
                      } else {
                        updateImagePreview(null);
                      }
                      setSelectedImageFile(null);
                      setShouldRemoveImage(false);
                    }}
                    variant="outline"
                    size="lg"
                    className="flex-1 min-h-[44px]"
                    disabled={isSaving || isUploadingImage}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center text-center">
                  <h2 className={`${typography.h3} text-center`}>{user.displayName}</h2>
                  {user.email && (
                    <p className={`${typography.body.small} mt-1 text-muted-foreground`}>
                      {user.email}
                    </p>
                  )}
                </div>

                {/* Badge de Rol */}
                <Badge
                  className={`rounded-full px-3 py-1 text-xs font-medium border-0 flex items-center gap-1 ${roleInfo.className}`}
                >
                  <RoleIcon className="h-3 w-3" />
                  {roleInfo.label}
                </Badge>

                {user.role === "lead" && (
                  <Button
                    onClick={() => setShowConvertDialog(true)}
                    className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Promover a Contacto Activo
                  </Button>
                )}

                {user.role !== "lead" && user.userAccount && (
                  <Button
                    onClick={() => {
                      setResetPasswordValue(generateSecurePassword());
                      setShowResetPasswordInput(false);
                      setShowResetPasswordDialog(true);
                    }}
                    variant="outline"
                    className="mt-2"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Restablecer Contraseña
                  </Button>
                )}

                {/* Información adicional */}
                {(user.phone || user.department) && (
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    {user.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {user.phone}
                      </div>
                    )}
                    {user.department && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        {user.department}
                      </div>
                    )}
                  </div>
                )}

                {/* Botones de acción */}
                <div
                  className={`flex items-center justify-center ${spacing.gap.small} w-full pt-2`}
                >
                  {user.phone && (
                    <Button
                      variant="default"
                      size="icon"
                      className="h-10 w-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center"
                      onClick={() => (window.location.href = `tel:${user.phone}`)}
                    >
                      <Phone className="h-5 w-5 flex-shrink-0" />
                    </Button>
                  )}
                  {user.email && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center"
                      onClick={() => (window.location.href = `mailto:${user.email}`)}
                    >
                      <Mail className="h-5 w-5 flex-shrink-0" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-5 w-5 flex-shrink-0" />
                  </Button>
                </div>

                {/* Información de Facturación */}
                {(user.billingName ||
                  user.billingAddress ||
                  user.billingTaxId ||
                  user.billingPhone) && (
                  <div className="w-full max-w-md mt-2 p-3 rounded-lg bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Información de Facturación
                    </p>
                    <div className="flex flex-col gap-1 text-sm">
                      {user.billingName && (
                        <p>
                          <span className="text-muted-foreground">Nombre:</span> {user.billingName}
                        </p>
                      )}
                      {user.billingAddress && (
                        <p>
                          <span className="text-muted-foreground">Dirección:</span>{" "}
                          {user.billingAddress}
                        </p>
                      )}
                      {user.billingTaxId && (
                        <p>
                          <span className="text-muted-foreground">RUC/Cédula:</span>{" "}
                          {user.billingTaxId}
                        </p>
                      )}
                      {user.billingPhone && (
                        <p>
                          <span className="text-muted-foreground">Teléfono:</span>{" "}
                          {user.billingPhone}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Recordatorios */}
        {user.assignedReminders && user.assignedReminders.length > 0 && (
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardHeader className="px-6 pt-6 pb-4">
              <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                <Bell className="h-5 w-5" />
                Recordatorios
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <FleetReminders
                reminders={user.assignedReminders}
                isLoading={false}
                onToggleCompleted={async (reminderId, isCompleted) => {
                  try {
                    const response = await fetch(
                      `/api/fleet-reminders/${encodeURIComponent(reminderId)}`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          data: { isCompleted: !isCompleted },
                        }),
                      }
                    );
                    if (!response.ok) throw new Error("Error al actualizar");
                    // Emitir evento de cambio de estado completado
                    emitReminderToggleCompleted(reminderId, !isCompleted);
                    toast.success(
                      isCompleted
                        ? "Recordatorio marcado como pendiente"
                        : "Recordatorio marcado como completado"
                    );
                    await loadUser();
                  } catch (error) {
                    console.error("Error:", error);
                    toast.error("Error al actualizar el recordatorio");
                  }
                }}
                vehicleId={userId}
              />
            </CardContent>
          </Card>
        )}

        {/* Autos a los que están interesados */}
        {user.interestedVehicles && user.interestedVehicles.length > 0 && (
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardHeader className="px-6 pt-6 pb-4">
              <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                <Car className="h-5 w-5" />
                Autos a los que están interesados
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="grid gap-4 md:grid-cols-2">
                {user.interestedVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    onClick={() =>
                      router.push(`/fleet/details/${vehicle.documentId || vehicle.id}`)
                    }
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  >
                    {vehicle.image?.url ? (
                      <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <Image
                          src={strapiImages.getURL(vehicle.image.url)}
                          alt={vehicle.image.alternativeText || vehicle.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                        <Car className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`${typography.body.base} font-medium line-clamp-1`}>
                        {vehicle.name}
                      </p>
                      <p className={`${typography.body.small} text-muted-foreground`}>
                        {vehicle.brand} {vehicle.model} ({vehicle.year})
                      </p>
                      <p className={`${typography.body.small} text-xs text-muted-foreground mt-1`}>
                        VIN: {vehicle.vin}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Autos a los que están contratando */}
        {user.assignedVehicles && user.assignedVehicles.length > 0 && (
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardHeader className="px-6 pt-6 pb-4">
              <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                <Car className="h-5 w-5" />
                Autos a los que están contratando
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="grid gap-4 md:grid-cols-2">
                {user.assignedVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    onClick={() =>
                      router.push(`/fleet/details/${vehicle.documentId || vehicle.id}`)
                    }
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  >
                    {vehicle.image?.url ? (
                      <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <Image
                          src={strapiImages.getURL(vehicle.image.url)}
                          alt={vehicle.image.alternativeText || vehicle.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                        <Car className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`${typography.body.base} font-medium line-clamp-1`}>
                        {vehicle.name}
                      </p>
                      <p className={`${typography.body.small} text-muted-foreground`}>
                        {vehicle.brand} {vehicle.model} ({vehicle.year})
                      </p>
                      <p className={`${typography.body.small} text-xs text-muted-foreground mt-1`}>
                        VIN: {vehicle.vin}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vehículos Registrados por el Contacto */}
        {user.registeredVehicles && user.registeredVehicles.length > 0 && (
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardHeader className="px-6 pt-6 pb-4">
              <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                <Plus className="h-5 w-5" />
                Vehículos Registrados
                <Badge variant="secondary" className="ml-2">
                  {user.registeredVehicles.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="grid gap-4 md:grid-cols-2">
                {user.registeredVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    onClick={() =>
                      router.push(`/fleet/details/${vehicle.documentId || vehicle.id}`)
                    }
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  >
                    {vehicle.image?.url ? (
                      <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <Image
                          src={strapiImages.getURL(vehicle.image.url)}
                          alt={vehicle.image.alternativeText || vehicle.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                        <Car className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`${typography.body.base} font-medium line-clamp-1`}>
                        {vehicle.name}
                      </p>
                      <p className={`${typography.body.small} text-muted-foreground`}>
                        {vehicle.brand} {vehicle.model} ({vehicle.year})
                      </p>
                      <p className={`${typography.body.small} text-xs text-muted-foreground mt-1`}>
                        Registrado:{" "}
                        {format(new Date(vehicle.createdAt), "dd/MM/yyyy", { locale: es })}
                      </p>
                      {vehicle.currentDrivers && vehicle.currentDrivers.length > 0 && (
                        <p
                          className={`${typography.body.small} text-xs text-green-600 dark:text-green-400 mt-1`}
                        >
                          Conductor actual: {vehicle.currentDrivers[0].displayName}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Historial de Conducción */}
        {user.driverHistories && user.driverHistories.length > 0 && (
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardHeader className="px-6 pt-6 pb-4">
              <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                <History className="h-5 w-5" />
                Historial de Conducción
                <Badge variant="secondary" className="ml-2">
                  {user.driverHistories.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-4">
                {user.driverHistories.map((history) => (
                  <div
                    key={history.id}
                    className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border-l-4 border-l-primary"
                  >
                    {history.vehicle?.image?.url ? (
                      <div
                        className="relative w-20 h-20 shrink-0 overflow-hidden rounded-lg bg-muted cursor-pointer"
                        onClick={() =>
                          router.push(
                            `/fleet/details/${history.vehicle?.documentId || history.vehicle?.id}`
                          )
                        }
                      >
                        <Image
                          src={strapiImages.getURL(history.vehicle.image.url)}
                          alt={history.vehicle.image.alternativeText || history.vehicle.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                        <Car className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`${typography.body.base} font-medium`}>
                          {history.vehicle?.name}
                        </p>
                        <Badge
                          className={
                            history.status === "active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                              : history.status === "completed"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                          }
                        >
                          {history.status === "active"
                            ? "Conductor Actual"
                            : history.status === "completed"
                              ? "Conductor Anterior"
                              : "Suspendido"}
                        </Badge>
                      </div>
                      <p className={`${typography.body.small} text-muted-foreground`}>
                        {history.vehicle?.brand} {history.vehicle?.model} ({history.vehicle?.year})
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {format(new Date(history.startDate), "dd/MM/yyyy", { locale: es })}
                            {history.endDate &&
                              ` - ${format(new Date(history.endDate), "dd/MM/yyyy", { locale: es })}`}
                          </span>
                        </div>
                        {(history.mileageStart || history.mileageEnd) && (
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {history.mileageStart?.toLocaleString()} km
                              {history.mileageEnd && ` - ${history.mileageEnd.toLocaleString()} km`}
                            </span>
                          </div>
                        )}
                      </div>
                      {history.notes && (
                        <p className={`${typography.body.small} text-muted-foreground mt-2 italic`}>
                          {history.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline de Actividad */}
        {user.serviceNotes?.length || user.deals?.length ? (
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardHeader className="px-6 pt-6 pb-4">
              <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                <Activity className="h-5 w-5" />
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-4">
                {[...(user.serviceNotes || []), ...(user.deals || [])]
                  .sort(
                    (a: any, b: any) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )
                  .slice(0, 10)
                  .map((item: any, index: number) => (
                    <div key={`${item.id}-${index}`} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            "salePrice" in item
                              ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
                              : "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                          }`}
                        >
                          {"salePrice" in item ? (
                            <Banknote className="h-4 w-4" />
                          ) : (
                            <ClipboardList className="h-4 w-4" />
                          )}
                        </div>
                        {index < 9 && <div className="w-0.5 h-full bg-border mt-2" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2">
                          <p className={`${typography.body.base} font-medium`}>
                            {"salePrice" in item ? "Negocio cerrado" : "Nota de servicio"}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                          </span>
                        </div>
                        {"salePrice" in item ? (
                          <>
                            <p className={`${typography.body.small} text-muted-foreground`}>
                              Vehículo: {item.vehicle?.name} - B/.{" "}
                              {item.salePrice?.toLocaleString()}
                            </p>
                            <p className={`${typography.body.small} text-muted-foreground`}>
                              Cliente: {item.client?.firstName} {item.client?.lastName}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className={`${typography.body.small} text-muted-foreground`}>
                              {item.content}
                            </p>
                            {item.vehicle && (
                              <p className={`${typography.body.small} text-muted-foreground`}>
                                Vehículo: {item.vehicle.name}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Información Adicional */}
        {!isEditing && (
          <>
            {/* Información Personal Detallada */}
            {(user.address ||
              user.dateOfBirth ||
              user.identificationNumber ||
              user.hireDate ||
              user.workSchedule) && (
              <Card className="shadow-sm ring-1 ring-inset ring-border/50">
                <CardHeader className="px-6 pt-6 pb-4">
                  <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                    <UserIcon className="h-5 w-5" />
                    Información Personal
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    {user.identificationNumber && (
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className={`${typography.body.small} text-muted-foreground`}>Cédula</p>
                          <p className={typography.body.base}>{user.identificationNumber}</p>
                        </div>
                      </div>
                    )}
                    {user.dateOfBirth && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className={`${typography.body.small} text-muted-foreground`}>
                            Fecha de Nacimiento
                          </p>
                          <p className={typography.body.base}>
                            {format(new Date(user.dateOfBirth), "d 'de' MMMM, yyyy", {
                              locale: es,
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                    {user.hireDate && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className={`${typography.body.small} text-muted-foreground`}>
                            Fecha de Contratación
                          </p>
                          <p className={typography.body.base}>
                            {format(new Date(user.hireDate), "d 'de' MMMM, yyyy", { locale: es })}
                          </p>
                        </div>
                      </div>
                    )}
                    {user.workSchedule && (
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className={`${typography.body.small} text-muted-foreground`}>
                            Horario de Trabajo
                          </p>
                          <p className={typography.body.base}>{user.workSchedule}</p>
                        </div>
                      </div>
                    )}
                    {user.address && (
                      <div className="flex items-start gap-3 md:col-span-2">
                        <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className={`${typography.body.small} text-muted-foreground`}>
                            Dirección
                          </p>
                          <p className={typography.body.base}>{user.address}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Información Profesional Adicional */}
            {user.role === "driver" && user.driverLicense && (
              <Card className="shadow-sm ring-1 ring-inset ring-border/50">
                <CardHeader className="px-6 pt-6 pb-4">
                  <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                    <Briefcase className="h-5 w-5" />
                    Información Profesional
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="flex flex-col gap-4">
                    {user.role === "driver" && user.driverLicense && (
                      <div className="flex items-center gap-3">
                        <Car className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className={`${typography.body.small} text-muted-foreground`}>
                            Licencia de Conducir
                          </p>
                          <p className={typography.body.base}>{user.driverLicense}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contacto de Emergencia y Redes */}
            {(user.emergencyContactName || user.emergencyContactPhone || user.linkedin) && (
              <Card className="shadow-sm ring-1 ring-inset ring-border/50">
                <CardHeader className="px-6 pt-6 pb-4">
                  <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                    <AlertCircle className="h-5 w-5" />
                    Contacto de Emergencia y Redes
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    {user.emergencyContactName && (
                      <div className="flex items-center gap-3">
                        <UserIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className={`${typography.body.small} text-muted-foreground`}>
                            Contacto de Emergencia
                          </p>
                          <p className={typography.body.base}>{user.emergencyContactName}</p>
                        </div>
                      </div>
                    )}
                    {user.emergencyContactPhone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className={`${typography.body.small} text-muted-foreground`}>
                            Teléfono de Emergencia
                          </p>
                          <p className={typography.body.base}>{user.emergencyContactPhone}</p>
                        </div>
                      </div>
                    )}
                    {user.linkedin && (
                      <div className="flex items-center gap-3 md:col-span-2">
                        <Linkedin className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={`${typography.body.small} text-muted-foreground`}>
                            LinkedIn
                          </p>
                          <a
                            href={user.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${typography.body.base} text-primary hover:underline break-all`}
                          >
                            {user.linkedin}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Biografía */}
            {user.bio && (
              <Card className="shadow-sm ring-1 ring-inset ring-border/50">
                <CardHeader className="px-6 pt-6 pb-4">
                  <CardTitle className={typography.h4}>Biografía</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <p className={typography.body.base}>{user.bio}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Comment timeline — available on every contact detail. */}
        <ContactCommentsTimeline contactDocumentId={user.documentId || String(user.id)} />
      </section>

      {/* Diálogo de conversión de lead */}
      <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promover Lead a Contacto Activo</AlertDialogTitle>
            <AlertDialogDescription>
              Selecciona el rol para el contacto {user.displayName}. Se creará una cuenta de
              autenticación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Rol destino</Label>
              <Select
                value={convertTargetRole}
                onValueChange={(value: "admin" | "driver") => setConvertTargetRole(value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="driver">Conductor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contraseña (opcional)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type={showConvertPassword ? "text" : "password"}
                  placeholder="Deja en blanco para generar una contraseña temporal"
                  value={convertPassword}
                  onChange={(e) => setConvertPassword(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowConvertPassword(!showConvertPassword)}
                  title={showConvertPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showConvertPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const generated = generateSecurePassword();
                    setConvertPassword(generated);
                    setShowConvertPassword(true);
                  }}
                  title="Generar contraseña segura"
                >
                  Generar
                </Button>
              </div>
              {convertPassword.trim().length > 0 && convertPassword.trim().length < 6 && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  La contraseña debe tener al menos 6 caracteres.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Si la dejas en blanco, se generará automáticamente sin caracteres ambiguos (0, O, l,
                I, 1).
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConvertDialog(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConvert();
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isConverting}
            >
              {isConverting ? "Convirtiendo..." : "Promover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de restablecer contraseña */}
      <AlertDialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restablecer Contraseña</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresa una nueva contraseña para {user?.displayName}. Se actualizará inmediatamente
              en el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Nueva contraseña</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type={showResetPasswordInput ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowResetPasswordInput(!showResetPasswordInput)}
                  title={showResetPasswordInput ? "Ocultar" : "Mostrar"}
                >
                  {showResetPasswordInput ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const generated = generateSecurePassword();
                    setResetPasswordValue(generated);
                    setShowResetPasswordInput(true);
                  }}
                >
                  Generar
                </Button>
              </div>
              {resetPasswordValue.trim().length > 0 && resetPasswordValue.trim().length < 6 && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  La contraseña debe tener al menos 6 caracteres.
                </p>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowResetPasswordDialog(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleResetPassword();
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isResettingPassword || resetPasswordValue.trim().length < 6}
            >
              {isResettingPassword ? "Actualizando..." : "Restablecer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de resultado con contraseña */}
      <Dialog
        open={showResultDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowResultDialog(false);
            loadUser();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contacto promovido exitosamente</DialogTitle>
            <DialogDescription>
              {isAlreadyConverted ? (
                <>
                  Este contacto ya tenía una cuenta de usuario en el sistema. Se ha vinculado
                  automáticamente.
                </>
              ) : (
                <>
                  El lead ha sido convertido a{" "}
                  <strong>{roleConfig[convertTargetRole].label}</strong>. Guarda la siguiente
                  contraseña de acceso.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isAlreadyConverted ? (
              <div className="space-y-4">
                <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400">
                    El usuario ya existía en el sistema con este email. No se generó una nueva
                    contraseña porque la cuenta fue reutilizada.
                  </AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowResultDialog(false);
                    setTimeout(() => setShowResetPasswordDialog(true), 300);
                  }}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Restablecer contraseña
                </Button>
              </div>
            ) : (
              <>
                <Card className="border-dashed border-2">
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-muted-foreground">
                        Haz clic en el campo, presiona Ctrl+A y luego Copiar. No la escribas
                        manualmente.
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <input
                          type="text"
                          readOnly
                          value={convertedPassword}
                          className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                          onFocus={(e) => e.target.select()}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(convertedPassword);
                              setCopiedToClipboard(true);
                              toast.success("Contraseña copiada al portapapeles");
                              setTimeout(() => setCopiedToClipboard(false), 2000);
                            } catch {
                              toast.error("No se pudo copiar al portapapeles");
                            }
                          }}
                          className="shrink-0"
                        >
                          {copiedToClipboard ? (
                            <>
                              <Check className="mr-2 h-4 w-4 text-green-600 dark:text-green-400" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="mr-2 h-4 w-4" />
                              Copiar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Asegúrate de compartir esta contraseña de forma segura con el contacto.
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowResultDialog(false);
                loadUser();
              }}
              className="w-full sm:w-auto"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el contacto{" "}
              {user.displayName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
