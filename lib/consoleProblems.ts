import { MAX_CONSOLE_ENTRIES, MAX_CONSOLE_ENTRY } from '@/lib/problemReport';

/**
 * The last 50 console errors and warnings on this page, kept in memory so a problem report can
 * carry them. They go nowhere unless the person sends a report.
 *
 * console.warn and console.error are wrapped (the original still runs first, untouched), and
 * uncaught errors and unhandled rejections are heard as events, since those never pass through
 * console at all.
 */
const entries: string[] = [];
let watching = false;

const describe = (arg: unknown): string => {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
};

function keep(level: string, args: unknown[]) {
  try {
    const text = `${new Date().toISOString()} ${level} ${args.map(describe).join(' ')}`;
    entries.push(text.slice(0, MAX_CONSOLE_ENTRY));
    if (entries.length > MAX_CONSOLE_ENTRIES) entries.splice(0, entries.length - MAX_CONSOLE_ENTRIES);
  } catch {
    /* never let this break the page */
  }
}

export function watchConsoleProblems() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  (['warn', 'error'] as const).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      keep(level, args);
    };
  });
  window.addEventListener('error', (event) => keep('uncaught', [event.message || 'error']));
  window.addEventListener('unhandledrejection', (event) => keep('unhandled-rejection', [event.reason]));
}

export const recentConsoleProblems = (): string[] => [...entries];
