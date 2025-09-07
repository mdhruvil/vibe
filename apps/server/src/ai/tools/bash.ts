import { tool } from "ai";
import z from "zod";
import type { VibeContext } from "../tool";

export const BashTool = (ctx: VibeContext) => {
  return tool({
    name: "bash",
    description:
      "Execute bash commands in a Linux environment. THIS COMMAND CAN'T BE LONG RUNNING.",
    inputSchema: z.object({
      command: z.string().min(1),
    }),
    outputSchema: z.object({
      stdout: z.string(),
      stderr: z.string(),
      exitCode: z.number(),
    }),
    execute: async (input) => {
      try {
        const process = await ctx.session.exec(input.command);
        return {
          exitCode: process.exitCode,
          stdout: process.stdout,
          stderr: process.stderr,
        };
      } catch (error) {
        let message = String(error);
        if (error instanceof Error) {
          message = error.message;
        }
        console.error(error);
        return {
          exitCode: 1,
          stdout: "",
          stderr: message,
        };
      }
    },
  });
};
