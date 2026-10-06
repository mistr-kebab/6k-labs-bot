const { REST, Routes } = require('discord.js');
const { logger } = require('./logger');
const { env } = require('./env');
const { safeReply } = require('./reply');

class CommandManager {
  constructor() {
    this.commands = new Map();
  }

  register(builder, handler) {
    this.commands.set(builder.name, { builder, handler });
  }

  async registerCommands(client, guildId) {
    const rest = new REST().setToken(env.DISCORD_TOKEN);
    const bodies = Array.from(this.commands.values()).map((c) => c.builder.toJSON());

    try {
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: bodies });
        logger.info('Commands', `Registered ${bodies.length} command(s) for guild ${guildId}`);
      } else {
        await rest.put(Routes.applicationCommands(client.user.id), { body: bodies });
        logger.info('Commands', `Registered ${bodies.length} global command(s)`);
      }
    } catch (error) {
      logger.error('Commands', `Failed to register commands: ${error}`);
    }
  }

  async handleInteraction(interaction) {
    const command = this.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
      return;
    }

    try {
      await command.handler(interaction);
    } catch (error) {
      logger.error('Commands', `Error in /${interaction.commandName}: ${error}`);
      await safeReply(interaction, {
        content: 'An error occurred while executing this command.',
        ephemeral: true,
      });
    }
  }
}

module.exports = { CommandManager };
