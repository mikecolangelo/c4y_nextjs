// Appointment Types v2
export type AppointmentType = "venta" | "prueba" | "mantenimiento" | "recordatorio";
export type AppointmentStatus = "confirmada" | "pendiente" | "cancelada";
export type AppointmentFrequency = "unica" | "semanal" | "quincenal" | "mensual";

export interface AppointmentV2 {
  id: string;
  numericId: number;
  documentId: string;
  title?: string;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledAt: string;
  scheduledAtLabel: string;
  isAllDay: boolean;
  frequency: AppointmentFrequency;
  durationMinutes?: number;
  description?: string;
  price?: number;
  priceLabel?: string;
  notes?: string;
  location?: string;
  contactPhone?: string;
  contactEmail?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  time: string;
  period: "AM" | "PM";
  day: number;
  month: number;
  year: number;
  vehicle?: {
    id?: string;
    documentId?: string;
    name?: string;
    placa?: string;
    brand?: string;
    model?: string;
  };
  service?: {
    id?: string;
    documentId?: string;
    name?: string;
    price?: number;
    coverage?: "cliente" | "empresa";
  };
  assignedTo?: {
    id?: string;
    documentId?: string;
    displayName?: string;
    email?: string;
  };
  parentAppointment?: {
    id?: string;
    documentId?: string;
  };
  childAppointments?: Array<{
    id?: string;
    documentId?: string;
  }>;
  serviceOrder?: {
    id?: string;
    documentId?: string;
    code?: string;
    status?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  _isFleetReminder?: boolean;
}

export interface AppointmentCreatePayload {
  title?: string;
  type: AppointmentType;
  status?: AppointmentStatus;
  scheduledAt: string;
  isAllDay?: boolean;
  frequency?: AppointmentFrequency;
  durationMinutes?: number;
  description?: string;
  price?: number;
  notes?: string;
  location?: string;
  contactPhone?: string;
  contactEmail?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  vehicle?: string | number;
  service?: string | number;
  assignedTo?: string | number;
  parentAppointment?: string | number;
  serviceOrder?: string | number;
}

export interface AppointmentUpdatePayload {
  title?: string;
  type?: AppointmentType;
  status?: AppointmentStatus;
  scheduledAt?: string;
  isAllDay?: boolean;
  frequency?: AppointmentFrequency;
  durationMinutes?: number;
  description?: string;
  price?: number;
  notes?: string;
  location?: string;
  contactPhone?: string;
  contactEmail?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  vehicle?: string | number | null;
  service?: string | number | null;
  assignedTo?: string | number | null;
}

export interface AppointmentActivityItem {
  id: string;
  documentId: string;
  title?: string;
  type: AppointmentType;
  typeLabel: string;
  status: AppointmentStatus;
  statusLabel: string;
  scheduledAt: string;
  authorName?: string;
  vehicleName?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Legacy Appointment Types (preservados para compatibilidad si hay imports residuales)

// Strapi Response Types
export interface StrapiResponse<T = unknown> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiData<T> {
  id: number;
  documentId?: string;
  attributes?: T;
}

// Client Types
export interface ClientData {
  id?: number;
  documentId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
}

// Vehicle Types
export interface VehicleData {
  id?: number;
  documentId?: string;
  name?: string;
  placa?: string;
}

// Deal Types
export interface DealData {
  id?: number;
  documentId?: string;
  title?: string;
}

// Assigned To Types
export interface AssignedToData {
  id?: number;
  documentId?: string;
  displayName?: string;
  email?: string;
}

// Service Catalog Types
export type ServiceCoverage = "cliente" | "empresa";

export interface ServiceTemplateItem {
  inventoryItemId: string;
  code: string;
  description: string;
  quantity: number;
  salePrice: number;
}

export interface ServiceCard {
  id: string;
  documentId: string;
  name: string;
  price: number;
  priceLabel: string;
  coverage: ServiceCoverage;
  coverageLabel: string;
  isFree: boolean;
  description?: string;
  category?: string;
  durationMinutes?: number;
  basePrice?: number;
  agencyCost?: number;
  maintenanceKits?: MaintenanceKitCard[];
  defaultTemplate?: ServiceTemplateItem[];
}

export interface ServiceRawAttributes {
  documentId?: string;
  name?: string;
  price?: number;
  coverage?: ServiceCoverage;
  description?: string;
  category?: string;
  durationMinutes?: number;
  basePrice?: number;
  agencyCost?: number;
  defaultTemplate?: ServiceTemplateItem[];
}

export interface ServiceRaw {
  id: number | string;
  documentId?: string;
  attributes?: ServiceRawAttributes;
}

export interface ServiceCreatePayload {
  name: string;
  price: number;
  coverage: ServiceCoverage;
  description?: string;
  category?: string;
  durationMinutes?: number;
  basePrice?: number;
  agencyCost?: number;
  defaultTemplate?: ServiceTemplateItem[];
}

export interface ServiceUpdatePayload {
  name?: string;
  price?: number;
  coverage?: ServiceCoverage;
  description?: string;
  category?: string;
  durationMinutes?: number;
  basePrice?: number;
  agencyCost?: number;
  defaultTemplate?: ServiceTemplateItem[];
}

// Maintenance Kit Types
export interface MaintenanceKitItemCard {
  id: string;
  documentId: string;
  quantity: number;
  inventoryItem: {
    id: string;
    documentId: string;
    code: string;
    description: string;
    salePrice: number;
    stock: number;
    unit?: string;
  };
}

export interface MaintenanceKitCard {
  id: string;
  documentId: string;
  name: string;
  type: string;
  description?: string;
  defaultLaborCost?: number;
  isActive?: boolean;
  kitItems?: MaintenanceKitItemCard[];
}

// Service Order Types
export interface ServiceOrderData {
  id?: number;
  documentId?: string;
}

// Appointment Raw Types (from Strapi)
export interface AppointmentRawAttributes {
  documentId?: string;
  title?: string;
  type: AppointmentType;
  status?: AppointmentStatus;
  scheduledAt: string;
  durationMinutes?: number;
  description?: string;
  price?: number | string;
  notes?: string;
  location?: string;
  contactPhone?: string;
  contactEmail?: string;
  client?: { data?: { id: number; documentId?: string; attributes?: { fullName?: string; email?: string; phone?: string } } } | ClientData;
  vehicle?: { data?: { id: number; documentId?: string; attributes?: { name?: string; placa?: string } } } | VehicleData;
  deal?: { data?: { id: number; documentId?: string; attributes?: { title?: string } } } | DealData;
  assignedTo?: { data?: { id: number; documentId?: string; attributes?: { displayName?: string; email?: string } } } | AssignedToData;
  serviceOrder?: { data?: { id: number; documentId?: string } } | ServiceOrderData;
}

export interface AppointmentRaw {
  id: number;
  documentId?: string;
  attributes?: AppointmentRawAttributes;
}

// Appointment Card Type (normalized for frontend)
export interface AppointmentCard {
  id: string;
  documentId: string;
  title?: string;
  type: AppointmentType;
  typeLabel: string;
  status: AppointmentStatus;
  statusLabel: string;
  scheduledAt: string;
  scheduledAtLabel: string;
  time: string;
  period: "AM" | "PM";
  day: number;
  month: number;
  year: number;
  durationMinutes?: number;
  description?: string;
  price?: number;
  priceLabel?: string;
  notes?: string;
  location?: string;
  contactPhone?: string;
  contactEmail?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientId?: string;
  clientDocumentId?: string;
  vehicleName?: string;
  vehiclePlaca?: string;
  vehicleId?: string;
  vehicleDocumentId?: string;
  dealTitle?: string;
  dealId?: string;
  dealDocumentId?: string;
  assignedToName?: string;
  assignedToEmail?: string;
  assignedToId?: string;
  assignedToDocumentId?: string;
  serviceOrderId?: string;
  serviceOrderDocumentId?: string;
}

// Page Metadata Types
export interface StrapiPageMetadata {
  title?: string;
  description?: string;
  favicon?: {
    url?: string;
  };
}

// Auth Types
export interface SinginData {
  sections?: Array<{
    __component?: string;
    [key: string]: unknown;
  }>;
  title?: string;
  description?: string;
  header?: AuthHeader;
}

export interface AuthHeader {
  title: string;
  subtitle: string;
}

export interface AuthLink {
  href: string;
  label: string;
}

export interface SinginFormData {
  title?: string;
  description?: string;
  header: AuthHeader;
  email_label: string;
  email_placeholder: string;
  password_label: string;
  password_placeholder: string;
  submit_button: string;
  singup_previous_link_text: string;
  singup_link?: AuthLink[];
}

export interface SinginDataProcessed {
  title?: string;
  description?: string;
  header?: AuthHeader;
  singinForm?: SinginFormData;
}

export interface SingupData {
  sections?: Array<{
    __component?: string;
    [key: string]: unknown;
  }>;
  Title?: string;
  Description?: string;
  header?: AuthHeader;
}

export interface SingupFormData {
  title?: string;
  description?: string;
  header: AuthHeader;
  fullname_label?: string;
  fullname_placeholder?: string;
  username_label: string;
  username_placeholder: string;
  email_label: string;
  email_placeholder: string;
  password_label: string;
  password_placeholder: string;
  submit_buton: string;
  singin_previous_link_text: string;
  singin_link?: AuthLink[];
}

export interface SingupDataProcessed {
  title?: string;
  description?: string;
  header?: AuthHeader;
  singupForm?: SingupFormData;
}

// Dashboard Types
export interface HeroSectionData {
  title?: string;
  description?: string;
  backgroundImage?: {
    url?: string;
    alternativeText?: string;
  };
  ctaButton?: {
    label?: string;
    link?: string;
  };
}

export interface DashboardData {
  title?: string;
  description?: string;
  favicon?: {
    url?: string;
  };
  sections?: Array<{
    __component?: string;
    [key: string]: unknown;
  }>;
}

export interface DashboardDataProcessed {
  title?: string;
  description?: string;
  favicon?: {
    url?: string;
  };
  sections: HeroSectionData[];
}

// Fleet Vehicle Types
export type FleetVehicleCondition = "nuevo" | "usado" | "seminuevo";

export interface FleetVehicleImage {
  id?: number;
  documentId?: string;
  url?: string;
  alternativeText?: string;
  formats?: {
    thumbnail?: { url?: string };
    small?: { url?: string };
    medium?: { url?: string };
    large?: { url?: string };
  };
}

export interface FleetVehicleRawAttributes {
  documentId?: string;
  name?: string;
  vin?: string;
  price?: number | string;
  condition?: FleetVehicleCondition;
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  currentMileage?: number;
  fuelType?: string;
  transmission?: string;
  imageAlt?: string;
  placa?: string;
  billingInitials?: string;
  nextMaintenanceDate?: string;
  maintenanceMileageInterval?: number;
  lastMaintenanceMileage?: number;
  oilChangeInterval?: number;
  lastOilChangeMileage?: number;
  oilChangeNotificationSent?: boolean;
  image?: FleetVehicleImage | { data?: { id?: number; attributes?: FleetVehicleImage } | null } | number | null;
  responsables?: Array<{
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: FleetVehicleImage | { data?: { attributes?: FleetVehicleImage } | null };
  }>;
  assignedDrivers?: Array<{
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: FleetVehicleImage | { data?: { attributes?: FleetVehicleImage } | null };
  }>;
  interestedDrivers?: Array<{
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: FleetVehicleImage | { data?: { attributes?: FleetVehicleImage } | null };
  }>;
  currentDrivers?: Array<{
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: FleetVehicleImage | { data?: { attributes?: FleetVehicleImage } | null };
  }>;
  interestedPersons?: Array<{
    id?: number;
    documentId?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    status?: string;
    avatar?: FleetVehicleImage | { data?: { attributes?: FleetVehicleImage } | null };
  }>;
  financing?: {
    id?: number;
    documentId?: string;
    financingNumber?: string;
    status?: string;
    totalAmount?: number;
    paidQuotas?: number;
    totalQuotas?: number;
    quotaAmount?: number;
    currentBalance?: number;
    totalPaid?: number;
    nextDueDate?: string;
    partialPaymentCredit?: number;
  };
}

export interface FleetVehicleRaw {
  id: number;
  documentId?: string;
  attributes?: FleetVehicleRawAttributes;
}

export interface FleetVehicleCard {
  id: string;
  documentId: string;
  name: string;
  vin: string;
  condition: FleetVehicleCondition;
  brand?: string;
  model?: string;
  year?: number;
  priceNumber: number;
  priceLabel: string;
  imageUrl?: string;
  imageAlt?: string;
  imageData?: {
    url?: string;
    alternativeText?: string;
    formats?: FleetVehicleImage["formats"];
  };
  color?: string;
  currentMileage?: number;
  fuelType?: string;
  transmission?: string;
  nextMaintenanceDate?: string;
  maintenanceMileageInterval?: number;
  lastMaintenanceMileage?: number;
  oilChangeInterval?: number;
  lastOilChangeMileage?: number;
  oilChangeNotificationSent?: boolean;
  placa?: string;
  billingInitials?: string;
  assignedDrivers?: Array<{
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: { url?: string; alternativeText?: string };
  }>;
  responsables?: Array<{
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: { url?: string; alternativeText?: string };
  }>;
  interestedDrivers?: Array<{
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: { url?: string; alternativeText?: string };
  }>;
  currentDrivers?: Array<{
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: { url?: string; alternativeText?: string };
  }>;
  interestedPersons?: Array<{
    id?: number;
    documentId?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    status?: string;
    avatar?: { url?: string; alternativeText?: string };
  }>;
  financing?: {
    id?: number;
    documentId?: string;
    financingNumber?: string;
    status?: string;
    totalAmount?: number;
    paidQuotas?: number;
    totalQuotas?: number;
    quotaAmount?: number;
    currentBalance?: number;
    totalPaid?: number;
    nextDueDate?: string;
    partialPaymentCredit?: number;
  };
}

export interface VehicleState {
  id: number;
  documentId?: string;
  comment?: string;
  images?: Array<{
    id?: number;
    url?: string;
    alternativeText?: string;
  }>;
  authorDocumentId?: string;
  author?: {
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: { url?: string; alternativeText?: string };
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface FleetMileageHistoryItem {
  id: number;
  documentId?: string;
  previousMileage: number;
  newMileage: number;
  notes?: string;
  createdByName?: string;
  changeType: "mileage_update" | "oil_change_reset";
  createdAt?: string;
  updatedAt?: string;
}

export interface FleetVehicleUpdatePayload {
  name?: string;
  vin?: string;
  price?: number;
  condition?: FleetVehicleCondition;
  brand?: string;
  model?: string;
  year?: number;
  color?: string | null;
  currentMileage?: number | null;
  fuelType?: string | null;
  transmission?: string | null;
  image?: number | null;
  imageAlt?: string | null;
  placa?: string | null;
  billingInitials?: string | null;
  nextMaintenanceDate?: string | null;
  maintenanceMileageInterval?: number | null;
  lastMaintenanceMileage?: number | null;
  oilChangeInterval?: number | null;
  lastOilChangeMileage?: number | null;
  responsables?: number[];
  assignedDrivers?: number[];
  interestedDrivers?: number[];
}

// Recurrence Pattern Types
export type RecurrencePattern = "daily" | "weekly" | "biweekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";

// Strapi Image Type
export interface StrapiImage {
  id?: number;
  documentId?: string;
  url?: string;
  alternativeText?: string;
  formats?: {
    thumbnail?: { url?: string };
    small?: { url?: string };
    medium?: { url?: string };
    large?: { url?: string };
  };
}

// Service Order Status Types
export type ServiceOrderStatus = "pending" | "in_progress" | "completed" | "cancelled";

// Service Order Types
export interface ServiceOrderRawAttributes {
  documentId?: string;
  status?: ServiceOrderStatus;
  scheduledDate?: string;
  completedDate?: string;
  notes?: string;
  totalCost?: number;
  service?: { data?: { id: number; documentId?: string; attributes?: { name?: string; price?: number; coverage?: string } } } | { id?: number; documentId?: string; name?: string; price?: number; coverage?: string };
  fleet?: { data?: { id: number; documentId?: string; attributes?: { name?: string; vin?: string; placa?: string } } } | { id?: number; documentId?: string; name?: string; vin?: string; placa?: string };
  createdBy?: { data?: { id: number; documentId?: string; attributes?: { displayName?: string; email?: string } } } | { id?: number; documentId?: string; displayName?: string; email?: string };
}

export interface ServiceOrderRaw {
  id: number;
  documentId?: string;
  attributes?: ServiceOrderRawAttributes;
}

export interface ServiceOrderCard {
  id: string;
  documentId: string;
  status: ServiceOrderStatus;
  statusLabel: string;
  scheduledDate?: string;
  scheduledDateLabel?: string;
  completedDate?: string;
  completedDateLabel?: string;
  notes?: string;
  totalCost?: number;
  totalCostLabel?: string;
  service?: {
    id?: string;
    documentId?: string;
    name: string;
    price?: number;
    coverage?: string;
  };
  fleet?: {
    id?: string;
    documentId?: string;
    name: string;
    vin?: string;
    placa?: string;
  };
  createdBy?: {
    id?: string;
    documentId?: string;
    displayName?: string;
    email?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceOrderCreatePayload {
  status?: ServiceOrderStatus;
  scheduledDate?: string;
  notes?: string;
  totalCost?: number;
  service: string | number; // documentId or id
  fleet: string | number; // documentId or id
  createdBy?: string | number; // documentId or id
}

export interface ServiceOrderUpdatePayload {
  status?: ServiceOrderStatus;
  scheduledDate?: string;
  completedDate?: string;
  notes?: string;
  totalCost?: number;
  service?: string | number;
  fleet?: string | number;
}

// Fleet Document Types
export interface FleetDocumentTypeData {
  id: number;
  documentId?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  order?: number;
}

export interface FleetDocument {
  id: number;
  documentId?: string;
  documentType: string;
  otherDescription?: string;
  files?: Array<{
    id?: number;
    url?: string;
    name?: string;
    mime?: string;
    size?: number;
    alternativeText?: string;
  }>;
  authorDocumentId?: string;
  author?: {
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: {
      url?: string;
      alternativeText?: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface FleetDocumentPayload {
  documentType: string;
  otherDescription?: string;
  files: number[];
  authorDocumentId?: string;
}

// ─────────────────────────────────────────────────────────────
// Vehicle Document v2 (Fase 11 - Zero Footprint)
// ─────────────────────────────────────────────────────────────
export interface VehicleDocumentCategory {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  order: number;
  templateFile?: {
    id?: number;
    url?: string;
    name?: string;
    mime?: string;
    size?: number;
  };
}

export interface VehicleDocumentFile {
  id?: number;
  url?: string;
  name?: string;
  mime?: string;
  size?: number;
  alternativeText?: string;
}

export interface VehicleDocument {
  id: number;
  documentId?: string;
  vehicleDocumentId: string;
  category?: VehicleDocumentCategory;
  description?: string;
  expirationDate?: string;
  files?: VehicleDocumentFile[];
  photos?: VehicleDocumentFile[];
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleDocumentPayload {
  vehicleDocumentId: string;
  category: number | string;
  description?: string;
  expirationDate?: string;
  files?: number[];
  photos?: number[];
}

// Reminder Types
export type ReminderModule = "fleet" | "calendar" | "billing" | "contracts" | "inventory" | "services";
export type ReminderType = "unique" | "recurring";

export interface FleetReminder {
  id: string | number;
  documentId?: string;
  title?: string;
  description?: string;
  scheduledDate?: string;
  nextTrigger?: string;
  reminderType?: ReminderType;
  recurrencePattern?: RecurrencePattern;
  recurrenceEndDate?: string;
  isActive?: boolean;
  isCompleted?: boolean;
  module?: ReminderModule;
  author?: {
    displayName?: string;
    email?: string;
  };
  assignedUsers?: Array<{
    id?: string | number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: {
      url?: string;
      alternativeText?: string;
    };
  }>;
  vehicle?: {
    name?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface FleetReminderPayload {
  title: string;
  scheduledDate: string;
  reminderType: ReminderType;
  recurrencePattern?: string;
  recurrenceEndDate?: string;
  description?: string;
  assignedUserIds?: string[];
  authorDocumentId?: string;
}

// ─────────────────────────────────────────────────────────────
// Inventory / Stock Types (Integración Servicios × Inventario)
// ─────────────────────────────────────────────────────────────
export type StockStatus = "high" | "medium" | "low";
export type InventoryIcon = "filter" | "disc" | "bolt" | "tire";

export interface InventoryItemRawAttributes {
  code: string;
  description: string;
  stock: number;
  stockStatus: StockStatus;
  assignedTo?: string;
  minStock?: number;
  maxStock?: number;
  unit?: string;
  location?: string;
  supplier?: string;
  lastRestocked?: string;
  icon?: InventoryIcon;
  unitCost?: number;
  salePrice?: number;
  isActive?: boolean;
}

export interface InventoryItemRaw {
  id: number | string;
  documentId?: string;
  attributes?: InventoryItemRawAttributes;
  code?: string;
  description?: string;
  stock?: number;
  stockStatus?: StockStatus;
  assignedTo?: string;
  minStock?: number;
  maxStock?: number;
  unit?: string;
  location?: string;
  supplier?: string;
  lastRestocked?: string;
  icon?: InventoryIcon;
  unitCost?: number;
  salePrice?: number;
  isActive?: boolean;
}

export interface InventoryItemCard {
  id: string;
  documentId: string;
  code: string;
  description: string;
  stock: number;
  stockStatus: StockStatus;
  assignedTo?: string;
  minStock?: number;
  maxStock?: number;
  unit?: string;
  location?: string;
  supplier?: string;
  lastRestocked?: string;
  icon: InventoryIcon;
  unitCost?: number;
  salePrice?: number;
  isActive?: boolean;
}

export interface InventoryItemCreatePayload {
  code: string;
  description: string;
  stock: number;
  stockStatus?: StockStatus;
  assignedTo?: string;
  minStock?: number;
  maxStock?: number;
  unit?: string;
  location?: string;
  supplier?: string;
  lastRestocked?: string;
  icon?: InventoryIcon;
  unitCost?: number;
  salePrice?: number;
  isActive?: boolean;
}

export interface InventoryItemUpdatePayload {
  code?: string;
  description?: string;
  stock?: number;
  stockStatus?: StockStatus;
  assignedTo?: string;
  minStock?: number;
  maxStock?: number;
  unit?: string;
  location?: string;
  supplier?: string;
  lastRestocked?: string;
  icon?: InventoryIcon;
  unitCost?: number;
  salePrice?: number;
  isActive?: boolean;
}

export interface InventoryMovement {
  id: number | string;
  documentId?: string;
  type: "entrada" | "salida" | "ajuste" | "reversion";
  quantity: number;
  reason?: string;
  date: string;
  inventoryItem?: InventoryItemCard;
  serviceOrder?: {
    id?: number | string;
    code?: string;
  };
  performedBy?: {
    id?: number;
    email?: string;
    username?: string;
  };
  createdAt?: string;
}

export interface StockDashboardMetrics {
  totalInventoryValue: number;
  criticalItemsCount: number;
  totalItemsCount: number;
  lastConsumptions: InventoryMovement[];
}

export interface StockAlert {
  id: string;
  code: string;
  description: string;
  stock: number;
  minStock: number;
  unit?: string;
  location?: string;
}
