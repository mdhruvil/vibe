import { useMutation } from "@tanstack/react-query";
import { UnplugIcon } from "lucide-react";
import { toast } from "sonner";
import { getQueryClient } from "@/lib/get-query-client";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";

export function DisconnectAppwriteProject({ chatId }: { chatId: string }) {
  const mutation = useMutation(
    trpc.disconnectAppwriteProject.mutationOptions({
      async onSuccess(data) {
        if (data.success) {
          const qc = getQueryClient();
          await qc.invalidateQueries({
            queryKey: trpc.getChatWithMessages.queryKey(),
          });
          toast.success("Disconnected from Appwrite Project");
        } else {
          toast.error("Failed to disconnect from Appwrite Project");
        }
      },
      onError(error, variables, context) {
        console.log("[ERROR] Disconnecting from Appwrite Project");
        console.log({ error, variables, context });
        toast.error("Failed to disconnect from Appwrite Project");
      },
    })
  );
  return (
    <Button
      loading={mutation.isPending}
      onClick={() => mutation.mutate({ chatId })}
      variant="secondary"
    >
      <UnplugIcon className="size-4" />
      Disconnect
    </Button>
  );
}
