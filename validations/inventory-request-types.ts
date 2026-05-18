// ============================================
// Inventory Request Types (Solicitudes de Piezas)
// ============================================

export type InventoryRequestStatus = "pendiente" | "aprobado" | "rechazado" | "entregado" | "cancelado";

export const INVENTORY_REQUEST_STATUS_LABELS: Record<InventoryRequestStatus, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  entregado: "Entregado",
  cancelado: "Cancelado"
};

export interface InventoryRequestRawAttributes {
  requestNumber?: string;
  quantity: number;
  unit?: string;
  justification: string;
  status: InventoryRequestStatus;
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
  inventoryItem?: {
    id?: number;
    documentId?: string;
    code?: string;
    description?: string;
    stock?: number;
  } | {
    data?: {
      id?: number;
      documentId?: string;
      attributes?: {
        code?: string;
        description?: string;
        stock?: number;
      };
    } | null;
  };
}

export type InventoryRequestRaw =
  | ({ id?: number | string; documentId?: string } & InventoryRequestRawAttributes)
  | {
      id?: number | string;
      documentId?: string;
      attributes: InventoryRequestRawAttributes & { documentId?: string };
    };

export interface InventoryRequestCard {
  id: string;
  documentId: string;
  requestNumber?: string;
  quantity: number;
  unit?: string;
  justification: string;
  status: InventoryRequestStatus;
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
  inventoryItemCode?: string;
  inventoryItemDescription?: string;
  inventoryItemId?: string;
  inventoryItemDocumentId?: string;
  inventoryItemStock?: number;
  canApprove: boolean;
  canDeliver: boolean;
}

export interface InventoryRequestCreatePayload {
  inventoryItem: number | string;
  quantity: number;
  unit?: string;
  justification: string;
}

export interface InventoryRequestUpdatePayload {
  inventoryItem?: number | string;
  quantity?: number;
  unit?: string;
  justification?: string;
  status?: InventoryRequestStatus;
  notes?: string;
}

export interface InventoryRequestApprovePayload {
  notes?: string;
}

export interface InventoryRequestRejectPayload {
  notes?: string;
}
