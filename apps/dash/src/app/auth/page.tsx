"use client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { GitHubIcon, GoogleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export default function AuthPage() {
  const googleMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(window.location.href);
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: url.origin,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    onError(error, variables, context) {
      console.log({ error, variables, context });
      toast.error(error.message ?? "Something went wrong");
    },
  });
  const githubMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(window.location.href);
      const { error } = await authClient.signIn.social({
        provider: "github",
        callbackURL: url.origin,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    onError(error, variables, context) {
      console.log({ error, variables, context });
      toast.error(error.message ?? "Something went wrong");
    },
  });
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm space-y-4">
        <Card className="p-0">
          <CardContent className="space-y-6 p-6 md:p-8">
            <div className="flex flex-col items-center text-center">
              <h1 className="font-bold text-2xl">Welcome </h1>
              <p className="text-balance text-muted-foreground">
                Login to your Vibe account
              </p>
            </div>
            <div className="space-y-4">
              <Button
                className="w-full"
                loading={googleMutation.isPending}
                onClick={() => {
                  googleMutation.mutate();
                }}
                size="lg"
                variant="secondary"
              >
                <GoogleIcon className="mr-2 h-4 w-4" />
                Sign in with Google
              </Button>
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-border after:border-t">
                <span className="relative z-10 bg-card px-2 text-muted-foreground">
                  Or
                </span>
              </div>
              <Button
                className="w-full"
                loading={githubMutation.isPending}
                onClick={() => {
                  githubMutation.mutate();
                }}
                size="lg"
                variant="secondary"
              >
                <GitHubIcon className="mr-2 h-4 w-4" />
                Sign in with GitHub
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="text-balance text-center text-muted-foreground text-xs *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary">
          By clicking continue, you agree to our{" "}
          <a href="/">Terms of Service</a> and <a href="/">Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}
