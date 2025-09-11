"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { PlugIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getQueryClient } from "@/lib/get-query-client";
import { trpc } from "@/lib/trpc";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const schema = z.object({
  region: z.enum(["fra", "nyc", "sfo", "syd"]),
  projectId: z.string().min(2).max(100),
  apiKey: z.string().min(2).max(300),
});

type SchemaType = z.infer<typeof schema>;

const regionsMap: Record<SchemaType["region"], { flag: string; name: string }> =
  {
    fra: { flag: "🇩🇪", name: "Frankfurt" },
    nyc: { flag: "🇺🇸", name: "New York" },
    sfo: { flag: "🇺🇸", name: "San Francisco" },
    syd: { flag: "🇦🇺", name: "Sydney" },
  };

const regions = Object.keys(regionsMap) as SchemaType["region"][];

type Props = {
  chatId: string;
};

export function ConnectAppwriteDialog({ chatId }: Props) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation(
    trpc.connectAppwriteProject.mutationOptions({
      async onSuccess() {
        const qc = getQueryClient();
        await qc.invalidateQueries({
          queryKey: trpc.getChatWithMessages.queryKey({ chatId }),
        });
        toast.success("Successfully connected to Appwrite");
        setOpen(false);
      },
      onError(error, variables, context) {
        console.log("[ERROR] Connecting to Appwrite");
        console.log({ error, variables, context });
        toast.error(error.message || "Error connecting to Appwrite");
      },
    })
  );

  const form = useForm<SchemaType>({
    resolver: zodResolver(schema),
    defaultValues: {
      region: "fra",
      projectId: "",
      apiKey: "",
    },
  });

  function onSubmit(data: SchemaType) {
    console.log(data);
    mutation.mutate({
      region: data.region,
      appwriteProjectId: data.projectId,
      apiKey: data.apiKey,
      vibeProject: chatId,
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <PlugIcon className="size-4" /> Connect
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Appwrite Project</DialogTitle>
          <DialogDescription>
            Connect your Appwrite project to directly deploy your vibecoded site
            to Appwrite's global network.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="mt-4 space-y-6"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <Select
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a region" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region} value={region}>
                          <span>{regionsMap[region].flag}</span>
                          <span>{regionsMap[region].name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Your Appwrite project region.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your project ID" {...field} />
                  </FormControl>
                  <FormDescription>Your Appwrite project ID.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your API key"
                      {...field}
                      type="password"
                    />
                  </FormControl>
                  <FormDescription>Your Appwrite API key.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button
            loading={mutation.isPending}
            onClick={() => {
              form.handleSubmit(onSubmit)();
            }}
          >
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
