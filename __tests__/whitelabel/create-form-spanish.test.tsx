/**
 * The create form renders in Spanish under a Spanish locale.
 *
 * A scan can prove a string was replaced by a `t()` call; only rendering proves
 * the call resolves through the provider and reaches the screen. These are the
 * two form fields with simple enough props to mount directly.
 */

import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@conduit-ucpi/whitelabel-sdk';
import ReleaseDateField from '@/components/contracts/ReleaseDateField';
import AmountGuidance from '@/components/contracts/AmountGuidance';
import AdvancedOptions from '@/components/contracts/AdvancedOptions';
import { WizardNavigation } from '@/components/ui/Wizard';

const inSpanish = (ui: React.ReactElement) =>
  render(<I18nProvider brandLocale="es">{ui}</I18nProvider>);

const inEnglish = (ui: React.ReactElement) =>
  render(<I18nProvider brandLocale="en">{ui}</I18nProvider>);

describe('the create form in Spanish', () => {
  describe('release date field', () => {
    it('translates its label and the automatic-release note', () => {
      inSpanish(<ReleaseDateField value={Date.now() + 86_400_000} onChange={jest.fn()} />);

      expect(screen.getByText(/¿Cuándo deben liberarse los fondos\?/)).toBeInTheDocument();
      expect(
        screen.getByText(/Los fondos se liberarán automáticamente a esta hora/)
      ).toBeInTheDocument();
    });

    it('still renders English when the locale is English', () => {
      inEnglish(<ReleaseDateField value={Date.now() + 86_400_000} onChange={jest.fn()} />);

      expect(screen.getByText(/When should funds be released\?/)).toBeInTheDocument();
    });
  });

  describe('amount guidance', () => {
    // The empty state shows the minimum and the fee, which are interpolated —
    // so this also covers a placeholder surviving translation.
    it('translates the minimum and fee line', () => {
      inSpanish(<AmountGuidance amount="" onUseTestAmount={jest.fn()} />);

      expect(screen.getByText(/Mínimo/)).toBeInTheDocument();
      expect(screen.getByText(/comisión/)).toBeInTheDocument();
      expect(screen.getByText(/Envía una prueba gratis/)).toBeInTheDocument();
    });

    it('translates the fee breakdown once an amount is entered', () => {
      inSpanish(<AmountGuidance amount="50" onUseTestAmount={jest.fn()} />);

      expect(screen.getByText(/Comisión/)).toBeInTheDocument();
      expect(screen.getByText('Recibes')).toBeInTheDocument();
    });

    it('leaves the numbers alone', () => {
      // Translation must not touch interpolated values — a mistranslated fee
      // would be a good deal worse than an untranslated label.
      inSpanish(<AmountGuidance amount="50" onUseTestAmount={jest.fn()} />);
      expect(screen.getByText(/\$49\.50/)).toBeInTheDocument();
    });
  });
});

/**
 * The navigation and disclosure controls.
 *
 * Both were missed by an earlier scan: the scanner needed two words and eight
 * characters, so single-word labels like "Continue" were invisible to it. These
 * pin them by rendering, which is the only check that would have caught it.
 */
describe('controls in Spanish', () => {
  it('translates the wizard navigation buttons', () => {
    inSpanish(
      <WizardNavigation currentStep={0} totalSteps={2} onNext={jest.fn()} onPrevious={jest.fn()} />
    );

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
  });

  it('falls back to Continue in English', () => {
    inEnglish(
      <WizardNavigation currentStep={0} totalSteps={2} onNext={jest.fn()} onPrevious={jest.fn()} />
    );

    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('translates the advanced options disclosure', () => {
    inSpanish(<AdvancedOptions arbiterAddress="" onArbiterChange={jest.fn()} />);

    expect(screen.getByText('Opciones avanzadas')).toBeInTheDocument();
  });
});
