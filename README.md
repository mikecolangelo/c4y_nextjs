# Car4You — Frontend

Admin panel for Car4You, built with **Next.js 14 (App Router)**, React 18,
TypeScript and Tailwind CSS. It talks to the Strapi backend over REST.

## Tech stack

- **Next.js 14** (App Router, server components, route handlers under `app/api`)
- **TypeScript**, **Tailwind CSS v4**, **shadcn/ui** (in `components_shadcn/`)
- **pino** for structured logging
- **Vitest** + Testing Library for unit/component tests
- **pnpm** as the package manager

## Prerequisites

- Node.js `>=20`
- pnpm `10.x`
- A running instance of the Car4You Strapi backend

## Environment

Environment variables are loaded by Next.js. Per-environment files
(`.env.development`, `.env.production`) are committed **without secrets**. The
key variable is the backend URL:

```bash
STRAPI_BASE_URL="http://localhost:1337"
```

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Available scripts

| Script                         | Description                                       |
| ------------------------------ | ------------------------------------------------- |
| `pnpm dev`                     | Start the dev server                              |
| `pnpm build`                   | Production build (output in `.next-prod-deploy/`) |
| `pnpm start`                   | Serve the production build                        |
| `pnpm lint`                    | Run ESLint (`next lint`)                          |
| `pnpm format` / `format:check` | Apply / verify Prettier formatting                |
| `pnpm typecheck`               | `tsc --noEmit`                                    |
| `pnpm test`                    | Run the Vitest suite                              |

## Project structure

```
app/                # App Router pages and route handlers (app/api/*)
components/         # Feature/UI components
components_shadcn/  # shadcn/ui primitives
features/          # Feature-based modules (data layer + hooks + components)
  services/        # Services feature: api/, hooks/, components/, types/, utils/
lib/               # Shared utilities (config, auth, logger, client-logger…)
validations/       # Shared types and schemas
```

New feature work should follow the **feature-based** layout under `features/`:
keep data fetching in `api/`, stateful logic in `hooks/`, and presentation in
`components/`, exposing a public API through the feature's `index.ts` barrel.

## Code quality & conventions

- **Prettier** owns formatting; **ESLint** (`eslint-config-next`) owns linting.
- **Husky** runs `lint-staged` on `pre-commit` (ESLint `--fix` + Prettier) and
  **commitlint** on `commit-msg`.
- Commit messages must follow **Conventional Commits**, e.g.
  `feat(services): add maintenance kit picker`.

## Logging

Use the central loggers instead of `console.*`:

- Server code (route handlers, `lib/*`): `import { logger } from "@/lib/logger"`
  (pino; `debug` in dev, `warn` in prod).
- Client components (`"use client"`): `import { clientLogger } from "@/lib/client-logger"`.

`console.*` is additionally stripped from production bundles by
`compiler.removeConsole` in `next.config.js` (keeping `error`/`warn`).

## Testing

```bash
pnpm test
```

Tests live next to the code they cover (e.g. `app/api/**/__tests__`,
`components/**/__tests__`).
