import { DurableObject, env } from "cloudflare:workers";
import { type ExecutionSession, getSandbox } from "@cloudflare/sandbox";
import type { CustomUIMessage } from ".";
import { AI } from "./ai";
import { keys } from "./lib/constants";

type Env = Cloudflare.Env;

/**
 * id
 * fileTree
 * messages
 * appwrite stuff
 * appwrite deployments
 */

export async function getChatManager(id: string) {
  const stub = env.CHAT_MANAGER.getByName(id);
  await stub.setChatId(id);
  return stub;
}

export class ChatManager extends DurableObject<Env> {
  private _chatId: string | undefined;
  private _session: ExecutionSession | undefined;
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    console.log(`[CHAT_MANAGER] Initialized with ${this.ctx.id.toString()}`);
  }

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
    return this.ctx.storage.get(key);
  }

  putToStore<T>(key: string, value: T): Promise<void> {
    return this.ctx.storage.put(key, value);
  }

  async setChatId(chatId: string) {
    await this.putToStore(keys.CHAT_ID, chatId);
    this._chatId = chatId;
  }

  async initSandbox() {
    await this.ctx.storage.delete(keys.DEV_SERVER_ID);
    await this.ctx.storage.delete(keys.DEV_SERVER_URL);
    this._session = await this.sandbox.createSession({
      id: crypto.randomUUID(),
      isolation: true,
      cwd: "/workspace",
    });
    const process = await this.session.exec("echo 'Hello World'");
    console.log(`[CHAT_MANAGER] Sandbox process: ${process}`);
    console.log(
      "[CHAT_MANAGER] Sandbox initialized:",
      await this.sandbox.getState()
    );
  }

  async getMessages(): Promise<CustomUIMessage[]> {
    const messages = (await this.getFromStore(keys.MESSAGES)) ?? [];
    return messages as CustomUIMessage[];
  }

  async getPreviewUrl() {
    let url = await this.getFromStore<string>(keys.DEV_SERVER_URL);
    if (!url) {
      await this.ensureSandboxIsRunning();
      url = await this.getFromStore<string>(keys.DEV_SERVER_URL);
    }
    return url;
  }

  async fetch(request: Request) {
    await this.resetAlarm();
    const ai = new AI(this);
    return ai.fetch(request);
  }

  async ensureSandboxIsRunning() {
    const sandboxState = await this.sandbox?.getState();
    console.log(`[CHAT_MANAGER] Found sandbox state: ${sandboxState.status}`);

    const activeStates: (typeof sandboxState.status)[] = ["running", "healthy"];
    if (!activeStates.includes(sandboxState?.status) || !this._session) {
      console.log("[CHAT_MANAGER] Making sure the sandbox is running");
      await this.initSandbox();
    }
    await this.resetAlarm();
    await this.ensureDevServerRunning();
  }

  async startDevServer() {
    await this.ctx.storage.delete(keys.DEV_SERVER_ID);
    await this.ctx.storage.delete(keys.DEV_SERVER_URL);

    const process = await this.session.startProcess("bun run dev");

    // TODO: make hostname come from config
    const { url } = await this.session.exposePort(5173, {
      hostname: "localhost:8787",
    });
    const newUrl = url.replace("5173-", "");
    console.log(`[CHAT_MANAGER] Dev server URL: ${newUrl}`);

    await this.putToStore(keys.DEV_SERVER_ID, process.id);
    await this.putToStore(keys.DEV_SERVER_URL, newUrl);
    return process.id;
  }

  async ensureDevServerRunning() {
    let devServerId = (await this.getFromStore(keys.DEV_SERVER_ID)) as string;

    if (!devServerId) {
      console.log("[CHAT_MANAGER] No dev server found, starting a new one");
      devServerId = await this.startDevServer();
      return;
    }
    const devServerProcess = await this.session
      .getProcess(devServerId)
      .catch(() => {
        console.log(
          "[CHAT_MANAGER] No dev server process found, starting a new one"
        );
        return null;
      });
    if (!devServerProcess) {
      // this case should not happen but just in case
      console.log(
        "[CHAT_MANAGER] No dev server process found, starting a new one"
      );
      devServerId = await this.startDevServer();
      return;
    }
    const devServerStatus = await devServerProcess?.getStatus();
    if (devServerStatus !== "running") {
      console.log(
        `[CHAT_MANAGER] Dev server is not running, starting. Current status: ${devServerStatus}`
      );
      devServerId = await this.startDevServer();
    }
    return devServerId;
  }

  async resetAlarm() {
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm) {
      await this.ctx.storage.deleteAlarm();
    }
    const at = Date.now() + 1000 * 60 * 10; // 10 minutes from now
    await this.ctx.storage.setAlarm(at);
    console.log(
      `[CHAT_MANAGER] Alarm reset to: ${new Date(at).toLocaleString()}`
    );
  }

  async alarm(_alarmInfo?: AlarmInvocationInfo) {
    await this.ctx.storage.delete(keys.DEV_SERVER_ID);
    await this.ctx.storage.delete(keys.DEV_SERVER_URL);
    const chatId = await this.ctx.storage.get<string>(keys.CHAT_ID);
    if (!chatId) {
      // this should not be happen in any case
      throw new Error("Chat ID not found");
    }
    const sandbox = getSandbox(env.Sandbox, chatId);
    await sandbox.destroy();
    console.log(
      `[CHAT_MANAGER] Sandbox destroyed for id: ${this.ctx.id.toString()}`
    );
  }
}
