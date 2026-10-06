const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { logger } = require('../../lib/logger');
const { safeReply } = require('../../lib/reply');
const { logModAction } = require('../../lib/modLog');

function parseDuration(amount, unit) {
  const multipliers = {
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
  };
  return amount * multipliers[unit];
}

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || '0m';
}

function registerModule(client, _components, commands) {
  commands.register(
    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Timeout a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
      .addUserOption((o) => o.setName('user').setDescription('The user to mute').setRequired(true))
      .addIntegerOption((o) =>
        o
          .setName('duration')
          .setDescription('How long the mute should last')
          .setRequired(true)
          .setMinValue(1),
      )
      .addStringOption((o) =>
        o
          .setName('unit')
          .setDescription('Time unit')
          .setRequired(true)
          .addChoices(
            { name: 'Minutes', value: 'minutes' },
            { name: 'Hours', value: 'hours' },
            { name: 'Days', value: 'days' },
          ),
      )
      .addStringOption((o) =>
        o.setName('reason').setDescription('Reason for the mute').setRequired(false),
      ),
    async (interaction) => {
      const user = interaction.options.getUser('user', true);
      const duration = interaction.options.getInteger('duration', true);
      const unit = interaction.options.getString('unit', true);
      const reason = interaction.options.getString('reason') ?? 'No reason provided';

      if (!interaction.guild) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      if (user.id === interaction.user.id) {
        await interaction.reply({ content: 'You cannot mute yourself.', ephemeral: true });
        return;
      }

      if (user.id === client.user.id) {
        await interaction.reply({ content: 'I cannot mute myself.', ephemeral: true });
        return;
      }

      const durationMs = parseDuration(duration, unit);
      const maxMs = 28 * 24 * 60 * 60 * 1000;

      if (durationMs > maxMs) {
        await interaction.reply({ content: 'Mute cannot exceed 28 days.', ephemeral: true });
        return;
      }

      try {
        const member = await interaction.guild.members.fetch(user.id);
        const until = new Date(Date.now() + durationMs);
        const formattedDuration = formatDuration(durationMs);

        const dmEmbed = new EmbedBuilder()
          .setTitle(`Muted in ${interaction.guild.name}`)
          .setDescription(`You have been muted in **${interaction.guild.name}**.`)
          .addFields(
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Duration', value: formattedDuration, inline: true },
            { name: 'Expires', value: `<t:${Math.floor(until.getTime() / 1000)}:F>`, inline: true },
            { name: 'Reason', value: reason },
          )
          .setColor(0xffa500)
          .setTimestamp();

        try {
          await user.send({ embeds: [dmEmbed] });
        } catch {
          logger.warn('Mute', `Could not send mute DM to ${user.tag}`);
        }

        await member.timeout(durationMs, `${interaction.user.tag}: ${reason}`);

        const embed = new EmbedBuilder()
          .setTitle('User Muted')
          .setDescription(`**${user.tag}** has been muted.`)
          .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Duration', value: formattedDuration, inline: true },
            { name: 'Expires', value: `<t:${Math.floor(until.getTime() / 1000)}:R>`, inline: true },
            { name: 'Reason', value: reason },
          )
          .setColor(0xffa500)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        await logModAction(interaction.guild, embed);
        logger.info(
          'Mute',
          `${interaction.user.tag} muted ${user.tag} for ${formattedDuration} (${reason})`,
        );
      } catch (error) {
        logger.error('Mute', `Failed to mute ${user.tag}: ${error}`);
        await safeReply(interaction, {
          content: `Failed to mute **${user.tag}**. ${error}`,
          ephemeral: true,
        });
      }
    },
  );

  commands.register(
    new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('Remove a timeout from a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
      .addUserOption((o) =>
        o.setName('user').setDescription('The user to unmute').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('reason').setDescription('Reason for the unmute').setRequired(false),
      ),
    async (interaction) => {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') ?? 'No reason provided';

      if (!interaction.guild) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      try {
        const member = await interaction.guild.members.fetch(user.id);

        if (!member.communicationDisabledUntil) {
          await interaction.reply({ content: 'That user is not muted.', ephemeral: true });
          return;
        }

        const dmEmbed = new EmbedBuilder()
          .setTitle(`Unmuted in ${interaction.guild.name}`)
          .setDescription(`Your mute has been lifted in **${interaction.guild.name}**.`)
          .addFields(
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason },
          )
          .setColor(0x00ff00)
          .setTimestamp();

        try {
          await user.send({ embeds: [dmEmbed] });
        } catch {
          logger.warn('Unmute', `Could not send unmute DM to ${user.tag}`);
        }

        await member.timeout(null, `${interaction.user.tag}: ${reason}`);

        const embed = new EmbedBuilder()
          .setTitle('User Unmuted')
          .setDescription(`**${user.tag}** has been unmuted.`)
          .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason },
          )
          .setColor(0x00ff00)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        await logModAction(interaction.guild, embed);
        logger.info('Unmute', `${interaction.user.tag} unmuted ${user.tag} (${reason})`);
      } catch (error) {
        logger.error('Unmute', `Failed to unmute ${user.tag}: ${error}`);
        await safeReply(interaction, {
          content: `Failed to unmute **${user.tag}**. ${error}`,
          ephemeral: true,
        });
      }
    },
  );

  commands.register(
    new SlashCommandBuilder()
      .setName('mutes')
      .setDescription('List all currently muted members')
      .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),
    async (interaction) => {
      if (!interaction.guild) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      try {
        const members = await interaction.guild.members.fetch();
        const muted = members.filter((m) => m.communicationDisabledUntil !== null);

        if (muted.size === 0) {
          await interaction.reply({ content: 'No members are currently muted.', ephemeral: true });
          return;
        }

        const lines = muted.map((m) => {
          const until = m.communicationDisabledUntil;
          return `• **${m.user.tag}** — expires <t:${Math.floor(until.getTime() / 1000)}:R>`;
        });

        const embed = new EmbedBuilder()
          .setTitle(`Active Mutes (${muted.size})`)
          .setDescription(lines.join('\n'))
          .setColor(0xffa500)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        logger.info('Mutes', `${interaction.user.tag} viewed active mutes (${muted.size})`);
      } catch (error) {
        logger.error('Mutes', `Failed to fetch mutes: ${error}`);
        await safeReply(interaction, {
          content: `Failed to fetch mutes. ${error}`,
          ephemeral: true,
        });
      }
    },
  );
}

module.exports = { registerModule };
