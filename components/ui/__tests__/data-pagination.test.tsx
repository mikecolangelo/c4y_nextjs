import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DataPagination } from "@/components/ui/data-pagination";

describe("DataPagination", () => {
  it("renders the 'Página X de Y' indicator", () => {
    render(<DataPagination currentPage={2} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText("Página 2 de 5")).toBeInTheDocument();
  });

  it("returns null when there is a single page or fewer", () => {
    const { container } = render(
      <DataPagination currentPage={1} totalPages={1} onPageChange={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("fires onPageChange with the next page when Siguiente is clicked", () => {
    const onPageChange = vi.fn();
    render(<DataPagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("fires onPageChange with the previous page when Anterior is clicked", () => {
    const onPageChange = vi.fn();
    render(<DataPagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables Anterior on the first page", () => {
    const onPageChange = vi.fn();
    render(<DataPagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);

    const prev = screen.getByRole("button", { name: /anterior/i });
    expect(prev).toBeDisabled();
    fireEvent.click(prev);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("disables Siguiente on the last page", () => {
    const onPageChange = vi.fn();
    render(<DataPagination currentPage={5} totalPages={5} onPageChange={onPageChange} />);

    const next = screen.getByRole("button", { name: /siguiente/i });
    expect(next).toBeDisabled();
    fireEvent.click(next);
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
