import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auto-detect the base URL from the request
  const protocol = req.headers['x-forwarded-proto'] || (req.connection as any)?.encrypted ? 'https' : 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const farcasterBaseUrl = `${protocol}://${host}`;

  // Different account association values based on domain
  const accountAssociations = {
    'farcaster.conduit-ucpi.com': {
      header: "eyJmaWQiOjEyMjE5MTcsInR5cGUiOiJhdXRoIiwia2V5IjoiMHg4M0Y3OTNmNzRiZWM1NGRjMTU0MzQ0MmFjODY5RjFhRWI4ODg2MzMwIn0",
      payload: "eyJkb21haW4iOiIifQ",
      signature: "1QUZsiWMEwtLjcldrZE7mv9sohXnMDsnQCd8rPdUy0NhJqgZEcUluu0cOS9RlIo4Os1WnDoy7QBMftUVvcZrdBw="
    },
    'farcaster-chris.conduit-ucpi.com': {
      header: "eyJmaWQiOjEyMjE5MTcsInR5cGUiOiJhdXRoIiwia2V5IjoiMHg4M0Y3OTNmNzRiZWM1NGRjMTU0MzQ0MmFjODY5RjFhRWI4ODg2MzMwIn0",
      payload: "eyJkb21haW4iOiJmYXJjYXN0ZXItY2hyaXMuY29uZHVpdC11Y3BpLmNvbSJ9",
      signature: "n0+XXxlH/PdRaLdYnym4a+e8Xj8j35lFozZRJ75YmDNLhu0xHUnlQJi4vQvmLxzsC1e+gyTtp+70PU1heEIq+hw="
    }
  };

  // Get the appropriate account association for the current host
  const accountAssociation = accountAssociations[host as keyof typeof accountAssociations] || accountAssociations['farcaster.conduit-ucpi.com'];

  const config = {
    frame: {
      name: "Instant Escrow",
      version: "1",
      iconUrl: `${farcasterBaseUrl}/icon.png`,
      homeUrl: farcasterBaseUrl,
      imageUrl: `${farcasterBaseUrl}/preview.png`,
      buttonTitle: "start",
      splashImageUrl: `${farcasterBaseUrl}/preview.png`,
      splashBackgroundColor: "#6200EA",
      subtitle: "buy and sell safely",
      description: "buy and sell safely",
      primaryCategory: "utility",
      tags: [
        "buy",
        "sell",
        "escrow"
      ]
    },
    accountAssociation
  };

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(config);
}