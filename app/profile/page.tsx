"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Lock, Camera, X, Phone, Mail, MapPin, Calendar, Briefcase, User, Shield, Car, FileText, AlertCircle, Linkedin, Clock, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components_shadcn/ui/dialog";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components_shadcn/ui/avatar";
import { Badge } from "@/components_shadcn/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { AdminLayout } from "@/components/admin/admin-layout";
import { typography, spacing, components } from "@/lib/design-system";
import { strapiImages } from "@/lib/strapi-images";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { toast } from "@/lib/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { UserVehicleManagement } from "@/components/ui/user-vehicle-management";
import { Calendar as CalendarComponent } from "@/components_shadcn/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components_shadcn/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface UserProfile {
  id: number;
  documentId?: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: "admin" | "seller" | "driver";
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
  avatar?: {
    url?: string;
    alternativeText?: string;
  };
  // Relations
  assignedVehicles?: any[];
  driverHistories?: any[];
  registeredVehicles?: any[];
}

const roleConfig = {
  admin: { 
    label: "Administrador", 
    className: "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100",
    icon: Shield 
  },
  seller: { 
    label: "Vendedor", 
    className: "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100",
    icon: Briefcase 
  },
  driver: { 
    label: "Conductor", 
    className: "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
    icon: Car 
  },
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [shouldRemoveImage, setShouldRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phone: "",
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
    loadUserProfile();
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const loadUserProfile = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/user-profile/me", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Error al cargar perfil");
      }
      const { data } = await response.json();
      
      if (data?.documentId) {
        const profileResponse = await fetch(`/api/user-profiles/${data.documentId}`, { cache: "no-store" });
        if (!profileResponse.ok) {
          throw new Error("Error al cargar perfil completo");
        }
        const { data: profileData } = await profileResponse.json();
        setUser(profileData);
        
        setFormData({
          displayName: profileData.displayName || "",
          email: profileData.email || "",
          phone: profileData.phone || "",
          department: profileData.department || "",
          bio: profileData.bio || "",
          address: profileData.address || "",
          dateOfBirth: profileData.dateOfBirth ? format(new Date(profileData.dateOfBirth), "yyyy-MM-dd") : "",
          hireDate: profileData.hireDate ? format(new Date(profileData.hireDate), "yyyy-MM-dd") : "",
          identificationNumber: profileData.identificationNumber || "",
          emergencyContactName: profileData.emergencyContactName || "",
          emergencyContactPhone: profileData.emergencyContactPhone || "",
          linkedin: profileData.linkedin || "",
          workSchedule: profileData.workSchedule || "",
          specialties: profileData.specialties || "",
          driverLicense: profileData.driverLicense || "",
        });

        if (profileData.avatar?.url) {
          updateImagePreview(strapiImages.getURL(profileData.avatar.url));
        } else {
          updateImagePreview(null);
        }
      }
    } catch (err) {
      console.error("Error cargando perfil:", err);
      toast.error("Error al cargar perfil");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
      toast.error(`Tipo de archivo no válido. Solo se permiten imágenes: ${validImageTypes.join(', ')}`);
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("El archivo es demasiado grande. El tamaño máximo es 10MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    updateImagePreview(objectUrl, true);
    setSelectedImageFile(file);
    setShouldRemoveImage(false);
    await handleSaveImageOnly(file);
  };

  const handleSaveImageOnly = async (file: File) => {
    if (!user) return;
    setIsUploadingImage(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("files", file);

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
        if (!response.ok) throw new Error("Error al guardar");
        await loadUserProfile();
        toast.success("Imagen de perfil actualizada");
      }
    } catch (err) {
      console.error("Error guardando imagen:", err);
      toast.error("Error al guardar imagen");
      if (user?.avatar?.url) {
        updateImagePreview(strapiImages.getURL(user.avatar.url));
      } else {
        updateImagePreview(null);
      }
      setSelectedImageFile(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      let uploadedImageId: number | null = null;

      if (selectedImageFile) {
        setIsUploadingImage(true);
        try {
          const uploadFormData = new FormData();
          uploadFormData.append("files", selectedImageFile);
          const uploadResponse = await fetch("/api/strapi/upload", {
            method: "POST",
            body: uploadFormData,
          });
          if (!uploadResponse.ok) throw new Error("Error al subir la imagen");
          const uploadData = await uploadResponse.json();
          uploadedImageId = uploadData.data?.id || null;
        } finally {
          setIsUploadingImage(false);
        }
      }

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
      
      if (!response.ok) throw new Error("Error al guardar");
      
      await loadUserProfile();
      toast.success("Perfil actualizado correctamente");
    } catch (err) {
      console.error("Error guardando perfil:", err);
      toast.error("Error al guardar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePasswordClick = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordDialog(true);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Todos los campos son obligatorios");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          password: newPassword,
          passwordConfirmation: confirmPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al cambiar la contraseña");
      }

      toast.success("Contraseña actualizada correctamente");
      setShowPasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Error cambiando contraseña:", err);
      toast.error(err instanceof Error ? err.message : "Error al cambiar la contraseña");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Cargando perfil..." showFilterAction>
        <div className="flex flex-col pb-28">
          <section className={`flex flex-col items-center ${spacing.gap.medium} pt-8`}>
            <Skeleton className="h-32 w-32 rounded-full" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </section>
          <section className={`flex flex-col ${spacing.gap.small} py-3`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </section>
        </div>
      </AdminLayout>
    );
  }

  if (!user) {
    return (
      <AdminLayout title="Error" showFilterAction>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <p className={typography.body.large}>No se pudo cargar el perfil</p>
          <Button onClick={loadUserProfile}>Reintentar</Button>
        </div>
      </AdminLayout>
    );
  }

  const roleInfo = roleConfig[user.role];
  const RoleIcon = roleInfo.icon;

  return (
    <>
      <AdminLayout
        title="Editar Perfil"
        leftActions={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      >
        <div className="flex flex-col pb-28">
          {/* Profile Header */}
          <section className={`flex flex-col items-center ${spacing.gap.medium} pt-8`}>
            <div className="relative group">
              <Avatar className="h-32 w-32 rounded-full overflow-hidden ring-2 ring-background">
                {imagePreview ? (
                  <AvatarImage src={imagePreview} alt={user.avatar?.alternativeText || `Avatar de ${user.displayName}`} className="rounded-full object-cover w-full h-full" />
                ) : user.avatar?.url ? (
                  <AvatarImage src={strapiImages.getURL(user.avatar.url)} alt={user.avatar.alternativeText || `Avatar de ${user.displayName}`} className="rounded-full object-cover w-full h-full" />
                ) : null}
                <AvatarFallback className="rounded-full text-2xl w-full h-full flex items-center justify-center bg-muted">
                  {getInitials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-12 w-12 rounded-full bg-background/80 text-foreground hover:bg-background"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                >
                  <Camera className="h-6 w-6" />
                </Button>
              </div>
              {isUploadingImage && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageInputChange}
                className="hidden"
              />
            </div>
            <div className="flex flex-col items-center">
              <p className="text-[22px] font-bold leading-tight tracking-[-0.015em] text-center">
                {user.displayName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 ${roleInfo.className}`}>
                  <RoleIcon className="h-3 w-3" />
                  {roleInfo.label}
                </Badge>
                {user.department && (
                  <span className="text-base font-normal leading-normal text-center text-muted-foreground">
                    {user.department}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Form Fields */}
          <section className={`flex flex-col ${spacing.gap.base} py-3`}>
            {/* Información Personal */}
            <Card className="shadow-sm ring-1 ring-inset ring-border/50">
              <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                  <User className="h-5 w-5" />
                  Información Personal
                </CardTitle>
              </CardHeader>
              <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
                <div className="flex flex-col">
                  <Label htmlFor="displayName" className={`pb-2 ${typography.body.large}`}>
                    Nombre y Apellidos
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="e.g. Alejandro Martinez"
                    className={`h-14 px-[15px] text-base ${components.input.base}`}
                  />
                </div>

                <div className="flex flex-col">
                  <Label htmlFor="email" className={`pb-2 ${typography.body.large}`}>
                    Correo Electrónico
                  </Label>
                  <div className="flex w-full items-stretch">
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      placeholder="e.g. a.martinez@concesionario.com"
                      className={`h-14 px-[15px] pr-2 text-base ${components.input.base} rounded-r-none border-r-0`}
                    />
                    <div className="flex h-14 items-center justify-center rounded-r-lg border border-l-0 bg-muted px-[15px]">
                      <Lock className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <Label htmlFor="phone" className={`pb-2 ${typography.body.large} flex items-center gap-2`}>
                    <Phone className="h-4 w-4" />
                    Número de Teléfono
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +34 600 123 456"
                    className={`h-14 px-[15px] text-base ${components.input.base}`}
                  />
                </div>

                <div className="flex flex-col">
                  <Label htmlFor="identificationNumber" className={`pb-2 ${typography.body.large} flex items-center gap-2`}>
                    <FileText className="h-4 w-4" />
                    Cédula
                  </Label>
                  <Input
                    id="identificationNumber"
                    type="text"
                    value={formData.identificationNumber}
                    onChange={(e) => setFormData({ ...formData, identificationNumber: e.target.value })}
                    placeholder="e.g. 8-888-8888"
                    className={`h-14 px-[15px] text-base ${components.input.base}`}
                  />
                </div>

                <div className="flex flex-col">
                  <Label htmlFor="dateOfBirth" className={`pb-2 ${typography.body.large} flex items-center gap-2`}>
                    <Calendar className="h-4 w-4" />
                    Fecha de Nacimiento
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className={`h-14 px-[15px] text-base ${components.input.base}`}
                  />
                </div>

                <div className="flex flex-col">
                  <Label htmlFor="address" className={`pb-2 ${typography.body.large} flex items-center gap-2`}>
                    <MapPin className="h-4 w-4" />
                    Dirección
                  </Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Dirección completa"
                    className={`min-h-[80px] px-[15px] py-3 text-base ${components.input.base}`}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Información Profesional */}
            <Card className="shadow-sm ring-1 ring-inset ring-border/50">
              <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                  <Briefcase className="h-5 w-5" />
                  Información Profesional
                </CardTitle>
              </CardHeader>
              <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
                <div className="flex flex-col">
                  <Label htmlFor="department" className={`pb-2 ${typography.body.large} flex items-center gap-2`}>
                    <Briefcase className="h-4 w-4" />
                    Departamento
                  </Label>
                  <Input
                    id="department"
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Ventas, Administración"
                    className={`h-14 px-[15px] text-base ${components.input.base}`}
                  />
                </div>

                <div className="flex flex-col">
                  <Label htmlFor="hireDate" className={`pb-2 ${typography.body.large} flex items-center gap-2`}>
                    <Calendar className="h-4 w-4" />
                    Fecha de Contratación
                  </Label>
                  <Input
                    id="hireDate"
                    type="date"
                    value={formData.hireDate}
                    onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                    className={`h-14 px-[15px] text-base ${components.input.base}`}
                  />
                </div>

                <div className="flex flex-col">
                  <Label htmlFor="workSchedule" className={`pb-2 ${typography.body.large} flex items-center gap-2`}>
                    <Clock className="h-4 w-4" />
                    Horario de Trabajo
                  </Label>
                  <Input
                    id="workSchedule"
                    type="text"
                    value={formData.workSchedule}
                    onChange={(e) => setFormData({ ...formData, workSchedule: e.target.value })}
                    placeholder="e.g. Lunes a Viernes 9:00 - 18:00"
                    className={`h-14 px-[15px] text-base ${components.input.base}`}
                  />
                </div>

                {user.role === "seller" && (
                  <div className="flex flex-col">
                    <Label htmlFor="specialties" className={`pb-2 ${typography.body.large}`}>
                      Especialidades
                    </Label>
                    <Textarea
                      id="specialties"
                      value={formData.specialties}
                      onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                      placeholder="Especialidades o áreas de experiencia"
                      className={`min-h-[80px] px-[15px] py-3 text-base ${components.input.base}`}
                      rows={3}
                    />
                  </div>
                )}

                {user.role === "driver" && (
                  <div className="flex flex-col">
                    <Label htmlFor="driverLicense" className={`pb-2 ${typography.body.large} flex items-center gap-2`}>
                      <Car className="h-4 w-4" />
                      Licencia de Conducir
                    </Label>
                    <Input
                      id="driverLicense"
                      type="text"
                      value={formData.driverLicense}
                      onChange={(e) => setFormData({ ...formData, driverLicense: e.target.value })}
                      placeholder="e.g. B, C, D"
                      className={`h-14 px-[15px] text-base ${components.input.base}`}
                    />
                  </div>
                )}

                <div className="flex flex-col">
                  <Label htmlFor="bio" className={`pb-2 ${typography.body.large}`}>
                    Biografía
                  </Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Escribe una breve biografía sobre ti..."
                    className={`min-h-[100px] px-[15px] py-3 text-base ${components.input.base}`}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contacto de Emergencia y Redes Sociales */}
            <Card className="shadow-sm ring-1 ring-inset ring-border/50">
              <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className={`${typography.h4} flex items-center gap-2`}>
                  <AlertCircle className="h-5 w-5" />
                  Contacto de Emergencia y Redes
                </CardTitle>
              </CardHeader>
              <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
                <div className="flex flex-col">
                  <Label htmlFor="emergencyContactName" className={`pb-2 ${typography.body.large}`}>
                    Nombre del Contacto de Emergencia
                  </Label>
                  <Input
                    id="emergencyContactName"
                    type="text"
                    value={formData.emergencyContactName}
                    onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                    placeholder="e.g. María García"
                    className={`h-14 px-[15px] text-base ${components.input.base}`}
                  />
                </div>

                <div className="flex flex-col">
                  <Label htmlFor="emergencyContactPhone" className={`pb-2 ${typography.body.large} flex items-center gap-2`}>
                    <Phone className="h-4 w-4" />
                    Teléfono de Emergencia
                  </Label>
                  <Input
                    id="emergencyContactPhone"
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                    placeholder="e.g. +34 600 123 456"
                    className={`h-14 px-[15px] text-base ${components.input.base}`}
                  />
                </div>

                <div className="flex flex-col">
                  <Label htmlFor="linkedin" className={`pb-2 ${typography.body.large} flex items-center gap-2`}>
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </Label>
                  <Input
                    id="linkedin"
                    type="url"
                    value={formData.linkedin}
                    onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                    placeholder="e.g. https://linkedin.com/in/tu-perfil"
                    className={`h-14 px-[15px] text-base ${components.input.base}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Change Password Section */}
            <div className="flex flex-col">
              <Label className={`pb-2 ${typography.body.large}`}>
                Seguridad
              </Label>
              <Button
                variant="ghost"
                className="h-14 w-full bg-slate-200 dark:bg-slate-800 text-[#0d141b] dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 font-medium rounded-lg"
                onClick={handleChangePasswordClick}
              >
                Cambiar Contraseña
              </Button>
            </div>

            {/* Gestión de Vehículos */}
            {user && (
              <UserVehicleManagement 
                userId={user.documentId || user.id} 
                userRole={user.role}
              />
            )}
          </section>
        </div>
      </AdminLayout>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Button
            className={`h-14 w-full ${components.input.full} text-base font-bold`}
            onClick={handleSaveChanges}
            disabled={isSaving || isUploadingImage}
          >
            {isSaving || isUploadingImage ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </div>

      {/* Diálogo de Cambio de Contraseña */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Cambiar Contraseña
            </DialogTitle>
            <DialogDescription>
              Ingresa tu contraseña actual y la nueva contraseña para actualizar tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="currentPassword">Contraseña Actual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña actual"
                  className="h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="newPassword">Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className="h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowPasswordDialog(false)}
              disabled={isChangingPassword}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full sm:w-auto"
            >
              {isChangingPassword ? "Actualizando..." : "Actualizar Contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
