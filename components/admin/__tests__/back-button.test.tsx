import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackButton } from "../back-button";

const backMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: backMock, push: pushMock }),
}));

describe("BackButton", () => {
  beforeEach(() => {
    backMock.mockReset();
    pushMock.mockReset();
  });

  it("renders icon-only by default with an accessible label", () => {
    render(<BackButton />);
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("renders a visible label when provided", () => {
    render(<BackButton label="Volver" />);
    expect(screen.getByText("Volver")).toBeInTheDocument();
  });

  it("calls router.back() on click when there is history", () => {
    window.history.pushState({}, "", "/users/details/1");
    render(<BackButton fallbackHref="/users" />);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(backMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates back with the Cmd/Ctrl + ArrowLeft shortcut", () => {
    window.history.pushState({}, "", "/users/details/1");
    render(<BackButton fallbackHref="/users" />);
    fireEvent.keyDown(window, { key: "ArrowLeft", metaKey: true });
    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it("ignores the shortcut while typing in a field", () => {
    render(
      <div>
        <BackButton fallbackHref="/users" />
        <input data-testid="field" />
      </div>
    );
    const field = screen.getByTestId("field");
    field.focus();
    fireEvent.keyDown(field, { key: "ArrowLeft", ctrlKey: true });
    expect(backMock).not.toHaveBeenCalled();
  });
});
