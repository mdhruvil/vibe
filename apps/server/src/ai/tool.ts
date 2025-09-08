import type { ExecutionSession } from "@cloudflare/sandbox";
import type { InferUITools, Tool, UIDataTypes, UIMessage } from "ai";
import type { ChatManager } from "@/chat-manager";
import { bashTool } from "./tools/bash";
import { editTool } from "./tools/edit";
import { readTool } from "./tools/read";
import { todoRead, todoWrite } from "./tools/todo";
import { webfetchTool } from "./tools/webfetch";

export type VibeContext = {
  session: ExecutionSession;
  manager: ChatManager;
};

export type VibeTool = (ctx: VibeContext) => Tool;

/**
 * NOTE: This Tools are functions which takes context as parameter and returns the tool
 * This is a work around to support passing ctx and maintaining type safety without doing any wizardry
 */
export const ALL_TOOL_FUNCS = {
  bash: bashTool,
  read: readTool,
  webfetch: webfetchTool,
  edit: editTool,
  todoread: todoRead,
  todowrite: todoWrite,
} as const;

type Tools = {
  [K in keyof typeof ALL_TOOL_FUNCS]: ReturnType<(typeof ALL_TOOL_FUNCS)[K]>;
};

export type CustomUITools = InferUITools<Tools>;
export type CustomUIMessage = UIMessage<never, UIDataTypes, CustomUITools>;
