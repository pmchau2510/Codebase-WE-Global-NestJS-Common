import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { I18nContext, I18nValidationException } from 'nestjs-i18n';
import { DomainError } from '../errors/domain.error';
import { IntegrationError } from '../errors/integration.error';
import { flattenValidationErrors, getExceptionDetails, getI18nMessage } from './exception.helper';

function fakeI18n(translations: Record<string, string> = {}): I18nContext {
  return {
    t: (key: string) => translations[key] ?? key,
  } as unknown as I18nContext;
}

describe('getI18nMessage', () => {
  it('returns the raw message when no i18n context is given', () => {
    expect(getI18nMessage(undefined, 'SOME_CODE', 'fallback message')).toBe('fallback message');
  });

  it('translates by code when a translation exists (underscore codes key as errors.<prefix>.<code>)', () => {
    const i18n = fakeI18n({ 'errors.AUTH.AUTH_ERR_001': 'translated by code' });
    expect(getI18nMessage(i18n, 'AUTH_ERR_001', 'fallback')).toBe('translated by code');
  });

  it('falls back to translating the message key when the code has no translation', () => {
    const i18n = fakeI18n({ 'errors.Notfound': 'translated by message' });
    expect(getI18nMessage(i18n, 'UNKNOWN_CODE', 'Not found')).toBe('translated by message');
  });

  it('returns the raw message when neither code nor message translates', () => {
    const i18n = fakeI18n();
    expect(getI18nMessage(i18n, 'UNKNOWN_CODE', 'Not found')).toBe('Not found');
  });
});

describe('flattenValidationErrors', () => {
  it('flattens a single-level validation error', () => {
    const result = flattenValidationErrors(undefined, [{ property: 'email', constraints: { isEmail: 'email must be valid' } }]);
    expect(result).toEqual([{ field: 'email', error: 'email must be valid' }]);
  });

  it('flattens nested children with dotted field paths', () => {
    const result = flattenValidationErrors(undefined, [
      {
        property: 'profile',
        children: [{ property: 'age', constraints: { isInt: 'age must be an integer' } }],
      },
    ]);
    expect(result).toEqual([{ field: 'profile.age', error: 'age must be an integer' }]);
  });
});

describe('getExceptionDetails', () => {
  it('maps DomainError to its httpStatus/code/metadata', () => {
    const error = new DomainError('USER.NOT_FOUND', { httpStatus: 404, metadata: { id: '1' } });
    const details = getExceptionDetails(error);
    expect(details.status).toBe(404);
    expect(details.errorCode).toBe('USER.NOT_FOUND');
    expect(details.metadata).toEqual({ id: '1' });
  });

  it('maps IntegrationError to its status/code/data/metadata', () => {
    const error = IntegrationError.fromAxios(new Error('boom'), 'provider-x');
    const details = getExceptionDetails(error);
    expect(details.status).toBe(HttpStatus.BAD_REQUEST);
    expect(details.errorCode).toBe('INTEGRATION_UNKNOWN');
    expect(details.message).toBe('boom');
  });

  it('maps a plain HttpException with a raw string response', () => {
    const details = getExceptionDetails(new HttpException('Bad input', HttpStatus.BAD_REQUEST));
    expect(details.status).toBe(HttpStatus.BAD_REQUEST);
    expect(details.errorCode).toBe('BADINPUT');
    expect(details.message).toBe('Bad input');
  });

  it('maps a convenience exception (object response) using its `error` field as the code', () => {
    const details = getExceptionDetails(new BadRequestException('Bad input'));
    expect(details.status).toBe(HttpStatus.BAD_REQUEST);
    expect(details.errorCode).toBe('Bad Request');
    expect(details.message).toBe('Bad input');
  });

  it('maps an HttpException with an object response', () => {
    const details = getExceptionDetails(new HttpException({ error: 'CUSTOM_CODE', message: 'custom message' }, HttpStatus.CONFLICT));
    expect(details.status).toBe(HttpStatus.CONFLICT);
    expect(details.errorCode).toBe('CUSTOM_CODE');
    expect(details.message).toBe('custom message');
  });

  it('maps I18nValidationException to VALIDATION_ERROR with flattened fields', () => {
    const error = new I18nValidationException([{ property: 'email', constraints: { isEmail: 'email must be valid' } }]);
    const details = getExceptionDetails(error);
    expect(details.status).toBe(HttpStatus.BAD_REQUEST);
    expect(details.errorCode).toBe('VALIDATION_ERROR');
    expect(details.message).toEqual([{ field: 'email', error: 'email must be valid' }]);
  });

  it('maps an RPC-style plain object with status/code/message', () => {
    const details = getExceptionDetails({ status: 409, code: 'CONFLICT', message: 'already exists' });
    expect(details.status).toBe(409);
    expect(details.errorCode).toBe('CONFLICT');
    expect(details.message).toBe('already exists');
  });

  it('maps a plain Error to its message with default status', () => {
    const details = getExceptionDetails(new Error('unexpected'));
    expect(details.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(details.errorCode).toBe('INTERNAL_SERVER_ERROR');
    expect(details.message).toBe('unexpected');
  });

  it('falls back to a generic message for unrecognized values', () => {
    const details = getExceptionDetails(null);
    expect(details.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(details.message).toBe('Internal server error');
  });
});
