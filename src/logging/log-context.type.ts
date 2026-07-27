export type LogContext = {
  traceId?: string;
  userId?: string;
  tenantId?: string;
  source?: string;
  extra?: Record<string, unknown>;
  notify?: boolean;
};
