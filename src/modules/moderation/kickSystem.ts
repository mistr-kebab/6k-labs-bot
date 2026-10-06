import {
  Client,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { ComponentManager } from '../../lib/componentManager';
import { CommandManager } from '../../lib/commandManager';
import { logger } from '../../lib/logger';
import { safeReply } from '../../lib/reply';
import { logModAction } from '../../lib/modLog';

export function registerModule(_client: Client, _components: ComponentManager, commands: CommandManager): void {
  commands.register(
    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a member from the server')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((o) =>
        o.setName('user').setDescription('The user to kick').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('reason').setDescription('Reason for the kick').setRequired(false),
      ),
    async (interaction: ChatInputCommandInteraction) => {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') ?? 'No reason provided';

      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      if (user.id === interaction.user.id) {
        await interaction.reply({ content: 'You cannot kick yourself.', ephemeral: true });
        return;
      }

      if (user.id === interaction.client.user.id) {
        await interaction.reply({ content: 'I cannot kick myself.', ephemeral: true });
        return;
      }

      try {
        const member = await interaction.guild.members.fetch(user.id);

        if (!member.kickable) {
          await interaction.reply({ content: 'I cannot kick that user. They may have higher permissions.', ephemeral: true });
          return;
        }

        const dmEmbed = new EmbedBuilder()
          .setTitle(`Kicked from ${interaction.guild.name}`)
          .setDescription(`You have been kicked from **${interaction.guild.name}**.`)
          .addFields(
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason },
          )
          .setColor(0xffa500)
          .setTimestamp();

        try {
          await user.send({ embeds: [dmEmbed] });
        } catch {
          logger.warn('Kick', `Could not send kick DM to ${user.tag}`);
        }

        await member.kick(`${interaction.user.tag}: ${reason}`);

        const embed = new EmbedBuilder()
          .setTitle('User Kicked')
          .setDescription(`**${user.tag}** has been kicked.`)
          .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason },
          )
          .setColor(0xffa500)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        await logModAction(interaction.guild, embed);
        logger.info('Kick', `${interaction.user.tag} kicked ${user.tag} (${reason})`);
      } catch (error) {
        logger.error('Kick', `Failed to kick ${user.tag}: ${error}`);
        await safeReply(interaction, { content: `Failed to kick **${user.tag}**. ${error}`, ephemeral: true });
      }
    },
  );
}
