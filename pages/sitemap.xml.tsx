import { GetServerSideProps } from 'next';

// This creates a dynamic sitemap.xml for search engines
function generateSiteMap() {
  const baseUrl = 'https://app.instantescrow.nz';

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

  return `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     ${staticPages
       .map((page) => {
         return `
       <url>
           <loc>${baseUrl}${page.path}</loc>
           <lastmod>${new Date().toISOString()}</lastmod>
           <changefreq>${page.changefreq}</changefreq>
           <priority>${page.priority}</priority>
       </url>
     `;
       })
       .join('')}
   </urlset>
 `;
}

function SiteMap() {
  // getServerSideProps will do the heavy lifting
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  // Generate the XML sitemap
  const sitemap = generateSiteMap();

  res.setHeader('Content-Type', 'text/xml');
  // Cache for 24 hours
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
  res.write(sitemap);
  res.end();

  return {
    props: {},
  };
};

export default SiteMap;
