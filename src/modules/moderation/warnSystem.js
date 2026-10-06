const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const {
  addWarning,
  removeWarning,
  getUserWarnings,
  getAllWarnings,
} = require('../../lib/configManager');
const { logger } = require('../../lib/logger');
const { logModAction } = require('../../lib/modLog');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function registerModule(client, _components, commands) {
  commands.register(
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Warn a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('user').setDescription('The user to warn').setRequired(true))
      .addStringOption((o) =>
        o.setName('reason').setDescription('Reason for the warning').setRequired(false),
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

      if (user.id === interaction.user.id) {
        await interaction.reply({ content: 'You cannot warn yourself.', ephemeral: true });
        return;
      }

      if (user.id === client.user.id) {
        await interaction.reply({ content: 'I cannot warn myself.', ephemeral: true });
        return;
      }

      addWarning(interaction.guildId, {
        id: generateId(),
        userId: user.id,
        moderatorId: interaction.user.id,
        reason,
        timestamp: Date.now(),
      });

      const dmEmbed = new EmbedBuilder()
        .setTitle(`Warning from ${interaction.guild.name}`)
        .setDescription(`You have received a warning in **${interaction.guild.name}**.`)
        .addFields(
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason },
        )
        .setColor(0xffa500)
        .setTimestamp();

      try {
        await user.send({ embeds: [dmEmbed] });
      } catch {
        logger.warn('Warn', `Could not send warn DM to ${user.tag}`);
      }

      const totalWarns = getUserWarnings(interaction.guildId, user.id).length;

      const embed = new EmbedBuilder()
        .setTitle('User Warned')
        .setDescription(`**${user.tag}** has been warned.`)
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason },
          { name: 'Total Warnings', value: `${totalWarns}`, inline: true },
        )
        .setColor(0xffa500)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await logModAction(interaction.guild, embed);
      logger.info(
        'Warn',
        `${interaction.user.tag} warned ${user.tag} — total: ${totalWarns} (${reason})`,
      );
    },
  );

  commands.register(
    new SlashCommandBuilder()
      .setName('warn_remove')
      .setDescription('Remove a specific warning from a user')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) =>
        o.setName('user').setDescription('The user to remove the warning from').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('warning_id').setDescription('The ID of the warning to remove').setRequired(true),
      ),
    async (interaction) => {
      const user = interaction.options.getUser('user', true);
      const warningId = interaction.options.getString('warning_id', true);

      if (!interaction.guild) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      const removed = removeWarning(interaction.guildId, user.id, warningId);

      if (!removed) {
        await interaction.reply({
          content: 'Warning not found. Use `/warns` to see all warning IDs.',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('Warning Removed')
        .setDescription(`A warning from **${user.tag}** has been removed.`)
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true },
          { name: 'Removed Reason', value: removed.reason },
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await logModAction(interaction.guild, embed);
      logger.info(
        'WarnRemove',
        `${interaction.user.tag} removed warning ${warningId} from ${user.tag}`,
      );
    },
  );

  commands.register(
    new SlashCommandBuilder()
      .setName('warns')
      .setDescription('View warnings for a user or all warnings')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) =>
        o.setName('user').setDescription('The user to check warnings for').setRequired(false),
      ),
    async (interaction) => {
      if (!interaction.guild) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      const user = interaction.options.getUser('user');

      if (user) {
        const warnings = getUserWarnings(interaction.guildId, user.id);

        if (warnings.length === 0) {
          await interaction.reply({ content: `**${user.tag}** has no warnings.`, ephemeral: true });
          return;
        }

        const lines = warnings.map(
          (w) =>
            `\`${w.id}\` — <t:${Math.floor(w.timestamp / 1000)}:d> — <@${w.moderatorId}> — ${w.reason}`,
        );

        const embed = new EmbedBuilder()
          .setTitle(`Warnings for ${user.tag} (${warnings.length})`)
          .setDescription(lines.join('\n'))
          .setColor(0xffa500)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        const all = getAllWarnings(interaction.guildId);

        if (all.length === 0) {
          await interaction.reply({ content: 'No warnings have been issued.', ephemeral: true });
          return;
        }

        const lines = all.map(
          (w) =>
            `• **<@${w.userId}>** — \`${w.id}\` — <t:${Math.floor(w.timestamp / 1000)}:d> — ${w.reason}`,
        );

        const embed = new EmbedBuilder()
          .setTitle(`All Warnings (${all.length})`)
          .setDescription(lines.join('\n'))
          .setColor(0xffa500)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

      logger.info('Warns', `${interaction.user.tag} viewed warnings`);
    },
  );
}

module.exports = { registerModule };
