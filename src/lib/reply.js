async function safeReply(interaction, options) {
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

module.exports = { safeReply };
