import {
  Client,
  ChannelType,
  EmbedBuilder,
  Events,
  TextChannel,
  SlashCommandBuilder,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  FileUploadBuilder,
} from 'discord.js';
import { ComponentManager } from '../../lib/componentManager';
import { CommandManager } from '../../lib/commandManager';
import { getGuildConfig, setGuildConfig } from '../../lib/configManager';
import { logger } from '../../lib/logger';

const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID ?? '';
const REPORT_MODAL_ID = 'report_modal';
const REPORT_TEXT_USER = 'report_user';
const REPORT_TEXT_DESC = 'report_description';
const REPORT_FILE_EVIDENCE = 'report_evidence';

function buildStickyEmbed(client: Client, reportCommandId?: string): EmbedBuilder {
  const reportText = reportCommandId
    ? `</report:${reportCommandId}>`
    : '`/report`';

  return new EmbedBuilder()
    .setAuthor({ name: 'Report System', iconURL: client.user!.displayAvatarURL() })
    .setTitle('How to Report Users')
    .setDescription(
      'This channel is for reporting users who contact you **outside the server** ' +
      "(e.g. via DMs) trying to sell you something, offer you services, " +
      "or simply won't take no for an answer.\n\n" +
      `You can also use **${reportText}** — your report will be posted here automatically.\n\n` +
      '**Information we need:**\n' +
      '• Evidence (screenshot)\n' +
      '• User ID\n' +
      '• User Name',
    )
    .setColor(0x5865f2)
    .setFooter({ text: '6K Labs • Report System' });
}

export function registerModule(client: Client, components: ComponentManager, commands: CommandManager): void {
  if (!REPORT_CHANNEL_ID) {
    logger.error('Report', 'REPORT_CHANNEL_ID is not set in .env — report module disabled');
    return;
  }

  let stickyTimer: ReturnType<typeof setTimeout> | null = null;

  async function updateStickyMention(guildId: string, stickyId: string, retries = 5): Promise<void> {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(REPORT_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildText) return;
    const textChannel = channel as TextChannel;

    try {
      const guildCmds = await guild.commands.fetch();
      let reportCmd = guildCmds.find((c) => c.name === 'report');

      if (!reportCmd) {
        const globalCmds = await client.application!.commands.fetch();
        reportCmd = globalCmds.find((c) => c.name === 'report');
      }

      if (!reportCmd) {
        if (retries > 0) {
          setTimeout(() => updateStickyMention(guildId, stickyId, retries - 1), 3000);
        }
        return;
      }

      const msg = await textChannel.messages.fetch(stickyId);
      await msg.edit({ embeds: [buildStickyEmbed(client, reportCmd.id)] });
    } catch {
      if (retries > 0) {
        setTimeout(() => updateStickyMention(guildId, stickyId, retries - 1), 3000);
      }
    }
  }

  async function refreshSticky(guildId: string): Promise<void> {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(REPORT_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildText) return;
    const textChannel = channel as TextChannel;

    const config = getGuildConfig(guildId);

    if (config.reportStickyMessageId) {
      try {
        const old = await textChannel.messages.fetch(config.reportStickyMessageId);
        await old.delete();
      } catch {
        // doesn't exist anymore
      }
    }

    const embed = buildStickyEmbed(client);
    const sent = await textChannel.send({ embeds: [embed] });
    setGuildConfig(guildId, { ...config, reportStickyMessageId: sent.id });
    await updateStickyMention(guildId, sent.id);
  }

  async function scheduleRefresh(guildId: string): Promise<void> {
    if (stickyTimer) clearTimeout(stickyTimer);
    stickyTimer = setTimeout(() => {
      refreshSticky(guildId);
      stickyTimer = null;
    }, 1500);
  }

  async function findOrCreateSticky(guildId: string): Promise<void> {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(REPORT_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildText) return;
    const textChannel = channel as TextChannel;

    const config = getGuildConfig(guildId);

    if (config.reportStickyMessageId) {
      try {
        await textChannel.messages.fetch(config.reportStickyMessageId);
        logger.info('Report', `Sticky message found in #${textChannel.name} (${guild.name})`);
        await updateStickyMention(guildId, config.reportStickyMessageId);
        return;
      } catch {
        // message gone, create new one
      }
    }

    const embed = buildStickyEmbed(client);
    const sent = await textChannel.send({ embeds: [embed] });
    setGuildConfig(guildId, { ...config, reportStickyMessageId: sent.id });
    logger.info('Report', `Created sticky message in #${textChannel.name} (${guild.name})`);
    await updateStickyMention(guildId, sent.id);
  }

  client.on(Events.ClientReady, async () => {
    for (const [guildId] of client.guilds.cache) {
      await findOrCreateSticky(guildId);
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.channelId !== REPORT_CHANNEL_ID) return;
    if (!message.guild) return;

    await scheduleRefresh(message.guild.id);
  });

  commands.register(
    new SlashCommandBuilder()
      .setName('report')
      .setDescription('Report a user who contacted you outside the server'),
    async (interaction) => {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(REPORT_MODAL_ID)
        .setTitle('Report a User')
        .addLabelComponents(
          new LabelBuilder()
            .setLabel('Reported User (ID)')
            .setDescription('Paste the ID of the user you want to report')
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId(REPORT_TEXT_USER)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('User ID (right-click user → Copy ID)')
                .setRequired(true),
            ),
        )
        .addLabelComponents(
          new LabelBuilder()
            .setLabel('Description')
            .setDescription('What happened? Be as detailed as possible.')
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId(REPORT_TEXT_DESC)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe what the user did — DMs, offers, harassment, etc.')
                .setMinLength(10)
                .setMaxLength(2000)
                .setRequired(true),
            ),
        )
        .addLabelComponents(
          new LabelBuilder()
            .setLabel('Evidence (Screenshot)')
            .setDescription('Upload a screenshot as proof')
            .setFileUploadComponent(
              new FileUploadBuilder()
                .setCustomId(REPORT_FILE_EVIDENCE)
                .setMinValues(0)
                .setMaxValues(3)
                .setRequired(false),
            ),
        );

      await interaction.showModal(modal);
    },
  );

  components.registerModal(REPORT_MODAL_ID, async (interaction) => {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This can only be used in a server.', ephemeral: true });
      return;
    }

    const userId = interaction.fields.getTextInputValue(REPORT_TEXT_USER);
    const description = interaction.fields.getTextInputValue(REPORT_TEXT_DESC);
    const evidenceFiles = interaction.fields.getUploadedFiles(REPORT_FILE_EVIDENCE);

    const channel = interaction.guild.channels.cache.get(REPORT_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: 'Report channel not found. Please contact staff.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('New Report')
      .setDescription(description)
      .addFields(
        { name: 'Reported User', value: `<@${userId}> (${userId})`, inline: true },
        { name: 'Reported by', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      )
      .setColor(0xed4245)
      .setTimestamp();

    if (evidenceFiles && evidenceFiles.size > 0) {
      embed.setImage(evidenceFiles.first()!.url);
    }

    await (channel as TextChannel).send({ embeds: [embed] });
    await interaction.reply({ content: 'Your report has been submitted. Thank you.', ephemeral: true });
    logger.info('Report', `${interaction.user.tag} reported user ${userId}`);
  });
}
