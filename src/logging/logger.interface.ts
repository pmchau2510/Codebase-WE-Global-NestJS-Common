import { LogContext } from './log-context.type';

export interface ILogger {
  trace(message: string, data?: unknown, ctx?: LogContext): void;
  debug(message: string, data?: unknown, ctx?: LogContext): void;
  info(message: string, data?: unknown, ctx?: LogContext): void;
  warn(message: string, data?: unknown, ctx?: LogContext): void;
  error(message: string, data?: unknown, ctx?: LogContext): void;
  fatal(message: string, data?: unknown, ctx?: LogContext): void;
}
