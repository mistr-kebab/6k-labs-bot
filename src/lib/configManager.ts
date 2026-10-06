import fs from 'fs';
import path from 'path';

export interface Warning {
  id: string;
  userId: string;
  moderatorId: string;
  reason: string;
  timestamp: number;
}

export interface GuildConfig {
  filterChannelId?: string;
  embedMessageId?: string;
  banCount?: number;
  warnings?: Record<string, Warning[]>;
  reportStickyMessageId?: string;
}

interface Config {
  guilds: Record<string, GuildConfig>;
}

const CONFIG_PATH = path.resolve(__dirname, '..', '..', 'config.json');

function readConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as Config;
  } catch {
    const defaultConfig: Config = { guilds: {} };
    writeConfig(defaultConfig);
    return defaultConfig;
  }
}

function writeConfig(config: Config): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getGuildConfig(guildId: string): GuildConfig {
  const config = readConfig();
  const guild = config.guilds[guildId] ?? {};
  return {
    banCount: guild.banCount ?? 0,
    embedMessageId: guild.embedMessageId,
    filterChannelId: guild.filterChannelId,
    warnings: guild.warnings ?? {},
    reportStickyMessageId: guild.reportStickyMessageId,
  };
}

export function setGuildConfig(guildId: string, guildConfig: GuildConfig): void {
  const config = readConfig();
  config.guilds[guildId] = guildConfig;
  writeConfig(config);
}

export function updateGuildConfig(guildId: string, partial: Partial<GuildConfig>): GuildConfig {
  const config = readConfig();
  const merged: GuildConfig = { ...(config.guilds[guildId] ?? {}), ...partial };
  config.guilds[guildId] = merged;
  writeConfig(config);
  return merged;
}

export function addWarning(guildId: string, warning: Warning): Warning {
  const config = readConfig();
  const guild = config.guilds[guildId] ?? {};
  const warnings = guild.warnings ?? {};
  const userWarnings = warnings[warning.userId] ?? [];
  userWarnings.push(warning);
  warnings[warning.userId] = userWarnings;
  guild.warnings = warnings;
  config.guilds[guildId] = guild;
  writeConfig(config);
  return warning;
}

export function removeWarning(guildId: string, userId: string, warningId: string): Warning | null {
  const config = readConfig();
  const guild = config.guilds[guildId] ?? {};
  const warnings = guild.warnings ?? {};
  const userWarnings = warnings[userId] ?? [];
  const index = userWarnings.findIndex((w) => w.id === warningId);
  if (index === -1) return null;
  const removed = userWarnings.splice(index, 1)[0];
  if (userWarnings.length === 0) {
    delete warnings[userId];
  } else {
    warnings[userId] = userWarnings;
  }
  guild.warnings = warnings;
  config.guilds[guildId] = guild;
  writeConfig(config);
  return removed;
}

export function getUserWarnings(guildId: string, userId: string): Warning[] {
  const config = readConfig();
  return config.guilds[guildId]?.warnings?.[userId] ?? [];
}

export function getAllWarnings(guildId: string): Warning[] {
  const config = readConfig();
  const warnings = config.guilds[guildId]?.warnings ?? {};
  return Object.values(warnings).flat();
}
