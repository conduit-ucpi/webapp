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

it('links to the API reference in plain sight, from the hero, without opening any panel', () => {
  const { container } = render(<PluginsPage />);
  const hero = container.querySelector('section[aria-label="Hero"]');
  const heroLink = Array.from(hero!.querySelectorAll('a')).find((a) => /API reference/i.test(a.textContent || ''));
  expect(heroLink?.getAttribute('href')).toBe(API_DOCS_URL);

  // And every other visible link to it (the footer) points at the same reference.
  const links = Array.from(container.querySelectorAll('a')).filter((a) => /API reference/i.test(a.textContent || ''));
  expect(links.length).toBeGreaterThanOrEqual(2);
  links.forEach((a) => expect(a.getAttribute('href')).toBe(API_DOCS_URL));
});
