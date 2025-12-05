# SIWE/SIWX Implementation Plan

## Overview

**Goal**: Implement Sign-In With Ethereum (SIWE) to enable one-click authentication for all wallet types.

**Current Problem**:
- Users must interact with their wallet TWICE: once to connect, once to sign auth message
- Social login (Google, etc.) can't sign messages using standard ethers.js methods
- Custom auth token format instead of industry standard

**SIWE Solution**:
- **One wallet interaction** - connect + sign SIWE message in one flow
- Works with ALL wallet types (MetaMask, WalletConnect, social login embedded wallets)
- Industry standard (EIP-4361)
- Better security (domain binding, nonce, expiration, prevents replay attacks)
- Recommended by Reown for AppKit integration

## Architecture Changes

### Current Flow
```
User → Click "Get Started"
     → Connect wallet (approve in wallet)
     → Sign auth message (sign in wallet AGAIN)
     → Backend validates signature
     → User authenticated
```

### SIWE Flow
```
User → Click "Get Started"
     → AppKit shows modal with "Connect + Sign-In"
     → User approves ONCE in wallet (connection + SIWE signature)
     → Backend validates SIWE signature with viem
     → User authenticated
```

## Frontend Implementation

### 1. Install Dependencies

```bash
npm install siwe viem@^2
```

### 2. Create SIWE Configuration

**File**: `lib/auth/siwe-config.ts`

```typescript
import { createSIWEConfig, formatMessage } from '@reown/appkit-siwe'

export function createAppKitSIWEConfig() {
  return createSIWEConfig({
    // Called when AppKit needs a nonce for SIWE message
    getNonce: async () => {
      const response = await fetch('/api/auth/siwe/nonce')
      const { nonce } = await response.json()
      return nonce
    },

    // Creates the SIWE message (AppKit calls this internally)
    createMessage: ({ nonce, address, chainId }) => {
      return formatMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Conduit UCPI',
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
      })
    },

    // Verify the SIWE signature on backend
    verifyMessage: async ({ message, signature }) => {
      const response = await fetch('/api/auth/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature })
      })
      return response.ok
    },

    // Get current session (if user is already authenticated)
    getSession: async () => {
      const response = await fetch('/api/auth/siwe/session')
      if (!response.ok) return null

      const { address, chainId } = await response.json()
      return { address, chainId }
    },

    // Sign out
    signOut: async () => {
      await fetch('/api/auth/siwe/signout', { method: 'POST' })
      return true
    }
  })
}
```

### 3. Update AppKit Initialization

**File**: `components/auth/reownWalletConnect.tsx`

Add SIWE config to `createAppKit()`:

```typescript
import { createAppKitSIWEConfig } from '@/lib/auth/siwe-config'

// In initialize() method:
const siweConfig = createAppKitSIWEConfig()

this.appKit = createAppKit({
  adapters: [ethersAdapter],
  networks: networks,
  projectId,
  metadata: { /* ... */ },
  siweConfig  // ← Add this
})
```

### 4. Remove Manual Auth Step

**Current**: After connection, we manually call `signMessageForAuth()`

**SIWE**: AppKit handles authentication automatically - no manual signing needed!

**File**: `components/auth/ConnectWalletEmbedded.tsx`

Remove the `authenticateBackend()` call - SIWE handles it via `verifyMessage()` callback.

### 5. Update Auth State Management

**File**: `lib/auth/react/AuthProvider.tsx`

- After AppKit connection, check session via `getSession()`
- If session exists, user is authenticated (no manual sign step needed)
- Auth state automatically managed by AppKit + SIWE config

## Backend Implementation (web3userservice)

### 1. Add SIWE Dependencies

**Kotlin/Spring Boot**: Use existing web3j or add Java SIWE library

**OR** create Node.js microservice endpoint wrapper that uses viem (easier)

### 2. Nonce Generation Endpoint

**Endpoint**: `GET /api/auth/siwe/nonce`

**Purpose**: Generate cryptographically secure random nonce

```kotlin
@GetMapping("/api/auth/siwe/nonce")
fun getNonce(): Map<String, String> {
    val nonce = UUID.randomUUID().toString()

    // Store nonce in Redis with 5 minute expiration
    // This prevents replay attacks
    redisTemplate.opsForValue().set("siwe:nonce:$nonce", "pending", 5, TimeUnit.MINUTES)

    return mapOf("nonce" to nonce)
}
```

**Response**:
```json
{
  "nonce": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 3. Signature Verification Endpoint

**Endpoint**: `POST /api/auth/siwe/verify`

**Purpose**: Verify SIWE signature and create user session

**Request**:
```json
{
  "message": "test.conduit-ucpi.com wants you to sign in...",
  "signature": "0xabc123..."
}
```

**Implementation**:
```kotlin
@PostMapping("/api/auth/siwe/verify")
fun verifySignature(@RequestBody request: SIWEVerifyRequest): ResponseEntity<*> {
    // 1. Parse SIWE message
    val siweMessage = parseSIWEMessage(request.message)

    // 2. Verify nonce is valid and not used
    val nonceKey = "siwe:nonce:${siweMessage.nonce}"
    val nonceStatus = redisTemplate.opsForValue().get(nonceKey)
    if (nonceStatus != "pending") {
        return ResponseEntity.status(401).body("Invalid or expired nonce")
    }

    // 3. Verify signature using viem (via Node.js subprocess or direct Java implementation)
    val isValid = verifySIWESignature(request.message, request.signature, siweMessage.address)
    if (!isValid) {
        return ResponseEntity.status(401).body("Invalid signature")
    }

    // 4. Mark nonce as used (prevent replay attacks)
    redisTemplate.opsForValue().set(nonceKey, "used", 5, TimeUnit.MINUTES)

    // 5. Check if user exists, create if not
    val user = userRepository.findByWalletAddress(siweMessage.address)
        ?: userRepository.save(User(walletAddress = siweMessage.address))

    // 6. Create session token (JWT)
    val sessionToken = jwtService.createToken(user)

    // 7. Set HTTP-only cookie
    val cookie = ResponseCookie.from("AUTH-TOKEN", sessionToken)
        .httpOnly(true)
        .secure(true)
        .sameSite("None")
        .path("/")
        .maxAge(Duration.ofDays(7))
        .build()

    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, cookie.toString())
        .body(mapOf("success" to true))
}
```

**Helper**: SIWE Message Parsing
```kotlin
data class SIWEMessage(
    val domain: String,
    val address: String,
    val statement: String,
    val uri: String,
    val version: String,
    val chainId: Int,
    val nonce: String,
    val issuedAt: String
)

fun parseSIWEMessage(message: String): SIWEMessage {
    // Parse SIWE message format (EIP-4361)
    // Format:
    // ${domain} wants you to sign in with your Ethereum account:
    // ${address}
    //
    // ${statement}
    //
    // URI: ${uri}
    // Version: ${version}
    // Chain ID: ${chainId}
    // Nonce: ${nonce}
    // Issued At: ${issuedAt}

    // Implementation: regex parsing or use SIWE library
}
```

**Helper**: Signature Verification (Option 1 - Node.js subprocess)
```kotlin
fun verifySIWESignature(message: String, signature: String, expectedAddress: String): Boolean {
    // Call Node.js script that uses viem to verify
    val process = ProcessBuilder(
        "node",
        "/path/to/verify-siwe.js",
        message,
        signature
    ).start()

    val output = process.inputStream.bufferedReader().readText()
    val result = objectMapper.readValue<Map<String, Any>>(output)

    return result["valid"] == true && result["address"] == expectedAddress
}
```

**Helper**: Signature Verification (Option 2 - Direct Java)
```kotlin
// Use Web3j's Sign.signedMessageHashToKey() and verify address matches
fun verifySIWESignature(message: String, signature: String, expectedAddress: String): Boolean {
    val messageHash = Hash.sha3(message.toByteArray())
    val signatureData = Sign.SignatureData(/* parse signature */)

    val publicKey = Sign.signedMessageHashToKey(messageHash, signatureData)
    val recoveredAddress = Keys.getAddress(publicKey)

    return recoveredAddress.equals(expectedAddress, ignoreCase = true)
}
```

### 4. Get Session Endpoint

**Endpoint**: `GET /api/auth/siwe/session`

**Purpose**: Return current authenticated session

```kotlin
@GetMapping("/api/auth/siwe/session")
fun getSession(@CookieValue("AUTH-TOKEN", required = false) token: String?): ResponseEntity<*> {
    if (token == null) {
        return ResponseEntity.status(401).build()
    }

    // Verify JWT token
    val claims = jwtService.verifyToken(token)
    if (claims == null) {
        return ResponseEntity.status(401).build()
    }

    val user = userRepository.findByWalletAddress(claims.subject)
        ?: return ResponseEntity.status(401).build()

    return ResponseEntity.ok(mapOf(
        "address" to user.walletAddress,
        "chainId" to 8453  // Base mainnet
    ))
}
```

### 5. Sign Out Endpoint

**Endpoint**: `POST /api/auth/siwe/signout`

**Purpose**: Clear user session

```kotlin
@PostMapping("/api/auth/siwe/signout")
fun signOut(): ResponseEntity<*> {
    // Clear cookie
    val cookie = ResponseCookie.from("AUTH-TOKEN", "")
        .httpOnly(true)
        .secure(true)
        .sameSite("None")
        .path("/")
        .maxAge(Duration.ZERO)
        .build()

    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, cookie.toString())
        .body(mapOf("success" to true))
}
```

## API Routes (Next.js Proxies)

Create proxy routes to backend:

### `/pages/api/auth/siwe/nonce.ts`
```typescript
export default async function handler(req, res) {
  const response = await fetch(`${process.env.USER_SERVICE_URL}/api/auth/siwe/nonce`)
  const data = await response.json()
  return res.json(data)
}
```

### `/pages/api/auth/siwe/verify.ts`
```typescript
export default async function handler(req, res) {
  const response = await fetch(`${process.env.USER_SERVICE_URL}/api/auth/siwe/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body)
  })

  // Forward Set-Cookie header
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) {
    res.setHeader('Set-Cookie', setCookie)
  }

  return res.status(response.status).json(await response.json())
}
```

### `/pages/api/auth/siwe/session.ts`
```typescript
export default async function handler(req, res) {
  const response = await fetch(`${process.env.USER_SERVICE_URL}/api/auth/siwe/session`, {
    headers: {
      Cookie: req.headers.cookie || ''
    }
  })

  if (!response.ok) {
    return res.status(response.status).end()
  }

  return res.json(await response.json())
}
```

### `/pages/api/auth/siwe/signout.ts`
```typescript
export default async function handler(req, res) {
  const response = await fetch(`${process.env.USER_SERVICE_URL}/api/auth/siwe/signout`, {
    method: 'POST'
  })

  // Forward Set-Cookie header to clear cookie
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) {
    res.setHeader('Set-Cookie', setCookie)
  }

  return res.json(await response.json())
}
```

## Testing Plan

### Unit Tests

1. **Frontend**:
   - Test SIWE config functions (getNonce, verifyMessage, getSession)
   - Mock API responses
   - Verify error handling

2. **Backend**:
   - Test nonce generation and expiration
   - Test SIWE message parsing
   - Test signature verification with known test vectors
   - Test session creation and validation

### Integration Tests

1. **MetaMask Connection + Auth**:
   - Connect MetaMask
   - Verify single signature prompt
   - Verify session cookie is set
   - Verify authenticated requests work

2. **WalletConnect to Mobile Wallet**:
   - Scan QR code with mobile wallet
   - Sign SIWE message on mobile
   - Verify authentication completes

3. **Social Login (Google)**:
   - Connect with Google
   - Verify SIWE signature works with embedded wallet
   - Verify backend validates correctly

4. **Session Persistence**:
   - Authenticate
   - Refresh page
   - Verify still authenticated (getSession works)

5. **Sign Out**:
   - Authenticate
   - Sign out
   - Verify session cleared
   - Verify protected routes return 401

## Migration Strategy

### Phase 1: Backend Implementation
1. Add SIWE endpoints to web3userservice
2. Keep existing `/api/auth/login` working (backward compatibility)
3. Deploy backend changes
4. Test SIWE endpoints with Postman/curl

### Phase 2: Frontend Implementation (Feature Flag)
1. Add SIWE config to AppKit
2. Keep old auth flow as fallback
3. Use feature flag to enable SIWE for testing
4. Deploy with SIWE disabled by default

### Phase 3: Testing & Rollout
1. Enable SIWE for internal testing
2. Test all wallet types thoroughly
3. Monitor error rates
4. Gradual rollout to users

### Phase 4: Cleanup
1. Remove old manual auth flow code
2. Remove `/api/auth/login` endpoint
3. Update documentation

## Security Considerations

1. **Nonce Management**:
   - Use cryptographically secure random nonces
   - Store in Redis with expiration (5 minutes)
   - Mark as used after verification (prevent replay attacks)

2. **Signature Verification**:
   - Use viem's `verifyMessage` (battle-tested)
   - Verify recovered address matches expected address
   - Validate all SIWE message fields (domain, chain ID, etc.)

3. **Session Security**:
   - HTTP-only cookies (prevent XSS)
   - Secure flag (HTTPS only)
   - SameSite=None (allow cross-origin but require Secure)
   - 7-day expiration

4. **Domain Binding**:
   - SIWE message includes domain
   - Prevents phishing attacks where attacker gets user to sign for wrong domain

## Performance Considerations

1. **Nonce Storage**: Use Redis for fast nonce validation
2. **Signature Verification**: Cache results if needed (low priority)
3. **Session Validation**: JWT tokens validated locally (no DB lookup per request)

## Monitoring & Logging

1. **Metrics to Track**:
   - SIWE authentication success rate
   - Signature verification failures (potential attacks)
   - Nonce reuse attempts (replay attacks)
   - Session creation rate
   - Time to authenticate

2. **Logs**:
   - Log all nonce generation with timestamp
   - Log signature verification attempts (success/failure)
   - Log session creation events
   - Alert on unusual patterns (many failures from one IP)

## Documentation Updates

1. Update README with SIWE flow diagram
2. Document SIWE endpoints in API docs
3. Add troubleshooting guide for common SIWE issues
4. Update user-facing documentation about authentication

## Rollback Plan

If SIWE causes issues:
1. Disable SIWE via feature flag
2. Fall back to old auth flow
3. Investigate and fix issues
4. Re-enable SIWE

All changes are additive - we don't remove old auth until SIWE is proven stable.

## Success Criteria

1. ✅ All wallet types authenticate successfully with SIWE
2. ✅ Social login (Google) works without errors
3. ✅ Users only sign ONCE (connection + auth combined)
4. ✅ Session persistence works across page refreshes
5. ✅ Sign out properly clears sessions
6. ✅ No increase in authentication error rates
7. ✅ Signature verification time < 100ms
8. ✅ All existing functionality continues to work

## Timeline Estimate

- Backend implementation: 4-6 hours
- Frontend implementation: 2-3 hours
- Testing: 3-4 hours
- Deployment & monitoring: 1-2 hours

**Total**: ~10-15 hours of development time

## Next Steps

1. Review this plan with team
2. Get approval for architecture changes
3. Start with backend implementation (web3userservice)
4. Test backend endpoints independently
5. Implement frontend SIWE config
6. Integration testing
7. Deploy with feature flag
8. Monitor and iterate
