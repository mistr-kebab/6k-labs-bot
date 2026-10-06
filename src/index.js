const { Client, GatewayIntentBits, Events } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { ComponentManager } = require('./lib/componentManager');
const { CommandManager } = require('./lib/commandManager');
const { logger } = require('./lib/logger');
const { env } = require('./lib/env');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const components = new ComponentManager();
const commands = new CommandManager();

client.on(Events.InteractionCreate, (interaction) => {
  if (interaction.isChatInputCommand()) {
    commands.handleInteraction(interaction);
  } else {
    components.handleInteraction(interaction);
  }
});

async function loadModules() {
  const modulesDir = path.resolve(__dirname, 'modules');

  if (!fs.existsSync(modulesDir)) return;

  const categories = fs.readdirSync(modulesDir);

  for (const category of categories) {
    const categoryPath = path.join(modulesDir, category);
    const stat = fs.statSync(categoryPath);
    if (!stat.isDirectory()) continue;

    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith('.js'));

    for (const file of files) {
      const modulePath = path.join(categoryPath, file);
      try {
        const mod = require(modulePath);
        if (typeof mod.registerModule === 'function') {
          mod.registerModule(client, components, commands);
          logger.info('Module', `Loaded ${category}/${file.replace(/\.js$/, '')}`);
        }
      } catch (error) {
        logger.error('Module', `Failed to load ${category}/${file}: ${error}`);
      }
    }
  }
}

client.once(Events.ClientReady, async () => {
  logger.info('Bot', `Logged in as ${client.user.tag}`);

  await commands.registerCommands(client, env.GUILD_ID);
});

loadModules()
  .then(() => client.login(env.DISCORD_TOKEN))
  .catch((error) => {
    logger.error('Bot', `Failed to start: ${error}`);
    process.exit(1);
  });

function shutdown(signal) {
  logger.info('Bot', `Received ${signal}, shutting down...`);
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
