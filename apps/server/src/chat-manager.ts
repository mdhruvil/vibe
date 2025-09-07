import { DurableObject, env } from "cloudflare:workers";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { type ExecutionSession, getSandbox } from "@cloudflare/sandbox";
import {
  convertToModelMessages,
  createIdGenerator,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import z from "zod";
import type { CustomUIMessage } from ".";
import { SYSTEM_PROMPT } from "./lib/prompt";
import { stripIndents } from "./lib/utils";

type Env = Cloudflare.Env;

/**
 * id
 * fileTree
 * messages
 * appwrite stuff
 * appwrite deployments
 */

const keys = {
  CHAT_ID: "chat_id",
  MESSAGES: "messages",
  DEV_SERVER_ID: "dev_server_id",
  DEV_SERVER_URL: "dev_server_url",
} as const;

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

  async setChatId(chatId: string) {
    await this.ctx.storage.put(keys.CHAT_ID, chatId);
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
    const messages = (await this.ctx.storage.get(keys.MESSAGES)) ?? [];
    return messages as CustomUIMessage[];
  }

  async getPreviewUrl() {
    let url = await this.ctx.storage.get<string>(keys.DEV_SERVER_URL);
    if (!url) {
      await this.ensureSandboxIsRunning();
      url = await this.ctx.storage.get<string>(keys.DEV_SERVER_URL);
    }
    return url;
  }

  async fetch(request: Request) {
    // biome-ignore lint/suspicious/noExplicitAny: <TODO>
    const body: any = await request.json();
    const { message } = body;

    const previousMessages = (await this.getMessages()) ?? [];
    const allMessages = [...previousMessages, message];

    await this.resetAlarm();

    const google = createGoogleGenerativeAI({
      apiKey: this.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT,
      messages: convertToModelMessages(allMessages),
      stopWhen: stepCountIs(50),
      tools: {
        bash: tool({
          description:
            "Run a bash command in sandbox. THIS COMMAND CAN'T BE LONG RUNNING.",
          inputSchema: z.object({
            command: z.string().describe("command you want to run in sandbox"),
          }),
          outputSchema: z.string().describe("output of the command"),
          execute: async ({ command }) => {
            try {
              await this.ensureSandboxIsRunning();
              const result = await this.session.exec(command);
              return stripIndents(`
                exit code: ${result.exitCode}
                stdout: ${result.stdout}
                stderr: ${result.stderr}
                `);
            } catch (error) {
              console.error(`[CHAT_MANAGER] Error executing command: ${error}`);
              const errorMessages =
                error instanceof Error ? error.message : String(error);
              return stripIndents(`
                Something Went Wrong while executing this command.
                ${errorMessages}
              `);
            }
          },
        }),
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: allMessages,
      generateMessageId: createIdGenerator({
        prefix: "msg",
        size: 16,
      }),
      onFinish: async ({ messages, responseMessage }) => {
        const messagesWithoutNewOne = messages.filter(
          (msg) => msg.id !== responseMessage.id
        );
        const messagesToStore = messagesWithoutNewOne.concat(responseMessage);

        await this.ctx.storage.put(keys.MESSAGES, messagesToStore);
      },
    });
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

    await this.ctx.storage.put(keys.DEV_SERVER_ID, process.id);
    await this.ctx.storage.put(keys.DEV_SERVER_URL, newUrl);
    return process.id;
  }

  async ensureDevServerRunning() {
    let devServerId = (await this.ctx.storage.get(
      keys.DEV_SERVER_ID
    )) as string;

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
