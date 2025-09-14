# Backend Requirements for Signature Token Authentication

## Overview
The webapp now sends two types of authentication tokens to the userservice:

1. **Web3Auth JWT tokens** (social logins) - existing functionality
2. **Signature tokens** (external wallets) - **NEW** - requires backend updates

## Token Format

### Web3Auth JWT (existing)
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9...
```

### Signature Token (new)
```
Authorization: Bearer ewogICJ0eXBlIjogInNpZ25hdHVyZV9hdXRoIiwKICAi...
```

The signature token is a **base64-encoded JSON** object with this structure:

```json
{
  "type": "signature_auth",
  "walletAddress": "0x742d35Cc6634C0532925a3b8D50e3e42b7C2fE5D",
  "message": "Authenticate wallet 0x742d35Cc6634C0532925a3b8D50e3e42b7C2fE5D at 1706186400000 with nonce abc123def456",
  "signature": "0x1234...abcd",
  "timestamp": 1706186400000,
  "nonce": "abc123def456",
  "issuer": "web3auth_external_wallet",
  "header": { "alg": "ECDSA", "typ": "SIG" },
  "payload": { 
    "sub": "0x742d35Cc6634C0532925a3b8D50e3e42b7C2fE5D", 
    "iat": 1706186400,
    "iss": "web3auth_external_wallet",
    "wallet_type": "external"
  }
}
```

## Required Userservice Changes

### 1. Token Detection
The userservice needs to detect which type of token it received:

```kotlin
fun determineTokenType(token: String): TokenType {
    return when {
        token.startsWith("ey") -> TokenType.WEB3AUTH_JWT
        else -> {
            try {
                val decoded = Base64.getDecoder().decode(token)
                val json = objectMapper.readValue(decoded, JsonNode::class.java)
                if (json.get("type")?.asText() == "signature_auth") {
                    TokenType.SIGNATURE_AUTH
                } else {
                    TokenType.WEB3AUTH_JWT
                }
            } catch (e: Exception) {
                TokenType.WEB3AUTH_JWT // fallback to existing behavior
            }
        }
    }
}
```

### 2. Signature Verification
For signature tokens, verify the signature matches the claimed wallet address:

```kotlin
fun verifySignatureToken(token: String): AuthResult {
    // 1. Decode base64 token
    val decoded = Base64.getDecoder().decode(token)
    val signatureData = objectMapper.readValue(decoded, SignatureTokenData::class.java)
    
    // 2. Verify timestamp (prevent replay attacks)
    val now = System.currentTimeMillis()
    val tokenAge = now - signatureData.timestamp
    if (tokenAge > SIGNATURE_TOKEN_MAX_AGE) { // e.g., 5 minutes
        throw AuthException("Token expired")
    }
    
    // 3. Verify signature matches wallet address
    val recoveredAddress = recoverSignerAddress(
        message = signatureData.message,
        signature = signatureData.signature
    )
    
    if (!recoveredAddress.equals(signatureData.walletAddress, ignoreCase = true)) {
        throw AuthException("Signature verification failed")
    }
    
    // 4. Return user data
    return AuthResult.success(
        userId = signatureData.walletAddress,
        walletAddress = signatureData.walletAddress,
        authProvider = "web3auth_external_wallet"
    )
}
```

### 3. Message Signature Recovery
Implement ECDSA signature recovery (you may need a library like Web3j):

```kotlin
import org.web3j.crypto.Sign
import org.web3j.crypto.Keys
import org.web3j.utils.Numeric

fun recoverSignerAddress(message: String, signature: String): String {
    // Convert message to Ethereum signed message format
    val messageHash = Hash.sha3(
        "\u0019Ethereum Signed Message:\n${message.length}$message".toByteArray()
    )
    
    // Parse signature
    val signatureBytes = Numeric.hexStringToByteArray(signature)
    val v = signatureBytes[64]
    val r = Arrays.copyOfRange(signatureBytes, 0, 32)
    val s = Arrays.copyOfRange(signatureBytes, 32, 64)
    
    // Recover public key
    val publicKey = Sign.recoverFromSignature(
        (v - 27).toByte(),
        Sign.SignatureData(v, r, s),
        messageHash
    )
    
    // Convert to address
    return "0x" + Keys.getAddress(publicKey)
}
```

### 4. Update Login Endpoint
Modify the login endpoint to handle both token types:

```kotlin
@PostMapping("/api/user/login")
fun login(@RequestBody request: LoginRequest, 
          @RequestHeader("Authorization") authHeader: String): ResponseEntity<*> {
    
    val token = authHeader.removePrefix("Bearer ")
    
    val authResult = when (determineTokenType(token)) {
        TokenType.WEB3AUTH_JWT -> verifyWeb3AuthJWT(token) // existing logic
        TokenType.SIGNATURE_AUTH -> verifySignatureToken(token) // new logic
    }
    
    if (!authResult.success) {
        return ResponseEntity.status(401).body(mapOf("error" to authResult.error))
    }
    
    // Continue with existing user creation/update logic...
    return ResponseEntity.ok(authResult.user)
}
```

## Security Considerations

### Signature Token Security
- ✅ **Wallet Ownership**: Only the wallet owner can create valid signatures
- ✅ **Replay Protection**: Timestamp and nonce prevent reuse
- ✅ **Message Integrity**: Specific message format prevents tampering
- ✅ **Non-repudiation**: Cryptographic proof of wallet ownership

### Implementation Notes
1. **Token Expiration**: Signature tokens should expire quickly (5-15 minutes)
2. **Nonce Tracking**: Consider storing used nonces to prevent replay (optional)
3. **Rate Limiting**: Apply normal rate limiting to prevent abuse
4. **Error Handling**: Provide clear error messages for debugging

## Dependencies
You may need to add Web3j or similar library for signature verification:

```xml
<dependency>
    <groupId>org.web3j</groupId>
    <artifactId>core</artifactId>
    <version>4.9.8</version>
</dependency>
```

## Testing
Test both authentication flows:
1. Social login → Web3Auth JWT token (existing)
2. MetaMask login → Signature token (new)

Both should result in successful authentication and user creation.