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

export function registerModule(client: Client, _components: ComponentManager, commands: CommandManager): void {
  commands.register(
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a member from the server')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((o) =>
        o.setName('user').setDescription('The user to ban').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('reason').setDescription('Reason for the ban').setRequired(false),
      )
      .addIntegerOption((o) =>
        o
          .setName('delete_days')
          .setDescription('Delete messages from the last X days (0-7)')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(7),
      ),
    async (interaction: ChatInputCommandInteraction) => {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      if (user.id === interaction.user.id) {
        await interaction.reply({ content: 'You cannot ban yourself.', ephemeral: true });
        return;
      }

      if (user.id === client.user!.id) {
        await interaction.reply({ content: 'I cannot ban myself.', ephemeral: true });
        return;
      }

      try {
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        const dmEmbed = new EmbedBuilder()
          .setTitle(`Banned from ${interaction.guild.name}`)
          .setDescription(`You have been banned from **${interaction.guild.name}**.`)
          .addFields(
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason },
            { name: 'Messages Deleted', value: deleteDays > 0 ? `Last ${deleteDays} day(s)` : 'None' },
            { name: 'Appeal', value: 'If you believe this was a mistake, please contact the server staff.' },
          )
          .setColor(0xff0000)
          .setTimestamp();

        try {
          await user.send({ embeds: [dmEmbed] });
        } catch {
          logger.warn('Ban', `Could not send ban DM to ${user.tag}`);
        }

        if (!member) {
          await interaction.guild.bans.create(user.id, {
            deleteMessageSeconds: deleteDays * 24 * 60 * 60,
            reason: `${interaction.user.tag}: ${reason}`,
          });
        } else {
          if (!member.bannable) {
            await interaction.reply({ content: 'I cannot ban that user. They may have higher permissions.', ephemeral: true });
            return;
          }

          await member.ban({
            deleteMessageSeconds: deleteDays * 24 * 60 * 60,
            reason: `${interaction.user.tag}: ${reason}`,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('User Banned')
          .setDescription(`**${user.tag}** has been banned.`)
          .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Reason', value: reason },
            { name: 'Messages Deleted', value: deleteDays > 0 ? `Last ${deleteDays} day(s)` : 'None' },
          )
          .setColor(0xff0000)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        logger.info('Ban', `${interaction.user.tag} banned ${user.tag} (${reason})`);
      } catch (error) {
        logger.error('Ban', `Failed to ban ${user.tag}: ${error}`);
        await interaction.reply({ content: `Failed to ban **${user.tag}**. ${error}`, ephemeral: true });
      }
    },
  );

  commands.register(
    new SlashCommandBuilder()
      .setName('unban')
      .setDescription('Unban a user from the server')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addStringOption((o) =>
        o.setName('user_id').setDescription('The ID of the user to unban').setRequired(true),
      ),
    async (interaction: ChatInputCommandInteraction) => {
      const userId = interaction.options.getString('user_id', true);

      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      try {
        const bans = await interaction.guild.bans.fetch();
        const bannedUser = bans.get(userId);

        if (!bannedUser) {
          await interaction.reply({ content: 'That user is not banned.', ephemeral: true });
          return;
        }

        const dmEmbed = new EmbedBuilder()
          .setTitle(`Unbanned from ${interaction.guild.name}`)
          .setDescription(`You have been unbanned from **${interaction.guild.name}**.`)
          .addFields(
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Previous Reason', value: bannedUser.reason ?? 'None' },
          )
          .setColor(0x00ff00)
          .setTimestamp();

        try {
          await bannedUser.user.send({ embeds: [dmEmbed] });
        } catch {
          logger.warn('Unban', `Could not send unban DM to ${bannedUser.user.tag}`);
        }

        await interaction.guild.bans.remove(userId, `Unbanned by ${interaction.user.tag}`);

        const embed = new EmbedBuilder()
          .setTitle('User Unbanned')
          .setDescription(`**${bannedUser.user.tag}** has been unbanned.`)
          .addFields(
            { name: 'User', value: `${bannedUser.user.tag} (${bannedUser.user.id})`, inline: true },
            { name: 'Moderator', value: interaction.user.tag, inline: true },
            { name: 'Previous Reason', value: bannedUser.reason ?? 'None' },
          )
          .setColor(0x00ff00)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        logger.info('Unban', `${interaction.user.tag} unbanned ${bannedUser.user.tag}`);
      } catch (error) {
        logger.error('Unban', `Failed to unban ${userId}: ${error}`);
        await interaction.reply({ content: `Failed to unban <@${userId}>. ${error}`, ephemeral: true });
      }
    },
  );

  commands.register(
    new SlashCommandBuilder()
      .setName('bans')
      .setDescription('List all banned users in the server')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async (interaction: ChatInputCommandInteraction) => {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      try {
        const bans = await interaction.guild.bans.fetch();

        if (bans.size === 0) {
          await interaction.reply({ content: 'No users are currently banned.', ephemeral: true });
          return;
        }

        const pages: string[] = [];
        let page = '';

        for (const [, ban] of bans) {
          const line = `• **${ban.user.tag}** (\`${ban.user.id}\`) — ${ban.reason ?? 'No reason'}\n`;
          if ((page + line).length > 1900) {
            pages.push(page);
            page = line;
          } else {
            page += line;
          }
        }
        if (page) pages.push(page);

        const embed = new EmbedBuilder()
          .setTitle(`Bans (${bans.size})`)
          .setDescription(pages[0])
          .setColor(0xffa500)
          .setFooter({ text: `Page 1 of ${pages.length}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        logger.info('Bans', `${interaction.user.tag} viewed ban list (${bans.size} bans)`);
      } catch (error) {
        logger.error('Bans', `Failed to fetch bans: ${error}`);
        await interaction.reply({ content: `Failed to fetch bans. ${error}`, ephemeral: true });
      }
    },
  );
}
