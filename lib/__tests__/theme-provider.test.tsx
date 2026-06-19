import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../theme-provider";

function ThemeProbe() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme("dark")}>go-dark</button>
    </div>
  );
}

function mockFetch(meTheme: string | null) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/user-profile/me")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { themePreference: meTheme } }),
      } as Response);
    }
    // PUT /api/user-profile/theme
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { themePreference: JSON.parse(String(init?.body)).themePreference },
        }),
    } as Response);
  });
}

describe("ThemeProvider DB sync", () => {
  beforeEach(() => {
    document.cookie = "admin-theme=; max-age=0; path=/";
    document.documentElement.classList.remove("dark");
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  it("hydrates the saved DB preference on load", async () => {
    global.fetch = mockFetch("dark") as unknown as typeof fetch;

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => expect(screen.getByTestId("resolved").textContent).toBe("dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists to the DB when the user changes the theme", async () => {
    const fetchSpy = mockFetch(null);
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText("go-dark"));
    });

    const putCall = fetchSpy.mock.calls.find(
      ([url, init]) => String(url).includes("/api/user-profile/theme") && init?.method === "PUT"
    );
    expect(putCall).toBeTruthy();
    expect(JSON.parse(String(putCall![1]!.body))).toEqual({ themePreference: "dark" });
  });
});
