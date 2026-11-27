/**
 * The rules "Report a problem" shares between the browser and the routes: which recorder format,
 * which path, what counts as a video, and how a large file is cut into parts.
 */
import {
  MAX_FILE_BYTES,
  MULTIPART_THRESHOLD_BYTES,
  PART_BYTES,
  canRecordInPage,
  fileProblem,
  isMultipart,
  partCount,
  partRange,
  pickRecorderMimeType,
  videoContentType,
} from '@/lib/problemReport';

it('records in the first format the browser supports, in order of preference', () => {
  expect(pickRecorderMimeType(() => true)).toBe('video/webm;codecs=vp9');
  expect(pickRecorderMimeType((type) => type === 'video/webm' || type === 'video/mp4')).toBe('video/webm');
  expect(pickRecorderMimeType((type) => type === 'video/mp4')).toBe('video/mp4');
  expect(pickRecorderMimeType(() => false)).toBe('');
});

it('chooses the path by what the browser can do, not by what it says it is', () => {
  (global as any).MediaRecorder = function MediaRecorder() {};
  expect(canRecordInPage({ userAgent: 'iPhone', mediaDevices: { getDisplayMedia: () => {} } })).toBe(true);
  expect(canRecordInPage({ userAgent: 'Chrome on Windows', mediaDevices: {} })).toBe(false);
  expect(canRecordInPage({})).toBe(false);
  delete (global as any).MediaRecorder;
  expect(canRecordInPage({ mediaDevices: { getDisplayMedia: () => {} } })).toBe(false);
});

it('accepts video only, reading the type without its parameters', () => {
  expect(videoContentType('video/webm;codecs=vp9')).toBe('video/webm');
  expect(videoContentType('video/quicktime')).toBe('video/quicktime');
  expect(videoContentType('image/png')).toBeNull();
  expect(videoContentType('text/html', 'clip.mp4')).toBeNull();
  expect(videoContentType('video/x"><script>')).toBeNull();
});

it('falls back to the file name when a phone gives no type at all', () => {
  expect(videoContentType('', 'RPReplay_Final1731230000.MOV')).toBe('video/quicktime');
  expect(videoContentType('', 'notes.txt')).toBeNull();
});

it('refuses files that are not video, empty, or over 500 MB', () => {
  expect(fileProblem({ size: 10, type: 'application/pdf', name: 'a.pdf' })).toBe('notVideo');
  expect(fileProblem({ size: 0, type: 'video/mp4' })).toBe('empty');
  expect(fileProblem({ size: MAX_FILE_BYTES + 1, type: 'video/mp4' })).toBe('tooLarge');
  expect(fileProblem({ size: MAX_FILE_BYTES, type: 'video/mp4' })).toBeNull();
});

it('sends anything over 100 MB in parts, and cuts the parts to cover the file exactly', () => {
  expect(MULTIPART_THRESHOLD_BYTES).toBeLessThanOrEqual(100 * 1024 * 1024);
  expect(isMultipart(MULTIPART_THRESHOLD_BYTES)).toBe(false);
  expect(isMultipart(100 * 1024 * 1024 + 1)).toBe(true);

  const size = 2 * PART_BYTES + 5;
  expect(partCount(size)).toBe(3);
  expect(partRange(size, 1)).toEqual({ start: 0, end: PART_BYTES });
  expect(partRange(size, 3)).toEqual({ start: 2 * PART_BYTES, end: size });
  expect(partCount(MAX_FILE_BYTES)).toBeLessThanOrEqual(10_000);
});
