const { ChannelType } = require('discord.js');
const { env } = require('./env');
const { logger } = require('./logger');

async function logModAction(guild, embed) {
  if (!env.MOD_LOG_CHANNEL_ID) return;

  try {
    const channel = guild.channels.cache.get(env.MOD_LOG_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildText) {
      logger.warn('ModLog', `Log channel not found in ${guild.name}`);
      return;
    }
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error('ModLog', `Failed to send mod log: ${error}`);
  }
}

module.exports = { logModAction };
