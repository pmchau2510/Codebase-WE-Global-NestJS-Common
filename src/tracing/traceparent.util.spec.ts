import { buildTraceparent, parseTraceparent } from './traceparent.util';

describe('parseTraceparent', () => {
  it('parses a valid W3C traceparent header', () => {
    const header = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    expect(parseTraceparent(header)).toEqual({
      traceId: '0af7651916cd43dd8448eb211c80319c',
      parentId: 'b7ad6b7169203331',
      flags: '01',
    });
  });

  it.each(['', 'not-a-header', '01-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01', '00-' + '0'.repeat(32) + '-b7ad6b7169203331-01'])(
    'returns null for invalid header: %s',
    (header) => {
      expect(parseTraceparent(header)).toBeNull();
    },
  );
});

describe('buildTraceparent', () => {
  it('generates a fresh 32-hex traceId and 16-hex spanId when none given', () => {
    const { header, traceId, spanId } = buildTraceparent();
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(header).toBe(`00-${traceId}-${spanId}-01`);
  });

  it('reuses the given traceId for a new span', () => {
    const traceId = '0af7651916cd43dd8448eb211c80319c';
    const result = buildTraceparent(traceId);
    expect(result.traceId).toBe(traceId);
    expect(result.header.startsWith(`00-${traceId}-`)).toBe(true);
  });
});
