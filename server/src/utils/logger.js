// Minimal timestamped logger. Never pass passwords, tokens, or request bodies to it.
const stamp = () => new Date().toISOString();

export const logger = {
  info: (...args) => console.log(stamp(), 'INFO ', ...args),
  warn: (...args) => console.warn(stamp(), 'WARN ', ...args),
  error: (...args) => console.error(stamp(), 'ERROR', ...args),
};

// Used by tests to keep output clean
export const silentLogger = { info() {}, warn() {}, error() {} };
