# syntax=docker/dockerfile:1

# =============================================================================
# Halwa Bot - Multi-stage Dockerfile
# Works with: Docker, Docker Compose, Railway, Coolify
# =============================================================================

# =============================================================================
# Builder stage - install dependencies and build
# =============================================================================
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy everything (filtered by .dockerignore)
COPY . .

# Install dependencies and build mini-app
# --ignore-scripts: skip better-sqlite3 native build (devDep for drizzle-kit only; runtime uses bun:sqlite)
RUN bun install --frozen-lockfile --ignore-scripts \
    && cd packages/mini-app && bun run --bun vite build

# Remove dev dependencies, source files, and unnecessary files
RUN rm -rf packages/mini-app/src packages/mini-app/public packages/mini-app/*.config.* \
    && rm -rf .git .github .vscode .cursor .dmux-hooks \
    && rm -rf *.md docs

# =============================================================================
# Production stage - minimal runtime image
# =============================================================================
FROM oven/bun:1-slim AS production

# Labels for container metadata
LABEL org.opencontainers.image.title="Halwa Bot"
LABEL org.opencontainers.image.description="Telegram bot for P2P currency exchange matching"
LABEL org.opencontainers.image.source="https://github.com/fusioneery/hawala-bot"

WORKDIR /app

# Create non-root user for security
# Use groupadd/useradd (shadow-utils) — addgroup/adduser not available in bun:1-slim
RUN groupadd --system --gid 1001 hawala \
    && useradd --system --uid 1001 --gid hawala --no-create-home hawala

# Create data directory for SQLite with proper permissions
RUN mkdir -p /app/data && chown -R hawala:hawala /app/data

# Copy built application from builder stage
COPY --from=builder --chown=hawala:hawala /app/node_modules node_modules
COPY --from=builder --chown=hawala:hawala /app/packages packages
COPY --from=builder --chown=hawala:hawala /app/package.json .

# Switch to non-root user
USER hawala

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_FILE_NAME=/app/data/hawala.db

# Expose port (configurable via PORT env var, but 3000 is default)
EXPOSE 3000

# No HEALTHCHECK in Dockerfile — Railway handles it via config

# Start the application
CMD ["bun", "packages/bot/src/index.ts"]
