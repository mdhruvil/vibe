"use client";

import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { SquareArrowOutUpRightIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/web-preview";
import { env } from "@/env";
import { PROMPT_STORAGE_KEY } from "@/lib/consts";
import { trpc } from "@/lib/trpc";
import type { CustomUIMessage } from "../../../../../server/src/index";

export function Chat({
  initialMessages,
  chatId,
}: {
  initialMessages: CustomUIMessage[];
  chatId: string;
}) {
  const [input, setInput] = useState("");

  const previewUrlQuery = useQuery(
    trpc.getChatPreviewUrl.queryOptions({ chatId })
  );
  const previewUrl = (previewUrlQuery.data?.previewUrl as string) ?? "";

  const { messages, sendMessage, status } = useChat<CustomUIMessage>({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `${env.NEXT_PUBLIC_API_URL}/api/chat/${chatId}`,
      prepareSendMessagesRequest({ messages: imessages, id }) {
        return { body: { message: imessages.at(-1), id } };
      },
    }),

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
    const prompt = localStorage.getItem(PROMPT_STORAGE_KEY);
    if (!prompt && !initialMessages.length && !messages.length) {
      console.log("THE PROMPT IS EMPTY!! THIS SHOULD NOT HAPPEN");
      return;
    }

    if (prompt && initialMessages.length > 0 && messages.length > 0) {
      console.log("Already has the messages so no need to set the prompt");
      return;
    }

    if (prompt && !initialMessages.length && !messages.length) {
      localStorage.removeItem(PROMPT_STORAGE_KEY);
      sendMessage({ text: prompt });
    }
  }, [initialMessages.length, messages.length, sendMessage]);

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
                                      <pre>{part.output ?? "No Output"}</pre>
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
            <WebPreview defaultUrl={previewUrl}>
              <WebPreviewNavigation>
                <WebPreviewUrl value={previewUrl} />
                <WebPreviewNavigationButton tooltip="Open in new tab">
                  <Link
                    href={previewUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <SquareArrowOutUpRightIcon />
                  </Link>
                </WebPreviewNavigationButton>
              </WebPreviewNavigation>
              <WebPreviewBody src={previewUrl} />
            </WebPreview>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
