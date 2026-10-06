import dotenv from 'dotenv';

dotenv.config();

import { logger } from './logger';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    logger.error('Env', `Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.error('Env', `Invalid ${name}: expected a positive integer, got "${raw}"`);
    process.exit(1);
  }
  return parsed;
}

export const env = {
  DISCORD_TOKEN: required('DISCORD_TOKEN'),
  CLIENT_ID: required('CLIENT_ID'),
  CLIENT_SECRET: required('CLIENT_SECRET'),
  FILTER_CHANNEL_NAME: process.env.FILTER_CHANNEL_NAME ?? 'filter-channel',
  FILTER_ACTION: (process.env.FILTER_ACTION === 'timeout' ? 'timeout' : 'ban') as 'ban' | 'timeout',
  FILTER_TIMEOUT_MINUTES: Math.min(positiveInt('FILTER_TIMEOUT_MINUTES', 1440), 28 * 24 * 60),
  REPORT_CHANNEL_ID: process.env.REPORT_CHANNEL_ID ?? '',
  MOD_LOG_CHANNEL_ID: process.env.MOD_LOG_CHANNEL_ID ?? '',
  GUILD_ID: process.env.GUILD_ID,
};
