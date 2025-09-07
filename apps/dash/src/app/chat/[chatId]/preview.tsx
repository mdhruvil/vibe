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
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/web-preview";
import { trpc } from "@/lib/trpc";

export function Preview({ chatId }: { chatId: string }) {
  const previewUrlQuery = useQuery(
    trpc.getChatPreviewUrl.queryOptions({ chatId })
  );

  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (previewUrlQuery.data) {
      setPreviewUrl(previewUrlQuery.data.previewUrl);
    }
  }, [previewUrlQuery.data]);

  function renderPreviewFrame() {
    if (previewUrlQuery.isLoading) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <LoaderIcon className="animate-spin" />
          <p>Preview is starting. Please wait </p>
        </div>
      );
    }

    if (previewUrlQuery.isError || !previewUrl) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <TriangleAlert />
          <p>Preview failed to load. Please try again later.</p>
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
    </WebPreview>
  );
}
