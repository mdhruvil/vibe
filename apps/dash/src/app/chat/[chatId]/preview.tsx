import { useQuery } from "@tanstack/react-query";
import {
  LoaderIcon,
  SquareArrowOutUpRightIcon,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewConsole,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/web-preview";
import { useDevServer } from "@/hooks/use-dev-server";
import { trpc } from "@/lib/trpc";

export function Preview({ chatId }: { chatId: string }) {
  // Kick off preview URL creation (ensures sandbox + dev server readiness)
  const previewUrlQuery = useQuery(
    trpc.getChatPreviewUrl.queryOptions({ chatId })
  );

  const { previewUrl: livePreviewUrl, status, logs } = useDevServer(chatId);

  const [previewUrl, setPreviewUrl] = useState("");

  // Initial fallback from query; thereafter prefer live websocket value.
  useEffect(() => {
    if (livePreviewUrl) {
      setPreviewUrl(livePreviewUrl);
      return;
    }
    if (previewUrlQuery.data?.previewUrl) {
      setPreviewUrl(previewUrlQuery.data.previewUrl);
    }
  }, [livePreviewUrl, previewUrlQuery.data]);

  function renderPreviewFrame() {
    if (!previewUrl && (previewUrlQuery.isLoading || status === "starting")) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <LoaderIcon className="animate-spin" />
          <p>Preview is starting. Please wait</p>
        </div>
      );
    }

    if (!previewUrl) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <TriangleAlert />
          <p>Preview not yet available.</p>
        </div>
      );
    }

    return <WebPreviewBody src={previewUrl} />;
  }

  return (
    <WebPreview defaultUrl={previewUrl}>
      <WebPreviewNavigation>
        <WebPreviewUrl
          onChange={() => {
            // noop
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPreviewUrl(e.currentTarget.value);
            }
          }}
          value={previewUrl}
        />
        <WebPreviewNavigationButton tooltip="Open in new tab">
          <Link href={previewUrl} rel="noopener noreferrer" target="_blank">
            <SquareArrowOutUpRightIcon />
          </Link>
        </WebPreviewNavigationButton>
      </WebPreviewNavigation>
      {renderPreviewFrame()}
      <WebPreviewConsole
        logs={logs.map((l) => ({
          level: l.stream === "stderr" ? "error" : "log",
          message: l.message,
          timestamp: new Date(l.ts),
        }))}
      />
    </WebPreview>
  );
}
