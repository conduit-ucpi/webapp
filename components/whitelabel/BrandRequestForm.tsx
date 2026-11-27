import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '@/lib/apiFetch';
import {
  EMPTY_REQUEST,
  WHITE_LABEL_INBOX,
  attachmentProblem,
  buildEmail,
  buildPayload,
  validateRequest,
  type RequestAttachment,
  type WhiteLabelRequest,
} from '@/lib/whiteLabelRequest';

/*
 * Step 1 of the white-label guide, self-serve: the partner pastes their whole brand config, gives
 * their contact address and domains, attaches their logo and font files, and sends it. It goes to
 * white-label@stabledrop.me through emailservice — which, not this page, decides the recipient.
 * "Copy email" stays as the fallback for when sending is not possible.
 */

function readAttachment(file: File): Promise<RequestAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      resolve({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        contentBase64: url.slice(url.indexOf(',') + 1),
        size: file.size,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type SendState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; to: string } | { kind: 'failed'; message: string };

const input =
  'w-full rounded-md border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 px-3 py-2 text-sm text-secondary-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500';

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-semibold text-secondary-800 dark:text-secondary-200 mb-1">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">{hint}</p>
      ) : null}
    </div>
  );
}

export default function BrandRequestForm({ example }: { example: string }) {
  const [req, setReq] = useState<WhiteLabelRequest>(EMPTY_REQUEST);
  const [touched, setTouched] = useState<Partial<Record<keyof WhiteLabelRequest, boolean>>>({});
  const [triedToSend, setTriedToSend] = useState(false);
  const [attachments, setAttachments] = useState<RequestAttachment[]>([]);
  const [state, setState] = useState<SendState>({ kind: 'idle' });

  const problems = useMemo(() => validateRequest(req), [req]);
  const fileProblem = attachmentProblem(attachments);
  const ready = Object.keys(problems).length === 0 && !fileProblem;
  const email = useMemo(() => (Object.keys(problems).length === 0 ? buildEmail(req) : null), [req, problems]);

  const pickAttachments = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    try {
      setAttachments(await Promise.all(files.map(readAttachment)));
    } catch {
      toast.error('A file could not be read. Try attaching it again.');
    }
  };

  const send = async () => {
    setTriedToSend(true);
    if (!ready || state.kind === 'sending') return;
    setState({ kind: 'sending' });
    try {
      const response = await apiFetch('/api/white-label-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(req, attachments)),
      });
      if (response.ok) return setState({ kind: 'sent', to: req.contactEmail.trim() });
      const body = await response.json().catch(() => ({}));
      setState({ kind: 'failed', message: body.error || 'The request could not be sent.' });
    } catch {
      setState({ kind: 'failed', message: 'The request could not be sent.' });
    }
  };

  const set = (key: keyof WhiteLabelRequest) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setReq((r) => ({ ...r, [key]: e.target.value }));
  const blur = (key: keyof WhiteLabelRequest) => () => setTouched((t) => ({ ...t, [key]: true }));
  const errorFor = (key: keyof WhiteLabelRequest) => (touched[key] || triedToSend ? problems[key] : undefined);
  const a11y = (key: keyof WhiteLabelRequest) => ({
    'aria-invalid': !!errorFor(key),
    'aria-describedby': errorFor(key) ? `wl-${key}-error` : undefined,
  });

  const readConfigFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReq((r) => ({ ...r, configJson: String(reader.result ?? '') }));
      setTouched((t) => ({ ...t, configJson: true }));
    };
    reader.readAsText(file);
  };

  const copyEmail = () => {
    setTriedToSend(true);
    if (!email) return;
    navigator.clipboard.writeText(`To: ${email.to}\nSubject: ${email.subject}\n\n${email.body}`).then(
      () => toast.success('Email copied: paste it into a new message'),
      () => toast.error('Could not copy: write to the address below instead')
    );
  };

  return (
    <form
      aria-label="White-label request"
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field id="wl-contactName" label="Your name">
          <input id="wl-contactName" className={input} value={req.contactName} onChange={set('contactName')} autoComplete="name" />
        </Field>
        <Field id="wl-contactEmail" label="Your email address" hint="Required. We reply here." error={errorFor('contactEmail')}>
          <input id="wl-contactEmail" type="email" className={input} value={req.contactEmail} onChange={set('contactEmail')} onBlur={blur('contactEmail')} autoComplete="email" {...a11y('contactEmail')} />
        </Field>
        <Field id="wl-productionDomains" label="Production domains" hint="The sites that will host the pages, e.g. your-site.example, www.your-site.example" error={errorFor('productionDomains')}>
          <textarea id="wl-productionDomains" rows={2} className={input} value={req.productionDomains} onChange={set('productionDomains')} onBlur={blur('productionDomains')} {...a11y('productionDomains')} />
        </Field>
        <Field id="wl-testDomains" label="Test domains" hint="Optional, e.g. staging.your-site.example" error={errorFor('testDomains')}>
          <textarea id="wl-testDomains" rows={2} className={input} value={req.testDomains} onChange={set('testDomains')} onBlur={blur('testDomains')} {...a11y('testDomains')} />
        </Field>
      </div>

      <Field id="wl-configJson" label="Brand config" hint="Paste your whole brand config JSON, or upload the file. It must include your brand id as &quot;id&quot; and your display name as &quot;name&quot;." error={errorFor('configJson')}>
        <textarea id="wl-configJson" rows={10} className={`${input} font-mono text-xs`} value={req.configJson} onChange={set('configJson')} onBlur={blur('configJson')} placeholder={example} {...a11y('configJson')} />
        <input type="file" accept="application/json,.json" onChange={readConfigFile} className="mt-2 block text-xs text-secondary-600 dark:text-secondary-400" aria-label="Upload a brand config file" />
      </Field>

      <Field id="wl-attachments" label="Logo and font files" hint="Your logo (and a dark-background version), favicon, share image and any WOFF2 fonts. PNG, JPEG, WebP, SVG, ICO or WOFF2; up to 6 files, 1 MB each." error={triedToSend || attachments.length ? fileProblem ?? undefined : undefined}>
        <input id="wl-attachments" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.svg,.ico,.woff2" onChange={pickAttachments} className="block text-sm text-secondary-700 dark:text-secondary-300" />
        {attachments.length > 0 && (
          <ul className="mt-2 text-xs text-secondary-600 dark:text-secondary-400 space-y-0.5">
            {attachments.map((f) => (
              <li key={f.filename}>{f.filename} · {Math.ceil(f.size / 1024)} KB</li>
            ))}
          </ul>
        )}
      </Field>

      <Field id="wl-notes" label="Anything else">
        <textarea id="wl-notes" rows={2} className={input} value={req.notes} onChange={set('notes')} />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state.kind === 'sending' || state.kind === 'sent'} className="rounded-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 disabled:opacity-60">
          {state.kind === 'sending' ? 'Sending…' : state.kind === 'sent' ? 'Sent' : 'Send request'}
        </button>
        <button type="button" onClick={copyEmail} className="rounded-md border border-secondary-300 dark:border-secondary-600 text-sm font-semibold px-4 py-2 text-secondary-800 dark:text-secondary-200">
          Copy email
        </button>
      </div>
      {triedToSend && !ready && state.kind !== 'sending' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">Fix the highlighted fields first.</p>
      )}
      {state.kind === 'sent' && (
        <p role="status" className="text-sm text-teal-700 dark:text-teal-300">
          Sent. We will reply to {state.to} once your brand is set up.
        </p>
      )}
      {state.kind === 'failed' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message} Use Copy email and send it to <strong className="select-all">{WHITE_LABEL_INBOX}</strong> yourself, with your files attached.
        </p>
      )}
      <p className="text-sm text-secondary-500 dark:text-secondary-400">
        It goes to <strong className="select-all">{WHITE_LABEL_INBOX}</strong>, with your files attached, and we reply to the
        address you give.
      </p>
    </form>
  );
}
