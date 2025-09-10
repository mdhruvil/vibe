import type { ExecutionSession } from "@cloudflare/sandbox";
import { isToolUIPart } from "ai";
import type { CustomUIMessage } from "./ai/tool";
import { fileExists, replace } from "./ai/tools/edit";

async function replayPart(
  part: CustomUIMessage["parts"][number],
  session: ExecutionSession
) {
  if (!isToolUIPart(part)) return false;
  if (part.state === "output-error" || part.errorText) return;
  if (part.type === "tool-edit") {
    const oldString = part.input?.oldString ?? "";
    const newString = part.input?.newString ?? "";
    const filePath = part.input?.filePath ?? "";
    const replaceAll = part.input?.replaceAll ?? false;

    if (oldString === "") {
      // that means we are creating a file
      const createdFile = await session.writeFile(filePath, newString);
      if (!createdFile.success || createdFile.exitCode !== 0) {
        throw new Error(`Failed to create file: ${filePath}`);
      }
      return true;
    }

    const exists = await fileExists(session, filePath);
    if (!exists) throw new Error(`File not found: ${filePath}`);

    const file = await session.readFile(filePath);

    const contentOld = file.content;
    let contentNew: string;
    try {
      contentNew = replace(contentOld, oldString, newString, replaceAll);
    } catch (error) {
      console.log("[REPLAY_MESSAGES] Error replacing content:", error);
      console.log(part);
      return false;
    }

    const updatedFile = await session.writeFile(filePath, contentNew);

    if (!updatedFile.success || updatedFile.exitCode !== 0) {
      throw new Error(`Failed to update file: ${filePath}`);
    }
    const updatedContent = await session.readFile(filePath);

    return updatedContent.content === contentNew;
  }
}

export async function replayMessages(
  messages: CustomUIMessage[],
  session: ExecutionSession
) {
  for (const message of messages) {
    for (const part of message.parts) {
      if (isToolUIPart(part)) {
        await replayPart(part, session);
      }
    }
  }
}
