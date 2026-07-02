"use client";

import { useCallback, useState } from "react";

import { toast } from "@/lib/toast";

/**
 * Singular/plural nouns used to build the toast copy, e.g.
 * `{ singular: "contacto", plural: "contactos" }`.
 */
export interface BatchDeleteLabels {
  singular: string;
  plural: string;
}

export interface UseBatchDeleteOptions {
  /**
   * Caller-supplied delete transport. Receives the ids to delete and must
   * resolve with how many succeeded/failed so the hook can pick the right
   * toast. Keep it transport-agnostic: a single batch endpoint, N parallel
   * `Promise.allSettled` DELETEs or sequential DELETEs all map onto this.
   */
  deleteBatch: (ids: string[]) => Promise<{ deletedCount: number; failedCount: number }>;
  /** Singular/plural noun for the toast copy. */
  labels: BatchDeleteLabels;
  /** Called after any non-total-failure outcome (e.g. refresh list / clear selection). */
  onSuccess?: () => void;
}

export interface UseBatchDeleteResult {
  /** Whether a delete is currently in flight. */
  isDeleting: boolean;
  /** Run the delete: toggles `isDeleting`, awaits `deleteBatch` and emits toasts. */
  runDelete: (ids: string[]) => Promise<void>;
}

/**
 * Reusable batch-delete hook that standardizes the duplicated delete STATE,
 * partial-failure handling and toast copy across modules (contacts, fleet,
 * service orders...). Stays domain-agnostic: callers own the transport via
 * `deleteBatch` and provide nouns via `labels`.
 *
 * Toast copy (mirrors the contacts implementation):
 * - Full success → `toast.success("{deletedCount} {singular}(s) eliminado(s) correctamente")`
 * - Partial      → `toast.warning("Se eliminaron {deletedCount} {plural}. {failedCount} no se pudieron eliminar.")`
 * - Total failure / throw → `toast.error("Error al eliminar: {message}")`
 *
 * `onSuccess` runs on full and partial success, but NOT on total failure / throw.
 */
export function useBatchDelete(options: UseBatchDeleteOptions): UseBatchDeleteResult {
  const { deleteBatch, labels, onSuccess } = options;
  const [isDeleting, setIsDeleting] = useState(false);

  const runDelete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setIsDeleting(true);
      try {
        const { deletedCount, failedCount } = await deleteBatch(ids);

        // Total failure: nothing was deleted. Treat as an error outcome.
        if (deletedCount === 0 && failedCount > 0) {
          toast.error(
            `Error al eliminar: no se pudo eliminar ${failedCount === 1 ? labels.singular : labels.plural}.`
          );
          return;
        }

        if (failedCount > 0) {
          toast.warning(
            `Se eliminaron ${deletedCount} ${labels.plural}. ${failedCount} no se pudieron eliminar.`
          );
        } else {
          toast.success(`${deletedCount} ${labels.singular}(s) eliminado(s) correctamente`);
        }

        onSuccess?.();
      } catch (err) {
        console.error("Error en eliminación masiva:", err);
        const message = err instanceof Error ? err.message : "Error desconocido";
        toast.error(`Error al eliminar: ${message}`);
      } finally {
        setIsDeleting(false);
      }
    },
    [deleteBatch, labels, onSuccess]
  );

  return { isDeleting, runDelete };
}
