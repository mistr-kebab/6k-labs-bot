const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

export const logger = {
  info: (tag: string, message: string) => {
    console.log(`${GREEN}[${tag}]${RESET} ${message}`);
  },

  warn: (tag: string, message: string) => {
    console.log(`${YELLOW}[${tag}]${RESET} ${message}`);
  },

  error: (tag: string, message: string) => {
    console.log(`${RED}[${tag}]${RESET} ${message}`);
  },
};
