const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '..', '..', 'config.json');

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const defaultConfig = { guilds: {} };
    writeConfig(defaultConfig);
    return defaultConfig;
  }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function getGuildConfig(guildId) {
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

function setGuildConfig(guildId, guildConfig) {
  const config = readConfig();
  config.guilds[guildId] = guildConfig;
  writeConfig(config);
}

function updateGuildConfig(guildId, partial) {
  const config = readConfig();
  const merged = { ...(config.guilds[guildId] ?? {}), ...partial };
  config.guilds[guildId] = merged;
  writeConfig(config);
  return merged;
}

function addWarning(guildId, warning) {
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

function removeWarning(guildId, userId, warningId) {
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

function getUserWarnings(guildId, userId) {
  const config = readConfig();
  return config.guilds[guildId]?.warnings?.[userId] ?? [];
}

function getAllWarnings(guildId) {
  const config = readConfig();
  const warnings = config.guilds[guildId]?.warnings ?? {};
  return Object.values(warnings).flat();
}

module.exports = {
  getGuildConfig,
  setGuildConfig,
  updateGuildConfig,
  addWarning,
  removeWarning,
  getUserWarnings,
  getAllWarnings,
};
