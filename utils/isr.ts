/**
 * ISR (`revalidate`) is rejected by `output: 'export'` — the static build has no
 * server to regenerate anything. These pages are static marketing content, so the
 * export simply bakes them at build time; the box build keeps revalidating as before.
 *
 * Returns a spreadable fragment rather than `revalidate: undefined`, because Next
 * treats the key's presence as opting into ISR regardless of its value.
 *
 *   return { props: {}, ...isr(3600) };
 */
export function isr(seconds: number): { revalidate?: number } {
  return process.env.STATIC_EXPORT === 'true' ? {} : { revalidate: seconds };
}
