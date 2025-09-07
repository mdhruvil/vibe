import { tool } from "ai";
import z from "zod";
import { stripIndents } from "@/lib/utils";
import type { VibeContext } from "../tool";

const DESCRIPTION = stripIndents(`
Reads a file from the filesystem. You can access any file directly by using this tool.
Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

Usage:
- The filePath parameter must be an absolute path, not a relative path
- By default, it reads up to 2000 lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters
- Any lines longer than 2000 characters will be truncated
- Results are returned using cat -n style numbering (starting at 1)
- If you have to return content to the user don't use cat -n style, just give the content in markdown codeblock
- This tool cannot read binary files, including images
- You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful.
- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.
`);

const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const WORKSPACE_ROOT = "/workspace"; // Sandbox session cwd

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function isImageExt(filePath: string): string | false {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "PNG";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "JPEG";
  if (lower.endsWith(".gif")) return "GIF";
  if (lower.endsWith(".bmp")) return "BMP";
  if (lower.endsWith(".webp")) return "WebP";
  return false;
}

const BINARY_EXT_SET = new Set([
  ".zip",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".so",
  ".class",
  ".jar",
  ".war",
  ".7z",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
  ".bin",
  ".dat",
  ".obj",
  ".o",
  ".a",
  ".lib",
  ".wasm",
  ".pyc",
  ".pyo",
]);

function getExt(path: string): string {
  const idx = path.lastIndexOf(".");
  if (idx === -1) return "";
  return path.slice(idx).toLowerCase();
}

function decodeBase64ToBytes(data: string): Uint8Array {
  // atob is available in workers; fallback not needed.
  const binary = atob(data.trim());
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isProbablyBinary(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  let nonPrintable = 0;
  // biome-ignore lint/style/useForOf: <it's easier to understand>
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0) return true; // immediate null detection
    if (b < 9 || (b > 13 && b < 32)) nonPrintable++;
  }
  return nonPrintable / bytes.length > 0.3;
}

export const readTool = (ctx: VibeContext) =>
  tool({
    name: "read",
    description: DESCRIPTION,
    inputSchema: z.object({
      filePath: z.string().describe("The path to the file to read"),
      offset: z.coerce
        .number()
        .describe("The line number to start reading from (0-based)")
        .optional(),
      limit: z.coerce
        .number()
        .describe("The number of lines to read (defaults to 2000)")
        .optional(),
    }),
    outputSchema: z.string(),
    execute: async (input) => {
      const { filePath } = input;
      let { offset, limit } = input;

      if (!filePath.startsWith("/")) {
        throw new Error("The filePath parameter must be an absolute path");
      }

      // Workspace containment (basic guard)
      if (
        !filePath.startsWith(`${WORKSPACE_ROOT}/`) &&
        filePath !== WORKSPACE_ROOT
      ) {
        throw new Error(
          `File ${filePath} is not in the workspace root (${WORKSPACE_ROOT})`
        );
      }

      offset = typeof offset === "number" && offset >= 0 ? offset : 0;
      limit =
        typeof limit === "number" && limit > 0 ? limit : DEFAULT_READ_LIMIT;

      const esc = shellEscape(filePath);

      // Existence check
      const existsProc = await ctx.session.exec(
        `[ -f ${esc} ] && echo __OK__ || echo __NO__`
      );
      if (!existsProc.stdout.includes("__OK__")) {
        // Attempt suggestions from parent directory
        const dir = filePath.includes("/")
          ? filePath.slice(0, filePath.lastIndexOf("/")) || "/"
          : "/";
        const base = filePath.slice(filePath.lastIndexOf("/") + 1);
        let suggestions: string[] = [];
        try {
          const dirList = await ctx.session.exec(
            `ls -1 ${shellEscape(dir)} 2>/dev/null || true`
          );
          suggestions = dirList.stdout
            .split(/\n+/)
            .filter((s) => s.length > 0)
            .filter(
              (s) =>
                s.toLowerCase().includes(base.toLowerCase()) ||
                base.toLowerCase().includes(s.toLowerCase())
            )
            .slice(0, 3)
            .map((s) => `${dir === "/" ? "" : dir}/${s}`);
        } catch {
          // ignore
        }
        if (suggestions.length) {
          throw new Error(
            `File not found: ${filePath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`
          );
        }
        throw new Error(`File not found: ${filePath}`);
      }

      // Image extension rejection
      const imgType = isImageExt(filePath);
      if (imgType) {
        throw new Error(
          `This is an image file of type: ${imgType}. Use a different tool to process images.`
        );
      }

      // Binary extension fast path
      const ext = getExt(filePath);
      if (ext && BINARY_EXT_SET.has(ext)) {
        throw new Error(
          `Cannot read binary file (extension ${ext}): ${filePath}`
        );
      }

      // Sample first 4KB for binary detection
      const headProc = await ctx.session.exec(
        `head -c 4096 ${esc} | base64 || true`
      );
      if (headProc.exitCode === 0 && headProc.stdout.trim().length) {
        try {
          const bytes = decodeBase64ToBytes(headProc.stdout);
          if (isProbablyBinary(bytes)) {
            throw new Error(`Cannot read binary file: ${filePath}`);
          }
        } catch (_e) {
          // If base64 decoding fails we ignore and proceed (best effort)
          // console.error("Binary detection error", e);
        }
      }

      // Count lines
      const countProc = await ctx.session.exec(
        `wc -l ${esc} 2>/dev/null | awk '{print $1}'`
      );
      let totalLines = 0;
      if (countProc.exitCode === 0) {
        totalLines = Number.parseInt(countProc.stdout.trim(), 10) || 0;
      }

      if (offset >= totalLines && totalLines !== 0) {
        throw new Error(
          `Offset ${offset} beyond end of file (only ${totalLines} lines)`
        );
      }

      const start = offset + 1; // sed is 1-based
      const end = offset + limit;
      const sedCmd = `sed -n '${start},${end}p' ${esc}`;
      const sliceProc = await ctx.session.exec(sedCmd);
      if (sliceProc.exitCode !== 0) {
        throw new Error(
          `Failed reading file segment (exit ${sliceProc.exitCode}): ${sliceProc.stderr}`
        );
      }

      const rawLines = sliceProc.stdout.length
        ? sliceProc.stdout.replace(/\n$/, "").split("\n")
        : [];

      // Truncate long lines & build numbered content
      const contentLines = rawLines.map((line, i) => {
        const safe =
          line.length > MAX_LINE_LENGTH
            ? `${line.slice(0, MAX_LINE_LENGTH)}...`
            : line;
        const lineNumber = (offset + i + 1).toString().padStart(5, "0");
        return `${lineNumber}| ${safe}`;
      });

      let output = "<file>\n";
      if (totalLines === 0) {
        output += "(File is empty)";
      } else if (contentLines.length === 0) {
        output += "(No lines returned for given range)";
      } else {
        output += contentLines.join("\n");
      }

      if (totalLines > offset + rawLines.length) {
        output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${offset + rawLines.length})`;
      }
      output += "\n</file>";

      return output;
    },
  });
