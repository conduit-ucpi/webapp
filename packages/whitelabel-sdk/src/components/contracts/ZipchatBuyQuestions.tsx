import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import { usePartnerBrand } from '../../theme/BrandProvider';

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      /** Zipchat's suggested questions, filled in by its widget script (components/feedback/ZipchatWidget). */
      'zipchat-pdp-questions': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

/**
 * Zipchat's suggested questions, for a buyer who has to buy stablecoins to pay: the moment they are
 * most likely to have one. The element is inert until Zipchat's script finds it, and that script
 * loads only on our own pages, so on a partner's white-label page nothing is drawn — the bot answers
 * for Stabledrop.
 */
export default function ZipchatBuyQuestions() {
  if (usePartnerBrand()) return null;
  return <zipchat-pdp-questions />;
}
