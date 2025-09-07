import { env } from "cloudflare:workers";
import { tool } from "ai";
import z from "zod";
import { stripIndents } from "@/lib/utils";

const DESCRIPTION = stripIndents(`
Fetch content from a URL and return text, markdown, or raw HTML.
- Validates URL (must start with http:// or https://)
- Enforces 5MB max response size
- Supports optional timeout (seconds, max 20)
- Removes scripts/styles from text & markdown extraction
- Returns ONLY the fetched/transformed content (no title/preview metadata)
`);

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT_MS = 10_000; // 10s
const MAX_TIMEOUT_MS = 20_000; // 20s

function sanitizeUrl(url: string): string {
  if (url.startsWith("http://")) return url.replace(/^http:\/\//, "https://");
  return url;
}

async function convertHtmlToMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/html" });

  const markdown = await env.AI.toMarkdown({
    name: filename,
    blob,
  });

  return markdown.data;
}

async function extractTextFromHTML(html: string): Promise<string> {
  let text = "";
  let skipContent = false;
  // biome-ignore lint/correctness/noUndeclaredVariables: <htmlwriter exist in workerd>
  const rewriter = new HTMLRewriter()
    .on("script, style, noscript, iframe, object, embed", {
      element() {
        skipContent = true;
      },
    })
    .on("*", {
      element(element) {
        if (
          ![
            "script",
            "style",
            "noscript",
            "iframe",
            "object",
            "embed",
          ].includes(element.tagName)
        ) {
          skipContent = false;
        }
      },
      text(t) {
        if (!skipContent) {
          text += t.text;
        }
      },
    })
    .transform(new Response(html));
  await rewriter.text();
  return text.trim();
}

export const webfetchTool = () =>
  tool({
    name: "webfetch",
    description: DESCRIPTION,
    inputSchema: z.object({
      url: z.url().describe("Fully qualified URL to fetch"),
      format: z
        .enum(["text", "markdown", "html"])
        .default("markdown")
        .describe("Return format: text | markdown | html"),
      timeout: z.coerce
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Timeout in seconds (max 20)"),
    }),
    outputSchema: z.string(),
    execute: async (input) => {
      let { url } = input;
      const { format } = input;
      const timeoutMs = Math.min(
        input.timeout ? input.timeout * 1000 : DEFAULT_TIMEOUT_MS,
        MAX_TIMEOUT_MS
      );

      if (!/^https?:\/\//i.test(url)) {
        throw new Error("URL must start with http:// or https://");
      }
      url = sanitizeUrl(url);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const resp = await fetch(url, {
        signal: AbortSignal.any([controller.signal]),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }).catch((e) => {
        clearTimeout(timer);
        throw new Error(
          `Fetch failed: ${e instanceof Error ? e.message : String(e)}`
        );
      });

      clearTimeout(timer);

      if (!resp.ok) {
        throw new Error(`Request failed with status code: ${resp.status}`);
      }

      const contentLengthHeader = resp.headers.get("content-length");
      if (
        contentLengthHeader &&
        Number.parseInt(contentLengthHeader, 10) > MAX_RESPONSE_SIZE
      ) {
        throw new Error("Response too large (exceeds 5MB limit)");
      }

      // Read as ArrayBuffer to enforce size limit
      const ab = await resp.arrayBuffer();
      if (ab.byteLength > MAX_RESPONSE_SIZE) {
        throw new Error("Response too large (exceeds 5MB limit)");
      }

      const contentType = resp.headers.get("content-type") || "";
      const text = new TextDecoder().decode(ab);

      switch (format) {
        case "text": {
          if (contentType.includes("text/html")) {
            return await extractTextFromHTML(text);
          }
          return text;
        }
        case "markdown":
          if (contentType.includes("text/html")) {
            return await convertHtmlToMarkdown(text, "input.html");
          }
          return `\`\`\`${text}\`\`\``;
        case "html":
          return text;
        default:
          return text;
      }
    },
  });
