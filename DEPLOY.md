# Deployment Guide

This guide covers deploying Halwa Bot using Docker, Railway, Coolify, Fly.io, and Render.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Option 1: Docker (Standalone)](#option-1-docker-standalone)
- [Option 2: Docker Compose](#option-2-docker-compose)
- [Option 3: Railway](#option-3-railway)
- [Option 4: Coolify](#option-4-coolify)
- [Option 5: Fly.io](#option-5-flyio)
- [Option 6: Render](#option-6-render)
- [Database Persistence](#database-persistence)
- [Health Checks](#health-checks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, you'll need:

1. **Telegram Bot Token** — Create a bot via [@BotFather](https://t.me/BotFather)
2. **OpenRouter API Key** — Sign up at [openrouter.ai](https://openrouter.ai)
3. **Trusted Group IDs** — Get group IDs by adding [@userinfobot](https://t.me/userinfobot) to your groups

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required variables:**

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Telegram bot token from @BotFather |
| `OPENROUTER_API_KEY` | API key from openrouter.ai |
| `TRUSTED_GROUP_IDS` | Comma-separated group IDs to monitor |
| `MINI_APP_URL` | Public URL where the app will be accessible |

See `.env.example` for all available options.

---

## Option 1: Docker (Standalone)

Build and run with plain Docker commands.

### Build the image

```bash
docker build -t hawala-bot .
```

### Run the container

```bash
# Create volume for database persistence
docker volume create hawala-data

# Run container
docker run -d \
  --name hawala-bot \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  -v hawala-data:/app/data \
  hawala-bot
```

### Manage the container

```bash
# View logs
docker logs -f hawala-bot

# Stop
docker stop hawala-bot

# Start
docker start hawala-bot

# Remove
docker rm -f hawala-bot

# Rebuild and restart
docker build -t hawala-bot . && docker rm -f hawala-bot && docker run -d --name hawala-bot --restart unless-stopped -p 3000:3000 --env-file .env -v hawala-data:/app/data hawala-bot
```

---

## Option 2: Docker Compose

Recommended for most deployments. Handles networking, volumes, and restarts automatically.

### Start the application

```bash
# Build and start in background
docker compose up -d --build

# Or use the npm script
bun run docker:up
```

### Production deployment

For production, use the override file with stricter limits:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Manage with Compose

```bash
# View logs
docker compose logs -f
# or: bun run docker:logs

# Stop
docker compose down
# or: bun run docker:down

# Restart
docker compose restart

# Rebuild
docker compose up -d --build
```

---

## Option 3: Railway

Railway automatically detects the Dockerfile and deploys.

### Quick Deploy

1. **Fork/push** your repo to GitHub
2. Go to [railway.app](https://railway.app) and create a new project
3. Select **Deploy from GitHub repo**
4. Choose your hawala-bot repository
5. Railway will detect the Dockerfile automatically

### Configure Environment Variables

In Railway dashboard → your project → Variables:

```
BOT_TOKEN=your_token
OPENROUTER_API_KEY=your_key
TRUSTED_GROUP_IDS=-1001234567890
MINI_APP_URL=https://your-app.up.railway.app
```

> **Note:** Railway provides `PORT` automatically. Don't set it manually.

### Persistent Storage

Railway ephemeral filesystem resets on each deploy. For SQLite persistence:

1. Go to your project → **Add New** → **Volume**
2. Mount path: `/app/data`
3. Set `DB_FILE_NAME=/app/data/hawala.db` in variables

### Custom Domain

1. Go to **Settings** → **Networking** → **Generate Domain**
2. Or add a custom domain and configure DNS

The `railway.toml` and `railway.json` files in the repo configure health checks and build settings automatically.

---

## Option 4: Coolify

Coolify is a self-hosted PaaS that supports Docker deployments.

### Deploy via GitHub

1. In Coolify, go to **Projects** → **New** → **Public/Private Repository**
2. Enter your GitHub repo URL
3. Coolify detects the Dockerfile automatically
4. Click **Deploy**

### Configure Environment Variables

1. Go to your application → **Environment Variables**
2. Add all required variables from `.env.example`
3. Click **Save** and **Redeploy**

### Persistent Storage

1. Go to **Storages** tab
2. Add a new persistent storage:
   - **Path in Container:** `/app/data`
   - **Name:** `hawala-data`
3. Save and redeploy

### Health Check Configuration

Coolify should detect the health check from Dockerfile. If not, configure manually:

- **Health check path:** `/api/health`
- **Health check port:** `3000` (or your PORT value)
- **Health check interval:** `30s`

### Custom Domain

1. Go to **Settings** → **Domains**
2. Add your domain
3. Coolify handles SSL automatically via Let's Encrypt

---

## Option 5: Fly.io

Fly.io deploys containers globally with excellent support for long-running connections (perfect for Telegram bots).

### Prerequisites

Install the Fly CLI:

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Login
fly auth login
```

### First Deployment

```bash
# Launch app (creates fly.toml if not present)
fly launch --no-deploy

# Create persistent volume for SQLite
fly volumes create hawala_data --region ams --size 1

# Set secrets (required)
fly secrets set BOT_TOKEN=your_token
fly secrets set OPENROUTER_API_KEY=your_key
fly secrets set TRUSTED_GROUP_IDS=-1001234567890
fly secrets set MINI_APP_URL=https://hawala-bot.fly.dev

# Deploy
fly deploy
```

### Configuration

The `fly.toml` file is pre-configured with:

- **Region:** Amsterdam (`ams`) — change `primary_region` as needed
- **Port:** 8080 (Fly.io default)
- **Volume:** Mounted at `/data` for SQLite
- **Auto-stop:** Disabled (keeps bot running for long-polling)
- **Health check:** `/api/health` every 30s

### Manage Deployment

```bash
# View logs
fly logs

# SSH into container
fly ssh console

# Check status
fly status

# Scale (if needed)
fly scale count 1

# Open in browser
fly open
```

### Regions

Change region in `fly.toml` or deploy to multiple regions:

```bash
# Single region
fly deploy --region fra  # Frankfurt

# Available regions: ams, cdg, fra, lhr, ord, sea, sin, syd, etc.
```

> **Note:** SQLite requires single-region deployment. For multi-region, consider PostgreSQL.

---

## Option 6: Render

Render provides a simple Heroku-like experience with Docker support and persistent disks.

### Quick Deploy

1. Push your repo to GitHub
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub repository
4. Render detects the `render.yaml` blueprint automatically
5. Click **Apply**

### Manual Setup (without blueprint)

1. **New** → **Web Service** → Connect repo
2. **Environment:** Docker
3. **Instance Type:** Starter ($7/mo, includes disk) or higher
4. Add a **Disk**:
   - Name: `hawala-data`
   - Mount Path: `/app/data`
   - Size: 1 GB

### Configure Environment Variables

In Render dashboard → your service → **Environment**:

```
BOT_TOKEN=your_token
OPENROUTER_API_KEY=your_key
TRUSTED_GROUP_IDS=-1001234567890
MINI_APP_URL=https://your-service.onrender.com
DB_FILE_NAME=/app/data/hawala.db
```

> **Note:** Render sets `PORT` automatically (usually 10000). Don't override it.

### Persistent Disk

Render's free tier has **ephemeral storage** — data is lost on redeploy. For SQLite persistence:

- Use **Starter plan** ($7/mo) or higher
- Attach a disk mounted at `/app/data`
- The `render.yaml` blueprint configures this automatically

### Custom Domain

1. Go to **Settings** → **Custom Domains**
2. Add your domain
3. Configure DNS as shown
4. SSL is automatic via Let's Encrypt

### Blueprint Deployment

The `render.yaml` file defines the entire infrastructure. To use it:

1. Push repo with `render.yaml` to GitHub
2. In Render: **New** → **Blueprint**
3. Connect repo → Render reads the YAML
4. Review and **Apply**

---

## Database Persistence

The bot uses SQLite stored at `/app/data/hawala.db`. **Always** mount a persistent volume to `/app/data` to avoid data loss:

| Platform | How to persist |
|----------|---------------|
| Docker | `-v hawala-data:/app/data` |
| Docker Compose | Already configured in `docker-compose.yml` |
| Railway | Add a Volume mounted to `/app/data` |
| Coolify | Add Storage with path `/app/data` |
| Fly.io | `fly volumes create` + mount in `fly.toml` |
| Render | Add Disk at `/app/data` (Starter plan+) |

### Backup the database

```bash
# Docker
docker cp hawala-bot:/app/data/hawala.db ./backup.db

# Docker Compose
docker compose cp hawala-bot:/app/data/hawala.db ./backup.db
```

---

## Health Checks

The application exposes a health check endpoint:

```
GET /api/health
```

Response:
```json
{"status": "ok"}
```

Health checks are configured in:
- `Dockerfile` — Docker HEALTHCHECK instruction
- `docker-compose.yml` — Compose healthcheck
- `railway.toml` — Railway health check path
- `fly.toml` — Fly.io health check
- `render.yaml` — Render health check path

---

## Troubleshooting

### Container won't start

1. Check logs: `docker logs hawala-bot`
2. Verify all required env vars are set
3. Ensure `BOT_TOKEN` is valid

### Bot not responding to messages

1. Check if bot is in the trusted groups
2. Verify `TRUSTED_GROUP_IDS` includes the correct group IDs
3. Check logs for LLM parsing errors

### Database errors

1. Ensure volume is mounted correctly
2. Check permissions: container runs as non-root user (uid 1001)
3. Verify `DB_FILE_NAME` path matches volume mount

### Health check failing

1. Wait for `start_period` (40s) after container start
2. Check if port matches: `curl http://localhost:3000/api/health`
3. Look for startup errors in logs

### Railway-specific issues

- **Port binding:** Don't set `PORT` manually; Railway provides it
- **Build fails:** Check that `bun.lock` is committed
- **Volume not persisting:** Ensure volume is attached and `DB_FILE_NAME` points to it

### Coolify-specific issues

- **Build context:** Ensure Dockerfile is in repo root
- **Networking:** Check that the exposed port matches your Coolify config
- **SSL issues:** Wait a few minutes for Let's Encrypt certificate

### Fly.io-specific issues

- **Volume not found:** Run `fly volumes create hawala_data --region ams --size 1`
- **Port mismatch:** Fly.io uses port 8080 by default; ensure `PORT=8080` in env
- **Machine stops:** Set `auto_stop_machines = false` in `fly.toml`
- **Database lost:** Check volume is mounted at `/app/data` and `DB_FILE_NAME=/app/data/hawala.db`
- **Deployment stuck:** Run `fly logs` to see what's happening

### Render-specific issues

- **Data lost on deploy:** Free tier is ephemeral; upgrade to Starter for persistent disk
- **Port binding:** Render uses port 10000; don't override `PORT`
- **Disk not working:** Ensure disk is attached to `/app/data` and `DB_FILE_NAME=/app/data/hawala.db`
- **Blueprint not applying:** Check `render.yaml` syntax; secrets need manual entry

---

## Updating

### Docker / Docker Compose

```bash
git pull
docker compose down
docker compose up -d --build
```

### Railway

Push to your connected GitHub branch — Railway auto-deploys.

### Coolify

Click **Redeploy** in the Coolify dashboard, or enable auto-deploy from GitHub.

### Fly.io

```bash
git pull
fly deploy
```

### Render

Push to your connected GitHub branch — Render auto-deploys. Or click **Manual Deploy** in dashboard.

---

## Resource Requirements

Minimum recommended resources:

- **CPU:** 0.5 vCPU
- **Memory:** 256 MB (512 MB recommended)
- **Storage:** 100 MB + database size

The bot is lightweight thanks to Bun runtime and SQLite.
