import { useEffect } from 'react';
import { usePartnerBrand } from '@conduit-ucpi/whitelabel-sdk';

/** Our Zipchat bot, trained on the site and the FAQ. The id is public: it is in every page that loads the widget. */
export const ZIPCHAT_SCRIPT_URL = 'https://app.zipchat.ai/widget/zipchat.js?id=ZimYlC24NMdUVMKFkHAV';
const SCRIPT_ID = 'zipchat-widget-script';

/**
 * How far up from the bottom of the window FeedbackButton and ReportProblemButton must start so they
 * sit above Zipchat's launcher. Set on <html>; 0px when the launcher is anywhere but the bottom right.
 */
export const CLEARANCE_VAR = '--chat-clearance';
const GAP = 12;

function framed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Zipchat's launcher. It lives in an open shadow root that Zipchat adds to <body>. */
function launcher(): Element | null {
  return document.getElementById('zipchat-shadow-host')?.shadowRoot?.getElementById('widget-chat-container') ?? null;
}

/** The clearance a launcher in the bottom right needs, in px; 0 for one that is hidden or elsewhere. */
export function clearanceFor(el: Element | null): number {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return 0;
  const onRight = r.right > window.innerWidth - 120;
  const atBottom = r.bottom > window.innerHeight - 160;
  return onRight && atBottom ? Math.ceil(window.innerHeight - r.top + GAP) : 0;
}

/**
 * The floating "ask a question" chat, mounted once in ClientOnlyApp beside the feedback buttons.
 *
 * Zipchat draws its own launcher, and its corner, size and offset are set in the Zipchat dashboard, so
 * rather than assume them this measures it and lifts our two buttons above it (CLEARANCE_VAR).
 *
 * Not loaded on a partner's white-label page or inside someone else's frame: the bot answers for
 * Stabledrop, and those pages are the partner's. It is decided when the script first loads; the
 * widget cannot be taken back out of the page afterwards.
 */
export default function ZipchatWidget() {
  const partnerBrand = usePartnerBrand();

  useEffect(() => {
    if (partnerBrand || framed()) return;

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = ZIPCHAT_SCRIPT_URL;
      script.defer = true;
      script.setAttribute('data-no-optimize', '1');
      document.body.appendChild(script);
    }

    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty(CLEARANCE_VAR, `${clearanceFor(launcher())}px`);
        watchShadow();
      });
    };

    // The launcher arrives late (after Zipchat fetches its settings) and moves with transitions, so
    // watch the shadow root for any change and re-measure when a transition ends.
    const inShadow = new MutationObserver(update);
    let watched: ShadowRoot | null = null;
    const watchShadow = () => {
      const shadow = document.getElementById('zipchat-shadow-host')?.shadowRoot ?? null;
      if (!shadow || shadow === watched) return;
      watched = shadow;
      inShadow.observe(shadow, { childList: true, subtree: true, attributes: true });
      shadow.addEventListener('transitionend', update);
    };
    const inBody = new MutationObserver(update);
    inBody.observe(document.body, { childList: true });
    window.addEventListener('resize', update);
    update();

    return () => {
      cancelAnimationFrame(frame);
      inBody.disconnect();
      inShadow.disconnect();
      watched?.removeEventListener('transitionend', update);
      window.removeEventListener('resize', update);
      root.style.removeProperty(CLEARANCE_VAR);
    };
  }, [partnerBrand]);

  return null;
}
