"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function Page() {
  // const { data, error, isPending } = useSession();
  const createChatMutation = useMutation(
    trpc.createChat.mutationOptions({
      onSuccess(data, variables, context) {
        console.log({ data, variables, context });
      },
    })
  );
  return (
    <div>
      <Button onClick={() => createChatMutation.mutate()}>New Chat</Button>
    </div>
  );
}
