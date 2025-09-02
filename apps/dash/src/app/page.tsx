"use client";

import { useChat } from "@ai-sdk/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/conversation";
import { Message, MessageContent } from "@/components/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/prompt-input";
import { Response } from "@/components/response";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewConsole,
  WebPreviewNavigation,
  WebPreviewUrl,
} from "@/components/web-preview";
import { useVMStore } from "@/stores/vm";
import "@xterm/xterm/css/xterm.css";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { fsTree } from "./fs";

export default function Page() {
  const vm = useVMStore((state) => state.vm);
  const runCommand = useVMStore((state) => state.runCommand);
  const initVM = useVMStore((state) => state.initVM);
  const logs = useVMStore((state) => state.logs);
  const [url, setUrl] = useState("");
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "http://localhost:8787/api/chat",
    }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  useEffect(() => {
    (async () => {
      if (!vm) {
        console.log("No VM instance available");
        await initVM();
        return;
      }
      vm.on("server-ready", (port, outUrl) => {
        console.log({ port, outUrl });
        setUrl(outUrl);
      });
      await runCommand("pwd");
      await vm.mount(fsTree);
      // const installProcess = await runCommand("pnpm", ["install"]);
      // const code = await installProcess.exit;
      // console.log({ code });
      // await runCommand("pnpm", ["run", "dev"]);
    })();
  }, [vm, initVM, runCommand]);

  return (
    <div className="flex h-screen flex-col">
      <div className="flex shrink-0 items-center justify-between border-b p-2">
        <div>
          <Link href="/">
            <Logo className="size-6" />
          </Link>
        </div>
        <div>
          <Button size="sm">Publish</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel minSize={30}>
            <Conversation className="relative h-full overflow-hidden">
              <ConversationContent className="space-y-2 pb-24">
                {messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageContent>
                      {message.parts.map((part, i) => {
                        switch (part.type) {
                          case "text": // we don't use any reasoning or tool calls in this example
                            return (
                              <Response key={`${message.id}-${i}`}>
                                {part.text}
                              </Response>
                            );
                          default:
                            return null;
                        }
                      })}
                    </MessageContent>
                  </Message>
                ))}
              </ConversationContent>
              <ConversationScrollButton />
              <div className="absolute right-0 bottom-0 left-0 p-2">
                <PromptInput
                  className="relative mx-auto mt-4 w-full max-w-2xl"
                  onSubmit={handleSubmit}
                >
                  <PromptInputTextarea
                    className="pr-12"
                    onChange={(e) => setInput(e.currentTarget.value)}
                    placeholder="Say something..."
                    value={input}
                  />
                  <PromptInputSubmit
                    className="absolute right-1 bottom-1"
                    disabled={!input.trim()}
                    status={status === "streaming" ? "streaming" : "ready"}
                  />
                </PromptInput>
              </div>
            </Conversation>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel className="p-2" minSize={30}>
            <WebPreview>
              <WebPreviewNavigation>
                <WebPreviewUrl
                  onChange={(e) => setUrl(e.target.value)}
                  value={url}
                />
              </WebPreviewNavigation>
              <WebPreviewBody src={url} />
              <WebPreviewConsole logs={logs} />
            </WebPreview>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
