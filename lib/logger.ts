import pino from "pino";

/**
 * Central application logger backed by pino.
 *
 * Use this instead of `console.*` so that log output is controlled in a single
 * place and can be silenced in production to avoid runtime cost and noise.
 *
 * Levels by environment (override with the `LOG_LEVEL` env var):
 *   - development: `debug` — verbose, everything visible while coding.
 *   - test:        `silent` — keeps the vitest output clean.
 *   - production:  `warn`  — only warnings and errors reach the terminal.
 *
 * Note: a plain pino instance is used (no `pino-pretty` transport) on purpose,
 * because transport worker threads do not bundle reliably inside Next.js. For
 * pretty local output you can pipe the dev server through pino-pretty.
 * Remaining stray `console.*` calls are additionally stripped from the
 * production bundle via `compiler.removeConsole` in `next.config.js`.
 */
const resolveLevel = (): pino.LevelWithSilent => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL as pino.LevelWithSilent;
  }
  switch (process.env.NODE_ENV) {
    case "production":
      return "warn";
    case "test":
      return "silent";
    default:
      return "debug";
  }
};

export const logger = pino({
  level: resolveLevel(),
  base: undefined,
});

export type Logger = typeof logger;
