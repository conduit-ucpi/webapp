/** @type {import('next').NextConfig} */


// Static-export mode, used only by the GitHub Pages build. Unset everywhere else,
// so the production box keeps building exactly as before while both deployments
// run in parallel (STATIC_FRONTEND_MIGRATION_PLAN.md, Phase 2 step 8).
//
// rewrites/redirects/headers are all server features: Next cannot apply them to a
// static export, and GitHub Pages cannot set response headers at all. They are
// omitted rather than left in place so the build fails loudly if that changes,
// instead of silently dropping the frame-ancestors CSP.
const isStaticExport = process.env.STATIC_EXPORT === 'true';

function normaliseBasePath(value) {
  if (!value) return undefined;
  const v = value.trim();
  // '/' is the value GitHub accepts when you mean "no prefix" — it refuses to
  // store an empty variable. Next rejects basePath '/' outright ("should not end
  // with /"), so it has to normalise to undefined, same as the repo's existing
  // 'null' convention.
  // Case-insensitive: the repo's convention is lowercase 'null', but the value is
  // typed by hand into a GitHub variable and 'NULL' would otherwise become a
  // literal basePath of '/NULL'.
  const lowered = v.toLowerCase();
  if (!v || lowered === 'null' || lowered === 'undefined' || v === '/') return undefined;
  const withLeadingSlash = v.startsWith('/') ? v : `/${v}`;
  // A trailing slash is rejected for the same reason.
  return withLeadingSlash.replace(/\/+$/, '') || undefined;
}

const serverOnlyConfig = {
  output: 'standalone',

  // Rewrite .well-known/farcaster.json to dynamic API route
  async rewrites() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: '/api/farcaster.json'
      },
      // Standalone static page — served at a clean path, not linked from anywhere
      {
        source: '/early-payment-offer2',
        destination: '/early-payment-offer2.html'
      }
    ]
  },

  // Redirects to external content
  async redirects() {
    return [
      {
        source: '/whats-wrong-with-payments',
        destination: 'https://medium.com/@charliepank/whats-wrong-with-payments-e2ea2bbeec87',
        permanent: true, // 301 permanent redirect
      }
    ]
  },

  // Headers configuration for iframe embedding and security
  async headers() {
    // Default frame ancestors for development and basic functionality
    const defaultFrameAncestors = "'self' https://warpcast.com https://*.farcaster.xyz https://farcaster.xyz";

    // Check environment variable for additional allowed domains
    // Can be set to:
    // - Specific domains: "https://merchant1.com https://merchant2.com"
    // - Wildcard patterns: "https://*.wordpress.com https://*.shopify.com"
    // - '*' to allow all domains (use with caution)
    const allowedFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS;

    let frameAncestorsValue;
    if (allowedFrameAncestors === '*') {
      // Allow all domains - removes frame-ancestors restriction entirely
      frameAncestorsValue = "*";
    } else if (allowedFrameAncestors) {
      // Combine default with additional allowed domains
      frameAncestorsValue = `${defaultFrameAncestors} ${allowedFrameAncestors}`;
    } else {
      // Use default frame ancestors
      frameAncestorsValue = defaultFrameAncestors;
    }

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL'
          },
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${frameAncestorsValue}`
          }
        ]
      }
    ]
  }
};

const staticExportConfig = {
  output: 'export',

  // GitHub Pages resolves /foo by looking for /foo/index.html, which is what
  // trailingSlash produces. Without it the export emits /foo.html and every
  // route 404s on Pages.
  trailingSlash: true,

  // The export has no server, so there is no image optimiser to call.
  images: { unoptimized: true },

  // Empty for a custom domain (stabledrop.me); '/webapp' while validating on the
  // default conduit-ucpi.github.io/webapp URL (Phase 2 step 9).
  //
  // The repo's convention is the literal string 'null' for "no basePath" (see
  // .env.local and .env.example), which Next rejects as a path — normalise it and
  // the empty string back to undefined.
  basePath: normaliseBasePath(process.env.NEXT_PUBLIC_BASE_PATH),
};

const nextConfig = {
  reactStrictMode: false,

  // Derive the build ID from the commit instead of letting Next generate a
  // random one. Two reasons, both about being able to check what is live:
  //
  //  1. Reproducibility. The build ID names the asset directory
  //     (_next/static/<buildId>/...), so a random one means two builds of the
  //     SAME commit produce different paths and cannot be compared. Pinning it
  //     to the sha is what makes "rebuild the tagged commit and diff it against
  //     what stabledrop.me is serving" a check that can actually run — the
  //     tamper-detection monitor depends on this.
  //  2. Identifiability. The live asset path now states which commit built it,
  //     without having to grep the bundle for an inlined version string.
  //
  // NEXT_PUBLIC_GIT_SHA is exported by both CI jobs (the box build sets it from
  // env vars, the Pages build from `git rev-parse`). Returning null locally
  // tells Next to fall back to its own random ID, so dev is unaffected.
  //
  // This puts the commit sha in asset URLs. It was already inlined in the
  // bundle as NEXT_PUBLIC_GIT_SHA and reported by /api/config, so nothing new
  // is disclosed.
  generateBuildId: () => process.env.NEXT_PUBLIC_GIT_SHA || null,

  ...(isStaticExport ? staticExportConfig : serverOnlyConfig),
};

module.exports = nextConfig
