/**
 * /plugins links to the escrow API's reference where everyone can see it, not only inside the
 * collapsed AI-agents panel.
 */
import { render } from '@testing-library/react';

jest.mock('@/lib/tracking', () => ({ initRedditPixel: jest.fn(), trackConversion: jest.fn() }));
jest.mock('@/hooks/usePageTracking', () => ({ useScrollTracking: jest.fn(), useTimeTracking: jest.fn() }));
// framer-motion's in-view animation needs IntersectionObserver, which jsdom lacks.
jest.mock('@/components/ui/Fade', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('next/router', () => ({ useRouter: () => ({ pathname: '/plugins', query: {}, asPath: '/plugins' }) }));

import PluginsPage from '@/pages/plugins';
import { API_DOCS_URL } from '@/lib/apiDocs';

it('links to the API reference from the page itself', () => {
  const { container } = render(<PluginsPage />);
  const links = Array.from(container.querySelectorAll('a')).filter((a) => /API reference/i.test(a.textContent || ''));
  expect(links.length).toBeGreaterThan(0);
  links.forEach((a) => expect(a.getAttribute('href')).toBe(API_DOCS_URL));
});
