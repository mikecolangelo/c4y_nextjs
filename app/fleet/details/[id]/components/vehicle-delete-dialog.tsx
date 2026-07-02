"use client";

import type { MouseEvent } from "react";
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
import { Can } from "@/components/auth/can";

interface VehicleDeleteDialogProps {
  isOpen: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function VehicleDeleteDialog({
  isOpen,
  isDeleting,
  onOpenChange,
  onConfirmDelete,
}: VehicleDeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent onClose={() => onOpenChange(false)}>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este vehículo?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción eliminará el vehículo de la flota y no se podrá deshacer. Confirma si deseas
            continuar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <Can module="fleet" action="canDelete">
            <AlertDialogAction onClick={onConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </Can>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
