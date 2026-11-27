/**
 * The page's one door to ap2service: an MCP tools/call through /api/ap2/mcp.
 */

import { callAp2Tool, isAp2ToolError } from '@/lib/ap2Mcp';

const reply = (status: number, body: unknown) =>
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('callAp2Tool', () => {
  it('posts a JSON-RPC tools/call to the MCP proxy', async () => {
    reply(200, { result: { structuredContent: { escrow_address: '0xabc' }, content: [] } });

    const result = await callAp2Tool('prepare_escrow_payment', { amount: 1 });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/api\/ap2\/mcp$/);
    expect(JSON.parse(init.body)).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'prepare_escrow_payment', arguments: { amount: 1 } },
    });
    expect(result).toEqual({ escrow_address: '0xabc' });
  });

  it('falls back to the text content when there is no structured copy', async () => {
    reply(200, { result: { content: [{ type: 'text', text: '{"status":"settled"}' }] } });
    expect(await callAp2Tool('settle_escrow_payment', {})).toEqual({ status: 'settled' });
  });

  it("returns a tool's own refusal for the page to show", async () => {
    reply(200, { result: { structuredContent: { error: 'amount_too_small', message: 'too small' }, content: [] } });
    const result = await callAp2Tool('prepare_escrow_payment', {});
    expect(isAp2ToolError(result)).toBe(true);
  });

  it('turns a tool that raised into a refusal carrying its message', async () => {
    reply(200, { result: { isError: true, content: [{ type: 'text', text: 'boom' }] } });
    expect(await callAp2Tool('prepare_escrow_payment', {})).toEqual({ error: 'tool_error', message: 'boom' });
  });

  it('throws on a transport or protocol failure', async () => {
    reply(502, {});
    await expect(callAp2Tool('prepare_escrow_payment', {})).rejects.toThrow('502');
    reply(200, { error: { message: 'Unknown tool' } });
    await expect(callAp2Tool('nope', {})).rejects.toThrow('Unknown tool');
  });

  describe('with the page\'s authenticatedFetch', () => {
    const toolReply = (body: unknown) =>
      ({ ok: true, status: 200, json: async () => ({ result: { structuredContent: body, content: [] } }) }) as Response;

    it('sends every call through it, so the session travels with the tool call', async () => {
      const fetcher = jest.fn().mockResolvedValueOnce(toolReply({ escrow_address: '0xabc' }));

      await callAp2Tool('prepare_escrow_payment', { amount: 1 }, { fetcher });

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher.mock.calls[0][0]).toBe('/api/ap2/mcp');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('signs the user in and tries once more when a tool needs an access code', async () => {
      const fetcher = jest
        .fn()
        .mockResolvedValueOnce(toolReply({ error: 'api_access_required', reason: 'missing', message: 'sign in' }))
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response)
        .mockResolvedValueOnce(toolReply({ status: 'settled' }));

      const result = await callAp2Tool('settle_escrow_payment', {}, { fetcher });

      expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['/api/ap2/mcp', '/api/auth/identity', '/api/ap2/mcp']);
      expect(result).toEqual({ status: 'settled' });
    });

    it('gives up after one retry, returning the refusal for the page to show', async () => {
      const refusal = { error: 'api_access_required', reason: 'terms_changed', message: 'terms changed' };
      const fetcher = jest
        .fn()
        .mockResolvedValueOnce(toolReply(refusal))
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response)
        .mockResolvedValueOnce(toolReply(refusal));

      expect(await callAp2Tool('settle_escrow_payment', {}, { fetcher })).toEqual(refusal);
      expect(fetcher).toHaveBeenCalledTimes(3);
    });
  });
});
