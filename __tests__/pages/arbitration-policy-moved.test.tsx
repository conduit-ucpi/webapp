import { render } from '@testing-library/react';
import ArbitrationPolicyMoved from '@/pages/arbitration-policy';

const replace = jest.fn();
jest.mock('next/router', () => ({ useRouter: () => ({ replace }) }));
jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const nextConfig = require('../../next.config.js');

/** The policy page moved to /dispute-policy; old links must still land on it, on the box and in the static export. */
describe('/arbitration-policy', () => {
  it('sends the reader to /dispute-policy, with and without JavaScript', () => {
    const { getByRole } = render(<ArbitrationPolicyMoved />);
    expect(replace).toHaveBeenCalledWith('/dispute-policy');
    expect(document.querySelector('meta[http-equiv="refresh"]')?.getAttribute('content')).toBe('0; url=../dispute-policy/');
    expect(getByRole('link', { name: 'dispute policy' }).getAttribute('href')).toBe('/dispute-policy');
  });

  it('is a permanent redirect on the box', async () => {
    const redirects = await nextConfig.redirects();
    expect(redirects).toContainEqual({ source: '/arbitration-policy', destination: '/dispute-policy', permanent: true });
  });
});
