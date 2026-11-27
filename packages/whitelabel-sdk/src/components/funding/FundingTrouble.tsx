import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { reportFundingEvent } from '@/lib/reportFundingEvent';
import { feedbackScreenIsHere, openFeedbackScreen } from '@/lib/feedbackScreen';
import type { FundingTroubleApi } from '@/hooks/useFundingTrouble';
import { usePartnerBrand } from '../../theme/BrandProvider';
import { useT } from '../../i18n';

const REASONS = ['declined', 'id', 'limit', 'country', 'fees', 'later', 'other'] as const;
export type TroubleReason = (typeof REASONS)[number];

/** A way of buying this screen offers, to suggest when another did not work. */
export interface FundingWay {
  /** The name it is logged under (Privy, Coinbase, Kraken, Link): matched against what failed. */
  logged: string;
  name: string;
  onChoose: () => void;
}

interface FundingTroubleProps {
  /** From useWalletFunding: what went wrong and with which way of buying. */
  trouble: FundingTroubleApi;
  walletAddress: string;
  token: string;
  /** Every way of buying on this screen that can be used now, best first. Two are offered. */
  ways: FundingWay[];
  /** Said once the buyer tells us the purchase went through: where this screen will show it. */
  purchasedNote: string;
  /** The buyer says the purchase went through: look for it. */
  onPurchased?: () => void;
}

/**
 * What a screen says when buying stablecoins did not work, for every way of buying it offers.
 * Draws `trouble.current` (hooks/useFundingTrouble) and nothing when there is none.
 *
 * ⚠️ HELP FIRST, THEN ONE QUESTION. A buyer who fails here leaves without a word: nobody has opened
 *    the chat or written in. So the next thing to try is on screen before anything is asked, and
 *    the question is one tap. The tap is logged (trouble-reason), which is the only way we learn
 *    why a purchase on somebody else's site failed, and it gets an answer for that reason.
 *
 * Only the card window says how it ended. For a company's own page the buyer is asked first
 * whether the purchase went through, and the help follows a "no".
 *
 * Everything shown and pressed is a funding-event line: trouble-shown, trouble-reason,
 * trouble-action.
 */
export default function FundingTrouble({ trouble, walletAddress, token, ways, purchasedNote, onPurchased }: FundingTroubleProps) {
  const current = trouble.current;
  const kind = current?.kind;
  const provider = current?.provider;
  const t = useT();
  // Zipchat's widget loads only on our own pages (components/feedback/ZipchatWidget).
  const chatHere = !usePartnerBrand();
  /** 'returned' and 'stuck' ask first; once the buyer says it failed, they are 'failed'. */
  const [saidFailed, setSaidFailed] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [reason, setReason] = useState<TroubleReason | null>(null);

  const logged = provider?.logged;
  const route = provider?.route;
  const seen = current?.seen;
  // What was shown, with the figures the page saw when it looked: "short: 19.20 of 20.00".
  const shownAs =
    kind && seen ? `${kind}: ${seen.held.toFixed(2)}${seen.needed === undefined ? ' held' : ` of ${seen.needed.toFixed(2)}`}` : kind;
  const log = (event: 'trouble-shown' | 'trouble-reason' | 'trouble-action', detail: string) =>
    void reportFundingEvent(event, { wallet: walletAddress, provider: logged, route, detail });

  useEffect(() => {
    if (!kind) return;
    void reportFundingEvent('trouble-shown', { wallet: walletAddress, provider: logged, route, detail: shownAs });
    setSaidFailed(false);
    setPurchased(false);
    setReason(null);
  }, [kind, shownAs, walletAddress, logged, route]);

  /*
   * ⚠️ BROUGHT INTO VIEW WHEN IT APPEARS. It sits at the top of the ways of buying, and the buyer
   *    comes back to wherever they pressed, which for a company in the lists is a screen or two
   *    further down: on /wallet it appeared and was never seen (2026-11-26).
   */
  const boxRef = useRef<HTMLElement>(null);
  const moreHelpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reason === 'other') moreHelpRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [reason]);
  useEffect(() => {
    if (kind) boxRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [kind, logged]);

  if (!current || !kind || !provider) return null;

  const name = provider.name;
  const asking = (kind === 'returned' || kind === 'stuck') && !saidFailed;
  const figures = seen && {
    held: seen.held.toFixed(2),
    needed: (seen.needed ?? 0).toFixed(2),
    // Up to the cent: buying a hair less leaves them short again.
    short: (Math.ceil(((seen.needed ?? 0) - seen.held) * 100 - 1e-7) / 100).toFixed(2),
    token,
  };
  /*
   * ⚠️ SAID, NOT ASKED. The page has looked at where the purchase delivers, so it says what it
   *    found ("we can't see it yet", with the figures) and only then asks how it went. It used to
   *    open with "Did your purchase go through?", as if it had no way of knowing (2026-11-26).
   *    The question is the heading only where the look itself failed.
   */
  const notSeen =
    kind === 'returned' && figures
      ? t(
          provider.route === 'payment'
            ? 'fundingTrouble.notSeen.payment'
            : seen?.needed === undefined
              ? 'fundingTrouble.notSeen.walletOnly'
              : 'fundingTrouble.notSeen.wallet',
          figures
        )
      : null;
  const title = kind === 'short' && figures
    ? t('fundingTrouble.title.short', figures)
    : asking
    ? kind === 'stuck'
      ? t('fundingTrouble.title.stuck')
      : notSeen
        ? name
          ? t('fundingTrouble.title.notSeenAt', { name })
          : t('fundingTrouble.title.notSeen')
        : name
          ? t('fundingTrouble.title.returnedAt', { name })
          : t('fundingTrouble.title.returned')
    : kind === 'cancelled'
      ? t('fundingTrouble.title.cancelled', { token })
      : kind === 'failed'
        ? // Only the card window reports a failure itself. Anything else here is the buyer's own
          // "no", so it is not said that the purchase failed: no company told us so.
          t('fundingTrouble.title.failed')
        : name
          ? t('fundingTrouble.title.saidFailedAt', { name })
          : t('fundingTrouble.title.saidFailed');
  const lead = kind === 'cancelled' || kind === 'failed' ? t(`fundingTrouble.lead.${kind}`) : t('fundingTrouble.lead.saidFailed');
  // The one that failed is offered as "open it again" where the page knows how, not as another way.
  const others = ways.filter((way) => !(provider.reopen && way.logged === provider.logged)).slice(0, 2);

  const pick = (chosen: TroubleReason) => {
    setReason(chosen);
    log('trouble-reason', chosen);
  };
  /** What they were doing, in their own voice: the start of a chat or a feedback message. */
  const whatHappened = (
    name
      ? t('fundingTrouble.chatMessageAt', { token, name })
      : t('fundingTrouble.chatMessage', { token })
  ).trim();
  const openChat = () => {
    log('trouble-action', 'chat');
    const zipchat = (window as unknown as { Zipchat?: { open?: (options: { prefillMessage: string; submit: boolean }) => unknown } }).Zipchat;
    zipchat?.open?.({ prefillMessage: whatHappened, submit: true });
  };
  /*
   * The two other ways to reach us, under the help, each a button of ours that opens it with what
   * they were doing already written: the site's feedback screen (the floating button's), and the
   * chat (Zipchat's own launcher, in the corner, is drawn and placed from Zipchat's dashboard;
   * opening the chat is not). Each only where this page has it: a partner's page built with this
   * package has neither.
   */
  const canReachUs = feedbackScreenIsHere() || chatHere;
  /*
   * ⚠️ "SOMETHING ELSE" POINTS HERE, AND THESE STAND OUT WHEN IT DOES. That reason has no answer
   *    of ours to give, so its answer is to tell us: it used to open a text box of its own
   *    (2026-11-26), a third way of telling us beside the two already here. Now it says to use
   *    these, and they are ringed, filled in and brought into view so the buyer sees where.
   */
  const pointedAt = reason === 'other';
  const moreHelp = canReachUs && (
    <div
      ref={moreHelpRef}
      data-pointed-at={pointedAt || undefined}
      className={
        pointedAt
          ? 'space-y-2 rounded-lg p-3 ring-2 ring-primary-500 bg-white dark:bg-secondary-800'
          : 'space-y-2 pt-2 border-t border-amber-200 dark:border-amber-800'
      }
    >
      <p className="text-sm font-medium">{t('fundingTrouble.more')}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        {chatHere && (
          <Button type="button" variant={pointedAt ? 'primary' : 'outline'} className="rounded-lg justify-center" onClick={openChat}>
            {t('fundingTrouble.openChat')}
          </Button>
        )}
        {feedbackScreenIsHere() && (
          <Button
            type="button"
            variant={pointedAt ? 'primary' : 'outline'}
            className="rounded-lg justify-center"
            onClick={() => {
              log('trouble-action', 'feedback');
              openFeedbackScreen(whatHappened);
            }}
          >
            {t('fundingTrouble.feedback')}
          </Button>
        )}
      </div>
    </div>
  );

  const box =
    'rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3 text-secondary-900 dark:text-white';
  const body = 'text-sm text-secondary-800 dark:text-secondary-100';
  const chip = (selected: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition-colors ${
      selected
        ? 'border-secondary-900 dark:border-white bg-secondary-900 text-white dark:bg-white dark:text-secondary-900'
        : 'border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-secondary-800 dark:text-secondary-100 hover:border-primary-500'
    }`;

  return (
    <section ref={boxRef} role="region" aria-label={title} className={box}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-base font-semibold">{title}</h4>
        <button
          type="button"
          onClick={() => {
            log('trouble-action', 'close');
            trouble.close();
          }}
          className="shrink-0 text-xs underline text-secondary-600 dark:text-secondary-300 hover:text-secondary-900 dark:hover:text-white"
        >
          {t('fundingTrouble.close')}
        </button>
      </div>

      {purchased ? (
        <p role="status" className={body}>{purchasedNote}</p>
      ) : kind === 'short' && figures ? (
        <>
          {/* It arrived, short: nothing to ask. Into the wallet, the ways to buy the rest. */}
          <p className={body}>{t(`fundingTrouble.lead.short.${provider.route}`, figures)}</p>
          {provider.route === 'wallet' && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
              {provider.reopen && (
                <Button
                  type="button"
                  className="rounded-lg justify-center"
                  onClick={() => {
                    log('trouble-action', 'retry');
                    trouble.close();
                    provider.reopen?.();
                  }}
                >
                  {name ? t('fundingTrouble.retryAt', { name }) : t('fundingTrouble.retry')}
                </Button>
              )}
              {others.map((way) => (
                <Button
                  key={way.logged}
                  type="button"
                  variant="outline"
                  className="rounded-lg justify-center"
                  onClick={() => {
                    log('trouble-action', `try: ${way.logged}`);
                    trouble.close();
                    way.onChoose();
                  }}
                >
                  {t('fundingTrouble.tryOther', { name: way.name })}
                </Button>
              ))}
            </div>
          )}
          {moreHelp}
        </>
      ) : asking ? (
        <>
          {kind === 'stuck' && <p className={body}>{t('fundingTrouble.lead.stuck')}</p>}
          {/* The page looked first: what it found, then how it went for them. */}
          {notSeen && (
            <>
              <p className={body}>{notSeen}</p>
              <p className="text-sm font-medium">{name ? t('fundingTrouble.howDidItGoAt', { name }) : t('fundingTrouble.howDidItGo')}</p>
            </>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            {kind === 'returned' && (
              <Button
                type="button"
                variant="outline"
                className="rounded-lg justify-center"
                onClick={() => {
                  log('trouble-action', 'purchased');
                  setPurchased(true);
                  trouble.awaitArrival(provider);
                  onPurchased?.();
                }}
              >
                {notSeen ? t('fundingTrouble.saidPaid') : t('fundingTrouble.returnedYes')}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="rounded-lg justify-center"
              onClick={() => {
                log('trouble-action', 'not-purchased');
                setSaidFailed(true);
              }}
            >
              {kind !== 'returned' ? t('fundingTrouble.stuckFailed') : notSeen ? t('fundingTrouble.saidFailedButton') : t('fundingTrouble.returnedNo')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className={body}>{lead}</p>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t('fundingTrouble.tryNext')}</p>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
              {others.map((way) => (
                <Button
                  key={way.logged}
                  type="button"
                  className="rounded-lg justify-center"
                  onClick={() => {
                    log('trouble-action', `try: ${way.logged}`);
                    trouble.close();
                    way.onChoose();
                  }}
                >
                  {t('fundingTrouble.tryOther', { name: way.name })}
                </Button>
              ))}
              {provider.reopen && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg justify-center"
                  onClick={() => {
                    log('trouble-action', 'retry');
                    trouble.close();
                    provider.reopen?.();
                  }}
                >
                  {name ? t('fundingTrouble.retryAt', { name }) : t('fundingTrouble.retry')}
                </Button>
              )}
            </div>
            <p className="text-xs text-secondary-600 dark:text-secondary-300">{t('fundingTrouble.moreBelow')}</p>
          </div>

          <div className="space-y-2 pt-2 border-t border-amber-200 dark:border-amber-800">
            <p className="text-sm font-medium">{t('fundingTrouble.ask')}</p>
            <div role="group" aria-label={t('fundingTrouble.ask')} className="flex flex-wrap gap-2">
              {REASONS.map((each) => (
                <button key={each} type="button" aria-pressed={reason === each} onClick={() => pick(each)} className={chip(reason === each)}>
                  {t(`fundingTrouble.reason.${each}`)}
                </button>
              ))}
            </div>
            {reason && reason !== 'other' && (
              <p role="status" className={body}>{t(`fundingTrouble.answer.${reason}`, { token })}</p>
            )}
            {reason === 'other' && (
              <p role="status" className={body}>
                {t(canReachUs ? 'fundingTrouble.answer.other' : 'fundingTrouble.answer.otherNoted')}
              </p>
            )}
          </div>
          {moreHelp}
        </>
      )}
    </section>
  );
}
