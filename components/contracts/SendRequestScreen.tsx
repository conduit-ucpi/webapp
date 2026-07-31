/**
 * "Send Payment Request to Buyer" - the final screen, shown once the request
 * exists. Delivery is by share link rather than an email we send, so the
 * buyer's address is never needed: the seller hands over the link themselves.
 */

import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { getSiteNameFromDomain } from '@/utils/siteName';

interface SendRequestScreenProps {
  paymentLink: string;
  amount: string;
  tokenSymbol: string;
  networkLabel?: string;
  description: string;
  /** Preformatted payout date, shown on the attachable PDF. */
  payoutLabel?: string;
  copied: boolean;
  /**
   * `kind` distinguishes the bare URL from the full message so the parent can
   * word its confirmation toast correctly.
   */
  onCopy: (text: string, kind: 'link' | 'message') => void;
  onDone: () => void;
}

export default function SendRequestScreen({
  paymentLink,
  amount,
  tokenSymbol,
  networkLabel,
  description,
  payoutLabel,
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

  const [qrCopied, setQrCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showInPerson, setShowInPerson] = useState(false);

  // Probed after mount rather than during render: navigator is absent on the
  // server, and branching layout on it directly would risk a hydration gap.
  const [canWebShare, setCanWebShare] = useState(false);
  useEffect(() => {
    setCanWebShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const siteName = getSiteNameFromDomain();

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const { downloadPaymentRequestPdf } = await import('@/utils/paymentRequestPdf');
      await downloadPaymentRequestPdf({
        formattedAmount,
        description,
        paymentLink,
        qrDataUrl: qrCanvasRef.current?.toDataURL('image/png'),
        networkLabel,
        payoutDate: payoutLabel,
        siteName,
      });
    } catch (error) {
      console.error('Failed to build payment request PDF:', error);
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadQr = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'payment-request-qr.png';
    a.click();
  };

  /**
   * Pasting straight into a chat beats a file in the Downloads folder for the
   * common case. ClipboardItem takes a Promise<Blob> rather than an awaited
   * one because Safari voids the user gesture if you await before writing.
   * Anything unsupported or refused falls back to the download.
   */
  const copyQr = async () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      downloadQr();
      return;
    }
    try {
      const blob = new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/png')
      );
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 3000);
    } catch {
      downloadQr();
    }
  };

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
    onCopy(buildMessage(false), 'message');
  };

  // mailto: bodies are plain text only, so the emailed version points at the
  // link rather than promising a QR the client can't attach. No recipient is
  // prefilled — the seller picks it in their own client, and asking for it
  // here would imply we do the sending.
  const mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    buildMessage(false)
  )}`;

  // Both hand off to an app the seller already uses; nothing is sent from here.
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(buildMessage(false))}`;
  const smsHref = `sms:?&body=${encodeURIComponent(buildMessage(false))}`;

  const actionClass =
    'grid place-items-center w-12 h-12 rounded-full border border-secondary-300 dark:border-secondary-600 ' +
    'text-secondary-700 dark:text-secondary-200 hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors';
  const actionLabel = 'mt-2 text-sm text-secondary-500 dark:text-secondary-400';

  const btnBase =
    'rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60';
  const btnOutlined = `${btnBase} border border-secondary-300 dark:border-secondary-600 text-secondary-700 dark:text-secondary-200 hover:bg-secondary-50 dark:hover:bg-secondary-800`;
  const btnFilled = `${btnBase} bg-secondary-900 dark:bg-white text-white dark:text-secondary-900 hover:bg-secondary-700 dark:hover:bg-secondary-100`;

  const groupHeading = 'text-sm font-semibold text-secondary-900 dark:text-white';
  const groupHint = 'mt-0.5 text-xs text-secondary-400 dark:text-secondary-500';

  // Section number badge — the three routes are alternatives, not steps, but
  // numbering them makes it obvious you only need one.
  const Marker = ({ n }: { n: number }) => (
    <span className="shrink-0 grid place-items-center w-6 h-6 rounded-full bg-secondary-100 dark:bg-secondary-800 text-xs font-semibold text-secondary-600 dark:text-secondary-300">
      {n}
    </span>
  );

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-semibold text-secondary-900 dark:text-white">
          Now send this to your buyer
        </h2>
        <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">{summary}</p>
      </div>

      {/* The single most misread thing on this screen: people assume creating
          the request notified the buyer. It didn't — nothing reaches them
          until the seller sends the link, so say so before the QR, not after.
          warning is a 50/500/600 scale; opacity modifiers stand in for the
          tints this palette doesn't define. */}
      <div className="mb-6 rounded-xl border border-warning-500/40 bg-warning-50 dark:bg-warning-500/10 px-4 py-3.5">
        <p className="text-sm font-semibold text-warning-600 dark:text-warning-500">
          Your buyer hasn&apos;t been notified yet
        </p>
        <p className="mt-1 text-sm text-warning-600/90 dark:text-warning-500/90 leading-relaxed">
          We don&apos;t contact them for you. Send the link below by email, text or
          however you normally reach them &mdash; they can&apos;t pay until they have it.
        </p>
      </div>

      {/* The QR canvas backs the copy/download/share-attachment paths, so it
          has to exist even while the in-person section is collapsed. */}
      <QRCodeCanvas
        ref={qrCanvasRef}
        value={paymentLink}
        size={512}
        marginSize={4}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Three routes to the same outcome, grouped by the seller's situation
          rather than by mechanism — messaging now, pasting somewhere, or
          handing it over in person. Sellers read one group and stop. */}
      <div className="rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 divide-y divide-secondary-200 dark:divide-secondary-700">
        <section className="p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <Marker n={1} />
            <div>
              <h3 className={groupHeading}>Send it now</h3>
              <p className={groupHint}>Opens the app with the message already written.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-center gap-6 sm:gap-9">
            <div className="text-center">
              <a href={mailtoHref} className={actionClass} aria-label="Email payment request">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>
              <p className={actionLabel}>Email</p>
            </div>

            <div className="text-center">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className={actionClass}
                aria-label="Send payment request on WhatsApp"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9 9 0 10-7.94-4.73L3 21l4.9-1.03A8.96 8.96 0 0012 21z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.8 9.2c0 3.31 2.69 6 6 6" />
                </svg>
              </a>
              <p className={actionLabel}>WhatsApp</p>
            </div>

            <div className="text-center">
              <a href={smsHref} className={actionClass} aria-label="Send payment request by text message">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 10.5h8M8 14h5M21 12a8 8 0 01-8 8H7l-4 3v-5.5A8 8 0 0111 4h2a8 8 0 018 8z" />
                </svg>
              </a>
              <p className={actionLabel}>Text</p>
            </div>

            {/* Only where the share sheet genuinely exists. On desktop Firefox
                navigator.share is absent and this silently fell back to a copy,
                which is a button that does something other than it says. */}
            {canWebShare && (
              <div className="text-center">
                <button type="button" onClick={handleShare} className={actionClass} aria-label="Share payment request">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.769-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                </button>
                <p className={actionLabel}>Share</p>
              </div>
            )}
          </div>
        </section>

        <section className="p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <Marker n={2} />
            <div>
              <h3 className={groupHeading}>Or paste it yourself</h3>
              <p className={groupHint}>
                For any app not listed above. The message includes the amount, what it&apos;s
                for and the link.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => onCopy(buildMessage(false), 'message')}
              className={btnFilled}
            >
              Copy message
            </button>
            <button
              type="button"
              onClick={() => onCopy(paymentLink, 'link')}
              className={btnOutlined}
            >
              {copied ? 'Copied' : 'Copy link only'}
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-secondary-400 dark:text-secondary-500 break-all">
            {paymentLink}
          </p>
        </section>

        <section className="p-6 sm:p-7">
          <button
            type="button"
            onClick={() => setShowInPerson((v) => !v)}
            className="w-full flex items-start gap-3 text-left"
            aria-expanded={showInPerson}
          >
            <Marker n={3} />
            <span className="flex-1">
              <span className={`${groupHeading} block`}>In person, or on paper</span>
              <span className={`${groupHint} block`}>
                QR code to scan, or a PDF you can attach or print.
              </span>
            </span>
            <svg
              className={`w-5 h-5 shrink-0 mt-0.5 text-secondary-400 transition-transform ${showInPerson ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showInPerson && (
            <div className="mt-6">
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-lg border border-secondary-200">
                  <QRCodeSVG value={paymentLink} size={180} />
                </div>
              </div>

              <div className="mt-3 flex justify-center gap-5 text-xs">
                <button
                  type="button"
                  onClick={copyQr}
                  className="text-secondary-500 dark:text-secondary-400 underline underline-offset-2 hover:no-underline"
                >
                  {qrCopied ? 'QR copied' : 'Copy QR image'}
                </button>
                <button
                  type="button"
                  onClick={downloadQr}
                  className="text-secondary-500 dark:text-secondary-400 underline underline-offset-2 hover:no-underline"
                >
                  Download QR
                </button>
              </div>

              <div className="mt-6 pt-5 border-t border-secondary-200 dark:border-secondary-700 flex flex-col items-center">
                <button
                  type="button"
                  onClick={downloadPdf}
                  disabled={pdfBusy}
                  className={btnOutlined}
                >
                  {pdfBusy ? 'Preparing…' : 'Download PDF'}
                </button>
                <p className="mt-3 text-center text-xs text-secondary-400 dark:text-secondary-500 max-w-xs">
                  A one-page request with the amount, link and QR &mdash; and an explanation
                  of escrow for buyers who haven&apos;t used {siteName} before. Not a tax invoice.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* "Done" implied the system had sent it. This wording only makes sense
          once the seller actually has, and the note keeps the link findable
          for anyone who lands here having not sent it yet. */}
      <div className="mt-8 flex flex-col items-center">
        <button
          type="button"
          onClick={onDone}
          className="w-full sm:w-72 rounded-lg bg-secondary-900 dark:bg-white text-white dark:text-secondary-900 px-8 py-3 text-sm font-semibold hover:bg-secondary-700 dark:hover:bg-secondary-100 transition-colors"
        >
          I&apos;ve sent it
        </button>
        <p className="mt-3 text-xs text-secondary-400 dark:text-secondary-500 text-center max-w-sm">
          Haven&apos;t sent it yet? Copy the link above before you leave this screen.
        </p>
      </div>
    </div>
  );
}
