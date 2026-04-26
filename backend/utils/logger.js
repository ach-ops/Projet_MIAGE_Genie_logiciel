// Logger avec niveaux et timestamps.
const levels = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = levels[process.env.LOG_LEVEL] ?? levels.info;

function format(level, message, meta) {
  const ts = new Date().toISOString();
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  return `[${ts}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  debug: (msg, meta) => { if (currentLevel <= levels.debug) console.debug(format('debug', msg, meta)); },
  info:  (msg, meta) => { if (currentLevel <= levels.info)  console.info(format('info',  msg, meta)); },
  warn:  (msg, meta) => { if (currentLevel <= levels.warn)  console.warn(format('warn',  msg, meta)); },
  error: (msg, meta) => { if (currentLevel <= levels.error) console.error(format('error', msg, meta)); },
};
