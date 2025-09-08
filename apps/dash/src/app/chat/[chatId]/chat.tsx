"use client";

import { useChat } from "@ai-sdk/react";
import type { CustomUIMessage } from "@vibe/server";
import { DefaultChatTransport } from "ai";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppMessagePart } from "@/components/app-message-part";
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
import { env } from "@/env";
import { PROMPT_STORAGE_KEY } from "@/lib/consts";
import { ChatError } from "@/lib/errors";
import { fetchWithErrorHandlers } from "@/lib/utils";

export function Chat({
  initialMessages,
  chatId,
}: {
  initialMessages: CustomUIMessage[];
  chatId: string;
}) {
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat<CustomUIMessage>({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      fetch: fetchWithErrorHandlers,
      api: `${env.NEXT_PUBLIC_API_URL}/api/chat/${chatId}`,
      prepareSendMessagesRequest({ messages: imessages, id }) {
        return { body: { message: imessages.at(-1), id } };
      },
      credentials: "include",
    }),
    onError: (error) => {
      if (error instanceof ChatError) {
        toast.error(error.message);
      }
      console.log({ error });
    },
    onToolCall: ({ toolCall }) => {
      console.log({ toolCall });
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
    <Conversation className="relative h-full overflow-hidden">
      <ConversationContent className="pb-24">
        {messages.map((message) => (
          <Message from={message.role} key={message.id}>
            <MessageContent>
              {message.parts.map((part, i) => {
                return (
                  <AppMessagePart key={`${message.id}-${i}`} part={part} />
                );
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
  );
}
