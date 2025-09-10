import { DurableObject } from "cloudflare:workers";
import {
  type ExecutionSession,
  getSandbox,
  type LogEvent,
  type Process,
  parseSSEStream,
} from "@cloudflare/sandbox";
import type { CustomUIMessage } from ".";
import { AI } from "./ai";
import { keys } from "./lib/constants";
import { replayMessages } from "./replay-messages";
import type { WSEvent } from "./types/ws";

/**
 * ChatManager: Manages a single chat's sandbox + dev server + websocket broadcast.
 */

type Env = Cloudflare.Env;

export async function getChatManager(env: Env, id: string) {
  const stub = env.CHAT_MANAGER.getByName(id);
  await stub.init(id); // Idempotent
  return stub;
}

export class ChatManager extends DurableObject<Env> {
  private _chatId: string | undefined;
  private _session: ExecutionSession | undefined;

  private _sandboxReadyPromise: Promise<void> | undefined;
  private _devServerReadyPromise: Promise<void> | undefined;

  private static readonly ALARM_TTL_MS = 1000 * 60 * 10; // 10m
  private static readonly LOG_MAX_BYTES = 1024 * 1024; // 1MB cap

  private readonly sessions: Map<WebSocket, { [key: string]: string }>;
  private _logStreamerProcessId: string | undefined;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    console.log(`[CHAT_MANAGER] Constructed ${this.ctx.id.toString()}`);
    this.sessions = new Map();

    // Restore hibernated websocket attachments.
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (attachment) {
        this.sessions.set(ws, { ...attachment });
      }
    }

    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );

    this.ctx.blockConcurrencyWhile(async () => {
      this._chatId = await this.ctx.storage.get<string>(keys.CHAT_ID);
    });
  }

  // --- Accessors ---
  get sandbox() {
    if (!this._chatId) throw new Error("No chatId available");
    return getSandbox(this.env.Sandbox, this._chatId);
  }
  get session() {
    if (!this._session) throw new Error("No session available");
    return this._session;
  }

  async getFromStore<T>(key: string) {
    return await this.ctx.storage.get<T>(key);
  }
  async putToStore<T>(key: string, value: T) {
    await this.ctx.storage.put(key, value);
  }

  async init(chatId: string) {
    await this.ensureChatId(chatId);
  }

  private async ensureChatId(chatId?: string): Promise<string> {
    if (this._chatId) {
      if (chatId && chatId !== this._chatId)
        throw new Error("Chat ID mismatch");
      return this._chatId;
    }
    if (!chatId) {
      const stored = await this.ctx.storage.get<string>(keys.CHAT_ID);
      if (!stored) throw new Error("Chat ID missing and none provided");
      this._chatId = stored;
      return stored;
    }
    await this.ctx.storage.put(keys.CHAT_ID, chatId);
    this._chatId = chatId;
    return chatId;
  }

  private async ensureSandboxReady(): Promise<void> {
    if (this._session) {
      try {
        const state = await this.sandbox.getState();
        if (["running", "healthy"].includes(state.status)) {
          return; // Healthy enough.
        }
        console.log(
          `[CHAT_MANAGER] Sandbox state '${state.status}' not active -> recreate`
        );
      } catch (e) {
        console.log("[CHAT_MANAGER] getState failed; recreating", e);
      }
    }
    if (this._sandboxReadyPromise) return this._sandboxReadyPromise;

    this._sandboxReadyPromise = (async () => {
      try {
        this.sendWebSocketMessage({
          type: "sb:status",
          data: { status: "starting" },
        });
        await Promise.all([
          this.ctx.storage.delete(keys.DEV_SERVER_ID),
          this.ctx.storage.delete(keys.DEV_SERVER_URL),
          this.ctx.storage.delete(keys.DEV_SERVER_LOGS),
        ]);
        this._session = await this.sandbox.createSession({
          id: crypto.randomUUID(),
          isolation: true,
          cwd: "/workspace",
        });
        const echo = await this._session.exec("echo 'Hello Sandbox'");
        console.log(
          `[CHAT_MANAGER] Sandbox session created (exit ${echo.exitCode})`
        );
        console.log("[CHAT_MANAGER] Replaying messages...");
        const messages = await this.getMessages();
        await replayMessages(messages, this.session);
        console.log("[CHAT_MANAGER] Messages replayed");
        this.sendWebSocketMessage({
          type: "sb:status",
          data: { status: "started" },
        });
      } catch (err) {
        this._session = undefined;
        this.sendWebSocketMessage({
          type: "sb:status",
          data: { status: "error" },
        });
        console.error("[CHAT_MANAGER] Sandbox creation failed", err);
        throw err;
      } finally {
        this._sandboxReadyPromise = undefined;
      }
    })();

    return this._sandboxReadyPromise;
  }

  private async startDevServer(): Promise<string> {
    const proc = await this.session.startProcess("bun run dev");
    this.attachLogStreamer(proc.id);
    const { url } = await this.session.exposePort(5173, {
      hostname: "localhost:8787",
    });
    const publicUrl = url.replace("5173-", "");
    await Promise.all([
      this.putToStore(keys.DEV_SERVER_ID, proc.id),
      this.putToStore(keys.DEV_SERVER_URL, publicUrl),
    ]);
    this.sendWebSocketMessage({
      type: "ds:preview-available",
      data: { url: publicUrl },
    });
    console.log(`[CHAT_MANAGER] Dev server process ${proc.id} -> ${publicUrl}`);
    return proc.id;
  }

  private ensureDevServerRunning(): Promise<void> {
    if (this._devServerReadyPromise) return this._devServerReadyPromise;

    const runCheck = async () => {
      const devServerId = await this.getFromStore<string>(keys.DEV_SERVER_ID);
      if (!devServerId) {
        console.log("[CHAT_MANAGER] No dev server id -> starting");
        await this.startDevServer();
        return;
      }
      let proc: Process | undefined | null;
      try {
        proc = await this.session.getProcess(devServerId);
      } catch {
        console.log(
          "[CHAT_MANAGER] Stored dev server process missing -> restarting"
        );
        await this.startDevServer();
        return;
      }
      if (!proc) return;
      const status = await proc.getStatus().catch(() => "unknown");
      if (status !== "running") {
        console.log(
          `[CHAT_MANAGER] Dev server status '${status}' -> restarting`
        );
        await this.startDevServer();
        return;
      }
      // Attach streamer if DO rehydrated after hibernation.
      this.attachLogStreamer(devServerId);
    };

    this._devServerReadyPromise = (async () => {
      try {
        await runCheck();
      } finally {
        this._devServerReadyPromise = undefined;
      }
    })();

    return this._devServerReadyPromise;
  }

  async getMessages(): Promise<CustomUIMessage[]> {
    const messages = (await this.getFromStore<string>(keys.MESSAGES)) ?? "[]";
    return JSON.parse(messages) ?? [];
  }

  async getPreviewUrl(): Promise<string | undefined> {
    await this.ensureChatId();
    await this.ensureSandboxReady();
    await this.ensureDevServerRunning();
    await this.resetAlarm();
    return this.getFromStore<string>(keys.DEV_SERVER_URL);
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/ws")) {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const id = crypto.randomUUID();
      server.serializeAttachment({ id });
      this.sessions.set(server, { id });
      // Initial preview + log replay in background.
      this.ctx.waitUntil(
        (async () => {
          try {
            // Send current sandbox status so clients don't remain 'idle' if they
            // connect after startup events already fired.
            try {
              const st = await this.sandbox.getState();
              // Derive a safe string status without using 'any'.
              const rawStatus = st.status;
              const stateMap: Record<
                typeof rawStatus,
                "starting" | "started" | "exited" | "error"
              > = {
                running: "started",
                healthy: "started",
                stopping: "exited",
                stopped: "exited",
                stopped_with_code: "exited",
              };
              const status = stateMap[rawStatus] || "starting";

              server.send(
                JSON.stringify({ type: "sb:status", data: { status } })
              );
            } catch {
              server.send(
                JSON.stringify({
                  type: "sb:status",
                  data: { status: "starting" },
                })
              );
            }

            const existingUrl = await this.getFromStore<string>(
              keys.DEV_SERVER_URL
            );
            if (existingUrl) {
              server.send(
                JSON.stringify({
                  type: "ds:preview-available",
                  data: { url: existingUrl },
                })
              );
            }
            const storedLogs = await this.getFromStore<
              { stream: "stdout" | "stderr"; message: string; ts: number }[]
            >(keys.DEV_SERVER_LOGS);
            if (storedLogs?.length) {
              for (const log of storedLogs) {
                server.send(
                  JSON.stringify({
                    type: "ds:log",
                    data: log,
                  })
                );
              }
            }
          } catch (e) {
            console.error("[CHAT_MANAGER] Error sending initial ws state", e);
          }
        })()
      );
      return new Response(null, { status: 101, webSocket: client });
    }

    await this.ensureChatId();
    await this.resetAlarm();
    await this.ensureSandboxReady();
    await this.ensureDevServerRunning();
    const ai = new AI(this);
    return ai.fetch(request);
  }

  async resetAlarm() {
    const now = Date.now();
    const existing = await this.ctx.storage.getAlarm();
    const target = now + ChatManager.ALARM_TTL_MS;
    if (existing) await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.setAlarm(target);
    console.log(
      `[CHAT_MANAGER] Alarm set for ${new Date(target).toLocaleString()}`
    );
  }

  sendWebSocketMessage(message: WSEvent) {
    const msg = JSON.stringify(message);
    this.sessions.forEach((_att, ws) => {
      ws.send(msg);
    });
  }

  private async appendLog(stream: "stdout" | "stderr", message: string) {
    const entry = { stream, message, ts: Date.now() };
    const logs =
      (await this.getFromStore<
        { stream: "stdout" | "stderr"; message: string; ts: number }[]
      >(keys.DEV_SERVER_LOGS)) ?? [];
    logs.push(entry);
    // Cap size.
    let total = new TextEncoder().encode(JSON.stringify(logs)).length;
    if (total > ChatManager.LOG_MAX_BYTES) {
      while (logs.length && total > ChatManager.LOG_MAX_BYTES) {
        logs.shift();
        total = new TextEncoder().encode(JSON.stringify(logs)).length;
      }
    }
    await this.putToStore(keys.DEV_SERVER_LOGS, logs);
    this.sendWebSocketMessage({ type: "ds:log", data: entry });
  }

  private attachLogStreamer(processId: string) {
    if (this._logStreamerProcessId === processId) return;
    this._logStreamerProcessId = processId;
    this.ctx.waitUntil(
      (async () => {
        try {
          const stream = await this.sandbox.streamProcessLogs(processId);
          for await (const evt of parseSSEStream<LogEvent>(stream)) {
            if (evt.type === "stdout" || evt.type === "stderr") {
              await this.appendLog(evt.type, evt.data ?? "");
            }
          }
        } catch (e) {
          console.error("[CHAT_MANAGER] Log streamer failed", e);
        } finally {
          this._logStreamerProcessId = undefined;
        }
      })()
    );
  }

  webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    this.sessions.delete(ws);
    console.log(
      `[CHAT_MANAGER] WebSocket closed: code=${code}, reason=${reason}, wasClean=${wasClean}`
    );
  }

  webSocketError(_ws: WebSocket, error: unknown) {
    console.error(`[CHAT_MANAGER] WebSocket error: ${error}`);
  }

  async alarm(_alarmInfo?: AlarmInvocationInfo) {
    console.log("[CHAT_MANAGER] Alarm fired -> teardown");
    await Promise.all([
      this.ctx.storage.delete(keys.DEV_SERVER_ID),
      this.ctx.storage.delete(keys.DEV_SERVER_URL),
      this.ctx.storage.delete(keys.DEV_SERVER_LOGS),
    ]);
    const chatId = await this.ctx.storage.get<string>(keys.CHAT_ID);
    if (!chatId) {
      console.warn("[CHAT_MANAGER] Alarm teardown without chatId (unexpected)");
      this._session = undefined;
      return;
    }
    try {
      await getSandbox(this.env.Sandbox, chatId).destroy();
      console.log(`[CHAT_MANAGER] Sandbox destroyed for chat ${chatId}`);
      this.sendWebSocketMessage({
        type: "sb:status",
        data: { status: "exited" },
      });
    } catch (err) {
      console.error("[CHAT_MANAGER] Sandbox destroy failed", err);
      this.sendWebSocketMessage({
        type: "sb:status",
        data: { status: "error" },
      });
    } finally {
      this._session = undefined;
    }
  }

  async connectToAppwriteProject({
    region,
    projectId,
    apiKey,
  }: {
    region: string;
    projectId: string;
    apiKey: string;
  }) {
    try {
      await this.putToStore(keys.APPWRITE_REGION, region);
      await this.putToStore(keys.APPWRITE_PROJECT_ID, projectId);
      await this.putToStore(keys.APPWRITE_API_KEY, apiKey);
    } catch (error) {
      console.error("[CHAT_MANAGER] Failed to connect to Appwrite", error);
      return false;
    }
    return true;
  }

  async disconnectFromAppwrite() {
    try {
      await this.ctx.storage.delete(keys.APPWRITE_REGION);
      await this.ctx.storage.delete(keys.APPWRITE_PROJECT_ID);
      await this.ctx.storage.delete(keys.APPWRITE_API_KEY);
    } catch (error) {
      console.error("[CHAT_MANAGER] Failed to disconnect from Appwrite", error);
      return false;
    }
    return true;
  }

  async isConnectedToAppwrite() {
    const region = await this.getFromStore<string>(keys.APPWRITE_REGION);
    const projectId = await this.getFromStore<string>(keys.APPWRITE_PROJECT_ID);
    const apiKey = await this.getFromStore<string>(keys.APPWRITE_API_KEY);
    return !!(region && projectId && apiKey);
  }
}
