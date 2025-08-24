import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Determine the base URL based on the Host header or environment
  const host = req.headers.host || '';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  
  let baseUrl: string;
  let appName: string;
  
  if (host.includes('farcaster-dev')) {
    // Development environment
    baseUrl = `${protocol}://farcaster-dev.conduit-ucpi.com`;
    appName = 'Conduit Escrow (Dev)';
  } else if (host.includes('dev.farcaster')) {
    // Legacy dev environment (will work when SSL cert is ready)
    baseUrl = `${protocol}://dev.farcaster.conduit-ucpi.com`;
    appName = 'Conduit Escrow (Dev)';
  } else if (host.includes('localhost') || host.includes('127.0.0.1')) {
    // Local development
    baseUrl = `${protocol}://${host}`;
    appName = 'Conduit Escrow (Local)';
  } else {
    // Production environment
    baseUrl = 'https://farcaster.conduit-ucpi.com';
    appName = 'Conduit Escrow';
  }

  const manifest: any = {
    name: appName,
    version: '1.0.0',
    iconUrl: `${baseUrl}/icon.png`,
    splashImageUrl: `${baseUrl}/preview.png`,
    homeUrl: baseUrl
  };

  // Add account association for farcaster-dev domain
  if (host.includes('farcaster-dev')) {
    manifest.accountAssociation = {
      header: "eyJmaWQiOjEyMjE5MTcsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg3OGFGNURBRWIyMjYzNDkwNGYwMUJBMDIxY0ZDMTlEMUUyRDYyMDZCIn0",
      payload: "eyJkb21haW4iOiJmYXJjYXN0ZXItZGV2LmNvbmR1aXQtdWNwaS5jb20ifQ",
      signature: "MHhhNzg3NDVkNjMwNjc2YzM2MGIzYjMzNWNiZmFkMjM5NjZmNzg1YTM5NTk0OTBkY2JhN2YwMTE3MmMzZGIxYzRlNGEzMGVhNDEzYzM4MGQwMjJiOTdhYzNkOTM2Y2FiMDkyMWYwZTI1NzVmODZkYWU2ZWFkODAzYzY4Mjc3YzIyMjFi"
    };
  }

  // Set appropriate headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  
  res.status(200).json(manifest);
}