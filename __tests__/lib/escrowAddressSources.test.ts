import { resolveEscrowAddressSources } from '@/lib/escrow/escrowAddressSources';

const FACTORY = '0x2e234DAe75C793f67A35089C9d99245E1C58470b';
const IMPL = '0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f';
const ARBITER = '0x9bB8e809EA6F5A74f46027D8016641D9cE9A149C';
const api = { factoryAddress: FACTORY, implementationAddress: IMPL, defaultArbiterAddress: ARBITER };

describe('resolveEscrowAddressSources', () => {
  const env = process.env;
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env = { ...env };
    delete process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS;
    delete process.env.NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS;
    delete process.env.NEXT_PUBLIC_DEFAULT_ARBITER_ADDRESS;
  });
  afterEach(() => {
    process.env = env;
    jest.restoreAllMocks();
  });

  it('falls back to the API when nothing is pinned', () => {
    expect(resolveEscrowAddressSources(api)).toEqual(api);
  });

  it('prefers the build-time value over the API', () => {
    process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS = FACTORY;
    const result = resolveEscrowAddressSources({ ...api, factoryAddress: FACTORY.toUpperCase() });
    expect(result.factoryAddress).toBe(FACTORY);
  });

  /**
   * The case this exists for. Whoever supplies the factory and implementation decides where
   * the money lands, so a disagreement is never something to resolve by picking one.
   */
  it('refuses when a pinned value disagrees with the API', () => {
    process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS = FACTORY;
    expect(() =>
      resolveEscrowAddressSources({
        ...api,
        factoryAddress: '0x1111111111111111111111111111111111111111'
      })
    ).toThrow(/Refusing to compute an escrow address/);
  });

  it('accepts a pinned value the API does not mention', () => {
    process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS = FACTORY;
    const result = resolveEscrowAddressSources({ ...api, factoryAddress: undefined });
    expect(result.factoryAddress).toBe(FACTORY);
  });

  it('throws rather than guessing when a value is missing entirely', () => {
    expect(() => resolveEscrowAddressSources({ ...api, implementationAddress: undefined })).toThrow(
      /implementationAddress is not available/
    );
  });

  it('is case-insensitive about agreement', () => {
    process.env.NEXT_PUBLIC_DEFAULT_ARBITER_ADDRESS = ARBITER.toLowerCase();
    expect(() => resolveEscrowAddressSources(api)).not.toThrow();
  });
});
