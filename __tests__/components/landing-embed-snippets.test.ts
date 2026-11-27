/**
 * The homepage's "Integrations" snippets work when pasted: the JavaScript one loads a file we
 * serve, from our own domain, and its button opens the checkout; the MCP config is valid and
 * names the MCP route that exists; the other tabs link to pages that exist.
 */
import * as fs from 'fs';
import * as path from 'path';
import { API_PLACEHOLDER, EMBED_EXAMPLES, MCP_PATH } from '@/components/landing-test/content';
import { runCheckoutSnippet } from '../../test-utils/checkoutSnippet';

const example = (key: string) => {
  const e = EMBED_EXAMPLES.find((x) => x.key === key);
  if (!e) throw new Error(`no ${key} example`);
  return e;
};
const pageExists = (route: string) =>
  ['.tsx', '.ts', '/index.tsx'].some((ext) => fs.existsSync(path.join(__dirname, '../../pages', route + ext)));

it('has a snippet for every integration tab', () => {
  expect(EMBED_EXAMPLES.map((e) => e.key).sort()).toEqual(['javascript', 'mcp', 'shopify', 'wordpress']);
});

describe('JavaScript snippet', () => {
  const { code } = example('javascript');

  it('loads the SDK from stabledrop.me, never the old conduit-ucpi.com domain', () => {
    expect(code).not.toContain('conduit-ucpi.com');
    const run = runCheckoutSnippet(code, { allowedOrigins: ['https://stabledrop.me'] });
    expect(run.scriptSrcs).toEqual(['https://stabledrop.me/conduit-checkout.js']);
  });

  it('initialises and opens the checkout for the amount on its button', () => {
    const run = runCheckoutSnippet(code, { allowedOrigins: ['https://stabledrop.me'] });
    expect(run.initOptions).toMatchObject({ sellerAddress: expect.any(String), baseUrl: 'https://stabledrop.me' });
    expect(run.opened).toHaveLength(1);
    const [checkout] = run.opened;
    expect(checkout.origin).toBe('https://stabledrop.me');
    expect(checkout.pathname).toBe('/contract-create');
    expect(checkout.searchParams.get('amount')).toBe('99.99');
    expect(checkout.searchParams.get('description')).toBe('Product Name');
    expect(checkout.searchParams.get('seller')).toBe(run.initOptions!.sellerAddress);
  });
});

describe('MCP snippet', () => {
  const { code } = example('mcp');

  it('points every client at the MCP route the site serves', () => {
    expect(fs.existsSync(path.join(__dirname, '../../pages/api', MCP_PATH.replace(/^\/api/, '') + '.ts'))).toBe(true);
    const urls = code.match(new RegExp(`\\${API_PLACEHOLDER}[^\\s"]*`, 'g')) || [];
    expect(urls).toHaveLength(3);
    urls.forEach((u) => expect(u.startsWith(`${API_PLACEHOLDER}${MCP_PATH}`)).toBe(true));
  });

  it('gives a JSON config that parses', () => {
    // The JSON block is the one that starts on a line of its own ({api} is a placeholder, not JSON).
    const json = code.slice(code.indexOf('\n{') + 1, code.indexOf('\n}') + 2);
    const config = JSON.parse(json);
    expect(config.mcpServers.stabledrop.url).toBe(`${API_PLACEHOLDER}${MCP_PATH}`);
    expect(config.mcpServers.stabledrop.headers.Authorization).toMatch(/^Bearer /);
  });
});

it('links the Shopify and WordPress tabs somewhere real', () => {
  expect(pageExists(example('shopify').link.href)).toBe(true);
  expect(example('wordpress').link.href).toMatch(/^https:\/\/wordpress\.org\/plugins\//);
  expect(pageExists(example('javascript').link.href)).toBe(true);
});
