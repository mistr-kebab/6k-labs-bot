import {
  Interaction,
  ButtonInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
} from 'discord.js';
import { logger } from './logger';

type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;
type SelectMenuHandler = (interaction: AnySelectMenuInteraction) => Promise<void>;
type ModalHandler = (interaction: ModalSubmitInteraction) => Promise<void>;

type AllHandler = (interaction: Interaction) => Promise<void>;

export class ComponentManager {
  private buttons = new Map<string, ButtonHandler>();
  private selectMenus = new Map<string, SelectMenuHandler>();
  private modals = new Map<string, ModalHandler>();
  private defaultHandler: AllHandler | null = null;

  setDefaultHandler(handler: AllHandler): void {
    this.defaultHandler = handler;
  }

  registerButton(customId: string, handler: ButtonHandler): void {
    this.buttons.set(customId, handler);
  }

  registerSelectMenu(customId: string, handler: SelectMenuHandler): void {
    this.selectMenus.set(customId, handler);
  }

  registerModal(customId: string, handler: ModalHandler): void {
    this.modals.set(customId, handler);
  }

  async handleInteraction(interaction: Interaction): Promise<void> {
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
