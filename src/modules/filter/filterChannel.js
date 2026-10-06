const {
  ChannelType,
  EmbedBuilder,
  AttachmentBuilder,
  Events,
  PermissionFlagsBits,
  TextChannel,
} = require('discord.js');
const { getGuildConfig, updateGuildConfig } = require('../../lib/configManager');
const { logger } = require('../../lib/logger');
const { env } = require('../../lib/env');
const { logModAction } = require('../../lib/modLog');

const FILTER_CHANNEL_NAME = env.FILTER_CHANNEL_NAME;
const HONEYPOT_EMBED_TITLE = 'Honeypot Channel';
const HONEYPOT_COLOR = 0x2b2d31;
const FILTER_TIMEOUT_MS = env.FILTER_TIMEOUT_MINUTES * 60_000;

function isTextChannel(channel) {
  return channel instanceof TextChannel;
}

function formatTimeout() {
  const totalMinutes = Math.floor(FILTER_TIMEOUT_MS / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || '0m';
}

function buildEmbed(client, count) {
  const isBan = env.FILTER_ACTION === 'ban';

  return new EmbedBuilder()
    .setAuthor({ name: 'Security Measure', iconURL: client.user.displayAvatarURL() })
    .setTitle(HONEYPOT_EMBED_TITLE)
    .setDescription(
      'This channel is a **honeypot** and is strictly monitored.\n\n' +
        (isBan
          ? 'Sending any message here will result in an **automatic ban** ' +
            'and **deletion of your messages from the past 3 days**.'
          : `Sending any message here will result in an **automatic timeout (${formatTimeout()})**.`),
    )
    .addFields(
      {
        name: 'Rule',
        value: 'Do **not** send any messages in this channel.',
        inline: true,
      },
      {
        name: 'Penalty',
        value: isBan ? 'Instant ban · 3-day message purge' : `Timeout · ${formatTimeout()}`,
        inline: true,
      },
      {
        name: 'Purpose',
        value: isBan
          ? 'This channel exists to automatically ban spammers and compromised accounts. We do not want or need Mr. Beast giveaways.'
          : 'This channel exists to automatically time out spammers and compromised accounts. We do not want or need Mr. Beast giveaways.',
      },
    )
    .setColor(HONEYPOT_COLOR)
    .setFooter({
      text: `6K Labs | Successful ${isBan ? 'bans' : 'timeouts'}: ${count}`,
      iconURL: client.user.displayAvatarURL(),
    });
}

function registerModule(client, _components, _commands) {
  client.on(Events.ClientReady, async () => {
    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const guildConfig = getGuildConfig(guildId);
        const channelId = guildConfig.filterChannelId;
        let channel = null;

        if (channelId) {
          try {
            const fetched = await guild.channels.fetch(channelId);
            if (isTextChannel(fetched)) {
              channel = fetched;
              logger.info('Filter', `Using existing channel #${channel.name} in ${guild.name}`);
            }
          } catch {
            channel = null;
            logger.warn(
              'Filter',
              `Stored channel ${channelId} not found in ${guild.name}, creating new one`,
            );
          }
        }

        if (!channel) {
          const created = await guild.channels.create({
            name: FILTER_CHANNEL_NAME,
            type: ChannelType.GuildText,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
              },
            ],
          });

          channel = created;
          updateGuildConfig(guildId, { filterChannelId: channel.id, banCount: 0 });
          logger.info('Filter', `Created channel #${channel.name} in ${guild.name}`);
        }

        const embed = buildEmbed(client, guildConfig.banCount ?? 0);

        if (guildConfig.embedMessageId) {
          try {
            const msg = await channel.messages.fetch(guildConfig.embedMessageId);
            await msg.edit({ embeds: [embed] });
            logger.info('Filter', `Updated honeypot embed in #${channel.name} (${guild.name})`);
            continue;
          } catch {
            // Stored message ID invalid, fall through to search
          }
        }

        const existing = await findExistingEmbed(client, channel);
        if (existing) {
          await existing.edit({ embeds: [embed] });
          updateGuildConfig(guildId, { embedMessageId: existing.id });
          logger.info(
            'Filter',
            `Updated existing honeypot embed in #${channel.name} (${guild.name})`,
          );
        } else {
          const sent = await channel.send({ embeds: [embed] });
          updateGuildConfig(guildId, { embedMessageId: sent.id });
          logger.info('Filter', `Sent honeypot embed in #${channel.name} (${guild.name})`);
        }
      } catch (error) {
        logger.error('Filter', `Setup failed in guild ${guildId}: ${error}`);
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildConfig = getGuildConfig(message.guildId);
    if (!guildConfig.filterChannelId) return;
    if (message.channelId !== guildConfig.filterChannelId) return;

    try {
      const evidenceAttachment = new AttachmentBuilder(
        Buffer.from(
          `Message Content: ${message.content}\n` +
            `Channel: #${message.channel.name}\n` +
            `Sent at: ${message.createdAt.toISOString()}\n` +
            `User ID: ${message.author.id}\n` +
            `User Tag: ${message.author.tag}`,
          'utf-8',
        ),
        { name: 'evidence.txt' },
      );

      const isBan = env.FILTER_ACTION === 'ban';

      const dmEmbed = isBan
        ? new EmbedBuilder()
            .setTitle('You have been banned')
            .setDescription(
              `You have been banned from **${message.guild.name}** ` +
                'for sending a message in the honeypot filter channel.',
            )
            .addFields(
              { name: 'Reason', value: 'Violation of server rules - Honeypot channel' },
              { name: 'Server', value: message.guild.name },
            )
            .setColor(0xff0000)
            .setTimestamp()
        : new EmbedBuilder()
            .setTitle('You have been timed out')
            .setDescription(
              `You have been timed out in **${message.guild.name}** ` +
                'for sending a message in the honeypot filter channel.',
            )
            .addFields(
              { name: 'Reason', value: 'Violation of server rules - Honeypot channel' },
              { name: 'Server', value: message.guild.name },
              { name: 'Duration', value: formatTimeout(), inline: true },
            )
            .setColor(0xffa500)
            .setTimestamp();

      try {
        await message.author.send({ embeds: [dmEmbed], files: [evidenceAttachment] });
        logger.info('Filter', `Sent punishment DM to ${message.author.tag}`);
      } catch {
        logger.warn('Filter', `Could not send DM to ${message.author.tag} (DMs closed)`);
      }

      await message.delete();

      if (isBan) {
        await message.member?.ban({
          deleteMessageSeconds: 3 * 24 * 60 * 60,
          reason: 'Sent a message in the honeypot filter channel',
        });
      } else {
        if (!message.member) {
          logger.error('Filter', `Could not time out ${message.author.tag}: member not found`);
          return;
        }
        await message.member.timeout(
          FILTER_TIMEOUT_MS,
          'Sent a message in the honeypot filter channel',
        );
      }

      const newCount = (getGuildConfig(message.guildId).banCount ?? 0) + 1;
      updateGuildConfig(message.guildId, { banCount: newCount });

      if (guildConfig.embedMessageId) {
        try {
          const embedMsg = await message.channel.messages.fetch(guildConfig.embedMessageId);
          const updatedEmbed = buildEmbed(client, newCount);
          await embedMsg.edit({ embeds: [updatedEmbed] });
        } catch {
          logger.warn('Filter', `Could not update embed after punishment`);
        }
      }

      const logEmbed = new EmbedBuilder()
        .setTitle(isBan ? 'Honeypot Ban' : 'Honeypot Timeout')
        .setDescription(
          `**${message.author.tag}** triggered the honeypot and was ${isBan ? 'banned' : 'timed out'} automatically.`,
        )
        .addFields(
          { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
          { name: 'Reason', value: 'Sent a message in the honeypot filter channel' },
          ...(isBan
            ? [{ name: 'Total Honeypot Bans', value: `${newCount}`, inline: true }]
            : [
                { name: 'Duration', value: formatTimeout(), inline: true },
                { name: 'Total Honeypot Timeouts', value: `${newCount}`, inline: true },
              ]),
        )
        .setColor(isBan ? 0xff0000 : 0xffa500)
        .setTimestamp();

      await logModAction(message.guild, logEmbed);
      logger.info(
        'Filter',
        `${isBan ? 'Banned' : 'Timed out'} ${message.author.tag} — total: ${newCount}`,
      );
    } catch (error) {
      logger.error('Filter', `Failed to punish ${message.author.tag}: ${error}`);
    }
  });
}

async function findExistingEmbed(client, channel) {
  const messages = await channel.messages.fetch({ limit: 50 });
  return (
    messages.find(
      (msg) =>
        msg.author.id === client.user.id &&
        msg.embeds.some((e) => e.title === HONEYPOT_EMBED_TITLE),
    ) ?? null
  );
}

module.exports = { registerModule };
