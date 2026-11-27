#!/usr/bin/env node
/**
 * Writes public/sitemap.xml at build time.
 *
 * This used to be pages/sitemap.xml.tsx, rendering the XML per request via
 * getServerSideProps — which a static export cannot do. Emitting a real file into
 * public/ works identically for both builds: the box serves it as a static asset,
 * and the export copies it into the bundle.
 *
 * `lastmod` is therefore the build time rather than the request time, which is
 * closer to the truth anyway — the pages only change when a build ships.
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://stabledrop.me';
const PAGES_DIR = path.join(__dirname, '..', 'pages');

/*
 * Every page under pages/ goes in, so a new page is listed without anyone remembering to.
 * Left out: API routes, _app/_document, dynamic routes, any page that says `noindex`, and the
 * pages below, which are only reached signed in, from a link, or by a partner's embed.
 */
const PRIVATE = new Set([
  '/admin', '/admin/email', '/api-keys', '/myAPIAccessCode', '/sd-reporting', '/report-recorder',
  '/dashboard', // robots.txt disallows it
  '/contract-pay', '/contract-create', // need a contract id; contract-create is the embed
  '/disputes', '/offers', '/liquidity',
  '/email-verification', '/verify-email', '/onramp-return', '/offramp-return',
  '/b2b', '/p2p', // the /sell page under other names
  '/projects', '/projects/create',
  '/landing_simple', // the homepage under its working name
  '/shopify/embedded', '/shopify/install-button', '/shopify/merchant-settings', '/shopify/setup-required',
]);

// Anything not named here gets 0.6 / weekly.
const RANKING = {
  '': ['1.0', 'daily'],
  '/how-it-works': ['0.9', 'weekly'],
  '/faq': ['0.9', 'weekly'],
  '/dispute-policy': ['0.9', 'weekly'],
  '/merchant-savings-calculator': ['0.9', 'weekly'],
  '/merchant': ['0.8', 'weekly'],
  '/sell': ['0.8', 'weekly'],
  '/pay': ['0.8', 'weekly'],
  '/integrate': ['0.8', 'weekly'],
  '/plugins': ['0.8', 'weekly'],
  '/plugin': ['0.8', 'weekly'],
  '/shopify': ['0.8', 'weekly'],
  '/privacy-policy': ['0.5', 'monthly'],
  '/terms-of-service': ['0.5', 'monthly'],
  '/white-label': ['0.6', 'monthly'],
};

function pagesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'api' && dir === PAGES_DIR ? [] : pagesUnder(full);
    return /\.(tsx|ts|jsx|js|mdx)$/.test(entry.name) ? [full] : [];
  });
}

const staticPages = pagesUnder(PAGES_DIR)
  .map((file) => {
    const route = '/' + path.relative(PAGES_DIR, file).replace(/\.(tsx|ts|jsx|js|mdx)$/, '').split(path.sep).join('/');
    return { file, route: route.replace(/\/index$/, '').replace(/^\/$/, '') };
  })
  .filter(({ file, route }) =>
    !/\/_[^/]*$/.test(route) &&
    !route.includes('[') &&
    !PRIVATE.has(route) &&
    !/noindex/.test(fs.readFileSync(file, 'utf8'))
  )
  .map(({ route }) => {
    const [priority, changefreq] = RANKING[route] ?? ['0.6', 'weekly'];
    return { path: route, priority, changefreq };
  })
  .sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path));

const lastmod = new Date().toISOString();

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     ${staticPages
       .map((page) => `
       <url>
           <loc>${BASE_URL}${page.path}/</loc>
           <lastmod>${lastmod}</lastmod>
           <changefreq>${page.changefreq}</changefreq>
           <priority>${page.priority}</priority>
       </url>
     `)
       .join('')}
   </urlset>
 `;

const out = path.join(__dirname, '..', 'public', 'sitemap.xml');
fs.writeFileSync(out, sitemap);
console.log(`sitemap: wrote ${staticPages.length} urls -> public/sitemap.xml`);
