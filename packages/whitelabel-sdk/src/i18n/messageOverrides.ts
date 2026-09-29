/**
 * A brand's rewording of catalogue strings, checked against the catalogue this
 * build actually ships.
 *
 * The white-label service stores overrides as plain strings and cannot know the
 * catalogue, so this is where they are held to it. Two rules:
 *
 *   - the key must exist. An unknown key is a typo or a string since removed,
 *     and would otherwise sit unused where nobody notices;
 *   - the override must use exactly the `{placeholders}` of the string it
 *     replaces. Dropping `{amount}` from a payment sentence changes what a payer
 *     is told they are agreeing to; adding `{foo}` renders a literal `{foo}`.
 *
 * A failing override is dropped and our wording shows instead — a partner's
 * page reading slightly off-brand is a far smaller failure than a wrong figure.
 */

const PLACEHOLDER = /\{(\w+)\}/g;

export function placeholderSet(template: string): string {
  return Array.from(new Set(Array.from(template.matchAll(PLACEHOLDER), (m) => m[1])))
    .sort()
    .join(',');
}

export interface SanitizedOverrides {
  accepted: Record<string, string>;
  /** Keys dropped, with why. Surfaced as a console warning in development. */
  rejected: { key: string; reason: 'unknown-key' | 'placeholders' | 'not-a-string' }[];
}

export function sanitizeOverrides(
  overrides: Record<string, unknown> | undefined,
  catalogue: Record<string, string>
): SanitizedOverrides {
  const accepted: Record<string, string> = {};
  const rejected: SanitizedOverrides['rejected'] = [];
  if (!overrides) return { accepted, rejected };

  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.prototype.hasOwnProperty.call(catalogue, key)) {
      rejected.push({ key, reason: 'unknown-key' });
    } else if (typeof value !== 'string' || value.trim() === '') {
      rejected.push({ key, reason: 'not-a-string' });
    } else if (placeholderSet(value) !== placeholderSet(catalogue[key])) {
      rejected.push({ key, reason: 'placeholders' });
    } else {
      accepted[key] = value;
    }
  }
  return { accepted, rejected };
}
