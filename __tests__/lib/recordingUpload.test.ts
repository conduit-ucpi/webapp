/**
 * Sending a recording from the browser: metadata to our API, the file to the bucket, then
 * completion. Retries what a dropped connection breaks; does not retry what the API refused.
 */
import { PART_BYTES, type CreateRecordingRequest } from '@/lib/problemReport';
import { UploadError, sendRecording } from '@/lib/recordingUpload';

const request = { contentType: 'video/webm', size: 3 } as CreateRecordingRequest;
const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const noWait = async () => undefined;

it('creates, PUTs the file to the signed URL with its headers, then completes', async () => {
  const api = jest.fn(async (path: string) =>
    path === '/api/recordings'
      ? json(201, { id: 'rec-1', upload: { kind: 'single', url: 'https://bucket.example/put', headers: { 'Content-Type': 'video/webm' } } })
      : json(200, { received: true })
  );
  const put = jest.fn(async (_url, body: Blob, _headers, onSent) => onSent(body.size));
  const fractions: number[] = [];
  const file = new Blob(['abc']);

  const id = await sendRecording({ api, file, request, put, onProgress: (f) => fractions.push(f), wait: noWait });

  expect(id).toBe('rec-1');
  expect(JSON.parse((api.mock.calls[0] as any)[1].body)).toEqual(request);
  expect(put).toHaveBeenCalledWith('https://bucket.example/put', file, { 'Content-Type': 'video/webm' }, expect.any(Function));
  expect(api.mock.calls[1][0]).toBe('/api/recordings/rec-1/complete');
  expect(fractions[fractions.length - 1]).toBe(1);
});

it('sends a large file part by part, asking for each URL as it goes and retrying a part that fails', async () => {
  const file = new Blob([new Uint8Array(PART_BYTES + 10)]);
  const api = jest.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/recordings') return json(201, { id: 'rec-2', upload: { kind: 'multipart', partBytes: PART_BYTES, partCount: 2 } });
    if (path.endsWith('/part-url')) return json(200, { url: `https://bucket.example/part-${JSON.parse(String(init!.body)).partNumber}` });
    return json(200, { received: true });
  });
  let failures = 1;
  const sizes: Record<string, number> = {};
  const put = jest.fn(async (url: string, body: Blob) => {
    if (url.endsWith('part-2') && failures-- > 0) throw new Error('connection dropped');
    sizes[url] = body.size;
  });

  await sendRecording({ api, file, request: { ...request, size: file.size }, put, wait: noWait });

  expect(sizes).toEqual({ 'https://bucket.example/part-1': PART_BYTES, 'https://bucket.example/part-2': 10 });
  // The failed part asked for a fresh URL before trying again.
  expect(api.mock.calls.filter(([path]) => path.endsWith('/part-url'))).toHaveLength(3);
  expect(api.mock.calls[api.mock.calls.length - 1][0]).toBe('/api/recordings/rec-2/complete');
});

it('stops at once, with the API\'s own words, when the API refuses', async () => {
  const api = jest.fn(async () => json(400, { error: 'Only video files can be sent.' }));
  const put = jest.fn();
  const failure = await sendRecording({ api, file: new Blob(['x']), request, put, wait: noWait }).catch((e) => e);
  expect(failure).toBeInstanceOf(UploadError);
  expect(failure.shown).toBe('Only video files can be sent.');
  expect(api).toHaveBeenCalledTimes(1);
  expect(put).not.toHaveBeenCalled();
});

it('tries completion again when we could not be told the first time', async () => {
  let completions = 0;
  const api = jest.fn(async (path: string) => {
    if (path === '/api/recordings') return json(201, { id: 'rec-3', upload: { kind: 'single', url: 'https://bucket.example/put', headers: {} } });
    completions += 1;
    return completions === 1 ? json(502, { error: 'Your recording arrived, but we could not be told.' }) : json(200, { received: true });
  });
  await sendRecording({ api, file: new Blob(['x']), request, put: async () => undefined, wait: noWait });
  expect(completions).toBe(2);
});

it('gives up after the allowed attempts when the connection stays down', async () => {
  const api = jest.fn(async () => {
    throw new TypeError('Failed to fetch');
  });
  const failure = await sendRecording({ api, file: new Blob(['x']), request, put: jest.fn(), attempts: 3, wait: noWait }).catch((e) => e);
  expect(failure).toBeInstanceOf(UploadError);
  expect(failure.shown).toBeNull();
  expect(api).toHaveBeenCalledTimes(3);
});
