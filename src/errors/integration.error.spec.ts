import { AxiosError } from 'axios';
import { IntegrationError } from './integration.error';

function axiosError(overrides: Partial<AxiosError> = {}): AxiosError {
  return {
    isAxiosError: true,
    name: 'AxiosError',
    message: 'Request failed',
    toJSON: () => ({}),
    ...overrides,
  } as AxiosError;
}

describe('IntegrationError.fromAxios', () => {
  it('classifies ECONNABORTED as a timeout', () => {
    const err = IntegrationError.fromAxios(axiosError({ code: 'ECONNABORTED' }), 'provider-x');
    expect(err.code).toBe('INTEGRATION_TIMEOUT');
    expect(err.provider).toBe('provider-x');
  });

  it('classifies a missing response as a network error', () => {
    const err = IntegrationError.fromAxios(axiosError({ response: undefined }), 'provider-x');
    expect(err.code).toBe('INTEGRATION_NETWORK_ERROR');
  });

  it.each([
    [400, 'INTEGRATION_BAD_REQUEST'],
    [401, 'INTEGRATION_UNAUTHORIZED'],
    [403, 'INTEGRATION_FORBIDDEN'],
    [404, 'INTEGRATION_NOT_FOUND'],
    [429, 'INTEGRATION_RATE_LIMIT'],
    [500, 'INTEGRATION_SERVER_ERROR'],
    [503, 'INTEGRATION_SERVER_ERROR'],
  ])('maps HTTP status %i to %s', (status, expectedCode) => {
    const err = IntegrationError.fromAxios(
      axiosError({ response: { status, data: { message: 'provider said no' } } as never }),
      'provider-x',
    );
    expect(err.code).toBe(expectedCode);
    expect(err.status).toBe(status);
    expect(err.message).toBe('provider said no');
  });

  it('wraps a plain Error as INTEGRATION_UNKNOWN', () => {
    const err = IntegrationError.fromAxios(new Error('boom'), 'provider-x');
    expect(err.code).toBe('INTEGRATION_UNKNOWN');
    expect(err.message).toBe('boom');
  });

  it('wraps a non-Error value as INTEGRATION_UNKNOWN', () => {
    const err = IntegrationError.fromAxios('just a string', 'provider-x');
    expect(err.code).toBe('INTEGRATION_UNKNOWN');
    expect(err.message).toBe('just a string');
  });

  it('sets isIntegrationError and name on every instance', () => {
    const err = IntegrationError.fromAxios(new Error('boom'), 'provider-x');
    expect(err.isIntegrationError).toBe(true);
    expect(err.name).toBe('IntegrationError');
  });
});
