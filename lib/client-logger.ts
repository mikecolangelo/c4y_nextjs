/**
 * Lightweight logger for Client Components.
 *
 * The pino logger in `@/lib/logger` is meant for server-side code (it would add
 * unnecessary weight to the browser bundle). In the browser we wrap `console`
 * instead, gated by environment:
 *   - `debug`/`info`: development only (also stripped from production by
 *     `compiler.removeConsole` in next.config.js).
 *   - `warn`/`error`: always kept, mirroring the removeConsole `exclude` list,
 *     so real problems remain visible in production.
 *
 * Use this in "use client" components instead of calling `console.*` directly.
 */
type LogFn = (...args: unknown[]) => void;

const noop: LogFn = () => {};
const isDevelopment = process.env.NODE_ENV !== "production";

export const clientLogger = {
  debug: isDevelopment ? console.debug.bind(console) : noop,
  info: isDevelopment ? console.info.bind(console) : noop,
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};
