Vibe

Vibe is a vibecoding tool that lets users vibecode apps and deploy directly to their Appwrite account.

Tech Stack

- Cloudflare Workers
- Cloudflare Durable Objects
- Cloudflare Sandbox (built on top of cloudflare containers)
- Next.js
- React
- TypeScript
- shadcn
- tailwindcss

## IMPORTANT

- Make sure you refer to latest docs with context7 mcp server. IT IS CRUCIAL FOR STAYING UP-TO-DATE.
- use context7 mcp server to get latest docs for any library
- use https://raw.githubusercontent.com/cloudflare/sandbox-sdk/refs/heads/main/packages/sandbox/README.md for cloudflare sandbox docs

## RULES

- Build: root `pnpm build` (Turbo), dev `pnpm dev`.
- Dash app: `pnpm -C apps/dash dev|build|start`.
- Server (Cloudflare Workers): `pnpm -C apps/server dev|build|deploy`.
- Type-check: root `pnpm check-types`; server `pnpm -C apps/server check-types`.
- Lint/format: root `pnpm check` (Biome write); dash `pnpm -C apps/dash lint|format`.
- Imports: ESM only; prefer `import type` for types (server uses `verbatimModuleSyntax`).
- Import order: Node/stdlib, third‑party, `@/*` aliases, then relative.
- Paths: use `@/*` alias in both apps per `tsconfig.json`.
- Formatting: Biome enforces double quotes and semicolons; run `pnpm check`.
- Types: strict TS; avoid `any`; prefer `unknown`; annotate exports.
- Zod: validate inputs; infer types or narrow from schemas.
- Naming: Components PascalCase; hooks `use*`; files kebab-case; constants SCREAMING_SNAKE_CASE.
- React/Next: add `"use client"` for client components; no default React import.
- Error handling (server): throw `TRPCError` with proper `code`/message; never return null on failure.
- Error handling (client): surface errors via `toast`; keep logs minimal (`console` allowed by Biome).
- Env: client via `@/env`; server via `cloudflare:workers` `env`; avoid `process.env` on client.
