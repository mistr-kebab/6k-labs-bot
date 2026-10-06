import { Client, GatewayIntentBits, Events, Interaction } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { ComponentManager } from './lib/componentManager';
import { CommandManager } from './lib/commandManager';
import { logger } from './lib/logger';

dotenv.config();

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

client.on(Events.InteractionCreate, (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    commands.handleInteraction(interaction);
  } else {
    components.handleInteraction(interaction);
  }
});

async function loadModules(): Promise<void> {
  const modulesDir = path.resolve(__dirname, 'modules');

  if (!fs.existsSync(modulesDir)) return;

  const categories = fs.readdirSync(modulesDir);

  for (const category of categories) {
    const categoryPath = path.join(modulesDir, category);
    const stat = fs.statSync(categoryPath);
    if (!stat.isDirectory()) continue;

    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith('.ts'));

    for (const file of files) {
      const modulePath = path.join(categoryPath, file);
      try {
        const moduleUrl = pathToFileURL(modulePath).href;
        const mod = await import(moduleUrl);
        if (typeof mod.registerModule === 'function') {
          mod.registerModule(client, components, commands);
          logger.info('Module', `Loaded ${category}/${file.replace('.ts', '')}`);
        }
      } catch (error) {
        logger.error('Module', `Failed to load ${category}/${file}: ${error}`);
      }
    }
  }
}

client.once(Events.ClientReady, async () => {
  logger.info('Bot', `Logged in as ${client.user!.tag}`);

  await commands.registerCommands(client, process.env.GUILD_ID);
});

loadModules()
  .then(() => client.login(process.env.DISCORD_TOKEN))
  .catch((error) => {
    logger.error('Bot', `Failed to start: ${error}`);
    process.exit(1);
  });

function shutdown(signal: string): void {
  logger.info('Bot', `Received ${signal}, shutting down...`);
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
