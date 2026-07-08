export interface DomainErrorOptions<TError = unknown> {
  httpStatus?: number;
  originalError?: TError;
  message?: string;
  metadata?: Record<string, unknown>;
}

export class DomainError<TError = unknown> extends Error {
  readonly isDomainError = true;

  public readonly httpStatus: number;
  public readonly originalError?: TError;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    public readonly code: string,
    options: DomainErrorOptions<TError> = {},
  ) {
    super(options.message ?? code);

    this.httpStatus = options.httpStatus ?? 500;
    this.originalError = options.originalError;
    this.metadata = options.metadata;

    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;

    const captureStackTrace = (Error as unknown as { captureStackTrace?: (target: object, ctor?: unknown) => void }).captureStackTrace;
    captureStackTrace?.(this, this.constructor);
  }
}
