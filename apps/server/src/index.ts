import { env } from 'cloudflare:workers';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { trpcServer } from '@hono/trpc-server';
import { convertToModelMessages, streamText } from 'ai';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './lib/auth';
import { createContext } from './lib/context';
import { appRouter } from './routers/index';

const app = new Hono();

app.use(logger());
app.use(
  '/*',
  cors({
    origin: env.CORS_ORIGIN || '',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.on(['POST', 'GET'], '/api/auth/**', (c) => auth.handler(c.req.raw));

app.post('/api/chat', async (c) => {
  const body = await c.req.json();
  const uiMessages = body.messages || [];
  const google = createGoogleGenerativeAI({
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: convertToModelMessages(uiMessages),
  });

  return result.toUIMessageStreamResponse();
});

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  })
);

app.get('/', (c) => {
  return c.text('OK');
});

export default app;
