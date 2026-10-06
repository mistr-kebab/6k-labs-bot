# 6K Labs Discord Bot

[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord)](https://discord.js.org)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Modular Discord bot for the 6K Labs community, built with plain JavaScript (CommonJS) and discord.js v14. Runs on stock Node.js — no build step, no transpiler.

## Features

- **Honeypot Filter Channel** – Auto-creates a monitored channel. Anyone who writes there gets a DM with the reason plus evidence, then gets punished (configurable via `FILTER_ACTION`: `ban` with 3-day message purge, or `timeout` with configurable duration). Punishment count is tracked in the embed footer.
- **Report System** – Sticky info message plus `/report` modal with text inputs and file upload for evidence (screenshots).
- **Moderation Commands** – Ban, mute (timeout), warn and kick systems with DMs, embeds and mod-log posts.
- **Module System** – Features live in self-contained modules (`src/modules/<Category>/<moduleName>.js`) and are auto-loaded on startup.
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
│   ├── index.js                    # Entry point – client setup, module loader, shutdown handler
│   ├── lib/
│   │   ├── commandManager.js       # Slash command registry and dispatcher
│   │   ├── componentManager.js     # Buttons, select menus and modal submissions
│   │   ├── configManager.js        # Per-guild JSON persistence (channels, bans, warnings)
│   │   ├── env.js                  # Validated environment variables (fails fast on missing secrets)
│   │   ├── modLog.js               # Posts moderation actions to the mod-log channel
│   │   ├── reply.js                # Safe interaction replies (reply vs. follow-up)
│   │   └── logger.js               # Colored console logger
│   └── modules/
│       ├── filter/
│       │   └── filterChannel.js    # Honeypot channel
│       ├── moderation/
│       │   ├── banSystem.js        # /ban, /unban, /bans
│       │   ├── muteSystem.js       # /mute, /unmute, /mutes
│       │   ├── warnSystem.js       # /warn, /warn_remove, /warns
│       │   └── kickSystem.js       # /kick
│       └── report/
│           └── reportSystem.js     # Sticky message + /report modal
├── .env                            # Secrets and channel configuration (not committed)
├── .env.example                    # Template for required variables
├── config.json                     # Runtime state (not committed)
├── eslint.config.mjs               # ESLint flat config
├── .prettierrc                     # Prettier config
├── package.json
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
npm run dev    # Development with auto-reload (node --watch)
npm start      # Production with plain node
npm run lint   # ESLint
npm run format # Prettier
```

Syntax-check all files without starting the bot:

```bash
node --check src/index.js
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

Create a new file in `src/modules/<Category>/<moduleName>.js`:

```js
function registerModule(client, components, commands) {
  // Register events, commands and components here
}

module.exports = { registerModule };
```

The module loader discovers and registers it automatically on startup.

## Built With

- [Node.js](https://nodejs.org/) – Plain JavaScript runtime, no build step
- [discord.js](https://discord.js.org/) – Discord API wrapper

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
