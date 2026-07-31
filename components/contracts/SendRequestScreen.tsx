/**
 * "Send Payment Request to Buyer" - the final screen, shown once the request
 * exists. Delivery is by share link rather than an email we send, so the
 * buyer's address is never needed: the seller hands over the link themselves.
 */

import { useRef } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';

interface SendRequestScreenProps {
  paymentLink: string;
  amount: string;
  tokenSymbol: string;
  networkLabel?: string;
  description: string;
  copied: boolean;
  onCopy: () => void;
  onDone: () => void;
}

export default function SendRequestScreen({
  paymentLink,
  amount,
  tokenSymbol,
  networkLabel,
  description,
  copied,
  onCopy,
  onDone,
}: SendRequestScreenProps) {
  // Trailing zeros read badly in a message to a human: "25 USDC", not "25.0000".
  const formattedAmount = `${parseFloat(amount || '0')
    .toFixed(4)
    .replace(/\.?0+$/, '')} ${tokenSymbol}`;

  const summary = [formattedAmount, networkLabel, description].filter(Boolean).join(' · ');

  // The description is what the recipient recognises in a crowded inbox, so it
  // leads the subject line.
  const subject = description ? `Payment request: ${description}` : `Payment request for ${formattedAmount}`;

  const buildMessage = (withQr: boolean) =>
    [
      `I've requested a payment of ${formattedAmount} from you through StableDrop (stabledrop.me).`,
      description ? `What it's for: ${description}` : null,
      withQr
        ? `To pay, open the link below or scan the attached QR code:\n${paymentLink}`
        : `To pay, open this link:\n${paymentLink}`,
      "Your payment is held in escrow until the agreed payout date — if something goes wrong, you can raise a dispute before then to freeze the funds.",
    ]
      .filter(Boolean)
      .join('\n\n');

  // Off-screen canvas exists purely so the QR can be exported as a PNG; the
  // visible code stays SVG so it scales cleanly.
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const qrFile = async (): Promise<File | null> => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return null;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob ? new File([blob], 'payment-request.png', { type: 'image/png' }) : null;
  };

  // Web Share where available (mobile, Safari, Chrome); copy is the fallback
  // so desktop Firefox still has a working path.
  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      // Attaching the QR is best-effort: canShare({ files }) is false on most
      // desktop browsers, and passing files there makes share() throw.
      const file = await qrFile();
      const withQr = !!file && !!navigator.canShare?.({ files: [file] });
      try {
        await navigator.share(
          withQr
            ? { title: subject, text: buildMessage(true), files: [file as File] }
            : { title: subject, text: buildMessage(false), url: paymentLink }
        );
        return;
      } catch {
        // User dismissed the sheet - fall through to copy.
      }
    }
    onCopy();
  };

  // mailto: bodies are plain text only, so the emailed version points at the
  // link rather than promising a QR the client can't attach.
  const mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    buildMessage(false)
  )}`;

  const actionClass =
    'grid place-items-center w-12 h-12 rounded-full border border-secondary-300 dark:border-secondary-600 ' +
    'text-secondary-700 dark:text-secondary-200 hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors';
  const actionLabel = 'mt-2 text-sm text-secondary-500 dark:text-secondary-400';

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-semibold text-secondary-900 dark:text-white">
          Send Payment Request to Buyer
        </h2>
        <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">{summary}</p>
      </div>

      <div className="rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-6 sm:p-8">
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-lg">
            <QRCodeSVG value={paymentLink} size={220} />
            <QRCodeCanvas
              ref={qrCanvasRef}
              value={paymentLink}
              size={512}
              marginSize={4}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          </div>
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-secondary-900 dark:text-white">
          Payment Link
        </p>
        <div className="mt-2 mx-auto max-w-sm rounded-lg border border-secondary-300 dark:border-secondary-600 px-4 py-3">
          <p className="text-center text-sm text-secondary-700 dark:text-secondary-200 break-all">
            {paymentLink}
          </p>
        </div>

        <div className="mt-6 flex items-start justify-center gap-8">
          <div className="text-center">
            <button type="button" onClick={handleShare} className={actionClass} aria-label="Share payment link">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.769-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            </button>
            <p className={actionLabel}>Share</p>
          </div>

          <div className="text-center">
            <button type="button" onClick={onCopy} className={actionClass} aria-label="Copy payment link">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
              </svg>
            </button>
            <p className={actionLabel}>{copied ? 'Copied' : 'Copy link'}</p>
          </div>

          <div className="text-center">
            <a href={mailtoHref} className={actionClass} aria-label="Email payment link">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </a>
            <p className={actionLabel}>Email</p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onDone}
          className="w-full sm:w-72 rounded-lg bg-secondary-900 dark:bg-white text-white dark:text-secondary-900 px-8 py-3 text-sm font-semibold hover:bg-secondary-700 dark:hover:bg-secondary-100 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
