/**
 * A modal's panel is white in dark mode too, and most modals are written for that. Content written
 * with `dark:` classes (anything that also appears on a page, such as the ways to add funds)
 * turned pale-on-white in dark mode there. Such a modal asks to follow the page's theme instead.
 */
import { render, screen } from '@testing-library/react';
import Modal from '@/components/ui/Modal';

const panel = () => screen.getByRole('dialog').querySelector('[class*="rounded-2xl"]') as HTMLElement;

describe('Modal', () => {
  it('is white with dark text in both themes unless asked otherwise', () => {
    render(<Modal isOpen onClose={jest.fn()} title="Plain">body</Modal>);
    expect(panel().className).toContain('bg-white');
    expect(panel().className).toContain('text-gray-900');
    expect(panel().className).not.toContain('dark:');
  });

  it('follows the page into dark mode when themed: dark panel, light text, light title', () => {
    render(<Modal isOpen onClose={jest.fn()} title="Themed" themed>body</Modal>);
    expect(panel().className).toContain('dark:bg-secondary-900');
    expect(panel().className).toContain('dark:text-white');
    expect(screen.getByRole('heading', { name: 'Themed' }).className).toContain('dark:text-white');
  });
});
