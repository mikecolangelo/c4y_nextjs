import type { FleetDocument } from "@/validations/types";

export type { FleetDocument };

export interface DocumentItemProps {
  document: FleetDocument;
  onDelete?: (documentId: number | string) => Promise<void>;
  onEdit?: (document: FleetDocument) => void;
  isEditing?: boolean;
}

export interface FleetDocumentsProps {
  documents: FleetDocument[];
  isLoading?: boolean;
  onDelete?: (documentId: number | string) => Promise<void>;
  onEdit?: (document: FleetDocument) => void;
  editingDocumentId?: string | number | null;
  vehicleId: string;
  onAddClick?: () => void;
}
