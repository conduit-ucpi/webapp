# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in the web application, please follow these steps:

### 1. Private Disclosure

Send a detailed report to: **security@conduit-ucpi.com**

Include:
- Description of the vulnerability
- Steps to reproduce (or proof of concept)
- Potential impact
- Affected browsers/devices
- Suggested fix (if any)
- Your contact information

### 2. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days with severity assessment
- **Fix Timeline**: Based on severity
- **Public Disclosure**: After fix deployment

### 3. Severity Levels

**Critical**: Direct threat to user funds or data
- Response: Immediate
- Bounty: Up to $10,000

**High**: XSS, authentication bypass, wallet compromise
- Response: Within 7 days
- Bounty: Up to $5,000

**Medium**: Security issue with limited impact
- Response: Within 30 days
- Bounty: Up to $1,000

**Low**: Minor security concern
- Response: Best effort
- Bounty: Recognition

## Security Measures

### Frontend Security

#### Wallet Security
- **Private keys never sent to server**: All signing happens client-side
- **Secure wallet provider integration**: Abstract interface prevents leaks
- **Transaction validation**: Users review all transactions before signing
- **No auto-signing**: Every transaction requires explicit user approval

#### Authentication
- **HTTP-only cookies**: Prevent XSS access to auth tokens
- **Secure flag**: Cookies only sent over HTTPS
- **SameSite attribute**: CSRF protection
- **Token validation**: All requests validated by backend

#### XSS Prevention
- React's built-in XSS protection
- Input sanitization
- Content Security Policy headers
- No `dangerouslySetInnerHTML` without sanitization

#### Data Protection
- **No sensitive data in localStorage**: Only HTTP-only cookies
- **No API keys in client code**: Server-side only
- **Environment variable protection**: Public variables prefixed with `NEXT_PUBLIC_`
- **Secure API routes**: Authentication required

### API Route Security

```typescript
// Example secure API route
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Validate method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Validate authentication
  const authHeader = req.headers.cookie;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 3. Validate input
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // 4. Call backend with auth forwarding
  // ... implementation
}
```

### Known Security Considerations

- **Client-side wallet dependence**: Security depends on user's wallet provider
- **RPC provider trust**: Transaction data relies on RPC accuracy
- **Backend service trust**: Authentication delegated to `web3userservice`
- **Smart contract trust**: Funds protected by audited smart contracts

## Best Practices for Contributors

### Environment Variables

**Never commit:**
- `.env.local` files
- API keys or secrets
- Private keys or mnemonics
- Production URLs or credentials

**Safe to commit:**
- `.env.example` with placeholder values
- Public contract addresses
- Public RPC URLs (testnet)

### Secure Coding

```typescript
// ✅ Good: Sanitized input
const cleanInput = sanitizeInput(userInput);

// ❌ Bad: Direct use of user input
element.innerHTML = userInput;

// ✅ Good: Validation before signing
if (isValidAddress(to) && isValidAmount(amount)) {
  await signTransaction({ to, amount });
}

// ❌ Bad: No validation
await signTransaction({ to: userInput, amount: userAmount });
```

### Testing Security

```typescript
describe('Security Tests', () => {
  it('should not expose private keys', () => {
    const provider = new MockProvider();
    // Verify private key never accessible
  });

  it('should validate transaction params', () => {
    expect(() => createTx({ to: 'invalid' }))
      .toThrow('Invalid address');
  });
});
```

## Configuration Security

### Production Checklist

- [ ] HTTPS enabled
- [ ] Secure cookies configured
- [ ] CSP headers set
- [ ] CORS properly restricted
- [ ] Rate limiting enabled
- [ ] Error messages don't leak internals
- [ ] Source maps disabled in production
- [ ] Dependencies audited (`npm audit`)

### Deployment Security

- Secrets managed through CI/CD variables
- No secrets in build artifacts
- GitHub Actions workflows use secret variables
- Docker images don't contain .env files

## Incident Response

In case of security incident:

1. **Immediate**: Take down affected feature if needed
2. **Assessment**: Evaluate user impact
3. **Communication**: Notify affected users
4. **Remediation**: Deploy fix
5. **Post-mortem**: Document and improve

## Audit Status

- **Last Security Review**: [Date - if applicable]
- **Findings**: [Link - if applicable]

## Contact

- Security Email: security@conduit-ucpi.com
- GitHub Security Advisories: [Link]

## Recognition

Security researchers who responsibly disclose vulnerabilities will be acknowledged with their permission.

Thank you for helping keep user funds safe!
