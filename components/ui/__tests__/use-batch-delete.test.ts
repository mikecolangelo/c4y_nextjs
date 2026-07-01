/**
 * Tests for the reusable useBatchDelete hook.
 *
 * Lives under components/ui/__tests__ because the vitest `include` globs cover
 * `components/**` but NOT `hooks/**` (see vitest.config.mts), mirroring where
 * the use-paginated-selection test lives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useBatchDelete } from "@/hooks/use-batch-delete";
import { toast } from "@/lib/toast";

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const labels = { singular: "contacto", plural: "contactos" };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useBatchDelete", () => {
  it("toggles isDeleting around the delete and emits a success toast on full success", async () => {
    let resolveDelete: (v: { deletedCount: number; failedCount: number }) => void = () => {};
    const deleteBatch = vi.fn(
      () =>
        new Promise<{ deletedCount: number; failedCount: number }>((resolve) => {
          resolveDelete = resolve;
        })
    );
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useBatchDelete({ deleteBatch, labels, onSuccess }));

    expect(result.current.isDeleting).toBe(false);

    let pending: Promise<void>;
    act(() => {
      pending = result.current.runDelete(["a", "b"]);
    });

    await waitFor(() => expect(result.current.isDeleting).toBe(true));

    await act(async () => {
      resolveDelete({ deletedCount: 2, failedCount: 0 });
      await pending;
    });

    expect(result.current.isDeleting).toBe(false);
    expect(deleteBatch).toHaveBeenCalledWith(["a", "b"]);
    expect(toast.success).toHaveBeenCalledWith("2 contacto(s) eliminado(s) correctamente");
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("emits a warning toast on partial failure and still calls onSuccess", async () => {
    const deleteBatch = vi.fn(async () => ({ deletedCount: 3, failedCount: 2 }));
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useBatchDelete({ deleteBatch, labels, onSuccess }));

    await act(async () => {
      await result.current.runDelete(["a", "b", "c", "d", "e"]);
    });

    expect(toast.warning).toHaveBeenCalledWith(
      "Se eliminaron 3 contactos. 2 no se pudieron eliminar."
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("emits an error toast on total failure and does NOT call onSuccess", async () => {
    const deleteBatch = vi.fn(async () => ({ deletedCount: 0, failedCount: 2 }));
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useBatchDelete({ deleteBatch, labels, onSuccess }));

    await act(async () => {
      await result.current.runDelete(["a", "b"]);
    });

    expect(toast.error).toHaveBeenCalledWith("Error al eliminar: no se pudo eliminar contactos.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("emits an error toast when deleteBatch throws and does NOT call onSuccess", async () => {
    const deleteBatch = vi.fn(async () => {
      throw new Error("boom");
    });
    const onSuccess = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useBatchDelete({ deleteBatch, labels, onSuccess }));

    await act(async () => {
      await result.current.runDelete(["a"]);
    });

    expect(toast.error).toHaveBeenCalledWith("Error al eliminar: boom");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.isDeleting).toBe(false);
    consoleSpy.mockRestore();
  });

  it("is a no-op for an empty id list", async () => {
    const deleteBatch = vi.fn(async () => ({ deletedCount: 0, failedCount: 0 }));
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useBatchDelete({ deleteBatch, labels, onSuccess }));

    await act(async () => {
      await result.current.runDelete([]);
    });

    expect(deleteBatch).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
