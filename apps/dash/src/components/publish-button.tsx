import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button, buttonVariants } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function PublishButton({ chatId }: { chatId: string }) {
  const query = useQuery(trpc.getLatestDeployment.queryOptions({ chatId }));

  const mutation = useMutation(
    trpc.deployAppwriteProject.mutationOptions({
      onSuccess: async () => {
        await query.refetch();
        toast.success("Deployment created successfully!");
      },
      onError: () => {
        toast.error("Failed to create deployment.");
      },
    })
  );

  function getDeploymentId() {
    if (query.isLoading) return "Loading...";
    return query.data?.deploymentId ?? "Not Deployed Yet";
  }

  function getConsoleUrl() {
    const CONSOLE_URL = "https://cloud.appwrite.io/console";
    if (query.isLoading) return "Loading...";
    if (
      !query.data?.consoleUrl ||
      query.data?.consoleUrl.includes("undefined")
    ) {
      return CONSOLE_URL;
    }
    return query.data?.consoleUrl ?? CONSOLE_URL;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button>Publish</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground text-sm">Latest Deployment</p>
            <p>{getDeploymentId()}</p>
          </div>
          <p className="text-muted-foreground text-sm">
            Since Appwrite API don't have a way to get latest deployment url,
            you have to visit Appwrite Console for deployment url :(
          </p>
          <Link
            className={buttonVariants({
              variant: "secondary",
              size: "sm",
              className: "w-full",
            })}
            href={getConsoleUrl()}
            rel="noopener noreferrer"
            target="_blank"
          >
            View in Appwrite Console
          </Link>
          <Button
            className="w-full"
            loading={mutation.isPending}
            onClick={() => mutation.mutate({ chatId })}
            size="sm"
          >
            Create a new deployment
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
