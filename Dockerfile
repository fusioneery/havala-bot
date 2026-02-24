# syntax=docker/dockerfile:1

# =============================================================================
# Halwa Bot - Multi-stage Dockerfile
# Works with: Docker, Docker Compose, Railway, Coolify
# =============================================================================

FROM oven/bun:1 AS base
WORKDIR /app

# =============================================================================
# Dependencies stage - install all dependencies
# =============================================================================
FROM base AS deps

# Copy package files for dependency installation
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY packages/llm-client/package.json packages/llm-client/
COPY packages/bot/package.json packages/bot/
COPY packages/mini-app/package.json packages/mini-app/

# Install dependencies (frozen lockfile for reproducible builds)
# --ignore-scripts: skip better-sqlite3 native build (devDep for drizzle-kit only; runtime uses bun:sqlite)
RUN bun install --frozen-lockfile --ignore-scripts

# =============================================================================
# Builder stage - build the application
# =============================================================================
FROM base AS builder

# Copy dependencies from deps stage
# Bun hoists all deps to root node_modules in workspaces
COPY --from=deps /app/node_modules node_modules

# Copy source code
COPY . .

# Build mini-app for production (vite only — tsc check runs in CI, not Docker)
RUN cd packages/mini-app && bun run --bun ../../node_modules/vite/bin/vite.js build

# Remove dev dependencies and unnecessary files
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

# Health check - verify API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the application
CMD ["bun", "packages/bot/src/index.ts"]
