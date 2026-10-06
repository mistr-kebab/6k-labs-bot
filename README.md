# 6K Labs Discord Bot

[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord)](https://discord.js.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Modular Discord bot for the 6K Labs community, built with TypeScript and discord.js v14.

## Features

- **Honeypot Filter Channel** – Auto-creates a monitored channel. Anyone who writes there gets a DM with the reason plus evidence, then gets punished (configurable via `FILTER_ACTION`: `ban` with 3-day message purge, or `timeout` with configurable duration). Punishment count is tracked in the embed footer.
- **Report System** – Sticky info message plus `/report` modal with text inputs and file upload for evidence (screenshots).
- **Moderation Commands** – Ban, mute (timeout), warn and kick systems with DMs, embeds and mod-log posts.
- **Module System** – Features live in self-contained modules (`src/modules/<Category>/<moduleName>.ts`) and are auto-loaded on startup.
- **Slash Commands** – Central `CommandManager` registers and dispatches all commands (guild-scoped via `GUILD_ID` for instant updates, global otherwise).
- **Components v2** – Central `ComponentManager` handles buttons, select menus and modal submissions.
- **Persistent Config** – Per-guild state (channel IDs, ban counts, warnings, sticky message IDs) stored in `config.json`.
- **Colored Logging** – Green for success, yellow for warnings, red for errors.

## Commands

| Command | Description | Permission |
| ------- | ----------- | ---------- |
| `/ban <user> [reason] [delete_days]` | Ban a member (0–7 days message delete) | Ban Members |
| `/unban <user_id>` | Unban a user | Ban Members |
| `/bans` | List banned users | Ban Members |
| `/mute <user> <duration> <unit> [reason]` | Timeout a member (minutes / hours / days, max 28d) | Mute Members |
| `/unmute <user> [reason]` | Remove a timeout | Mute Members |
| `/mutes` | List active timeouts | Mute Members |
| `/warn <user> [reason]` | Warn a member | Moderate Members |
| `/warn_remove <user> <warning_id>` | Remove a specific warning | Moderate Members |
| `/warns [user]` | Show warnings for a user or all warnings | Moderate Members |
| `/kick <user> [reason]` | Kick a member | Kick Members |
| `/report` | Open the report modal (user ID, description, evidence upload) | Everyone |

Targets of ban, mute, warn and kick receive a DM with action, reason, moderator and duration where applicable.

## Project Structure

```
├── src/
│   ├── index.ts                    # Entry point – client setup, module loader, shutdown handler
│   ├── lib/
│   │   ├── commandManager.ts       # Slash command registry and dispatcher
│   │   ├── componentManager.ts     # Buttons, select menus and modal submissions
│   │   ├── configManager.ts        # Per-guild JSON persistence (channels, bans, warnings)
│   │   ├── env.ts                  # Validated environment variables (fails fast on missing secrets)
│   │   ├── modLog.ts               # Posts moderation actions to the mod-log channel
│   │   ├── reply.ts                # Safe interaction replies (reply vs. follow-up)
│   │   └── logger.ts               # Colored console logger
│   └── modules/
│       ├── filter/
│       │   └── filterChannel.ts    # Honeypot channel
│       ├── moderation/
│       │   ├── banSystem.ts        # /ban, /unban, /bans
│       │   ├── muteSystem.ts       # /mute, /unmute, /mutes
│       │   ├── warnSystem.ts       # /warn, /warn_remove, /warns
│       │   └── kickSystem.ts       # /kick
│       └── report/
│           └── reportSystem.ts     # Sticky message + /report modal
├── .env                            # Secrets and channel configuration (not committed)
├── config.json                     # Runtime state (not committed)
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16.9.0 or higher
- A Discord application and bot token ([Discord Developer Portal](https://discord.com/developers/applications))

### Installation

```bash
git clone https://github.com/your-org/6k-labs-bot.git
cd 6k-labs-bot
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
# ----------- Discord -----------
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here

# ----------- Channels -----------
FILTER_CHANNEL_NAME=filter-channel
# FILTER_ACTION=ban
# FILTER_TIMEOUT_MINUTES=1440
REPORT_CHANNEL_ID=your_report_channel_id
# MOD_LOG_CHANNEL_ID=your_mod_log_channel_id

# ----------- Development -----------
# GUILD_ID=your_guild_id_here
```

`FILTER_ACTION` is `ban` (default) or `timeout`. `FILTER_TIMEOUT_MINUTES` sets the honeypot timeout duration (default 1440 = 24h, max 40320 = 28d).

Set `GUILD_ID` to register commands instantly on one server. Without it, commands register globally (can take up to an hour to appear).

### Running

```bash
npm run dev    # Development with auto-reload (TypeScript via tsx)
npm run build  # Compile TypeScript to dist/*.js
npm start      # Production with plain node (no tsx needed)
npm run lint   # ESLint
npm run format # Prettier
```

Type-check without starting the bot:

```bash
npx tsc --noEmit
```

### Required Bot Permissions

- `Send Messages`
- `Embed Links`
- `Attach Files`
- `Read Message History`
- `Manage Messages`
- `Ban Members`
- `Kick Members`
- `Moderate Members`
- `Manage Channels`
- `View Channels`

### Required Gateway Intents

Enable these in the Developer Portal under **Bot > Privileged Gateway Intents**:

- `Message Content Intent`
- `Server Members Intent`

## Adding a Module

Create a new file in `src/modules/<Category>/<moduleName>.ts`:

```ts
import { Client } from 'discord.js';
import { ComponentManager } from '../../lib/componentManager';
import { CommandManager } from '../../lib/commandManager';

export function registerModule(client: Client, components: ComponentManager, commands: CommandManager): void {
  // Register events, commands and components here
}
```

The module loader discovers and registers it automatically on startup.

## Built With

- [discord.js](https://discord.js.org/) – Discord API wrapper
- [TypeScript](https://www.typescriptlang.org/) – Type-safe JavaScript
- [tsx](https://github.com/privatenumber/tsx) – TypeScript execution

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
