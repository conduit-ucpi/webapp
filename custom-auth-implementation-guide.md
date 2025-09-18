# Custom Authentication Implementation Guide

## Overview

This document provides implementation instructions for a custom authentication system that supports both traditional crypto wallets and social login methods without using modal popups. This approach is iframe-friendly and provides a seamless user experience.

## Authentication Methods Supported

1. **MetaMask Browser Extension** - Direct connection
2. **Mobile Wallets** - Via WalletConnect protocol  
3. **Social Login** - Google, Facebook, Twitter via Web3Auth
4. **Email/Passwordless** - Magic link authentication

## Dependencies

Install the required packages:

```bash
npm install @web3modal/ethers5 @walletconnect/universal-provider
npm install @web3auth/no-modal @web3auth/openlogin-adapter @web3auth/ethereum-provider
```

## Configuration Setup

### 1. Environment Variables

```env
# WalletConnect Project ID (get from https://cloud.walletconnect.com)
WALLETCONNECT_PROJECT_ID=your_project_id_here

# Web3Auth Client ID (get from https://dashboard.web3auth.io)  
WEB3AUTH_CLIENT_ID=your_client_id_here
```

### 2. Initial Setup

Create `auth-config.js`:

```javascript
import { createWeb3Modal, defaultConfig } from '@web3modal/ethers5'
import { Web3AuthNoModal } from "@web3auth/no-modal"
import { OpenloginAdapter } from "@web3auth/openlogin-adapter"
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider"

// Chain configuration
const chainConfig = {
  chainNamespace: "eip155",
  chainId: "0x1", // Ethereum mainnet
  rpcTarget: "https://rpc.ankr.com/eth",
  displayName: "Ethereum Mainnet",
  blockExplorer: "https://etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum"
}

// Web3Modal setup (for wallet connections)
export const web3Modal = createWeb3Modal({
  ethersConfig: defaultConfig({
    metadata: {
      name: 'Your App Name',
      description: 'Your App Description',
      url: 'https://yourapp.com',
      icons: ['https://yourapp.com/icon.png']
    }
  }),
  chains: [chainConfig],
  projectId: process.env.WALLETCONNECT_PROJECT_ID,
  enableAnalytics: false // Good for iframe usage
})

// Web3Auth setup (for social login)
export const web3auth = new Web3AuthNoModal({
  clientId: process.env.WEB3AUTH_CLIENT_ID,
  chainConfig,
  web3AuthNetwork: "sapphire_mainnet" // Use "testnet" for development
})

const privateKeyProvider = new EthereumPrivateKeyProvider({ 
  config: { chainConfig } 
})

const openloginAdapter = new OpenloginAdapter({
  privateKeyProvider,
  adapterSettings: {
    uxMode: "redirect", // Iframe-friendly
    loginConfig: {
      google: { 
        verifier: "google", 
        typeOfLogin: "google",
        clientId: "your-google-oauth-client-id" // Optional: for custom Google OAuth
      },
      facebook: { 
        verifier: "facebook", 
        typeOfLogin: "facebook" 
      },
      twitter: { 
        verifier: "twitter", 
        typeOfLogin: "twitter" 
      }
    }
  }
})

web3auth.configureAdapter(openloginAdapter)
```

## Authentication Service Class

Create `auth-service.js`:

```javascript
import { web3Modal, web3auth } from './auth-config.js'

export class AuthenticationService {
  constructor() {
    this.isInitialized = false
    this.currentConnection = null
  }

  /**
   * Initialize the authentication service
   * Call this before using any auth methods
   */
  async init() {
    if (this.isInitialized) return
    
    try {
      await web3auth.init()
      this.isInitialized = true
    } catch (error) {
      console.error('Auth initialization failed:', error)
      throw error
    }
  }

  /**
   * Connect via MetaMask browser extension
   * @returns {Object} Connection result with provider and accounts
   */
  async connectMetaMask() {
    if (!window.ethereum || !window.ethereum.isMetaMask) {
      throw new Error('MetaMask not installed. Please install MetaMask extension.')
    }
    
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      })
      
      this.currentConnection = {
        type: 'metamask',
        accounts,
        provider: window.ethereum,
        address: accounts[0]
      }
      
      return this.currentConnection
    } catch (error) {
      console.error('MetaMask connection failed:', error)
      throw error
    }
  }

  /**
   * Connect via WalletConnect (for mobile wallets)
   * @returns {Object} Connection result with provider
   */
  async connectWalletConnect() {
    try {
      await web3Modal.open()
      const provider = web3Modal.getWalletProvider()
      
      this.currentConnection = {
        type: 'walletconnect',
        provider,
        address: provider.accounts[0]
      }
      
      return this.currentConnection
    } catch (error) {
      console.error('WalletConnect connection failed:', error)
      throw error
    }
  }

  /**
   * Connect via social login
   * @param {string} provider - 'google', 'facebook', 'twitter', etc.
   * @returns {Object} Connection result with provider and user info
   */
  async connectSocial(provider) {
    await this.init()
    
    try {
      const web3authProvider = await web3auth.connectTo("openlogin", {
        loginProvider: provider
      })
      
      const userInfo = await web3auth.getUserInfo()
      const accounts = await web3authProvider.request({ method: 'eth_accounts' })
      
      this.currentConnection = {
        type: 'social',
        socialProvider: provider,
        provider: web3authProvider,
        userInfo,
        accounts,
        address: accounts[0]
      }
      
      return this.currentConnection
    } catch (error) {
      console.error(`${provider} connection failed:`, error)
      throw error
    }
  }

  /**
   * Connect via email (passwordless)
   * @param {string} email - User's email address
   * @returns {Object} Connection result with provider and user info
   */
  async connectEmail(email) {
    await this.init()
    
    if (!email || !this.isValidEmail(email)) {
      throw new Error('Valid email address required')
    }
    
    try {
      const web3authProvider = await web3auth.connectTo("openlogin", {
        loginProvider: "email_passwordless",
        extraLoginOptions: {
          login_hint: email
        }
      })
      
      const userInfo = await web3auth.getUserInfo()
      const accounts = await web3authProvider.request({ method: 'eth_accounts' })
      
      this.currentConnection = {
        type: 'email',
        provider: web3authProvider,
        userInfo,
        accounts,
        address: accounts[0],
        email
      }
      
      return this.currentConnection
    } catch (error) {
      console.error('Email connection failed:', error)
      throw error
    }
  }

  /**
   * Disconnect current session
   */
  async disconnect() {
    try {
      if (this.currentConnection?.type === 'social' || this.currentConnection?.type === 'email') {
        await web3auth.logout()
      } else if (this.currentConnection?.type === 'walletconnect') {
        await web3Modal.disconnect()
      }
      
      this.currentConnection = null
    } catch (error) {
      console.error('Disconnect failed:', error)
      throw error
    }
  }

  /**
   * Get current connection status
   * @returns {Object|null} Current connection or null
   */
  getCurrentConnection() {
    return this.currentConnection
  }

  /**
   * Check if user is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.currentConnection !== null
  }

  /**
   * Utility method to validate email
   * @param {string} email - Email to validate
   * @returns {boolean} Is valid email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Get user's Ethereum address
   * @returns {string|null} Ethereum address
   */
  getAddress() {
    return this.currentConnection?.address || null
  }

  /**
   * Get the current provider for making transactions
   * @returns {Object|null} Web3 provider
   */
  getProvider() {
    return this.currentConnection?.provider || null
  }
}
```

## UI Implementation

### HTML Structure

Create your auth modal HTML:

```html
<!-- auth-modal.html -->
<div id="custom-auth-container" class="auth-container hidden">
  <div class="auth-modal">
    <div class="auth-header">
      <h2>Connect Your Wallet</h2>
      <button id="close-auth" class="close-btn">&times;</button>
    </div>
    
    <!-- Wallet Connection Section -->
    <div class="auth-section">
      <h3>Crypto Wallets</h3>
      <div class="auth-buttons">
        <button id="metamask-btn" class="auth-btn wallet-btn">
          <img src="/icons/metamask.svg" alt="MetaMask">
          MetaMask
        </button>
        <button id="walletconnect-btn" class="auth-btn wallet-btn">
          <img src="/icons/walletconnect.svg" alt="WalletConnect">
          Mobile Wallet
        </button>
      </div>
    </div>
    
    <!-- Social Login Section -->
    <div class="auth-section">
      <h3>Social Login</h3>
      <div class="auth-buttons">
        <button id="google-btn" class="auth-btn social-btn">
          <img src="/icons/google.svg" alt="Google">
          Continue with Google
        </button>
        <button id="facebook-btn" class="auth-btn social-btn">
          <img src="/icons/facebook.svg" alt="Facebook">
          Continue with Facebook
        </button>
        <button id="twitter-btn" class="auth-btn social-btn">
          <img src="/icons/twitter.svg" alt="Twitter">
          Continue with Twitter
        </button>
      </div>
    </div>
    
    <!-- Email Section -->
    <div class="auth-section">
      <h3>Email</h3>
      <div class="email-input-group">
        <input 
          id="email-input" 
          type="email" 
          placeholder="Enter your email address"
          class="email-input"
        >
        <button id="email-btn" class="auth-btn email-btn">
          Send Magic Link
        </button>
      </div>
    </div>
    
    <!-- Loading State -->
    <div id="auth-loading" class="loading-state hidden">
      <div class="spinner"></div>
      <p>Connecting...</p>
    </div>
    
    <!-- Error State -->
    <div id="auth-error" class="error-state hidden">
      <p class="error-message"></p>
      <button id="retry-btn" class="auth-btn retry-btn">Try Again</button>
    </div>
  </div>
</div>
```

### CSS Styles

Create `auth-styles.css`:

```css
.auth-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.auth-container.hidden {
  display: none;
}

.auth-modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
}

.auth-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.auth-header h2 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.auth-section {
  margin-bottom: 24px;
}

.auth-section h3 {
  margin: 0 0 12px 0;
  color: #555;
  font-size: 16px;
}

.auth-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.auth-btn:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.auth-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-btn img {
  width: 20px;
  height: 20px;
}

.email-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.email-input {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.loading-state, .error-state {
  text-align: center;
  padding: 24px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #333;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  color: #e74c3c;
  margin-bottom: 12px;
}

.retry-btn {
  background: #e74c3c;
  color: white;
  border: none;
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .auth-modal {
    width: 95%;
    padding: 20px;
  }
  
  .auth-btn {
    padding: 14px 16px;
    font-size: 16px;
  }
}
```

### JavaScript Controller

Create `auth-controller.js`:

```javascript
import { AuthenticationService } from './auth-service.js'

export class AuthController {
  constructor() {
    this.authService = new AuthenticationService()
    this.initializeEventListeners()
  }

  /**
   * Show the authentication modal
   */
  showAuthModal() {
    document.getElementById('custom-auth-container').classList.remove('hidden')
  }

  /**
   * Hide the authentication modal
   */
  hideAuthModal() {
    document.getElementById('custom-auth-container').classList.add('hidden')
    this.hideLoading()
    this.hideError()
  }

  /**
   * Initialize all event listeners
   */
  initializeEventListeners() {
    // Close modal
    document.getElementById('close-auth').onclick = () => this.hideAuthModal()
    
    // MetaMask connection
    document.getElementById('metamask-btn').onclick = () => this.handleMetaMaskConnection()
    
    // WalletConnect connection
    document.getElementById('walletconnect-btn').onclick = () => this.handleWalletConnectConnection()
    
    // Social connections
    document.getElementById('google-btn').onclick = () => this.handleSocialConnection('google')
    document.getElementById('facebook-btn').onclick = () => this.handleSocialConnection('facebook')
    document.getElementById('twitter-btn').onclick = () => this.handleSocialConnection('twitter')
    
    // Email connection
    document.getElementById('email-btn').onclick = () => this.handleEmailConnection()
    
    // Retry button
    document.getElementById('retry-btn').onclick = () => this.hideError()
    
    // Enter key for email input
    document.getElementById('email-input').onkeypress = (e) => {
      if (e.key === 'Enter') this.handleEmailConnection()
    }
    
    // Click outside to close
    document.getElementById('custom-auth-container').onclick = (e) => {
      if (e.target.id === 'custom-auth-container') this.hideAuthModal()
    }
  }

  /**
   * Handle MetaMask connection
   */
  async handleMetaMaskConnection() {
    this.showLoading()
    
    try {
      const result = await this.authService.connectMetaMask()
      this.handleConnectionSuccess(result)
    } catch (error) {
      this.handleConnectionError('MetaMask connection failed', error)
    }
  }

  /**
   * Handle WalletConnect connection
   */
  async handleWalletConnectConnection() {
    this.showLoading()
    
    try {
      const result = await this.authService.connectWalletConnect()
      this.handleConnectionSuccess(result)
    } catch (error) {
      this.handleConnectionError('Wallet connection failed', error)
    }
  }

  /**
   * Handle social login connection
   * @param {string} provider - Social provider name
   */
  async handleSocialConnection(provider) {
    this.showLoading()
    
    try {
      const result = await this.authService.connectSocial(provider)
      this.handleConnectionSuccess(result)
    } catch (error) {
      this.handleConnectionError(`${provider} connection failed`, error)
    }
  }

  /**
   * Handle email connection
   */
  async handleEmailConnection() {
    const email = document.getElementById('email-input').value.trim()
    
    if (!email) {
      this.showError('Please enter your email address')
      return
    }
    
    this.showLoading()
    
    try {
      const result = await this.authService.connectEmail(email)
      this.handleConnectionSuccess(result)
    } catch (error) {
      this.handleConnectionError('Email connection failed', error)
    }
  }

  /**
   * Handle successful connection
   * @param {Object} result - Connection result
   */
  handleConnectionSuccess(result) {
    console.log('Connection successful:', result)
    
    // Hide auth modal
    this.hideAuthModal()
    
    // Dispatch custom event for app to handle
    window.dispatchEvent(new CustomEvent('walletConnected', {
      detail: result
    }))
    
    // Optional: Update UI to show connected state
    this.updateConnectedState(result)
  }

  /**
   * Handle connection error
   * @param {string} message - Error message to display
   * @param {Error} error - Original error object
   */
  handleConnectionError(message, error) {
    console.error(message, error)
    this.hideLoading()
    
    // Show user-friendly error message
    let userMessage = message
    
    if (error.message.includes('User rejected')) {
      userMessage = 'Connection was cancelled'
    } else if (error.message.includes('MetaMask not installed')) {
      userMessage = 'Please install MetaMask extension'
    }
    
    this.showError(userMessage)
  }

  /**
   * Show loading state
   */
  showLoading() {
    document.getElementById('auth-loading').classList.remove('hidden')
    // Disable all buttons
    document.querySelectorAll('.auth-btn').forEach(btn => {
      btn.disabled = true
    })
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    document.getElementById('auth-loading').classList.add('hidden')
    // Re-enable all buttons
    document.querySelectorAll('.auth-btn').forEach(btn => {
      btn.disabled = false
    })
  }

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    document.querySelector('.error-message').textContent = message
    document.getElementById('auth-error').classList.remove('hidden')
  }

  /**
   * Hide error message
   */
  hideError() {
    document.getElementById('auth-error').classList.add('hidden')
  }

  /**
   * Update UI to show connected state
   * @param {Object} connection - Connection result
   */
  updateConnectedState(connection) {
    // Example: Update a connection status indicator
    const statusElement = document.getElementById('connection-status')
    if (statusElement) {
      statusElement.textContent = `Connected: ${connection.address.slice(0, 6)}...${connection.address.slice(-4)}`
      statusElement.classList.add('connected')
    }
  }

  /**
   * Get current connection
   * @returns {Object|null} Current connection
   */
  getCurrentConnection() {
    return this.authService.getCurrentConnection()
  }

  /**
   * Disconnect current session
   */
  async disconnect() {
    try {
      await this.authService.disconnect()
      
      // Update UI
      const statusElement = document.getElementById('connection-status')
      if (statusElement) {
        statusElement.textContent = 'Not Connected'
        statusElement.classList.remove('connected')
      }
      
      // Dispatch disconnect event
      window.dispatchEvent(new CustomEvent('walletDisconnected'))
      
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }
}
```

## Integration Example

Create `app.js` - your main application file:

```javascript
import { AuthController } from './auth-controller.js'

class App {
  constructor() {
    this.authController = new AuthController()
    this.initializeApp()
  }

  initializeApp() {
    // Listen for wallet connection events
    window.addEventListener('walletConnected', (event) => {
      const connection = event.detail
      console.log('Wallet connected:', connection)
      
      // Initialize your app with the connected wallet
      this.onWalletConnected(connection)
    })
    
    window.addEventListener('walletDisconnected', () => {
      console.log('Wallet disconnected')
      this.onWalletDisconnected()
    })
    
    // Add connect button listener
    document.getElementById('connect-wallet-btn').onclick = () => {
      this.authController.showAuthModal()
    }
  }

  onWalletConnected(connection) {
    // Your app logic when wallet is connected
    document.getElementById('user-address').textContent = connection.address
    document.getElementById('connection-type').textContent = connection.type
    
    // Enable wallet-dependent features
    document.querySelectorAll('.requires-wallet').forEach(el => {
      el.disabled = false
    })
  }

  onWalletDisconnected() {
    // Your app logic when wallet is disconnected
    document.getElementById('user-address').textContent = ''
    document.getElementById('connection-type').textContent = ''
    
    // Disable wallet-dependent features  
    document.querySelectorAll('.requires-wallet').forEach(el => {
      el.disabled = true
    })
  }
}

// Initialize the app
new App()
```

## iframe Considerations

When implementing in an iframe environment, create `iframe-setup.js`:

```javascript
function setupIframeAuth() {
  const isInIframe = window !== window.parent
  
  if (isInIframe) {
    // Override certain behaviors for iframe
    const authService = new AuthenticationService()
    
    // Use redirect mode for Web3Auth instead of popup
    // (This is already configured in auth-config.js with uxMode: "redirect")
    
    // Handle postMessage communication with parent if needed
    window.addEventListener('message', (event) => {
      if (event.data.type === 'CONNECT_WALLET') {
        authController.showAuthModal()
      }
    })
    
    // Notify parent of connection status changes
    window.addEventListener('walletConnected', (event) => {
      window.parent.postMessage({
        type: 'WALLET_CONNECTED',
        connection: event.detail
      }, '*')
    })
  }
}

setupIframeAuth()
```

## File Structure

Organize your files like this:

```
src/
├── auth/
│   ├── auth-config.js
│   ├── auth-service.js
│   ├── auth-controller.js
│   └── auth-styles.css
├── components/
│   └── auth-modal.html
├── utils/
│   └── iframe-setup.js
└── app.js
```

## Error Handling & Best Practices

### Common Error Scenarios

1. **MetaMask not installed**
   - Show clear installation instructions
   - Provide fallback to WalletConnect

2. **User rejection**
   - Handle gracefully without alarming error messages
   - Allow retry

3. **Network issues**
   - Implement retry logic
   - Show appropriate loading states

4. **iframe restrictions**
   - Use redirect mode for Web3Auth
   - Handle popup blocking gracefully

### Security Considerations

1. **Validate all user inputs** (especially email addresses)
2. **Use HTTPS** in production
3. **Implement proper CSP headers** for iframe usage
4. **Store sensitive config** in environment variables
5. **Validate chain ID** matches your app's requirements

### Performance Tips

1. **Lazy load** heavy Web3 libraries
2. **Cache connection state** in sessionStorage if appropriate
3. **Debounce** user interactions to prevent spam
4. **Minimize bundle size** by importing only needed components

## Testing

### Manual Testing Checklist

- [ ] MetaMask connection works on desktop
- [ ] WalletConnect works on mobile
- [ ] Google social login works
- [ ] Email passwordless works
- [ ] Error states display correctly
- [ ] Loading states work properly
- [ ] Disconnect functionality works
- [ ] iframe integration works
- [ ] Mobile responsive design

### Automated Testing Example

```javascript
// Example test structure
describe('Authentication Service', () => {
  let authService
  
  beforeEach(() => {
    authService = new AuthenticationService()
  })
  
  test('should initialize without errors', async () => {
    await expect(authService.init()).resolves.not.toThrow()
  })
  
  test('should validate email addresses', () => {
    expect(authService.isValidEmail('test@example.com')).toBe(true)
    expect(authService.isValidEmail('invalid-email')).toBe(false)
  })
  
  // Add more tests as needed
})
```

## Setup Instructions

1. **Install dependencies** using the npm commands above
2. **Get API keys** from WalletConnect and Web3Auth dashboards
3. **Set up environment variables**
4. **Create the files** as outlined in this document
5. **Import and initialize** in your main app file
6. **Test each authentication method** thoroughly
7. **Deploy and test** in your target environment (especially iframe if applicable)

## Support

For issues with specific integrations:
- **WalletConnect**: https://docs.walletconnect.com/
- **Web3Auth**: https://web3auth.io/docs/

This implementation provides a complete, production-ready authentication system that handles multiple connection methods without modal dependencies, making it perfect for iframe usage and custom UI requirements.
