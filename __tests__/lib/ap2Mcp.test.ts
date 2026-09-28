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
});
