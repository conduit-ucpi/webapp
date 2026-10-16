/**
 * The API reference through the API layer: the language and the partner brand reach ap2service,
 * and nothing else from the query string does.
 */
import { createMocks } from 'node-mocks-http';
import docHandler from '@/pages/api/ap2/settle/doc';
import specHandler from '@/pages/api/ap2/openapi.json';
import spanishSpecHandler from '@/pages/api/ap2/openapi.es.json';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ status: 200, text: async () => '<html></html>', json: async () => ({}) });
  global.fetch = fetchMock as any;
  process.env.AP2_SERVICE_URL = 'http://ap2service:8984';
});

describe('/api/ap2/settle/doc', () => {
  it('passes the brand and the language on', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { b: 'cobro', lang: 'es' } });
    await docHandler(req as any, res as any);
    expect(fetchMock.mock.calls[0][0]).toBe('http://ap2service:8984/settle/doc?lang=es&b=cobro');
  });

  it('keeps ReDoc and the brand together', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { redoc: '', b: 'cobro' } });
    await docHandler(req as any, res as any);
    expect(fetchMock.mock.calls[0][0]).toBe('http://ap2service:8984/settle/doc/redoc?b=cobro');
  });

  it('drops a brand that is not a slug and anything it does not know', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { b: '../admin', lang: 'fr', x: '1' } });
    await docHandler(req as any, res as any);
    expect(fetchMock.mock.calls[0][0]).toBe('http://ap2service:8984/settle/doc');
  });
});

describe('the specs', () => {
  it.each([
    [specHandler, 'openapi.json'],
    [spanishSpecHandler, 'openapi.es.json'],
  ])('passes the brand on (%#)', async (handler, file) => {
    const { req, res } = createMocks({ method: 'GET', query: { b: 'cobro' } });
    await (handler as any)(req, res);
    expect(fetchMock.mock.calls[0][0]).toBe(`http://ap2service:8984/${file}?b=cobro`);
  });

  it('drops a brand that is not a slug', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { b: 'Cobro&x=1' } });
    await specHandler(req as any, res as any);
    expect(fetchMock.mock.calls[0][0]).toBe('http://ap2service:8984/openapi.json');
  });
});
