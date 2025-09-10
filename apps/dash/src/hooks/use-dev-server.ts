"use client";

import { useCallback, useEffect } from "react";
import useWebSocket, { type ReadyState } from "react-use-websocket";
import { env } from "@/env";
import { useDevServerStore } from "@/stores/dev-server-store";

// Local mirror types (kept for external consumers of this hook)
export type DevServerLog = {
  stream: "stdout" | "stderr";
  message: string;
  ts: number;
};
export type SandboxStatusEvent = {
  type: "sb:status";
  data: { status: "starting" | "started" | "exited" | "error" };
};
export type PreviewAvailableEvent = {
  type: "ds:preview-available";
  data: { url: string };
};
export type DevServerLogEvent = { type: "ds:log"; data: DevServerLog };
export type WSEvent =
  | SandboxStatusEvent
  | PreviewAvailableEvent
  | DevServerLogEvent;

export type UseDevServerOptions = {
  onEvent?: (evt: WSEvent) => void;
  logLimit?: number; // client-side cap (default 1000)
};

export type UseDevServerState = {
  previewUrl: string | undefined;
  status: SandboxStatusEvent["data"]["status"] | "idle";
  logs: DevServerLog[];
  lastEvent: WSEvent | null;
  connectionStatus: ReadyState;
  sendJsonMessage: (data: unknown) => void;
};

/**
 * useDevServer
 * React hook that wires a shared (Zustand) dev-server session state to a WebSocket
 * using react-use-websocket for connection management while persisting all
 * updates globally so any component can read the same session data.
 */
export function useDevServer(
  chatId: string,
  { onEvent }: UseDevServerOptions = {}
): UseDevServerState {
  // Build WS URL (stable for a chatId)
  const url = `${env.NEXT_PUBLIC_API_URL}/api/chat/${chatId}/ws`;

  const { sendJsonMessage, lastMessage, readyState } = useWebSocket(url, {
    retryOnError: true,
    reconnectAttempts: 50,
    shouldReconnect: () => true,
    share: true, // Share single underlying WebSocket among hook consumers
  });

  const ensureSession = useDevServerStore((s) => s.ensureSession);
  const setConnectionStatus = useDevServerStore((s) => s.setConnectionStatus);
  const setStatus = useDevServerStore((s) => s.setStatus);
  const setPreviewUrl = useDevServerStore((s) => s.setPreviewUrl);
  const pushLog = useDevServerStore((s) => s.pushLog);
  const setLastEvent = useDevServerStore((s) => s.setLastEvent);

  useEffect(() => {
    ensureSession(chatId);
    setConnectionStatus(chatId, readyState);
  }, [chatId, ensureSession, readyState, setConnectionStatus]);

  useEffect(() => {
    setConnectionStatus(chatId, readyState);
  }, [chatId, readyState, setConnectionStatus]);

  const applyEvent = useCallback(
    (evt: WSEvent) => {
      switch (evt.type) {
        case "sb:status":
          setStatus(chatId, evt.data.status);
          break;
        case "ds:preview-available":
          setPreviewUrl(chatId, evt.data.url);
          break;
        case "ds:log":
          pushLog(chatId, evt.data);
          break;
        default:
          break;
      }
      setLastEvent(chatId, evt);
      onEvent?.(evt);
    },
    [chatId, onEvent, pushLog, setLastEvent, setPreviewUrl, setStatus]
  );

  // Handle incoming WS messages
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const parsed: WSEvent = JSON.parse(lastMessage.data as string);
      if (typeof parsed === "object" && "type" in parsed) applyEvent(parsed);
    } catch {
      console.log("Failed to parse WS message:", lastMessage.data);
      // ignore malformed
    }
  }, [lastMessage, applyEvent]);

  // Select session from store (will re-render on updates)
  const session = useDevServerStore((s) => s.sessions[chatId]);

  return {
    previewUrl: session?.previewUrl,
    status: session?.status ?? "idle",
    logs: session?.logs ?? [],
    lastEvent: (session?.lastEvent as WSEvent | undefined) ?? null,
    connectionStatus: (session?.connectionStatus as ReadyState) ?? readyState,
    sendJsonMessage,
  };
}
