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
import { useEffect, useState } from "react";
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
    <div className="h-screen flex flex-col">
      <div className="flex justify-between items-center border-b p-2 shrink-0">
        <div className="text-lg font-bold">My App</div>
        <div>
          <Button size="sm">Publish</Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
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
              <div className="p-2 absolute bottom-0 left-0 right-0">
                <PromptInput
                  onSubmit={handleSubmit}
                  className="mt-4 w-full max-w-2xl mx-auto relative"
                >
                  <PromptInputTextarea
                    value={input}
                    placeholder="Say something..."
                    onChange={(e) => setInput(e.currentTarget.value)}
                    className="pr-12"
                  />
                  <PromptInputSubmit
                    status={status === "streaming" ? "streaming" : "ready"}
                    disabled={!input.trim()}
                    className="absolute bottom-1 right-1"
                  />
                </PromptInput>
              </div>
            </Conversation>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel minSize={30} className="p-2">
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
