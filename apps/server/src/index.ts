import { env } from "cloudflare:workers";
import { trpcServer } from "@hono/trpc-server";
import { type InferUITools, tool, type UIDataTypes, type UIMessage } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import z from "zod";
import { auth } from "./lib/auth";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN || "",
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));
app.get("/api/auth-redirect", (c) => {
  return c.redirect(env.CORS_ORIGIN);
});

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

app.post("/api/chat/:chatId", (c) => {
  const chatId = c.req.param("chatId");
  const chatManager = env.CHAT_MANAGER.getByName(chatId);
  return chatManager.fetch(c.req.raw);
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

// biome-ignore lint/performance/noBarrelFile: <we need it>
export { ChatManager } from "./chat-manager";
export type { AppRouter } from "./routers";

export default app;
