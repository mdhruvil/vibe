"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderIcon, PlugZapIcon, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { ReadyState } from "react-use-websocket";
import { ConnectAppwriteDialog } from "@/components/connect-appwrite-dialog";
import { DisconnectAppwriteProject } from "@/components/disconnect-appwrite-project";
import { Logo } from "@/components/logo";
import { PublishButton } from "@/components/publish-button";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useDevServer } from "@/hooks/use-dev-server";
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

  // Dev server status (shared with preview component)
  const { status, connectionStatus } = useDevServer(chatId);
  const connectionLabel = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Connected",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[connectionStatus];

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

  function renderAppwriteButton() {
    if (isLoading) {
      return (
        <Button disabled loading variant="secondary">
          Checking...
        </Button>
      );
    }

    if (!data?.isConnectedToAppwrite) {
      return <ConnectAppwriteDialog chatId={chatId} />;
    }

    return <DisconnectAppwriteProject chatId={chatId} />;
  }

  function renderPublishButton() {
    if (isLoading) {
      return (
        <Button disabled loading>
          Checking...
        </Button>
      );
    }

    if (!data?.isConnectedToAppwrite) {
      return <Button disabled>Publish</Button>;
    }

    return <PublishButton chatId={chatId} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <nav className="flex shrink-0 items-center justify-between border-b p-2">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Logo className="size-6" />
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <p className="text-muted-foreground/60">/</p>
            <p>{data?.title}</p>
          </div>
          <div className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-muted-foreground text-xs">
            <PlugZapIcon className="size-3" />
            <span className="capitalize">{status}</span>
            <span className="text-border">/</span>
            <span>{connectionLabel}</span>
          </div>
        </div>
        <div className="flex gap-3">
          {renderAppwriteButton()}
          {renderPublishButton()}
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
