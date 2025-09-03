import { env } from "cloudflare:workers";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { db } from "@/db";
import { chat } from "@/db/schema/chat";
import type { CustomUIMessage } from "..";
import { protectedProcedure, publicProcedure, router } from "../lib/trpc";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  createChat: protectedProcedure.mutation(async ({ ctx }) => {
    const [newChat] = await db
      .insert(chat)
      .values({
        title: "Untitled Chat",
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
      const stub = env.CHAT_MANAGER.getByName(chatRecord.id);
      const messages = (await stub.getMessages()) as CustomUIMessage[];
      return { ...chatRecord, messages };
    }),
  getAllChats: protectedProcedure.query(async ({ ctx }) => {
    const chats = await db.query.chat.findMany({
      where: ({ created_by }, { eq }) => eq(created_by, ctx.session.user.id),
    });
    return chats;
  }),
});
export type AppRouter = typeof appRouter;
