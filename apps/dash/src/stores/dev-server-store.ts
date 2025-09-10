"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type DevServerLog = {
  stream: "stdout" | "stderr";
  message: string;
  ts: number;
};

export type SandboxStatus =
  | "idle"
  | "starting"
  | "started"
  | "exited"
  | "error";

export type SandboxStatusEvent = {
  type: "sb:status";
  data: { status: Exclude<SandboxStatus, "idle"> };
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

export type DevServerSession = {
  chatId: string;
  previewUrl?: string;
  status: SandboxStatus;
  logs: DevServerLog[];
  lastEvent?: WSEvent;
  connectionStatus: number; // WebSocket readyState numeric
  connected: boolean;
};

export type DevServerStore = {
  sessions: Record<string, DevServerSession>;
  logLimit: number;
  ensureSession: (chatId: string) => void;
  setStatus: (chatId: string, status: SandboxStatus) => void;
  setPreviewUrl: (chatId: string, url: string) => void;
  pushLog: (chatId: string, log: DevServerLog) => void;
  clearLogs: (chatId: string) => void;
  setConnectionStatus: (chatId: string, readyState: number) => void;
  setLastEvent: (chatId: string, evt: WSEvent) => void;
  setLogLimit: (limit: number) => void;
};

function initialSession(chatId: string): DevServerSession {
  return {
    chatId,
    previewUrl: undefined,
    status: "idle",
    logs: [],
    connectionStatus: 0,
    connected: false,
  };
}

export const useDevServerStore = create<DevServerStore>()(
  // @ts-expect-error
  immer((set) => ({
    sessions: {},
    logLimit: 1000,
    ensureSession(chatId) {
      set((state) => {
        if (!state.sessions[chatId]) {
          state.sessions[chatId] = initialSession(chatId);
        }
      });
    },
    setStatus(chatId, status) {
      set((state) => {
        const s = state.sessions[chatId];
        if (!s || s.status === status) return;
        s.status = status;
      });
    },
    setPreviewUrl(chatId, url) {
      set((state) => {
        const s = state.sessions[chatId];
        if (!s || s.previewUrl === url) return;
        s.previewUrl = url;
      });
    },
    pushLog(chatId, log) {
      set((state) => {
        const s = state.sessions[chatId];
        if (!s) return;
        s.logs.push(log);
        if (s.logs.length > state.logLimit) {
          s.logs = s.logs.slice(s.logs.length - state.logLimit);
        }
      });
    },
    clearLogs(chatId) {
      set((state) => {
        const s = state.sessions[chatId];
        if (!s || s.logs.length === 0) return;
        s.logs = [];
      });
    },
    setConnectionStatus(chatId, readyState) {
      set((state) => {
        const s = state.sessions[chatId];
        if (!s || s.connectionStatus === readyState) return;
        s.connectionStatus = readyState;
        s.connected = readyState === 1;
      });
    },
    setLastEvent(chatId, evt) {
      set((state) => {
        const s = state.sessions[chatId];
        if (!s) return;
        s.lastEvent = evt;
      });
    },
    setLogLimit(limit) {
      set((state) => {
        state.logLimit = limit;
      });
    },
  }))
);
