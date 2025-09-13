# Vibe

Vibe is a vibecoding tool that lets users vibecode apps and deploy directly to their Appwrite account. It provides an AI-powered development environment with integrated chat, code editing, and deployment capabilities.

## Youtube Demo

[https://youtu.be/RY-2LNRveK8](https://youtu.be/RY-2LNRveK8)

## Features

- **AI-Powered Development** - Interactive chat interface for coding assistance
- **Live Preview** - Cloudflare Sandbox integration for running code in isolated environments
- **Appwrite Integration** - Direct deployment to Appwrite accounts

## Tech Stack

### Frontend (Dash App)

- **Next.js 15** - You probably know what it is
- **React 19** - You definitely know what it is
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Reusable UI components
- **TanStack Query** - Data fetching and caching
- **tRPC** - Type-safe API layer
- **Zustand** - State management
- **React Hook Form** - Form handling

### Backend (Server)

- **AI SDK** - AI library
- **Cloudflare Workers** - edge deployment
- **Cloudflare Durable Objects** - Persistent storage and chat management
- **Cloudflare Sandbox** - Isolated code execution
- **Hono** - Lightweight web framework
- **tRPC** - Type-safe API procedures
- **Drizzle ORM** - TypeScript-first ORM
- **Cloudflare D1** - SQLite database
- **Better Auth** - Authentication

### Development Tools

- **Turborepo** - Monorepo build system
- **Biome** - Linting and formatting
- **Wrangler** - Cloudflare development CLI
- **TypeScript** - Type checking

## Prerequisites

- **Node.js** - Version 18 or higher
- **pnpm** - Package manager (recommended)
- **Cloudflare Account** - For deployment and D1 database
- **Appwrite Account** - For app deployment (optional)

## Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd vibe
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Set up environment variables:**

   Copy the example environment file:

   ```bash
   cp apps/server/.env.example apps/server/.env
   ```

   Configure the env variables in `apps/server/.env`:

### Start Development Servers

```bash
# Start all apps (frontend + backend)
# MAKE SURE DOCKER IS RUNNING, IT'S REQUIRED FOR CLOUDFLARE SANDBOX
pnpm dev

# Or start individually:
pnpm -C apps/dash dev    # Frontend only
pnpm -C apps/server dev  # Backend only
```

The applications will be available at:

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8787

## Project Structure

```
vibe/
├── apps/
│   ├── dash/                    # Next.js frontend application
│   │   ├── public/             # Static assets
│   │   ├── src/
│   │   │   ├── app/            # Next.js app router pages
│   │   │   │   ├── (home)/     # Home layout and pages
│   │   │   │   ├── auth/       # Authentication pages
│   │   │   │   └── chat/       # Chat interface
│   │   │   │       └── [chatId]/
│   │   │   ├── components/     # Reusable UI components
│   │   │   │   ├── ui/         # shadcn/ui components
│   │   │   │   └── ...         # App-specific components
│   │   │   ├── hooks/         # React hooks
│   │   │   ├── lib/           # Utilities and configurations
│   │   │   └── stores/        # Zustand state stores
│   │   ├── package.json
│   │   └── next.config.ts
│   └── server/                 # Cloudflare Workers backend
│       ├── src/
│       │   ├── ai/             # AI tools and integrations
│       │   │   ├── tools/      # Available AI tools
│       │   │   └── ...
│       │   ├── db/             # Database schemas and migrations
│       │   │   ├── migrations/
│       │   │   └── schema/
│       │   ├── lib/           # Server utilities
│       │   ├── routers/       # tRPC routers
│       │   └── ...
│       ├── wrangler.jsonc      # Cloudflare configuration
│       └── package.json
├── packages/                   # Shared packages (if any)
├── .claude/                    # Claude-specific configurations
├── biome.json                  # Code formatting/linting config
├── turbo.json                  # Turborepo configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Root package configuration
```

## Available Scripts

### Root Scripts

- `pnpm dev` - Start all applications in development mode
- `pnpm build` - Build all applications for production
- `pnpm check-types` - Run TypeScript type checking across all apps
- `pnpm check` - Run Biome linting and formatting

### Dash App Scripts (`apps/dash/`)

- `pnpm dev` - Start Next.js development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run Biome linting
- `pnpm format` - Run Biome formatting

### Server Scripts (`apps/server/`)

- `pnpm dev` - Start Wrangler development server
- `pnpm build` - Build for deployment (dry run)
- `pnpm deploy` - Deploy to Cloudflare Workers
- `pnpm check-types` - Run TypeScript type checking
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate:local` - Apply migrations to local D1
- `pnpm db:migrate:remote` - Apply migrations to remote D1
- `pnpm db:studio:local` - Open Drizzle Studio for local DB
- `pnpm db:studio:remote` - Open Drizzle Studio for remote DB

## Deployment

### Frontend (Dash App)

Deployed on Appwrite Sites

### Backend (Cloudflare Workers)

The backend is deployed on Cloudflare Workers with:

- API endpoints available globally
- Durable Objects for persistent chat sessions
- D1 database for data storage

### Environment Variables

Ensure all production environment variables are configured in your Cloudflare Workers environment.

## Contributing

TODO

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

- Create an issue on GitHub
- Contact me: [mdhruvil.com](https://mdhruvil.com)
