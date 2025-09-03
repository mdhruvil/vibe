"use client";

import { useChat } from "@ai-sdk/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/conversation";
import { Logo } from "@/components/logo";
import { Message, MessageContent } from "@/components/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/prompt-input";
import { Response } from "@/components/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/tool";
import { Button } from "@/components/ui/button";
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
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CustomUIMessage } from "../../../../../server/src/index";
import { fsTree } from "../../fs";

export function Chat({
  initialMessages,
  chatId,
}: {
  initialMessages: CustomUIMessage[];
  chatId: string;
}) {
  const vm = useVMStore((state) => state.vm);
  const runCommand = useVMStore((state) => state.runCommand);
  const initVM = useVMStore((state) => state.initVM);
  const logs = useVMStore((state) => state.logs);
  const runWithLogs = useVMStore((state) => state.runWithLogs);
  const [url, setUrl] = useState("");
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, addToolResult } =
    useChat<CustomUIMessage>({
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: `http://localhost:8787/api/chat/${chatId}`,
        prepareSendMessagesRequest({ messages: imessages, id }) {
          return { body: { message: imessages.at(-1), id } };
        },
      }),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      onToolCall: async ({ toolCall }) => {
        if (toolCall.dynamic) {
          return;
        }
        console.log({ toolCall });
        if (toolCall.toolName === "bash") {
          const command = toolCall.input.command;
          const parts = command.split(" ");
          await new Promise((resolve) => setTimeout(resolve, 3000)); // simulate some delay
          const ilogs = await runWithLogs(parts[0], parts.slice(1));
          console.log({ ilogs });
          addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: ilogs.join("\n"),
          });
        }
      },
      onFinish: ({ messages: msgs }) => {
        console.log({ msgs });
      },
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
                          case "tool-bash":
                            return (
                              <Tool
                                defaultOpen={false}
                                key={`${message.id}-${i}`}
                              >
                                <ToolHeader
                                  state={part.state}
                                  text={`Running \`${part.input?.command}\``}
                                  type={part.type}
                                />
                                <ToolContent>
                                  <ToolInput input={part.input} />
                                  <ToolOutput
                                    errorText={part.errorText}
                                    output={
                                      <Response>
                                        {part.output ?? "No Output"}
                                      </Response>
                                    }
                                  />
                                </ToolContent>
                              </Tool>
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
                    className="!absolute right-1 bottom-1"
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
