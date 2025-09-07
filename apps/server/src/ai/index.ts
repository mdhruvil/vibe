import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createIdGenerator,
  generateObject,
  stepCountIs,
  streamText,
} from "ai";
import z from "zod";
import type { ChatManager } from "@/chat-manager";
import { auth } from "@/lib/auth";
import { keys } from "@/lib/constants";
import { ChatError } from "@/lib/errors";
import { SYSTEM_PROMPT, TITLE_PROMPT } from "@/lib/prompt";
import { ALL_TOOL_FUNCS, type VibeContext, type VibeTool } from "./tool";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  message: z.object({
    id: z.string(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;

export class AI {
  manager: ChatManager;
  constructor(manager: ChatManager) {
    this.manager = manager;
  }

  async fetch(req: Request): Promise<Response> {
    const body = await req.json();

    const { success, data, error } = postRequestBodySchema.safeParse(body);
    if (!success) {
      console.error(error);
      return new ChatError("bad_request:chat").toResponse();
    }

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return new ChatError("unauthorized:chat").toResponse();
    }

    const message = data.message;
    const messagesFromStore = (await this.manager.getMessages()) ?? [];
    const allMessages = messagesFromStore.concat([message]);

    const context: VibeContext = {
      session: this.manager.session,
    };

    const tools: Record<string, ReturnType<VibeTool>> = {};
    for (const [name, t] of Object.entries(ALL_TOOL_FUNCS)) {
      tools[name] = t(context);
    }

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT,
      messages: convertToModelMessages(allMessages),
      stopWhen: stepCountIs(50),
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

        await this.manager.putToStore(keys.MESSAGES, messagesToStore);
      },
    });
  }
}

export async function generateTitle(prompt: string) {
  const { object } = await generateObject({
    model: google("gemini-2.5-flash-lite"),
    schema: z.object({
      title: z.string().describe("A concise title for the given user message"),
    }),
    system: TITLE_PROMPT,
    prompt: `<user_message>${prompt}</user_message>`,
  });
  return object.title;
}
