import {
  Client,
  ChannelType,
  EmbedBuilder,
  AttachmentBuilder,
  Events,
  PermissionFlagsBits,
  TextChannel,
  Message,
  Embed,
} from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../../lib/configManager';
import { ComponentManager } from '../../lib/componentManager';
import { CommandManager } from '../../lib/commandManager';
import { logger } from '../../lib/logger';

const FILTER_CHANNEL_NAME = process.env.FILTER_CHANNEL_NAME ?? 'filter-channel';
const HONEYPOT_EMBED_TITLE = 'Honeypot Channel';
const HONEYPOT_COLOR = 0x2b2d31;

function isTextChannel(channel: unknown): channel is TextChannel {
  return channel instanceof TextChannel;
}

function buildEmbed(client: Client, banCount: number): EmbedBuilder {
  return new EmbedBuilder()
    .setAuthor({ name: 'Security Measure', iconURL: client.user!.displayAvatarURL() })
    .setTitle(HONEYPOT_EMBED_TITLE)
    .setDescription(
      'This channel is a **honeypot** and is strictly monitored.\n\n' +
      'Sending any message here will result in an **automatic ban** ' +
      'and **deletion of your messages from the past 3 days**.',
    )
    .addFields(
      {
        name: 'Rule',
        value: 'Do **not** send any messages in this channel.',
        inline: true,
      },
      {
        name: 'Penalty',
        value: 'Instant ban · 3-day message purge',
        inline: true,
      },
      {
        name: 'Purpose',
        value: 'This channel exists to automatically ban spammers and compromised accounts. We do not want or need Mr. Beast giveaways.',
      },
    )
    .setColor(HONEYPOT_COLOR)
    .setFooter({ text: `6K Labs | Successful bans: ${banCount}`, iconURL: client.user!.displayAvatarURL() });
}

export function registerModule(client: Client, _components: ComponentManager, _commands: CommandManager): void {
  client.on(Events.ClientReady, async () => {
    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const guildConfig = getGuildConfig(guildId);
        let channelId = guildConfig.filterChannelId;
        let channel: TextChannel | null = null;

        if (channelId) {
          try {
            const fetched = await guild.channels.fetch(channelId);
            if (isTextChannel(fetched)) {
              channel = fetched;
              logger.info('Filter', `Using existing channel #${channel.name} in ${guild.name}`);
            }
          } catch {
            channel = null;
            logger.warn('Filter', `Stored channel ${channelId} not found in ${guild.name}, creating new one`);
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
          setGuildConfig(guildId, { filterChannelId: channel.id, banCount: 0 });
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
          setGuildConfig(guildId, { ...guildConfig, embedMessageId: existing.id });
          logger.info('Filter', `Updated existing honeypot embed in #${channel.name} (${guild.name})`);
        } else {
          const sent = await channel.send({ embeds: [embed] });
          setGuildConfig(guildId, { ...guildConfig, embedMessageId: sent.id });
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

    const guildConfig = getGuildConfig(message.guildId!);
    if (!guildConfig.filterChannelId) return;
    if (message.channelId !== guildConfig.filterChannelId) return;

    try {
      const evidenceAttachment = new AttachmentBuilder(
        Buffer.from(
          `Message Content: ${message.content}\n` +
          `Channel: #${(message.channel as TextChannel).name}\n` +
          `Sent at: ${message.createdAt.toISOString()}\n` +
          `User ID: ${message.author.id}\n` +
          `User Tag: ${message.author.tag}`,
          'utf-8',
        ),
        { name: 'evidence.txt' },
      );

      const dmEmbed = new EmbedBuilder()
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
        .setTimestamp();

      try {
        await message.author.send({ embeds: [dmEmbed], files: [evidenceAttachment] });
        logger.info('Filter', `Sent ban DM to ${message.author.tag}`);
      } catch {
        logger.warn('Filter', `Could not send DM to ${message.author.tag} (DMs closed)`);
      }

      await message.delete();

      await message.member?.ban({
        deleteMessageSeconds: 3 * 24 * 60 * 60,
        reason: 'Sent a message in the honeypot filter channel',
      });

      const newCount = (guildConfig.banCount ?? 0) + 1;
      setGuildConfig(message.guildId!, { ...guildConfig, banCount: newCount });

      if (guildConfig.embedMessageId) {
        try {
          const embedMsg = await (message.channel as TextChannel).messages.fetch(guildConfig.embedMessageId);
          const updatedEmbed = buildEmbed(client, newCount);
          await embedMsg.edit({ embeds: [updatedEmbed] });
        } catch {
          logger.warn('Filter', `Could not update embed after ban`);
        }
      }

      logger.info('Filter', `Banned ${message.author.tag} — total: ${newCount}`);
    } catch (error) {
      logger.error('Filter', `Failed to ban ${message.author.tag}: ${error}`);
    }
  });
}

async function findExistingEmbed(client: Client, channel: TextChannel): Promise<Message | null> {
  const messages = await channel.messages.fetch({ limit: 50 });
  return messages.find(
    (msg: Message) =>
      msg.author.id === client.user!.id &&
      msg.embeds.some((e: Embed) => e.title === HONEYPOT_EMBED_TITLE),
  ) ?? null;
}
