import { partRange, type CreateRecordingRequest, type CreateRecordingResponse } from '@/lib/problemReport';

/**
 * Sending a recording: ask our API where it goes, PUT the file straight to the bucket, then tell
 * our API it is there. The video itself never goes to our API.
 *
 * Phone connections drop, so every step is tried again a few times with a growing pause, and a
 * large file goes up in parts so that a drop costs one part. Each part's URL is asked for just
 * before it is sent, because a URL lives 15 minutes and a big upload takes longer.
 */

/** Our own API, through the caller's authenticated fetch (which resolves the API's host). */
export type Api = (path: string, init?: RequestInit) => Promise<Response>;

/** PUT bytes to a signed URL, reporting how many have gone. Rejects on anything but a 2xx. */
export type Put = (url: string, body: Blob, headers: Record<string, string>, onSent: (bytes: number) => void) => Promise<void>;

export class UploadError extends Error {
  /** `message` is one our API wrote for the person, when it gave one. */
  constructor(message: string | null, readonly retryable: boolean) {
    super(message ?? 'upload failed');
  }
  readonly shown = this.message !== 'upload failed' ? this.message : null;
}

const xhrPut: Put = (url, body, headers, onSent) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => onSent(event.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`PUT answered ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('PUT failed'));
    xhr.onabort = () => reject(new Error('PUT aborted'));
    xhr.send(body);
  });

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function retrying<T>(attempts: number, wait: (ms: number) => Promise<unknown>, task: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const final = error instanceof UploadError && !error.retryable;
      if (final || attempt >= attempts) throw error;
      await wait(1000 * 2 ** (attempt - 1));
    }
  }
}

/** POST JSON to our API. A 4xx is the API saying no, and is not tried again; anything else is. */
async function post<T>(api: Api, path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new UploadError(null, true);
  }
  const answer = await response.json().catch(() => ({}));
  if (response.ok) return answer as T;
  const refused = response.status >= 400 && response.status < 500 && response.status !== 409 && response.status !== 429;
  throw new UploadError(typeof answer?.error === 'string' ? answer.error : null, !refused);
}

export interface SendOptions {
  api: Api;
  file: Blob;
  request: CreateRecordingRequest;
  /** 0 to 1, as bytes reach the bucket. */
  onProgress?: (fraction: number) => void;
  put?: Put;
  attempts?: number;
  wait?: (ms: number) => Promise<unknown>;
}

/** Send the file and its context. Resolves with the recording id once we have been told. */
export async function sendRecording({ api, file, request, onProgress, put = xhrPut, attempts = 4, wait = pause }: SendOptions): Promise<string> {
  const progress = (bytes: number) => onProgress?.(Math.min(1, bytes / Math.max(1, file.size)));
  const created = await retrying(attempts, wait, () => post<CreateRecordingResponse>(api, '/api/recordings', request));
  const { id, upload } = created;

  if (upload.kind === 'single') {
    await retrying(attempts, wait, () => put(upload.url, file, upload.headers, progress));
  } else {
    let done = 0;
    for (let partNumber = 1; partNumber <= upload.partCount; partNumber += 1) {
      const { start, end } = partRange(file.size, partNumber);
      await retrying(attempts, wait, async () => {
        const { url } = await post<{ url: string }>(api, `/api/recordings/${id}/part-url`, { partNumber });
        await put(url, file.slice(start, end), {}, (sent) => progress(done + sent));
      });
      done = end;
      progress(done);
    }
  }
  progress(file.size);

  await retrying(attempts, wait, () => post(api, `/api/recordings/${id}/complete`, {}));
  return id;
}
