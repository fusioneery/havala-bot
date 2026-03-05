# syntax=docker/dockerfile:1

# Single-stage build — avoids bun workspace symlink issues with multi-stage COPY
FROM oven/bun:1-slim
WORKDIR /app

# Copy everything (filtered by .dockerignore)
COPY . .

# Install dependencies and build mini-app
# --ignore-scripts: skip better-sqlite3 native build (devDep for drizzle-kit only; runtime uses bun:sqlite)
RUN bun install --frozen-lockfile --ignore-scripts \
    && cd packages/mini-app && bun run vite build

# Clean up dev artifacts not needed at runtime
RUN rm -rf packages/mini-app/src packages/mini-app/public packages/mini-app/*.config.* \
    && rm -rf .git .github .vscode .cursor .dmux-hooks \
    && rm -rf *.md docs

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_FILE_NAME=/app/data/hawala.db

EXPOSE 3000

CMD ["bun", "packages/bot/src/index.ts"]
