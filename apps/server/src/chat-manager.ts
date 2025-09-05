import { DurableObject } from "cloudflare:workers";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createIdGenerator,
  streamText,
  tool,
} from "ai";
import z from "zod";
import type { CustomUIMessage } from ".";
import { SYSTEM_PROMPT } from "./lib/prompt";

type Env = Cloudflare.Env;

const tools = {
  bash: tool({
    description: "Run a bash command in webcontainer",
    inputSchema: z.object({
      command: z.string().describe("command you want to run in webcontainer"),
    }),
    outputSchema: z.string().describe("output of the command"),
  }),
};

/**
 * id
 * fileTree
 * messages
 * appwrite stuff
 * appwrite deployments
 */

const keys = {
  MESSAGES: "messages",
} as const;

export class ChatManager extends DurableObject<Env> {
  // biome-ignore lint/complexity/noUselessConstructor: <idk why its erroring here>
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
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

    const google = createGoogleGenerativeAI({
      apiKey: this.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT,
      messages: convertToModelMessages(allMessages),
      tools,
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
}
