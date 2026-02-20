FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY packages/llm-client/package.json packages/llm-client/
COPY packages/bot/package.json packages/bot/
COPY packages/mini-app/package.json packages/mini-app/
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build mini-app
RUN cd packages/mini-app && bun run build

# Production image
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=base /app/node_modules node_modules
COPY --from=base /app/packages packages
COPY --from=base /app/package.json .

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "packages/bot/src/index.ts"]
