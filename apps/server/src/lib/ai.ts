import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import z from "zod";
import { TITLE_PROMPT } from "./prompt";

export async function generateTitle(prompt: string) {
  const { object } = await generateObject({
    model: google("gemini-2.5-flash-lite"),
    schema: z.object({
      title: z.string().describe("A concise title for the given user message"),
    }),
    system: TITLE_PROMPT,
    prompt: `<user_message>${prompt}</user_message>`,
  });
  return object.title;
}
