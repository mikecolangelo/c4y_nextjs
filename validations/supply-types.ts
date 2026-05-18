// ============================================
// Supply Types (Suministros e Insumos)
// ============================================

export type SupplyType = "kit_limpieza" | "gasolina" | "aceite" | "otros";
export type SupplyUnit = "unidades" | "litros" | "galones" | "kits";
export type SupplyIcon = "package" | "fuel" | "droplet" | "box";
export type SupplyRequestStatus = "pendiente" | "aprobado" | "rechazado" | "entregado" | "cancelado";

export const SUPPLY_TYPE_LABELS: Record<SupplyType, string> = {
  kit_limpieza: "Kit de Limpieza",
  gasolina: "Gasolina",
  aceite: "Aceite",
  otros: "Otros"
};

export const SUPPLY_UNIT_LABELS: Record<SupplyUnit, string> = {
  unidades: "Unidades",
  litros: "Litros",
  galones: "Galones",
  kits: "Kits"
};

export const SUPPLY_STATUS_LABELS: Record<SupplyRequestStatus, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  entregado: "Entregado",
  cancelado: "Cancelado"
};

export interface SupplyItemRawAttributes {
  name: string;
  type: SupplyType;
  stock: number;
  unit: SupplyUnit;
  minStock?: number;
  description?: string;
  isActive: boolean;
  icon: SupplyIcon;
  documentId?: string;
}

export type SupplyItemRaw =
  | ({ id?: number | string; documentId?: string } & SupplyItemRawAttributes)
  | {
      id?: number | string;
      documentId?: string;
      attributes: SupplyItemRawAttributes & { documentId?: string };
    };

export interface SupplyItemCard {
  id: string;
  documentId: string;
  name: string;
  type: SupplyType;
  typeLabel: string;
  stock: number;
  unit: SupplyUnit;
  unitLabel: string;
  minStock?: number;
  description?: string;
  isActive: boolean;
  icon: SupplyIcon;
  stockStatus: "high" | "medium" | "low";
}

export interface SupplyItemCreatePayload {
  name: string;
  type: SupplyType;
  stock: number;
  unit: SupplyUnit;
  minStock?: number;
  description?: string;
  isActive?: boolean;
  icon?: SupplyIcon;
}

export interface SupplyItemUpdatePayload {
  name?: string;
  type?: SupplyType;
  stock?: number;
  unit?: SupplyUnit;
  minStock?: number;
  description?: string;
  isActive?: boolean;
  icon?: SupplyIcon;
}

export interface SupplyRequestRawAttributes {
  requestNumber?: string;
  type: SupplyType;
  quantity: number;
  unit: SupplyUnit;
  justification: string;
  status: SupplyRequestStatus;
  notes?: string;
  requestedAt: string;
  approvedAt?: string;
  deliveredAt?: string;
  documentId?: string;
  requester?: {
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
  } | {
    data?: {
      id?: number;
      documentId?: string;
      attributes?: {
        displayName?: string;
        email?: string;
      };
    } | null;
  };
  approvedBy?: {
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
  } | {
    data?: {
      id?: number;
      documentId?: string;
      attributes?: {
        displayName?: string;
        email?: string;
      };
    } | null;
  };
  supplyItem?: {
    id?: number;
    documentId?: string;
    name?: string;
    stock?: number;
  } | {
    data?: {
      id?: number;
      documentId?: string;
      attributes?: {
        name?: string;
        stock?: number;
      };
    } | null;
  };
}

export type SupplyRequestRaw =
  | ({ id?: number | string; documentId?: string } & SupplyRequestRawAttributes)
  | {
      id?: number | string;
      documentId?: string;
      attributes: SupplyRequestRawAttributes & { documentId?: string };
    };

export interface SupplyRequestCard {
  id: string;
  documentId: string;
  requestNumber?: string;
  type: SupplyType;
  typeLabel: string;
  quantity: number;
  unit: SupplyUnit;
  unitLabel: string;
  justification: string;
  status: SupplyRequestStatus;
  statusLabel: string;
  notes?: string;
  requestedAt: string;
  requestedAtLabel: string;
  approvedAt?: string;
  approvedAtLabel?: string;
  deliveredAt?: string;
  deliveredAtLabel?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterId?: string;
  requesterDocumentId?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  approvedById?: string;
  approvedByDocumentId?: string;
  supplyItemName?: string;
  supplyItemId?: string;
  supplyItemDocumentId?: string;
  supplyItemStock?: number;
  canApprove: boolean;
  canDeliver: boolean;
}

export interface SupplyRequestCreatePayload {
  type: SupplyType;
  quantity: number;
  unit: SupplyUnit;
  justification: string;
  supplyItem?: number | string;
}

export interface SupplyRequestUpdatePayload {
  type?: SupplyType;
  quantity?: number;
  unit?: SupplyUnit;
  justification?: string;
  status?: SupplyRequestStatus;
  notes?: string;
  supplyItem?: number | string | null;
}

export interface SupplyRequestApprovePayload {
  notes?: string;
}

export interface SupplyRequestRejectPayload {
  notes?: string;
}
