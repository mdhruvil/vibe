import { env } from "cloudflare:workers";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { generateTitle } from "@/ai";
import { getChatManager } from "@/chat-manager";
import { db } from "@/db";
import { chat } from "@/db/schema/chat";
import { checkValidity } from "@/lib/appwrite";
import type { CustomUIMessage } from "..";
import { protectedProcedure, publicProcedure, router } from "../lib/trpc";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),

  createChat: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const title = await generateTitle(input.prompt);
      const [newChat] = await db
        .insert(chat)
        .values({
          title,
          created_by: ctx.session.user.id,
        })
        .returning();
      return newChat;
    }),

  getChatWithMessages: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const chatRecord = await db.query.chat.findFirst({
        where: ({ id, created_by }, { eq, and }) =>
          and(eq(id, input.chatId), eq(created_by, ctx.session.user.id)),
      });
      if (!chatRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }
      const stub = await getChatManager(env as Cloudflare.Env, chatRecord.id);
      // @ts-expect-error <Type instantiation is excessively deep and possibly infinite.>
      const messages = (await stub.getMessages()) as CustomUIMessage[];

      const isConnectedToAppwrite = await stub.isConnectedToAppwrite();
      return { ...chatRecord, messages, isConnectedToAppwrite };
    }),

  getAllChatsForCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    const chats = await db.query.chat.findMany({
      where: ({ created_by }, { eq }) => eq(created_by, ctx.session.user.id),
    });
    return chats;
  }),

  getChatPreviewUrl: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const chatRecord = await db.query.chat.findFirst({
        where: ({ id, created_by }, { eq, and }) =>
          and(eq(id, input.chatId), eq(created_by, ctx.session.user.id)),
      });
      if (!chatRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }
      const stub = await getChatManager(env as Cloudflare.Env, chatRecord.id);
      const previewUrl = await stub.getPreviewUrl();
      return { previewUrl: previewUrl ?? null };
    }),

  connectAppwriteProject: protectedProcedure
    .input(
      z.object({
        region: z.enum(["fra", "nyc", "sfo", "syd"]),
        appwriteProjectId: z.string().min(2).max(100),
        apiKey: z.string().min(2).max(300),
        vibeProject: z.uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const isValid = await checkValidity(input);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid Appwrite credentials",
        });
      }
      const chatRecord = await db.query.chat.findFirst({
        where: ({ id, created_by }, { eq, and }) =>
          and(eq(id, input.vibeProject), eq(created_by, ctx.session.user.id)),
      });
      if (!chatRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      const chatManager = await getChatManager(env, chatRecord.id);
      const success = await chatManager.connectToAppwriteProject({
        region: input.region,
        projectId: input.appwriteProjectId,
        apiKey: input.apiKey,
      });
      return { success };
    }),

  disconnectAppwriteProject: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const chatRecord = await db.query.chat.findFirst({
        where: ({ id, created_by }, { eq, and }) =>
          and(eq(id, input.chatId), eq(created_by, ctx.session.user.id)),
      });
      if (!chatRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      const chatManager = await getChatManager(env, chatRecord.id);
      const success = await chatManager.disconnectFromAppwrite();
      return { success };
    }),

  deployAppwriteProject: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const chatRecord = await db.query.chat.findFirst({
        where: ({ id, created_by }, { eq, and }) =>
          and(eq(id, input.chatId), eq(created_by, ctx.session.user.id)),
      });
      if (!chatRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      const chatManager = await getChatManager(env, chatRecord.id);
      await chatManager.createNewAppwriteDeployment();
      return { success: true };
    }),

  getLatestDeployment: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const chatRecord = await db.query.chat.findFirst({
        where: ({ id, created_by }, { eq, and }) =>
          and(eq(id, input.chatId), eq(created_by, ctx.session.user.id)),
      });
      if (!chatRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      const chatManager = await getChatManager(env, chatRecord.id);
      const latestDeployment = await chatManager.getDeploymentConsoleUrl();
      return {
        consoleUrl: latestDeployment.url,
        deploymentId: latestDeployment.deploymentId,
      };
    }),
});
export type AppRouter = typeof appRouter;
