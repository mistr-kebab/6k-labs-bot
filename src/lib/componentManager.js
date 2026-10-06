const { logger } = require('./logger');

class ComponentManager {
  constructor() {
    this.buttons = new Map();
    this.selectMenus = new Map();
    this.modals = new Map();
    this.defaultHandler = null;
  }

  setDefaultHandler(handler) {
    this.defaultHandler = handler;
  }

  registerButton(customId, handler) {
    this.buttons.set(customId, handler);
  }

  registerSelectMenu(customId, handler) {
    this.selectMenus.set(customId, handler);
  }

  registerModal(customId, handler) {
    this.modals.set(customId, handler);
  }

  async handleInteraction(interaction) {
    try {
      if (interaction.isButton()) {
        const handler = this.buttons.get(interaction.customId);
        if (handler) {
          await handler(interaction);
          return;
        }
      }

      if (interaction.isAnySelectMenu()) {
        const handler = this.selectMenus.get(interaction.customId);
        if (handler) {
          await handler(interaction);
          return;
        }
      }

      if (interaction.isModalSubmit()) {
        const handler = this.modals.get(interaction.customId);
        if (handler) {
          await handler(interaction);
          return;
        }
      }

      if (this.defaultHandler) {
        await this.defaultHandler(interaction);
      }
    } catch (error) {
      logger.error('Components', `Error handling interaction: ${error}`);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'An error occurred.', ephemeral: true });
        }
      } catch {
        // Interaction expired — nothing we can do
      }
    }
  }
}

module.exports = { ComponentManager };
