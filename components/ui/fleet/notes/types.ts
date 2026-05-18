export interface FleetNote {
  id: number;
  documentId?: string;
  content: string;
  authorDocumentId?: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: {
      url?: string;
      alternativeText?: string;
    };
  };
}

export interface NoteItemProps {
  note: FleetNote;
  isLast: boolean;
  onEdit?: (noteId: number | string, editContent: string) => Promise<void>;
  onDelete?: (noteId: number | string) => Promise<void>;
  vehicleId: string;
}

export interface NotesTimelineProps {
  notes: FleetNote[];
  isLoading?: boolean;
  onEdit?: (noteId: number | string, editContent: string) => Promise<void>;
  onDelete?: (noteId: number | string) => Promise<void>;
  vehicleId: string;
  onAddClick?: () => void;
}

















