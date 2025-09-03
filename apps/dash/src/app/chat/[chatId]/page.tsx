"use client";

import { useQuery } from "@tanstack/react-query";
import type { CustomUIMessage } from "@vibe/server";
import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Chat } from "./chat";

export default function Page({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const { data, isLoading, error } = useQuery(
    trpc.getChatWithMessages.queryOptions({ chatId })
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (error || !data) {
    return <div>Error: {error?.message ?? "Something went wrong"}</div>;
  }

  return (
    <Chat
      chatId={chatId}
      initialMessages={data?.messages as CustomUIMessage[]}
    />
  );
}
