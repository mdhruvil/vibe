import { DurableObject } from "cloudflare:workers";
import {
  type ExecutionSession,
  getSandbox,
  type Process,
} from "@cloudflare/sandbox";
import type { CustomUIMessage } from ".";
import { AI } from "./ai";
import { keys } from "./lib/constants";

/**
 * Central manager for a single chat's ephemeral dev sandbox + dev server.
 *
 * Concurrency / race considerations (important parts only):
 * 1. Durable Object constructor runs per activation; we use blockConcurrencyWhile
 *    to restore minimal in‑memory state (chatId) before any events execute.
 * 2. Sandbox/session creation and dev server startup are protected by in‑memory
 *    promise locks so concurrent fetch/RPC calls coalesce instead of racing and
 *    starting multiple containers/processes ("thundering herd" avoidance).
 * 3. Alarm scheduling is idempotent; we avoid deleting & re‑setting each request
 *    (narrow race where object could hibernate). We only extend when needed.
 * 4. Teardown (alarm) uses this.env (instance scoped) and only destroys after
 *    clearing dev server keys + session reference; any new request will lazily
 *    recreate via the locks.
 */

type Env = Cloudflare.Env;

/** Public helper used by the Worker to obtain a stub and initialize idempotently. */
export async function getChatManager(env: Env, id: string) {
  const stub = env.CHAT_MANAGER.getByName(id);
  // Idempotent: underlying method will just verify existing chat id.
  await stub.init(id);
  return stub;
}

export class ChatManager extends DurableObject<Env> {
  private _chatId: string | undefined;
  private _session: ExecutionSession | undefined;

  // Promise locks (cleared after resolution) to prevent parallel startups.
  private _sandboxReadyPromise: Promise<void> | undefined;
  private _devServerReadyPromise: Promise<void> | undefined;

  // Idle teardown alarm TTL (object/sandbox can hibernate after this inactivity).
  private static readonly ALARM_TTL_MS = 1000 * 60 * 1;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    console.log(`[CHAT_MANAGER] Constructed ${this.ctx.id.toString()}`);

    // IMPORTANT: Ensure chatId (if previously persisted) is loaded before any
    // incoming event mutates or relies on it. Avoid heavy work here.
    this.ctx.blockConcurrencyWhile(async () => {
      this._chatId = await this.ctx.storage.get<string>(keys.CHAT_ID);
    });
  }

  // --- Basic accessors ---
  get sandbox() {
    if (!this._chatId) {
      throw new Error("No chatId available");
    }
    return getSandbox(this.env.Sandbox, this._chatId);
  }

  get session() {
    if (!this._session) {
      throw new Error("No session available");
    }
    return this._session;
  }

  getFromStore<T>(key: string): Promise<T | undefined> {
    return this.ctx.storage.get<T>(key);
  }

  putToStore<T>(key: string, value: T): Promise<void> {
    return this.ctx.storage.put(key, value);
  }

  /**
   * Idempotent initialization for external caller; simply ensures chat id is
   * persisted & consistent. Safe under concurrent invocation.
   */
  async init(chatId: string) {
    await this.ensureChatId(chatId);
  }

  // Ensure we have a chat id in memory & storage (if provided first time).
  private async ensureChatId(chatId?: string): Promise<string> {
    if (this._chatId) {
      if (chatId && chatId !== this._chatId) {
        throw new Error("Chat ID mismatch for existing object");
      }
      return this._chatId;
    }
    // Only first caller sets it.
    if (!chatId) {
      const stored = await this.ctx.storage.get<string>(keys.CHAT_ID);
      if (!stored) {
        throw new Error("Chat ID missing and none provided");
      }
      this._chatId = stored;
      return stored;
    }
    await this.ctx.storage.put(keys.CHAT_ID, chatId);
    this._chatId = chatId;
    return chatId;
  }

  /**
   * (Re)create sandbox execution session if absent or unhealthy.
   * Uses a promise lock so only one expensive path runs at a time.
   */
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
        console.log(
          "[CHAT_MANAGER] Failed to get sandbox state, will recreate",
          e
        );
      }
    }
    if (this._sandboxReadyPromise) {
      return this._sandboxReadyPromise;
    }

    this._sandboxReadyPromise = (async () => {
      try {
        // Clear dev server metadata early; a new session invalidates previous processes.
        await Promise.all([
          this.ctx.storage.delete(keys.DEV_SERVER_ID),
          this.ctx.storage.delete(keys.DEV_SERVER_URL),
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
      } catch (err) {
        // Ensure callers do not retain broken session ref.
        this._session = undefined;
        console.error("[CHAT_MANAGER] Sandbox creation failed", err);
        throw err;
      } finally {
        this._sandboxReadyPromise = undefined; // Allow future retries.
      }
    })();

    return this._sandboxReadyPromise;
  }

  /** Start dev server (assumes sandbox/session ready). */
  private async startDevServer(): Promise<string> {
    const proc = await this.session.startProcess("bun run dev");
    // TODO: hostname should be configurable.
    const { url } = await this.session.exposePort(5173, {
      hostname: "localhost:8787",
    });
    const publicUrl = url.replace("5173-", "");
    await Promise.all([
      this.putToStore(keys.DEV_SERVER_ID, proc.id),
      this.putToStore(keys.DEV_SERVER_URL, publicUrl),
    ]);
    console.log(`[CHAT_MANAGER] Dev server process ${proc.id} -> ${publicUrl}`);
    return proc.id;
  }

  /** Ensure dev server is running (single-flight via lock). */
  private ensureDevServerRunning(): Promise<void> {
    // Fast path: if another caller already starting.
    if (this._devServerReadyPromise) {
      return this._devServerReadyPromise;
    }

    const runCheck = async (): Promise<void> => {
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
      if (!proc) {
        return; // Type narrow; should be defined here.
      }
      const status = await proc.getStatus().catch(() => "unknown");
      if (status !== "running") {
        console.log(
          `[CHAT_MANAGER] Dev server status '${status}' -> restarting`
        );
        await this.startDevServer();
      }
    };

    this._devServerReadyPromise = (async () => {
      try {
        await runCheck();
      } finally {
        this._devServerReadyPromise = undefined; // Release lock regardless of success.
      }
    })();

    return this._devServerReadyPromise;
  }

  async getMessages(): Promise<CustomUIMessage[]> {
    const messages =
      (await this.getFromStore<CustomUIMessage[]>(keys.MESSAGES)) ?? [];
    return messages;
  }

  /** Public method to obtain preview URL after ensuring readiness. */
  async getPreviewUrl(): Promise<string | undefined> {
    await this.ensureChatId();
    await this.ensureSandboxReady();
    await this.ensureDevServerRunning();
    // Treat preview URL access as activity so sandbox will teardown after inactivity.
    await this.resetAlarm();
    return this.getFromStore<string>(keys.DEV_SERVER_URL);
  }

  /** Request entry point. Ensures environment readiness prior to AI handling. */
  async fetch(request: Request) {
    await this.ensureChatId();
    await this.resetAlarm();
    await this.ensureSandboxReady();
    await this.ensureDevServerRunning();
    const ai = new AI(this);
    return ai.fetch(request);
  }

  /** Idempotently extend idle alarm; only reschedule when >50% TTL elapsed. */
  async resetAlarm() {
    const now = Date.now();
    const existing = await this.ctx.storage.getAlarm();
    const target = now + ChatManager.ALARM_TTL_MS;
    if (existing) {
      // const remaining = existing - now;
      // const threshold =
      //   ChatManager.ALARM_TTL_MS * ChatManager.ALARM_REFRESH_THRESHOLD_RATIO;
      // if (remaining > threshold) {
      //   return; // Still far from expiry; skip churn.
      // }
      this.ctx.storage.deleteAlarm(); // Clear existing to reset.
    }
    await this.ctx.storage.setAlarm(target);
    console.log(
      `[CHAT_MANAGER] Alarm set for ${new Date(target).toLocaleString()}`
    );
  }

  /** Alarm: graceful teardown to free resources after inactivity. */
  async alarm(_alarmInfo?: AlarmInvocationInfo) {
    console.log("[CHAT_MANAGER] Alarm fired -> teardown");
    // Remove dev server discovery data first so new requests won't reuse stale id.
    await Promise.all([
      this.ctx.storage.delete(keys.DEV_SERVER_ID),
      this.ctx.storage.delete(keys.DEV_SERVER_URL),
    ]);
    const chatId = await this.ctx.storage.get<string>(keys.CHAT_ID);
    if (!chatId) {
      console.warn("[CHAT_MANAGER] Alarm teardown without chatId (unexpected)");
      this._session = undefined;
      return;
    }
    try {
      // Attempt to stop all running processes; ignore individual failures.
      await getSandbox(this.env.Sandbox, chatId).destroy();
      console.log(`[CHAT_MANAGER] Sandbox destroyed for chat ${chatId}`);
    } catch (err) {
      console.error("[CHAT_MANAGER] Sandbox destroy failed", err);
    } finally {
      this._session = undefined; // Force recreation next request.
    }
  }
}
