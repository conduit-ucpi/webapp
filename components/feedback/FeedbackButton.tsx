import { useEffect, useState, type FormEvent } from 'react';
import { ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/components/auth';
import { usePageT } from '@/config/locales';
import { MAX_MESSAGE, buildFeedbackPayload, validateFeedback, type FeedbackDraft } from '@/lib/inAppFeedback';

type State = { kind: 'editing' } | { kind: 'sending' } | { kind: 'sent'; to: string } | { kind: 'failed'; message: string };

/**
 * The floating feedback button, bottom right on every page (mounted once in ClientOnlyApp, outside
 * Layout, so no layout branch can leave it out). It opens a form that emails our inbox through
 * /api/in-app-feedback. The page URL goes with the message; the signed-in account is added by the
 * server, never by this component.
 */
export default function FeedbackButton() {
  const t = usePageT();
  const { user, authenticatedFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FeedbackDraft>({ contactEmail: '', message: '' });
  const [triedToSend, setTriedToSend] = useState(false);
  const [state, setState] = useState<State>({ kind: 'editing' });

  // Start from the account's email when there is one; whatever they type wins.
  useEffect(() => {
    if (user?.email) setDraft((d) => (d.contactEmail ? d : { ...d, contactEmail: user.email }));
  }, [user?.email]);

  const problems = validateFeedback(draft);
  const errorFor = (key: keyof FeedbackDraft) => {
    const problem = triedToSend ? problems[key] : undefined;
    return problem ? t(`feedback.${problem}`, { max: MAX_MESSAGE }) : undefined;
  };

  const close = () => {
    setOpen(false);
    // A sent message is done with; an unsent one is kept in case they come back to it.
    if (state.kind === 'sent') {
      setDraft((d) => ({ ...d, message: '' }));
      setTriedToSend(false);
      setState({ kind: 'editing' });
    }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setTriedToSend(true);
    if (Object.keys(problems).length > 0 || state.kind === 'sending') return;
    setState({ kind: 'sending' });
    try {
      const response = await authenticatedFetch('/api/in-app-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFeedbackPayload(draft, window.location.href)),
      });
      if (response.ok) return setState({ kind: 'sent', to: draft.contactEmail.trim() });
      const body = await response.json().catch(() => ({}));
      setState({ kind: 'failed', message: body.error || t('feedback.failed') });
    } catch {
      setState({ kind: 'failed', message: t('feedback.failed') });
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('feedback.title')}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 inline-flex items-center gap-2 rounded-full px-4 py-3 shadow-xl bg-secondary-900 text-white dark:bg-white dark:text-secondary-900 text-sm font-medium hover:scale-105 transition-transform"
        >
          <ChatBubbleLeftEllipsisIcon className="w-5 h-5" aria-hidden="true" />
          <span className="hidden sm:inline">{t('feedback.button')}</span>
        </button>
      )}

      <Modal isOpen={open} onClose={close} title={t('feedback.title')}>
        {state.kind === 'sent' ? (
          <div className="space-y-4">
            <p role="status" className="text-sm text-gray-700">{t('feedback.sent', { email: state.to })}</p>
            <div className="flex justify-end">
              <Button type="button" onClick={close}>{t('feedback.close')}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={send} noValidate className="space-y-4" aria-label={t('feedback.title')}>
            <p className="text-sm text-gray-600">{t('feedback.intro')}</p>
            <Input
              type="email"
              label={t('feedback.email')}
              aria-label={t('feedback.email')}
              autoComplete="email"
              value={draft.contactEmail}
              onChange={(e) => setDraft((d) => ({ ...d, contactEmail: e.target.value }))}
              error={errorFor('contactEmail')}
            />
            <div className="space-y-1">
              <label htmlFor="feedback-message" className="text-sm font-medium text-gray-700">
                {t('feedback.message')}
              </label>
              <textarea
                id="feedback-message"
                rows={5}
                maxLength={MAX_MESSAGE + 100}
                value={draft.message}
                onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
                aria-invalid={!!errorFor('message')}
                aria-describedby={errorFor('message') ? 'feedback-message-error' : undefined}
                className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${errorFor('message') ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errorFor('message') && (
                <p id="feedback-message-error" className="text-sm text-red-600">{errorFor('message')}</p>
              )}
            </div>
            <p className="text-xs text-gray-500">{t('feedback.context')}</p>
            {state.kind === 'failed' && <p role="alert" className="text-sm text-red-600">{state.message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>{t('feedback.cancel')}</Button>
              <Button type="submit" disabled={state.kind === 'sending'}>
                {state.kind === 'sending' ? t('feedback.sending') : t('feedback.send')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
