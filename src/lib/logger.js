const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const logger = {
  info: (tag, message) => {
    console.log(`${GREEN}[${tag}]${RESET} ${message}`);
  },

  warn: (tag, message) => {
    console.log(`${YELLOW}[${tag}]${RESET} ${message}`);
  },

  error: (tag, message) => {
    console.log(`${RED}[${tag}]${RESET} ${message}`);
  },
};

module.exports = { logger };
