# Halwa Bot - Agent Instructions

## Cursor Cloud specific instructions

### Project overview

Bun monorepo (Telegram bot + React mini-app) for P2P currency exchange matching. See `README.md` for architecture and scripts.

### Services

| Service | Port | Command |
|---------|------|---------|
| Bot (Fastify API + grammY) | 3003 | `bun run dev:bot` |
| Mini-app (Vite dev server) | 5173 | `cd packages/mini-app && bun run dev` |
| Both concurrently | 3003 + 5173 | `bun run dev` |

### Key gotchas

- **Do NOT run `bun run db:push` before starting the bot.** The bot auto-runs Drizzle migrations on startup (`packages/bot/src/db/index.ts`). Running `db:push` creates tables via a different mechanism, then `migrate()` fails with "table already exists". If this happens, delete `packages/bot/data/hawala.db*` and restart the bot.
- **Telegram long-polling 409 conflict:** If another bot instance is running with the same `BOT_TOKEN` (e.g. production), the bot will crash with a 409 error from `getUpdates`. The API server still starts and works fine; only the Telegram polling is affected.
- **Database location:** The SQLite database is created at the path specified by `DB_FILE_NAME` in `.env`, resolved relative to the bot package's CWD (`packages/bot/`). Default: `./data/hawala.db`.
- **`.env` file:** Must be at the workspace root (`/workspace/.env`). Both the bot and drizzle config resolve it from there. Copy `.env.example` and fill in secrets. Required: `BOT_TOKEN`, `OPENROUTER_API_KEY`, `TRUSTED_GROUP_IDS`, `MINI_APP_URL`.
- **Dev mode auth bypass:** Set `DEV=true` in `.env` to bypass Telegram auth in the mini-app (allows self-matching for testing).
- **Lint has pre-existing errors:** `bun run --filter @hawala/mini-app lint` reports ~14 React hooks/refresh errors that exist in the codebase. These are not regressions.

### Standard commands

See `package.json` scripts at root for all commands. Key ones:
- **Typecheck:** `bun run typecheck` (runs across all packages)
- **Lint:** `cd packages/mini-app && bun run lint`
- **Build:** `bun run build` (builds mini-app for production)
- **Dev:** `bun run dev` (starts bot + mini-app concurrently)
