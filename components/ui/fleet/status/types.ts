import type { VehicleState } from "@/validations/types";

export type { VehicleState };

export interface StatusItemProps {
  status: VehicleState;
  isLast: boolean;
  isLoading?: boolean;
  onEdit?: (statusId: number | string, editComment: string, imageIds?: number[], newImages?: File[]) => Promise<void>;
  onDelete?: (statusId: number | string) => Promise<void>;
  vehicleId: string;
}

export interface VehicleStatusTimelineProps {
  statuses: VehicleState[];
  isLoading?: boolean;
  loadingStatusId?: string | number | null;
  onEdit?: (statusId: number | string, editComment: string, imageIds?: number[], newImages?: File[]) => Promise<void>;
  onDelete?: (statusId: number | string) => Promise<void>;
  vehicleId: string;
  onAddClick?: () => void;
}

















