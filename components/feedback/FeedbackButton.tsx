import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { CalendarDaysIcon, ChatBubbleLeftEllipsisIcon, VideoCameraIcon, StopCircleIcon } from '@heroicons/react/24/outline';
import { usePartnerBrand } from '@conduit-ucpi/whitelabel-sdk';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { usePageT } from '@/config/locales';
import { MAX_MESSAGE, buildFeedbackPayload, validateFeedback } from '@/lib/inAppFeedback';
import {
  MAX_DESCRIPTION,
  MAX_RECORDING_SECONDS,
  canRecordInPage,
  fileProblem,
  isEmail,
  videoContentType,
  type CapturedSurface,
  type CreateRecordingRequest,
} from '@/lib/problemReport';
import { recentConsoleProblems } from '@/lib/consoleProblems';
import { listenForFeedbackRequests } from '@/lib/feedbackScreen';
import { UploadError, sendRecording } from '@/lib/recordingUpload';
import { useScreenRecorder } from './useScreenRecorder';
import { useRecorderWindow } from './useRecorderWindow';

/**
 * The one floating "Feedback" button, on every page (mounted once in ClientOnlyApp). It opens a
 * message form that emails our inbox through /api/in-app-feedback; from there, where the
 * environment has somewhere to send recordings, "Show us with a screen recording" sends a screen
 * recording instead, carrying what they typed with it.
 *
 * Two ways to get a recording, chosen by what the browser can do (never by its user agent):
 *   - it can record the screen (desktop): record here, preview, send;
 *   - it cannot (phones, in-app wallet browsers): the person records with the phone's own
 *     recorder and uploads the file. Refusing the desktop screen-share prompt lands here too.
 *
 * ⚠️ IT LIVES IN ITS OWN ELEMENT DIRECTLY UNDER <body>, ABOVE EVERYTHING. The moment it matters
 *    most is while Privy's funding window is open. That window is a Headless UI dialog at
 *    z-index 999999 that makes the app's own tree inert and treats a click there as "outside",
 *    closing itself. A top-level sibling of the app root is what such a dialog leaves alone, so
 *    this stays clickable and typeable over it, and using it does not dismiss it.
 */

/** Our Google Calendar booking page, for a demo or a call. Not offered on a partner's pages. */
export const BOOK_A_DEMO_URL =
  'https://calendar.google.com/appointments/schedules/AcZssZ0g2vHh3ahuQw9pESooNqgbX0SLrX7PAIL2_VV8_vWyXa89dGCy35DYYmO7SGOM4aqojlnqpIOf';

type Step =
  | { kind: 'closed' }
  | { kind: 'message'; sending?: boolean }
  | { kind: 'intro'; recorderRefused?: boolean; windowBlocked?: boolean }
  | { kind: 'recording' }
  | { kind: 'review'; hitLimit: boolean }
  | { kind: 'sending'; fraction: number }
  | { kind: 'sent'; via: 'message' | 'recording' };

/** What survives the person leaving for the phone's recorder and the browser reloading the tab. */
const DRAFT_KEY = 'problem-report-draft';
interface Draft {
  open: boolean;
  /** They had gone on to the recording, so reopen there rather than at the message. */
  recording?: boolean;
  message: string;
  contactEmail: string;
}

const readDraft = (): Draft | null => {
  try {
    const saved = window.sessionStorage.getItem(DRAFT_KEY);
    return saved ? (JSON.parse(saved) as Draft) : null;
  } catch {
    return null;
  }
};
const writeDraft = (draft: Draft | null) => {
  try {
    if (draft) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* private mode: the draft just does not survive a reload */
  }
};

/** False only when the browser says outright that this frame may not capture the screen. */
function frameAllowsCapture(): boolean {
  try {
    const doc = document as unknown as Record<'permissionsPolicy' | 'featurePolicy', { allowsFeature?: (feature: string) => boolean } | undefined>;
    const policy = doc.permissionsPolicy ?? doc.featurePolicy;
    return policy?.allowsFeature ? policy.allowsFeature('display-capture') : true;
  } catch {
    return true;
  }
}

/** Whether another page is showing this one in a frame. */
function isFramed(): boolean {
  try {
    return typeof window !== 'undefined' && window.parent !== window;
  } catch {
    return true;
  }
}

/** The origin of the page framing this one, as far as the browser will say. */
function framingOrigin(): string | null {
  try {
    const ancestors = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
    return ancestors?.[0] ?? (document.referrer ? new URL(document.referrer).origin : null);
  } catch {
    return null;
  }
}

/**
 * Which phone's instructions to show. Only wording hangs on this: which path the person takes is
 * decided by canRecordInPage. Unknown shows both.
 */
function phonePlatform(): 'ios' | 'android' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  if (/android/i.test(navigator.userAgent)) return 'android';
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'unknown';
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** The screen-record control as both phones draw it: a filled dot in a ring. */
const RecordGlyph = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12 shrink-0" aria-hidden="true">
    <rect width="48" height="48" rx="12" fill="#1f2937" />
    <circle cx="24" cy="24" r="12" fill="none" stroke="#fff" strokeWidth="3" />
    <circle cx="24" cy="24" r="7" fill="#fff" />
  </svg>
);

/** Its own element under <body>, above every other layer on the page. */
function TopLayer({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const element = document.createElement('div');
    element.id = 'problem-report-root';
    element.style.position = 'relative';
    element.style.zIndex = '2147483647';
    document.body.appendChild(element);
    setHost(element);
    return () => element.remove();
  }, []);
  return host ? createPortal(children, host) : null;
}

export default function FeedbackButton() {
  const t = usePageT();
  const router = useRouter();
  const { config } = useConfig();
  const { user, authenticatedFetch } = useAuth();
  const partnerBrand = usePartnerBrand();
  const [step, setStep] = useState<Step>({ kind: 'closed' });
  const [file, setFile] = useState<Blob | null>(null);
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [triedToSend, setTriedToSend] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const recordingsLive = !!config?.problemRecordingsLive;
  const inPage = useMemo(() => canRecordInPage(), []);
  const platform = useMemo(phonePlatform, []);
  // Framed by a site whose <iframe allow> leaves out display-capture: the browser has the
  // recorder but will refuse it here, so record through a window of our own instead.
  const framed = useMemo(isFramed, []);
  const framedOut = useMemo(() => inPage && !frameAllowsCapture(), [inPage]);
  // A browser that has the recorder is a computer, whatever stopped it; phones have none.
  const computer = inPage && platform === 'unknown';

  const [captured, setCaptured] = useState<CapturedSurface | null>(null);
  const recorder = useScreenRecorder(({ blob, hitLimit, surface }) => {
    setFile(blob);
    setCaptured(surface);
    setStep({ kind: 'review', hitLimit });
  });

  const recorderWindow = useRecorderWindow(
    ({ blob, hitLimit, surface }) => {
      setFile(blob);
      setCaptured(surface);
      setStep({ kind: 'review', hitLimit });
    },
    () => setStep({ kind: 'intro' })
  );

  // Back from the phone's recorder into a reloaded tab: reopen where they left off.
  useEffect(() => {
    const draft = readDraft() as (Draft & { description?: string }) | null;
    if (!draft) return;
    setMessage(draft.message ?? draft.description ?? '');
    setContactEmail(draft.contactEmail ?? '');
    if (draft.open) setStep(draft.recording ? { kind: 'intro' } : { kind: 'message' });
  }, []);

  // Start from the account's email when there is one; whatever they type wins.
  useEffect(() => {
    if (user?.email) setContactEmail((current) => current || user.email);
  }, [user?.email]);

  // Asked to open from elsewhere on the page (lib/feedbackScreen): the help shown when buying
  // stablecoins goes wrong has a "Send feedback" button. What they were doing is put in the
  // message for them, unless they have already written one.
  useEffect(
    () =>
      listenForFeedbackRequests((suggested) => {
        if (suggested) setMessage((current) => current || suggested);
        setStep((current) => (current.kind === 'closed' ? { kind: 'message' } : current));
      }),
    []
  );

  const open = step.kind !== 'closed' && step.kind !== 'recording';
  const recordingFlow = step.kind === 'intro' || step.kind === 'review' || step.kind === 'sending';
  useEffect(() => {
    if (step.kind === 'sent') writeDraft(null);
    else if (step.kind !== 'recording') {
      writeDraft(open || message ? { open, recording: recordingFlow, message, contactEmail } : null);
    }
  }, [step.kind, open, recordingFlow, message, contactEmail]);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const close = useCallback(() => {
    if (step.kind === 'sending' || (step.kind === 'message' && step.sending)) return;
    if (step.kind === 'sent') {
      setFile(null);
      setMessage('');
    }
    setTriedToSend(false);
    setError(null);
    setStep({ kind: 'closed' });
  }, [step]);

  const toRecording = () => {
    setError(null);
    setTriedToSend(false);
    setStep({ kind: 'intro' });
  };

  const backToMessage = () => {
    setError(null);
    setTriedToSend(false);
    setStep({ kind: 'message' });
  };

  const startRecording = async () => {
    setError(null);
    setStep({ kind: 'recording' });
    if (!(await recorder.start())) setStep({ kind: 'intro', recorderRefused: true });
  };

  const startInWindow = () => {
    setError(null);
    // The partner's brand, so the window is dressed as the page that opened it.
    const brand = new URLSearchParams(window.location.search).get('b');
    if (recorderWindow.open(brand ? `?b=${encodeURIComponent(brand)}` : '')) setStep({ kind: 'recording' });
    else setStep({ kind: 'intro', recorderRefused: true, windowBlocked: true });
  };

  const discard = () => {
    setFile(null);
    setError(null);
    setStep({ kind: 'intro' });
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    const problem = fileProblem(chosen);
    if (problem) return setError(t(`report.${problem}`));
    setError(null);
    setCaptured(null);
    setFile(chosen);
    setStep({ kind: 'review', hitLimit: false });
  };

  // The message on its own: emailed to our inbox.
  const messageProblems = validateFeedback({ contactEmail, message });
  const messageError = (key: 'contactEmail' | 'message') => {
    const problem = triedToSend ? messageProblems[key] : undefined;
    return problem ? t(`feedback.${problem}`, { max: MAX_MESSAGE }) : undefined;
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    setTriedToSend(true);
    if (Object.keys(messageProblems).length > 0 || step.kind !== 'message' || step.sending) return;
    setError(null);
    setStep({ kind: 'message', sending: true });
    try {
      const response = await authenticatedFetch('/api/in-app-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFeedbackPayload({ contactEmail, message }, window.location.href)),
      });
      if (response.ok) {
        setTriedToSend(false);
        return setStep({ kind: 'sent', via: 'message' });
      }
      const body = await response.json().catch(() => ({}));
      setError(body.error || t('feedback.failed'));
    } catch {
      setError(t('feedback.failed'));
    }
    setStep({ kind: 'message' });
  };

  // The message with a recording: the message travels as the recording's description.
  const emailMissing = !isEmail(contactEmail);
  const descriptionTooLong = message.trim().length > MAX_DESCRIPTION;

  const sendWithRecording = async (event: FormEvent) => {
    event.preventDefault();
    setTriedToSend(true);
    if (!file || emailMissing || descriptionTooLong || step.kind !== 'review') return;
    const review = step;
    const recorded = !(file instanceof File);
    const request: CreateRecordingRequest = {
      contentType: videoContentType(file.type, recorded ? null : (file as File).name) ?? 'video/webm',
      size: file.size,
      description: message.trim(),
      contactEmail: contactEmail.trim(),
      source: recorded ? 'recorder' : 'upload',
      pageUrl: window.location.href,
      route: router.pathname,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      platform: navigator.platform || '',
      appVersion: config?.gitSha || process.env.NEXT_PUBLIC_GIT_SHA || '',
      clientTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      connectedWallet: user?.walletAddress || null,
      // Whichever session-replay tool is turned on publishes its session id here.
      replayId: (window as unknown as { __sessionReplayId?: string }).__sessionReplayId ?? null,
      captured: recorded ? captured : null,
      framedBy: framed ? framingOrigin() : null,
      console: recentConsoleProblems(),
    };
    setError(null);
    setStep({ kind: 'sending', fraction: 0 });
    try {
      await sendRecording({
        api: authenticatedFetch,
        file,
        request,
        onProgress: (fraction) => setStep({ kind: 'sending', fraction }),
      });
      setTriedToSend(false);
      setStep({ kind: 'sent', via: 'recording' });
    } catch (failure) {
      setError((failure instanceof UploadError && failure.shown) || t('report.failed'));
      setStep(review);
    }
  };

  const instructions = (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">{t(computer ? 'report.computerIntro' : 'report.phoneIntro')}</p>
      {computer && <p className="text-sm text-gray-700">{t('report.computerSteps')}</p>}
      {!computer && platform !== 'android' && (
        <div className="flex items-center gap-3">
          <RecordGlyph />
          <p className="text-sm text-gray-700">{t('report.iosSteps')}</p>
        </div>
      )}
      {!computer && platform !== 'ios' && (
        <div className="flex items-center gap-3">
          <RecordGlyph />
          <p className="text-sm text-gray-700">{t('report.androidSteps')}</p>
        </div>
      )}
      <p className="text-sm text-gray-700">{t(computer ? 'report.computerReturn' : 'report.phoneReturn')}</p>
    </div>
  );

  const canStart = inPage && !framedOut && !(step.kind === 'intro' && step.recorderRefused);
  // Refused inside somebody's frame: our own window can still record.
  const canStartInWindow = inPage && framed && !canStart && !(step.kind === 'intro' && step.windowBlocked);
  // Whichever recorder is running, the page's own or the window's.
  const live = recorder.recording ? recorder : recorderWindow.state === 'recording' ? recorderWindow : null;

  const uploadControl = (
    <>
      {/* No `capture`: that would open the camera, not the recordings already on the phone. */}
      <input ref={fileInput} type="file" accept="video/*" className="hidden" onChange={chooseFile} aria-label={t('report.upload')} />
      <Button type="button" onClick={() => fileInput.current?.click()}>{t('report.upload')}</Button>
    </>
  );

  const title = t(recordingFlow ? 'report.title' : 'feedback.title');
  const textareaClass = (invalid: boolean) =>
    `w-full rounded-md border px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${invalid ? 'border-red-500' : 'border-gray-300'}`;

  return (
    <TopLayer>
      {step.kind === 'closed' && (
        <button
          type="button"
          onClick={() => setStep({ kind: 'message' })}
          aria-label={t('feedback.title')}
          // Out of the way while the help chat is open over this corner (see ZipchatWidget).
          className="[html[data-chat-open]_&]:hidden fixed bottom-[max(1rem,var(--chat-clearance,0px))] right-4 sm:bottom-[max(1.5rem,var(--chat-clearance,0px))] sm:right-6 inline-flex items-center gap-2 rounded-full px-4 py-3 shadow-xl bg-secondary-900 text-white dark:bg-white dark:text-secondary-900 text-sm font-medium hover:scale-105 transition-transform"
        >
          <ChatBubbleLeftEllipsisIcon className="w-5 h-5" aria-hidden="true" />
          <span className="hidden sm:inline">{t('feedback.button')}</span>
        </button>
      )}

      {step.kind === 'recording' && recorderWindow.state === 'waiting' && (
        <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-gray-900 text-white pl-4 pr-2 py-2 shadow-xl max-w-[calc(100vw-2rem)]">
          <span className="text-sm font-medium">{t('report.windowWaiting')}</span>
          <button type="button" onClick={recorderWindow.cancel} className="rounded-full bg-white text-gray-900 px-3 py-1.5 text-sm font-semibold">
            {t('report.cancel')}
          </button>
        </div>
      )}

      {step.kind === 'recording' && live && (
        <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 max-w-[calc(100vw-2rem)]">
          {live.surface === 'browser' && (
            <p className="rounded-lg bg-amber-100 text-amber-900 text-sm px-3 py-2 shadow-xl text-center">{t('report.tabOnly')}</p>
          )}
          <div className="flex items-center gap-3 rounded-full bg-red-600 text-white pl-4 pr-2 py-2 shadow-xl">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
          <span className="text-sm font-medium tabular-nums">
            {t('report.recordingFor', { elapsed: clock(live.seconds), limit: clock(MAX_RECORDING_SECONDS) })}
          </span>
          <button
            type="button"
            onClick={live.stop}
            className="inline-flex items-center gap-1 rounded-full bg-white text-red-700 px-3 py-1.5 text-sm font-semibold"
          >
            <StopCircleIcon className="w-5 h-5" aria-hidden="true" />
            {t('report.stop')}
          </button>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 overflow-y-auto bg-black/40 flex items-start sm:items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && close()}>
          <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-2xl bg-white p-6 text-left text-gray-900 shadow-xl space-y-4">
            <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>

            {step.kind === 'message' && (
              <form onSubmit={sendMessage} noValidate className="space-y-4" aria-label={t('feedback.title')}>
                <p className="text-sm text-gray-600">{t('feedback.intro')}</p>
                <Input
                  type="email"
                  label={t('feedback.email')}
                  aria-label={t('feedback.email')}
                  autoComplete="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  error={messageError('contactEmail')}
                />
                <div className="space-y-1">
                  <label htmlFor="feedback-message" className="text-sm font-medium text-gray-700">{t('feedback.message')}</label>
                  <textarea
                    id="feedback-message"
                    rows={5}
                    maxLength={MAX_MESSAGE + 100}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    aria-invalid={!!messageError('message')}
                    aria-describedby={messageError('message') ? 'feedback-message-error' : undefined}
                    className={textareaClass(!!messageError('message'))}
                  />
                  {messageError('message') && (
                    <p id="feedback-message-error" className="text-sm text-red-600">{messageError('message')}</p>
                  )}
                </div>
                {recordingsLive && (
                  <button
                    type="button"
                    onClick={toRecording}
                    className="flex items-center gap-2 text-sm font-medium text-primary-700 hover:underline"
                  >
                    <VideoCameraIcon className="w-5 h-5" aria-hidden="true" />
                    {t('feedback.record')}
                  </button>
                )}
                {!partnerBrand && (
                  <a
                    href={BOOK_A_DEMO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-medium text-primary-700 hover:underline"
                  >
                    <CalendarDaysIcon className="w-5 h-5" aria-hidden="true" />
                    {t('feedback.bookDemo')}
                  </a>
                )}
                <p className="text-xs text-gray-500">{t('feedback.context')}</p>
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={close} disabled={step.sending}>{t('feedback.cancel')}</Button>
                  <Button type="submit" disabled={step.sending}>
                    {step.sending ? t('feedback.sending') : t('feedback.send')}
                  </Button>
                </div>
              </form>
            )}

            {step.kind === 'intro' && (
              <>
                {step.recorderRefused && !canStartInWindow && <p role="status" className="text-sm text-gray-700">{t('report.recorderRefused')}</p>}
                {canStart ? (
                  <p className="text-sm text-gray-700">{t('report.desktopIntro', { limit: clock(MAX_RECORDING_SECONDS) })}</p>
                ) : canStartInWindow ? (
                  <p className="text-sm text-gray-700">{t('report.windowIntro', { limit: clock(MAX_RECORDING_SECONDS) })}</p>
                ) : (
                  instructions
                )}
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">{t('report.warning')}</p>
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={backToMessage}>{t('report.back')}</Button>
                  {canStart ? (
                    <Button type="button" onClick={startRecording}>{t('report.start')}</Button>
                  ) : canStartInWindow ? (
                    <Button type="button" onClick={startInWindow}>{t('report.start')}</Button>
                  ) : (
                    uploadControl
                  )}
                </div>
              </>
            )}

            {(step.kind === 'review' || step.kind === 'sending') && (
              <form onSubmit={sendWithRecording} noValidate className="space-y-4" aria-label={t('report.title')}>
                {step.kind === 'review' && step.hitLimit && (
                  <p role="status" className="text-sm text-gray-700">{t('report.hitLimit', { limit: clock(MAX_RECORDING_SECONDS) })}</p>
                )}
                {preview && <video src={preview} controls playsInline className="w-full max-h-64 rounded-md bg-black" />}
                <div className="space-y-1">
                  <label htmlFor="report-description" className="text-sm font-medium text-gray-700">{t('report.description')}</label>
                  <textarea
                    id="report-description"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    aria-invalid={triedToSend && descriptionTooLong}
                    className={textareaClass(triedToSend && descriptionTooLong)}
                  />
                  {triedToSend && descriptionTooLong && (
                    <p className="text-sm text-red-600">{t('feedback.messageTooLong', { max: MAX_DESCRIPTION })}</p>
                  )}
                </div>
                <Input
                  type="email"
                  label={t('report.email')}
                  aria-label={t('report.email')}
                  autoComplete="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  error={triedToSend && emailMissing ? t('report.emailError') : undefined}
                />
                <p className="text-xs text-gray-500">{t('report.context')}</p>
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                {step.kind === 'sending' && (
                  <div className="space-y-1">
                    <div
                      role="progressbar"
                      aria-label={t('report.sending')}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(step.fraction * 100)}
                      className="h-2 w-full rounded-full bg-gray-200 overflow-hidden"
                    >
                      <div className="h-full bg-primary-600 transition-[width]" style={{ width: `${Math.round(step.fraction * 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-600">{t('report.progress', { percent: Math.round(step.fraction * 100) })}</p>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={discard} disabled={step.kind === 'sending'}>{t('report.discard')}</Button>
                  <Button type="submit" disabled={step.kind === 'sending'}>
                    {step.kind === 'sending' ? t('report.sending') : t('report.send')}
                  </Button>
                </div>
              </form>
            )}

            {step.kind === 'sent' && (
              <>
                <p role="status" className="text-sm text-gray-700">
                  {t(step.via === 'message' ? 'feedback.sent' : 'report.sent', { email: contactEmail.trim() })}
                </p>
                <div className="flex justify-end">
                  <Button type="button" onClick={close}>{t('report.close')}</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </TopLayer>
  );
}
