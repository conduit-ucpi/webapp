import Link from 'next/link';
import { demoCheckoutUrl } from './content';
import VideoEmbed from './VideoEmbed';
import { lt } from './theme';

interface Props {
  className?: string;
  primaryClass?: string;
  outlineClass?: string;
}

/**
 * The live demo: opens the real checkout for a $0.001 USDC payment in a new tab, the
 * savings calculator, and the walkthrough video in a small click-to-play window. Same three actions on every landing.
 */
export default function DemoButtons({ className = '', primaryClass = lt.btnPrimary, outlineClass = lt.btnSecondary }: Props) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={primaryClass}
          // ⚠️ noopener. With this page as a same-origin opener, Privy takes the checkout for its
          //    own sign-in popup and posts the Google result back here instead of logging in.
          onClick={() => window.open(demoCheckoutUrl(window.location.origin), '_blank', 'noopener')}
        >
          See what your customers see
        </button>
        <Link href="/merchant-savings-calculator" className={outlineClass}>
          Calculate savings
        </Link>
      </div>
      <p className={`mt-3 text-xs ${lt.muted}`}>Pay $0.001 USDC (try for free)</p>
      <p className={`mt-6 mb-2 text-xs ${lt.muted}`}>Or watch it instead</p>
      <VideoEmbed />
    </div>
  );
}
