# Scratchpad: Fix npm workspace:* error

## Understanding

The user ran `ralph web` and got `EUNSUPPORTEDPROTOCOL: Unsupported URL Type workspace:: workspace:*`.

### Root cause analysis
1. Project uses **bun** as its package manager (bun.lock, `bun run --filter` scripts)
2. `ralph web` internally uses **npm** to install dependencies
3. node_modules was installed by bun — npm's arborist can't read bun's node_modules layout
4. Specifically, `node_modules/@vitejs/plugin-react/package.json` has `"@vitejs/react-common": "workspace:*"` in devDependencies (Vite monorepo publishing artifact)
5. Commit 39f2645 already fixed the project's own package.json files (replaced `workspace:*` with `*`)
6. When I run `npm install` now, I get a different error (`Invalid Version:`) — same root cause: bun-installed node_modules incompatible with npm

### Fix plan
- Delete bun-installed node_modules and stale package-lock.json
- Run clean `npm install` so npm creates its own node_modules layout
- Verify both npm install and bun runtime work
- bun can use npm-installed node_modules fine; npm cannot use bun-installed ones

## Resolution

Fixed in commit 90f7f9e. Key steps:
1. Deleted ALL node_modules (root + packages/bot, mini-app, llm-client, shared)
2. Deleted stale package-lock.json
3. Ran clean `npm install` — generated proper lockfile
4. Verified: `npm install` (repeat runs), `bun run typecheck`, `bun run build` all pass

Note: `ralph web` still has a separate issue about missing `backend/ralph-web-server/` directory — that's a ralph setup issue, not an npm issue.
