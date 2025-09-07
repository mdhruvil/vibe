"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderIcon, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { trpc } from "@/lib/trpc";
import { Chat } from "./chat";
import { Preview } from "./preview";

export default function Page({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const { data, isLoading, error } = useQuery(
    trpc.getChatWithMessages.queryOptions({ chatId })
  );

  function renderChat() {
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center overflow-y-auto">
          <LoaderIcon className="animate-spin" />
        </div>
      );
    }

    if (error || !data) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <TriangleAlert />
          <p>Error loading chat</p>
        </div>
      );
    }
    return <Chat chatId={chatId} initialMessages={data?.messages} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <nav className="flex shrink-0 items-center justify-between border-b p-2">
        <div>
          <Link href="/">
            <Logo className="size-6" />
          </Link>
        </div>
        <div>
          <Button size="sm">Publish</Button>
        </div>
      </nav>
      <section className="flex min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel minSize={30}>{renderChat()}</ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel className="p-2" minSize={30}>
            <Preview chatId={chatId} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </section>
    </div>
  );
}
