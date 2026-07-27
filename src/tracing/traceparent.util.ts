import { randomBytes } from 'crypto';

export interface ParsedTraceparent {
  traceId: string; // 32 hex chars (128-bit)
  parentId: string; // 16 hex chars (64-bit)
  flags: string; // 2 hex chars
}

/**
 * Parse a W3C traceparent header (RFC).
 * Format: 00-{traceId}-{parentId}-{flags}
 * Returns null if invalid.
 */
export function parseTraceparent(header: string): ParsedTraceparent | null {
  if (!header) return null;
  const parts = header.split('-');
  if (parts.length !== 4) return null;

  const [version, traceId, parentId, flags] = parts;
  if (version !== '00') return null;
  if (!/^[0-9a-f]{32}$/.test(traceId) || traceId === '0'.repeat(32)) return null;
  if (!/^[0-9a-f]{16}$/.test(parentId) || parentId === '0'.repeat(16)) return null;
  if (!/^[0-9a-f]{2}$/.test(flags)) return null;

  return { traceId, parentId, flags };
}

/**
 * Build a traceparent header string.
 * If traceId is provided, reuse it (same trace, new span).
 * Otherwise generate a completely fresh trace.
 */
export function buildTraceparent(traceId?: string): { header: string; traceId: string; spanId: string } {
  const tid = traceId ?? randomBytes(16).toString('hex');
  const spanId = randomBytes(8).toString('hex');
  return { header: `00-${tid}-${spanId}-01`, traceId: tid, spanId };
}
