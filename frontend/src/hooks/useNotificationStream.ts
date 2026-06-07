"use client";

import { useEffect, useRef } from "react";
import { API_URL } from "@/lib/api";
import type { UserNotification } from "@/types/music";

type SseMessage = {
  event: string;
  data: string;
};

type UseNotificationStreamOptions = {
  accessToken: string | null;
  enabled: boolean;
  onNotification: (notification: UserNotification) => void;
};

function isDevelopment() {
  return process.env.NODE_ENV === "development";
}

function isExpectedStreamDisconnect(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  return error instanceof TypeError && error.message === "network error";
}

function parseSseChunk(chunk: string): SseMessage | null {
  const lines = chunk.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  });

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}

function isUserNotification(value: unknown): value is UserNotification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<UserNotification>;

  return Boolean(candidate.id && candidate.type && candidate.title);
}

export function useNotificationStream({
  accessToken,
  enabled,
  onNotification,
}: UseNotificationStreamOptions) {
  const onNotificationRef = useRef(onNotification);
  const connectedRef = useRef(false);

  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (!enabled || !accessToken) {
      connectedRef.current = false;
      return;
    }

    let stopped = false;
    let retryDelay = 3000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const waitForReconnect = () => {
      return new Promise<void>((resolve) => {
        reconnectTimer = setTimeout(resolve, retryDelay);
      });
    };

    const connect = async () => {
      while (!stopped) {
        try {
          const response = await fetch(`${API_URL}/notifications/stream`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "text/event-stream",
            },
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error("Notification stream request failed.");
          }

          connectedRef.current = true;
          retryDelay = 3000;

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (!stopped) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const chunks = buffer.split(/\r?\n\r?\n/);
            buffer = chunks.pop() ?? "";

            chunks.forEach((chunk) => {
              const message = parseSseChunk(chunk);

              if (!message || message.event === "ping" || message.event === "connected") {
                return;
              }

              if (message.event !== "notification") {
                return;
              }

              try {
                const parsedData = JSON.parse(message.data);

                if (isUserNotification(parsedData)) {
                  onNotificationRef.current(parsedData);
                }
              } catch (error) {
                if (isDevelopment()) {
                  console.warn("Notification stream parse failed:", error);
                }
              }
            });
          }
        } catch (error) {
          if (!stopped && isDevelopment() && !isExpectedStreamDisconnect(error)) {
            console.warn("Notification stream error:", error);
          }
        } finally {
          connectedRef.current = false;
        }

        if (!stopped) {
          await waitForReconnect();
          retryDelay = Math.min(retryDelay + 2000, 10000);
        }
      }
    };

    void connect();

    return () => {
      stopped = true;
      connectedRef.current = false;
      controller.abort();

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [accessToken, enabled]);
}
