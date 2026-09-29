/**
 * A partner's rewording of catalogue strings. The service stores them as plain
 * strings; the SDK holds them to the catalogue it ships. The rule that matters
 * most: an override may not drop or invent a {placeholder}, because a payment
 * sentence missing its {amount} tells the payer something different.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { I18nProvider, useT, sanitizeOverrides, placeholderSet } from '@conduit-ucpi/whitelabel-sdk';

describe('sanitizeOverrides', () => {
  const catalogue = {
    'create.title': 'Time-locked payment request',
    'create.getStarted': 'Get Started with {brand}',
  };

  it('accepts a rewording that keeps the placeholders', () => {
    const r = sanitizeOverrides({ 'create.getStarted': 'Start with {brand} today' }, catalogue);
    expect(r.accepted).toEqual({ 'create.getStarted': 'Start with {brand} today' });
    expect(r.rejected).toEqual([]);
  });

  it('drops unknown keys, changed placeholders and blanks', () => {
    const r = sanitizeOverrides(
      { 'create.titel': 'x', 'create.getStarted': 'Start today', 'create.title': '  ' },
      catalogue
    );
    expect(r.accepted).toEqual({});
    expect(r.rejected.map((x) => x.reason).sort()).toEqual(['not-a-string', 'placeholders', 'unknown-key']);
  });

  it('compares placeholders as a set', () => {
    expect(placeholderSet('{b} {a} {b}')).toBe('a,b');
  });
});

describe('I18nProvider with overrides', () => {
  function Title() {
    const t = useT();
    return <span data-testid="t">{t('create.getStarted', { brand: 'COBRO' })}</span>;
  }

  afterEach(() => window.history.replaceState({}, '', '/'));

  it('renders the override for the active locale', async () => {
    window.history.replaceState({}, '', '/create?lang=es');
    render(
      <I18nProvider messageOverrides={{ es: { 'create.getStarted': 'Cobra con {brand}' } }}>
        <Title />
      </I18nProvider>
    );
    await waitFor(() => expect(screen.getByTestId('t').textContent).toBe('Cobra con COBRO'));
  });

  it('keeps our wording when the override is rejected', async () => {
    window.history.replaceState({}, '', '/create?lang=en');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <I18nProvider messageOverrides={{ en: { 'create.getStarted': 'Get started now' } }}>
        <Title />
      </I18nProvider>
    );
    await waitFor(() => expect(screen.getByTestId('t').textContent).toBe('Get Started with COBRO'));
    warn.mockRestore();
  });
});
