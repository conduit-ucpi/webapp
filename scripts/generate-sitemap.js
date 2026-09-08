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

// Static pages that should be indexed
const staticPages = [
  // High priority pages
  { path: '', priority: '1.0', changefreq: 'daily' },  // homepage
  { path: '/faq', priority: '0.9', changefreq: 'weekly' },
  { path: '/arbitration-policy', priority: '0.9', changefreq: 'weekly' },
  { path: '/merchant-savings-calculator', priority: '0.9', changefreq: 'weekly' },

  // Integration & plugin pages
  { path: '/integrate', priority: '0.8', changefreq: 'weekly' },
  { path: '/plugins', priority: '0.8', changefreq: 'weekly' },
  { path: '/plugin', priority: '0.8', changefreq: 'weekly' },
  { path: '/shopify', priority: '0.8', changefreq: 'weekly' },
  { path: '/wordpress', priority: '0.8', changefreq: 'weekly' },

  // Core functionality pages
  { path: '/create', priority: '0.7', changefreq: 'weekly' },
  { path: '/contract-create', priority: '0.7', changefreq: 'weekly' },
  { path: '/dashboard', priority: '0.7', changefreq: 'weekly' },

  // Wallet & token pages
  { path: '/wallet', priority: '0.6', changefreq: 'weekly' },
  { path: '/buy-token', priority: '0.6', changefreq: 'weekly' },

  // Legal pages
  { path: '/privacy-policy', priority: '0.5', changefreq: 'monthly' },
  { path: '/terms-of-service', priority: '0.5', changefreq: 'monthly' },
];

const lastmod = new Date().toISOString();

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     ${staticPages
       .map((page) => `
       <url>
           <loc>${BASE_URL}${page.path}</loc>
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
