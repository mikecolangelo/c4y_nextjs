import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNotificationsStream } from "@/hooks/use-notifications-stream";

/** Minimal in-memory EventSource mock that records listeners and lets tests drive events. */
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  private listeners = new Map<string, Set<() => void>>();

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: () => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(cb);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, cb: () => void) {
    this.listeners.get(type)?.delete(cb);
  }

  close() {
    this.closed = true;
  }

  emit(type: string) {
    this.listeners.get(type)?.forEach((cb) => cb());
  }

  open() {
    this.onopen?.();
  }

  error() {
    this.onerror?.();
  }
}

describe("useNotificationsStream", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("connects to the stream endpoint with credentials", () => {
    renderHook(() => useNotificationsStream({ onRefresh: vi.fn() }));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/notifications/stream");
    expect(MockEventSource.instances[0].withCredentials).toBe(true);
  });

  it("reports 'open' once the connection opens", () => {
    const { result } = renderHook(() => useNotificationsStream({ onRefresh: vi.fn() }));
    expect(result.current.status).toBe("connecting");
    act(() => MockEventSource.instances[0].open());
    expect(result.current.status).toBe("open");
  });

  it("calls onRefresh on each push event", () => {
    const onRefresh = vi.fn();
    renderHook(() => useNotificationsStream({ onRefresh }));
    act(() => MockEventSource.instances[0].open());

    act(() => MockEventSource.instances[0].emit("notification.created"));
    act(() => MockEventSource.instances[0].emit("notification.updated"));
    act(() => MockEventSource.instances[0].emit("notification.deleted"));

    expect(onRefresh).toHaveBeenCalledTimes(3);
  });

  it("reconnects with backoff after an error", () => {
    renderHook(() => useNotificationsStream({ onRefresh: vi.fn(), maxReconnectAttempts: 4 }));
    expect(MockEventSource.instances).toHaveLength(1);

    act(() => MockEventSource.instances[0].error());
    // First backoff is 1000ms.
    act(() => vi.advanceTimersByTime(1000));
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("falls back to polling after exhausting reconnect attempts", () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      useNotificationsStream({ onRefresh, maxReconnectAttempts: 1, pollIntervalMs: 1000 })
    );

    // One error meets the (max=1) threshold and triggers the polling fallback.
    act(() => MockEventSource.instances[0].error());
    expect(result.current.status).toBe("polling");

    act(() => vi.advanceTimersByTime(1000));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("falls back to polling when EventSource is unsupported", () => {
    vi.stubGlobal("EventSource", undefined);
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      useNotificationsStream({ onRefresh, pollIntervalMs: 1000 })
    );
    expect(result.current.status).toBe("polling");
    act(() => vi.advanceTimersByTime(1000));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("does not connect when disabled", () => {
    renderHook(() => useNotificationsStream({ onRefresh: vi.fn(), enabled: false }));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("closes the connection on unmount", () => {
    const { unmount } = renderHook(() => useNotificationsStream({ onRefresh: vi.fn() }));
    const source = MockEventSource.instances[0];
    unmount();
    expect(source.closed).toBe(true);
  });
});
