# Design references

Verbatim snapshots of third-party sites, captured so a layout can be studied and
pulled apart. **Reference material only.**

## Rules

- **Never move these into `public/`.** Anything under `public/` is emitted by the
  static export and served from stabledrop.me. Publishing one of these would put
  another company's branding, copy and product claims on our domain.
- Served by `pages/api/design-reference/[...path].ts`, a server route, so they
  are reachable on the box build at `/cobro-demo` (or
  `/api/design-reference/<name>/index.html` directly) and absent from the static
  GitHub Pages export, which only emits from `public/`.
- Take the layout, the spacing, the type scale. Do not take the copy, the brand,
  the logo, or claims about what a product does.

## Contents

### `cobro/`

- **Source:** https://payments.co.ve (COBRO, part of Latido Capital)
- **Captured:** 2026-09-10, rendered DOM at 1440px
- **Processing:** scripts stripped so the captured DOM stays put; stylesheets
  inlined into a single `<style id="captured-styles">`; fonts and images
  downloaded to `assets/` and rewritten to relative paths, so the file is
  self-contained and renders offline.
- **Our own take on this layout:** `/landing9` — same structure and treatment,
  Stabledrop's content, no borrowed branding.

Note the snapshot is a single 317KB `index.html`. Editing it is fine; it is not
wired to anything and nothing imports from it.
