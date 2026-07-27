import { HttpException, HttpStatus } from '@nestjs/common';
import { I18nContext, I18nValidationError, I18nValidationException } from 'nestjs-i18n';
import { DomainError } from '../errors/domain.error';
import { IntegrationError } from '../errors/integration.error';

/** i18n key looked up for the fallback message when no other source yields one. Add this key to your own translation files to customize it. */
export const DEFAULT_ERROR_I18N_KEY = 'errors.internal_server_error';

export interface ExceptionDetails {
  status: number;
  errorCode: string;
  message: string | unknown[];
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function flattenValidationErrors(
  i18n: I18nContext | undefined,
  validationErrors: I18nValidationError[],
  parentPath = '',
): Array<{ field: string; error: string }> {
  const results: Array<{ field: string; error: string }> = [];

  for (const error of validationErrors) {
    const currentPath = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      results.push({
        field: currentPath,
        error: Object.values(error.constraints)
          .map((msg) => getI18nMessage(i18n, undefined, msg))
          .join('. '),
      });
    }

    if (error.children && error.children.length > 0) {
      results.push(...flattenValidationErrors(i18n, error.children, currentPath));
    }
  }

  return results;
}

export function getI18nMessage(i18n: I18nContext | undefined, code: string | undefined, message: string | undefined): string | undefined {
  if (!i18n) return message;

  if (code && code !== 'HTTP_ERROR' && code !== 'INTERNAL_SERVER_ERROR') {
    const prefix = code.split('_')[0];
    const codeKey = code.includes('.') ? `errors.${code}` : code.includes('_') ? `errors.${prefix}.${code}` : `errors.${code}`;
    const translated = i18n.t(codeKey);
    if (typeof translated === 'string' && translated !== codeKey) return translated;
  }

  if (message) {
    const messageKey = message.startsWith('errors.') ? message : `errors.${message.replace(/\s+/g, '')}`;
    const translated = i18n.t(messageKey);
    if (typeof translated === 'string' && translated !== messageKey) return translated;
  }

  return message;
}

export function getExceptionDetails(exception: unknown, i18n?: I18nContext): ExceptionDetails {
  let status = HttpStatus.INTERNAL_SERVER_ERROR;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message: string | unknown[] | undefined;
  let data: Record<string, unknown> | undefined;
  let metadata: Record<string, unknown> | undefined;

  if (exception instanceof I18nValidationException) {
    status = HttpStatus.BAD_REQUEST;
    errorCode = 'VALIDATION_ERROR';
    message = flattenValidationErrors(i18n, exception.errors ?? []);
  } else if (
    exception instanceof IntegrationError ||
    (typeof exception === 'object' && exception !== null && (exception as Record<string, unknown>).isIntegrationError)
  ) {
    const err = exception as Record<string, unknown>;
    status = (err.status as number) || HttpStatus.BAD_REQUEST;
    errorCode = err.code as string;
    message = getI18nMessage(i18n, errorCode, err.message as string);
    data = err.errors as Record<string, unknown>;
    metadata = err.metadata as Record<string, unknown>;
  } else if (
    exception instanceof DomainError ||
    (typeof exception === 'object' && exception !== null && (exception as Record<string, unknown>).isDomainError)
  ) {
    const err = exception as DomainError;
    status = err.httpStatus;
    errorCode = err.code;
    message = getI18nMessage(i18n, errorCode, err.message);
    metadata = err.metadata;
  } else if (exception instanceof HttpException) {
    const res = exception.getResponse();
    if (typeof res === 'object' && res !== null && (res as Record<string, unknown>).isIntegrationError) {
      const resObj = res as Record<string, unknown>;
      status = exception.getStatus();
      errorCode = resObj.code as string;
      message = getI18nMessage(i18n, errorCode, resObj.message as string);
      data = resObj.errors as Record<string, unknown>;
      metadata = resObj.metadata as Record<string, unknown>;
    } else {
      status = exception.getStatus();
      if (typeof res === 'string') {
        errorCode = res.replace(/\s+/g, '').toUpperCase();
        message = getI18nMessage(i18n, undefined, res);
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        errorCode = (resObj.error as string) || (resObj.code as string) || 'HTTP_ERROR';
        message = getI18nMessage(i18n, errorCode, resObj.message as string);
      }
    }
  } else if (typeof exception === 'object' && exception !== null && ('status' in exception || 'statusCode' in exception) && 'message' in exception) {
    const resObj = exception as Record<string, unknown>;
    status = (resObj.status as number) || (resObj.statusCode as number) || HttpStatus.INTERNAL_SERVER_ERROR;
    errorCode = (resObj.code as string) || (resObj.error as string) || 'RPC_ERROR';
    message = getI18nMessage(i18n, errorCode, resObj.message as string);
    data = resObj.data as Record<string, unknown>;
    metadata = resObj.metadata as Record<string, unknown>;
  } else if (exception instanceof Error) {
    message = getI18nMessage(i18n, undefined, exception.message);
  }

  return {
    status,
    errorCode,
    message: message || i18n?.t(DEFAULT_ERROR_I18N_KEY, { defaultValue: 'Internal server error' }) || 'Internal server error',
    data,
    metadata,
  };
}
