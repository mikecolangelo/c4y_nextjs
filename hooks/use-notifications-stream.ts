"use client";

import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

/** Connection state exposed by {@link useNotificationsStream}. */
export type StreamStatus = "connecting" | "open" | "polling";

/** Options for {@link useNotificationsStream}. */
export interface UseNotificationsStreamOptions {
  /**
   * Called whenever the stream signals that notifications changed (or when the
   * polling fallback ticks). Consumers refresh/merge their data here.
   */
  onRefresh: () => void;
  /** Whether the stream is active. Defaults to `true`. */
  enabled?: boolean;
  /** SSE endpoint to connect to. Defaults to `/api/notifications/stream`. */
  url?: string;
  /** Polling interval (ms) used only when SSE is unavailable. Default 60s. */
  pollIntervalMs?: number;
  /** Reconnect attempts before giving up on SSE and falling back. Default 4. */
  maxReconnectAttempts?: number;
}

/** Event names the backend hub publishes that should trigger a refresh. */
const PUSH_EVENTS = [
  "notification.created",
  "notification.updated",
  "notification.deleted",
] as const;

const DEFAULT_URL = "/api/notifications/stream";
const DEFAULT_POLL_MS = 60_000;
const DEFAULT_MAX_RECONNECTS = 4;

/**
 * Subscribes to the real-time notifications SSE stream and invokes `onRefresh`
 * on every push event. If `EventSource` is unsupported or the connection keeps
 * failing, it gracefully falls back to interval polling (only while the tab is
 * visible), preserving the previous polling behaviour as a safety net.
 */
export function useNotificationsStream({
  onRefresh,
  enabled = true,
  url = DEFAULT_URL,
  pollIntervalMs = DEFAULT_POLL_MS,
  maxReconnectAttempts = DEFAULT_MAX_RECONNECTS,
}: UseNotificationsStreamOptions): { status: StreamStatus } {
  const [status, setStatus] = useState<StreamStatus>("connecting");

  // Keep the latest callback without re-subscribing the stream on every render.
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let disposed = false;

    const refresh = () => {
      onRefreshRef.current();
    };

    const startPolling = () => {
      if (pollTimer || disposed) {
        return;
      }
      setStatus("polling");
      logger.debug("notifications stream: falling back to polling");
      pollTimer = setInterval(() => {
        // Do not poll while the tab is hidden — matches prior behaviour.
        if (typeof document !== "undefined" && document.hidden) {
          return;
        }
        refresh();
      }, pollIntervalMs);
    };

    const connect = () => {
      if (disposed) {
        return;
      }
      if (typeof EventSource === "undefined") {
        startPolling();
        return;
      }

      setStatus("connecting");
      source = new EventSource(url, { withCredentials: true });

      source.onopen = () => {
        attempts = 0;
        setStatus("open");
        logger.debug("notifications stream: connected");
      };

      for (const eventName of PUSH_EVENTS) {
        source.addEventListener(eventName, refresh);
      }

      source.onerror = () => {
        // The browser auto-reconnects EventSource, but we bound the attempts and
        // fall back to polling if the endpoint is persistently unavailable.
        source?.close();
        source = null;
        if (disposed) {
          return;
        }
        attempts += 1;
        if (attempts >= maxReconnectAttempts) {
          startPolling();
          return;
        }
        setStatus("connecting");
        const backoff = Math.min(1000 * 2 ** (attempts - 1), 15_000);
        reconnectTimer = setTimeout(connect, backoff);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (source) {
        for (const eventName of PUSH_EVENTS) {
          source.removeEventListener(eventName, refresh);
        }
        source.close();
      }
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [enabled, url, pollIntervalMs, maxReconnectAttempts]);

  return { status };
}
