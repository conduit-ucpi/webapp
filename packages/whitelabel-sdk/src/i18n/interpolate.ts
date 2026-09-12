/**
 * Fill `{name}` placeholders from a vars object.
 *
 * An unmatched placeholder is left as written rather than blanked. A visible
 * `{amount}` is a bug report; an empty gap where a number should be is a
 * mistranslated figure nobody notices.
 */
export function interpolate(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}
