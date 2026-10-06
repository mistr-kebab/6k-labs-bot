import { ChatInputCommandInteraction, InteractionReplyOptions } from 'discord.js';

export async function safeReply(
  interaction: ChatInputCommandInteraction,
  options: InteractionReplyOptions,
): Promise<void> {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(options);
    } else {
      await interaction.reply(options);
    }
  } catch {
    // Interaction expired or unknown — nothing we can do
  }
}
