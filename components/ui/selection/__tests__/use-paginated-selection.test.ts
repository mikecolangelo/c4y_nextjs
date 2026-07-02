import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePaginatedSelection } from "@/hooks/use-paginated-selection";

describe("usePaginatedSelection", () => {
  it("toggles ids and reports selection state", () => {
    const { result } = renderHook(() => usePaginatedSelection());

    act(() => result.current.toggle("a"));
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.selectionCount).toBe(1);

    act(() => result.current.toggle("a"));
    expect(result.current.isSelected("a")).toBe(false);
    expect(result.current.selectionCount).toBe(0);
  });

  it("unions current page ids and removes only current-page ids", () => {
    const { result } = renderHook(() => usePaginatedSelection());

    act(() => result.current.selectCurrentPage(["a", "b"]));
    act(() => result.current.toggle("z")); // from another page
    expect(result.current.selectionCount).toBe(3);

    act(() => result.current.clearCurrentPage(["a", "b"]));
    expect(result.current.isSelected("z")).toBe(true);
    expect(result.current.isSelected("a")).toBe(false);
    expect(result.current.selectionCount).toBe(1);
  });

  it("selects every filtered id across pages and clears all", () => {
    const { result } = renderHook(() => usePaginatedSelection());

    act(() => result.current.selectAllAcrossPages(["a", "b", "c", "d"]));
    expect(result.current.selectionCount).toBe(4);

    act(() => result.current.clearAll());
    expect(result.current.selectionCount).toBe(0);
  });

  it("reports current page all-selected", () => {
    const { result } = renderHook(() => usePaginatedSelection());

    expect(result.current.isCurrentPageAllSelected(["a", "b"])).toBe(false);
    act(() => result.current.selectCurrentPage(["a", "b"]));
    expect(result.current.isCurrentPageAllSelected(["a", "b"])).toBe(true);
    // Empty page is never "all selected".
    expect(result.current.isCurrentPageAllSelected([])).toBe(false);
  });

  describe("getAcrossPagesBanner", () => {
    it("does NOT show when everything fits on one page", () => {
      const { result } = renderHook(() => usePaginatedSelection());
      act(() => result.current.selectCurrentPage(["a", "b"]));
      const banner = result.current.getAcrossPagesBanner(["a", "b"], ["a", "b"]);
      expect(banner.show).toBe(false);
      expect(banner.remaining).toBe(0);
    });

    it("does NOT show when the current page is not fully selected", () => {
      const { result } = renderHook(() => usePaginatedSelection());
      act(() => result.current.toggle("a"));
      const banner = result.current.getAcrossPagesBanner(["a", "b"], ["a", "b", "c", "d"]);
      expect(banner.show).toBe(false);
    });

    it("shows when current page is full and more filtered rows exist beyond it", () => {
      const { result } = renderHook(() => usePaginatedSelection());
      act(() => result.current.selectCurrentPage(["a", "b"]));
      const banner = result.current.getAcrossPagesBanner(["a", "b"], ["a", "b", "c", "d"]);
      expect(banner.show).toBe(true);
      expect(banner.pageCount).toBe(2);
      expect(banner.totalFiltered).toBe(4);
      expect(banner.remaining).toBe(2);
      expect(banner.isAllFilteredSelected).toBe(false);
    });

    it("does NOT show once every filtered row is selected", () => {
      const { result } = renderHook(() => usePaginatedSelection());
      act(() => result.current.selectAllAcrossPages(["a", "b", "c", "d"]));
      const banner = result.current.getAcrossPagesBanner(["a", "b"], ["a", "b", "c", "d"]);
      expect(banner.show).toBe(false);
      expect(banner.isAllFilteredSelected).toBe(true);
    });
  });
});
