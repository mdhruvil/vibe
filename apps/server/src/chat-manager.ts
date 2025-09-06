import { DurableObject } from "cloudflare:workers";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getSandbox } from "@cloudflare/sandbox";
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
type Sandbox = ReturnType<typeof getSandbox>;

/**
 * id
 * fileTree
 * messages
 * appwrite stuff
 * appwrite deployments
 */

const keys = {
  MESSAGES: "messages",
  DEV_SERVER_ID: "dev_server_id",
  DEV_SERVER_URL: "dev_server_url",
} as const;

export class ChatManager extends DurableObject<Env> {
  sandbox: Sandbox;
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    console.log(`[CHAT_MANAGER] Initialized with ${this.ctx.id.toString()}`);
    this.sandbox = getSandbox(
      this.env.Sandbox,
      this.ctx.id.name ?? crypto.randomUUID()
    );
  }

  async initSandbox() {
    await this.ctx.storage.delete(keys.DEV_SERVER_ID);
    await this.ctx.storage.delete(keys.DEV_SERVER_URL);

    const process = await this.sandbox.exec("echo 'Hello World'");
    console.log(`[CHAT_MANAGER] Sandbox process: ${process}`);
    console.log(
      "[CHAT_MANAGER] Sandbox initialized:",
      await this.sandbox.getState()
    );
    const at = Date.now() + 1000 * 60 * 10; // 10 minutes from now
    await this.ctx.storage.setAlarm(at);
    console.log(
      `[CHAT_MANAGER] Alarm reset to: ${new Date(at).toLocaleString()}`
    );
  }

  async getMessages(): Promise<CustomUIMessage[]> {
    const messages = (await this.ctx.storage.get(keys.MESSAGES)) ?? [];
    return messages as CustomUIMessage[];
  }

  async fetch(request: Request) {
    // biome-ignore lint/suspicious/noExplicitAny: <TODO>
    const body: any = await request.json();
    const { message } = body;

    const previousMessages = (await this.getMessages()) ?? [];
    const allMessages = [...previousMessages, message];

    this.ctx.waitUntil(this.ensureSandboxIsRunning());
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
              const result = await this.sandbox.exec(command);
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
    if (!activeStates.includes(sandboxState?.status)) {
      console.log("[CHAT_MANAGER] Making sure the sandbox is running");
      await this.initSandbox();
    }
    await this.ensureDevServerRunning();
  }

  async startDevServer() {
    await this.ctx.storage.delete(keys.DEV_SERVER_ID);
    await this.ctx.storage.delete(keys.DEV_SERVER_URL);

    const process = await this.sandbox.startProcess("bun run dev");
    console.log(process);

    await this.ctx.storage.put(keys.DEV_SERVER_ID, process.id);
    // TODO: make hostname come from config
    const { url } = await this.sandbox.exposePort(5173, {
      hostname: "localhost:8787",
    });
    console.log(`[CHAT_MANAGER] Dev server URL: ${url}`);
    await this.ctx.storage.put(keys.DEV_SERVER_URL, url);
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
    const devServerProcess = await this.sandbox.getProcess(devServerId);
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
    await this.sandbox?.destroy();
    console.log(
      `[CHAT_MANAGER] Sandbox destroyed for id: ${this.ctx.id.toString()}`
    );
  }
}
