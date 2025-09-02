import { env } from "cloudflare:workers";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { trpcServer } from "@hono/trpc-server";
import {
  convertToModelMessages,
  type InferUITools,
  streamText,
  tool,
  type UIDataTypes,
  type UIMessage,
} from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import z from "zod";
import { auth } from "./lib/auth";
import { createContext } from "./lib/context";
import { SYSTEM_PROMPT } from "./lib/prompt";
import { appRouter } from "./routers/index";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN || "",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

const tools = {
  bash: tool({
    description: "Run a bash command in webcontainer",
    inputSchema: z.object({
      command: z.string().describe("command you want to run in webcontainer"),
    }),
    outputSchema: z.string().describe("output of the command"),
  }),
};

export type CustomUITools = InferUITools<typeof tools>;
export type CustomUIMessage = UIMessage<never, UIDataTypes, CustomUITools>;

app.post("/api/chat", async (c) => {
  const body = await c.req.json();
  const uiMessages = body.messages || [];
  const google = createGoogleGenerativeAI({
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(uiMessages),
    tools,
  });

  return result.toUIMessageStreamResponse();
});

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  })
);

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
