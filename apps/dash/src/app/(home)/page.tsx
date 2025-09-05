"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/prompt-input";
import { useSession } from "@/lib/auth-client";
import { PROMPT_STORAGE_KEY } from "@/lib/consts";
import { trpc } from "@/lib/trpc";

export default function Page() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const { data: sessionData } = useSession();
  const createChatMutation = useMutation(
    trpc.createChat.mutationOptions({
      onSuccess(data, variables, context) {
        console.log({ data, variables, context });
        router.push(`/chat/${data.id}`);
      },
    })
  );
  const isLoading =
    createChatMutation.isPending || createChatMutation.isSuccess;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionData?.user) {
      router.push("/auth");
    }
    if (!input.trim()) {
      return toast.error("Prompt can't be empty");
    }
    createChatMutation.mutate({
      prompt: input,
    });
  }

  return (
    <div className="flex h-svh w-full items-center justify-center gap-4">
      <PromptInput
        className="relative mx-auto mt-4 w-full max-w-xl"
        onSubmit={handleSubmit}
      >
        <PromptInputTextarea
          className="h-[6lh] pr-12"
          onChange={(e) => {
            setInput(e.currentTarget.value);
            localStorage.setItem(PROMPT_STORAGE_KEY, e.currentTarget.value);
          }}
          placeholder="Ask Vibe to build..."
          ref={(el) => {
            // instead of using useEffect we are using ref callback to put cursor at the end of the text
            if (!el) {
              return;
            }
            setInput(localStorage.getItem(PROMPT_STORAGE_KEY) ?? "");

            const length = el.value.length;
            el.focus();
            el.setSelectionRange(length, length);
          }}
          value={input}
        />
        <PromptInputSubmit
          className="!absolute right-1 bottom-1"
          disabled={!input.trim() || isLoading}
          status={isLoading ? "submitted" : "ready"}
        />
      </PromptInput>
    </div>
  );
}
