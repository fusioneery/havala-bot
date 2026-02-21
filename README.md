# Halva

Telegram bot and a mini app that matches people looking to exchange currencies — peer-to-peer, no middlemen, no fees.

The bot monitors trusted Telegram groups, uses LLM to parse exchange offers from messages, and matches them against user-created offers based on currency pairs, payment methods, and trust relationships. When a match is found, both parties get a notification and can connect directly in Telegram.

## How it works

1. **You create an offer** — specify what currency you want to exchange, what you want to receive, the amount, and your preferred payment methods.
2. **The bot watches trusted groups** — it reads messages from pre-configured Telegram groups, batches them, and sends them to an LLM that extracts structured exchange offers.
3. **Matching happens automatically** — the bot cross-references parsed group offers with your active offers, respecting your visibility settings (friends only, or friends + acquaintances).
4. **You get a match notification** — a DM with details about the counterparty and a direct link to their message, so you can reach out and arrange the exchange yourselves.

The bot never touches money. It only connects people.

## Tech stack

- **Runtime:** [Bun](https://bun.sh)
- **Bot framework:** [grammY](https://grammy.dev)
- **API server:** [Fastify](https://fastify.dev)
- **Database:** SQLite via [Drizzle ORM](https://orm.drizzle.team)
- **LLM parsing:** [OpenRouter](https://openrouter.ai)
- **Mini App:** React 19, Vite, Tailwind CSS 4, Framer Motion
- **Exchange rates:** CoinGecko (crypto), Open Exchange Rates (fiat), [Vas3k.Kurs](https://kurs.vas3k.club) (crypto<->fiat)

## Project structure

```
hawala-bot/
├── packages/
│   ├── bot/          # Telegram bot, API server, database
│   ├── mini-app/     # Telegram Mini App (React SPA)
│   ├── shared/       # Shared types, currencies, payment methods
│   └── llm-client/   # OpenRouter client for parsing offers
├── .env.example
└── package.json      # Bun workspaces root
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- Envs from `.env.example`

### Installation

```bash
git clone https://github.com/fusioneery/havala-bot.git
cd havala-bot
bun install
```

### Configuration

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

### Database setup

Generate and apply migrations:

```bash
bun run db:push
```

### Running

Start both the bot and the mini app in development mode:

```bash
bun run dev
```

The bot API server starts on port `3003`, and the Vite dev server for the mini app starts on port `5173` with API requests proxied to the bot.

You can also run them separately:

```bash
bun run dev:bot        # bot only
cd packages/mini-app && bun run dev   # mini app only
```

### Building for production

```bash
bun run build
```

This builds the mini app. In production, Fastify serves the static build alongside the API.

## Contributing

Feature requests, bug reports, and pull requests are welcome.

If you have an idea or found a bug, [open an issue](https://github.com/fusioneery/havala-bot/issues). If you'd like to contribute code, fork the repo, create a branch, and submit a PR.

## License

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — you are free to share and adapt it with attribution, for non-commercial use only.

Copyright (c) 2025 Vlad Abramov
