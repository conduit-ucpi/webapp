/**
 * "Report a problem": the rules the browser and the server share for a screen recording someone
 * sends us. Pure, so the form, the routes and their tests agree.
 *
 * The checks the browser makes with these are only fast feedback: the routes under
 * /api/recordings make them again and are the ones that decide.
 */

/** Phone recordings run to tens of MB a minute at native resolution. */
export const MAX_FILE_BYTES = 500 * 1024 * 1024;

/**
 * Past this a file goes up in parts, so a dropped connection costs one part and not the whole
 * file. Kept well under 100 MB on purpose: a phone on 4G is where connections drop.
 */
export const MULTIPART_THRESHOLD_BYTES = 16 * 1024 * 1024;
/** S3 and R2 want at least 5 MB for every part but the last. 500 MB is 63 parts of this. */
export const PART_BYTES = 8 * 1024 * 1024;

/** The in-page recorder stops itself here. */
export const MAX_RECORDING_SECONDS = 3 * 60;

export const MAX_DESCRIPTION = 2000;
export const MAX_CONSOLE_ENTRIES = 50;
export const MAX_CONSOLE_ENTRY = 1000;

/** In order of preference; the last one is what Safari records. */
export const RECORDER_MIME_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'] as const;

/** The first type this browser's MediaRecorder can write, or '' to let the browser choose. */
export function pickRecorderMimeType(isTypeSupported: (type: string) => boolean): string {
  return RECORDER_MIME_TYPES.find((type) => isTypeSupported(type)) ?? '';
}

/** Whether the page can record the screen itself. Feature detection only: never the user agent. */
export function canRecordInPage(nav: unknown = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  const mediaDevices = (nav as { mediaDevices?: { getDisplayMedia?: unknown } } | undefined)?.mediaDevices;
  return typeof mediaDevices?.getDisplayMedia === 'function' && typeof MediaRecorder !== 'undefined';
}

const VIDEO_TYPE = /^video\/[a-z0-9][a-z0-9.+-]{0,60}$/;
const TYPE_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp',
};
const EXTENSION_BY_TYPE: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'video/3gpp': '3gp',
};

/**
 * The plain video type of a file, without parameters ("video/webm;codecs=vp9" is "video/webm"),
 * or null when it is not a video. Some phones hand over a recording with no type at all, so the
 * file name's extension is the fallback.
 */
export function videoContentType(type: string | undefined | null, fileName?: string | null): string | null {
  const plain = (type ?? '').split(';')[0].trim().toLowerCase();
  if (VIDEO_TYPE.test(plain)) return plain;
  if (plain) return null;
  const extension = (fileName ?? '').toLowerCase().match(/\.([a-z0-9]{2,4})$/)?.[1];
  return (extension && TYPE_BY_EXTENSION[extension]) || null;
}

export const extensionFor = (contentType: string): string => EXTENSION_BY_TYPE[contentType] ?? 'bin';

export type FileProblem = 'notVideo' | 'tooLarge' | 'empty';

export function fileProblem(file: { size: number; type?: string; name?: string }): FileProblem | null {
  if (!videoContentType(file.type, file.name)) return 'notVideo';
  if (file.size <= 0) return 'empty';
  if (file.size > MAX_FILE_BYTES) return 'tooLarge';
  return null;
}

export const isMultipart = (size: number): boolean => size > MULTIPART_THRESHOLD_BYTES;
export const partCount = (size: number): number => Math.max(1, Math.ceil(size / PART_BYTES));

/** The byte range of a part, numbered from 1 as S3 numbers them. */
export function partRange(size: number, partNumber: number): { start: number; end: number } {
  const start = (partNumber - 1) * PART_BYTES;
  return { start, end: Math.min(size, start + PART_BYTES) };
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
export const isEmail = (value: string): boolean => EMAIL.test(value.trim());

/** What the browser knows about the moment of the report. The server cleans every field. */
export interface ReportContext {
  pageUrl: string;
  route: string;
  viewport: { width: number; height: number };
  platform: string;
  appVersion: string;
  clientTime: string;
  timezone: string;
  /** The wallet the page has connected, as the page sees it. The account is looked up server-side. */
  connectedWallet: string | null;
  replayId: string | null;
  /** What the in-page recorder was given to record. Null for an uploaded file, or when the browser does not say. */
  captured: CapturedSurface | null;
  /** The origin of the site whose page frames ours (a white-label partner's), or null when nobody does. */
  framedBy: string | null;
  console: string[];
}

/**
 * The recorder window. A page framed by another site can only record the screen if that site's
 * <iframe allow> says so, and we do not write partners' pages. A window of our own is nobody's
 * frame, so it can always record: the framed page opens it, it records, and it hands the video
 * back. Both are our origin, so they talk with postMessage and nothing passes through the partner.
 */
export const RECORDER_WINDOW_PATH = '/report-recorder';
export type RecorderWindowMessage =
  | { type: 'problem-recorder'; event: 'started'; surface: CapturedSurface | null }
  | { type: 'problem-recorder'; event: 'finished'; blob: Blob; hitLimit: boolean; surface: CapturedSurface | null }
  | { type: 'problem-recorder'; event: 'stop' };
export const recorderWindowMessage = (data: unknown): RecorderWindowMessage | null =>
  !!data && typeof data === 'object' && (data as { type?: unknown }).type === 'problem-recorder' ? (data as RecorderWindowMessage) : null;

/** The browser's own names: the whole screen, one window, or one tab. A tab shows nothing that opens beside it. */
export type CapturedSurface = 'monitor' | 'window' | 'browser';
export const capturedSurface = (value: unknown): CapturedSurface | null =>
  value === 'monitor' || value === 'window' || value === 'browser' ? value : null;

export interface CreateRecordingRequest extends ReportContext {
  contentType: string;
  size: number;
  description: string;
  contactEmail: string;
  /** 'recorder' for the in-page recorder, 'upload' for a file from the phone's own recorder. */
  source: 'recorder' | 'upload';
}

export type UploadPlan =
  | { kind: 'single'; url: string; headers: Record<string, string> }
  | { kind: 'multipart'; partBytes: number; partCount: number };

export interface CreateRecordingResponse {
  id: string;
  upload: UploadPlan;
}
