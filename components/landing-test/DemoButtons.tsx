import Link from 'next/link';
import { VIDEO_URL, demoCheckoutUrl } from './content';
import { lt } from './theme';

interface Props {
  className?: string;
  primaryClass?: string;
  outlineClass?: string;
}

/**
 * The live demo: opens the real checkout for a $0.001 USDC payment in a new tab, the
 * walkthrough video, and the savings calculator. Same three actions on every landing.
 */
export default function DemoButtons({ className = '', primaryClass = lt.btnPrimary, outlineClass = lt.btnSecondary }: Props) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={primaryClass}
          onClick={() => window.open(demoCheckoutUrl(window.location.origin), '_blank')}
        >
          See what your customers see
        </button>
        <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer" className={outlineClass}>
          Watch video instead
        </a>
        <Link href="/merchant-savings-calculator" className={outlineClass}>
          Calculate savings
        </Link>
      </div>
      <p className={`mt-3 text-xs ${lt.muted}`}>Pay $0.001 USDC (try for free)</p>
    </div>
  );
}
