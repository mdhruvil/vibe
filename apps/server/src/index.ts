import { env } from "cloudflare:workers";
import { getSandbox } from "@cloudflare/sandbox";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { getChatManager } from "./chat-manager";
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

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const parts = url.hostname.split(".");
  if (uuidRegex.test(parts[0])) {
    const sandbox = getSandbox(env.Sandbox, parts[0]);
    const newUrl = `http://localhost:5173${url.pathname}${url.search}`;
    const newReq = new Request(newUrl, {
      method: c.req.method,
      headers: {
        ...Object.fromEntries(c.req.raw.headers),
        "X-Original-URL": url.toString(),
        "X-Forwarded-Host": url.hostname,
        "X-Forwarded-Proto": url.protocol.replace(":", ""),
        "X-Sandbox-Name": parts[0], // Pass the friendly name
      },
      body: c.req.raw.body,
    });
    return sandbox.fetch(newReq);
  }
  await next();
});

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));
app.get("/api/auth-redirect", (c) => {
  return c.redirect(env.CORS_ORIGIN);
});

app.post("/api/chat/:chatId", async (c) => {
  const chatId = c.req.param("chatId");
  const chatManager = await getChatManager(env as Cloudflare.Env, chatId);
  return chatManager.fetch(c.req.raw);
});

app.get("/api/chat/:chatId/ws", async (c) => {
  const chatId = c.req.param("chatId");
  const upgrade = c.req.header("Upgrade");
  if (!upgrade || upgrade.toLowerCase() !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }
  const chatManager = await getChatManager(env as Cloudflare.Env, chatId);
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
export { Sandbox } from "@cloudflare/sandbox";
export type { CustomUIMessage, CustomUITools } from "./ai/tool";
export type { TodoInfo } from "./ai/tools/todo";
export { ChatManager } from "./chat-manager";
export type { AppRouter } from "./routers";

export default app;
