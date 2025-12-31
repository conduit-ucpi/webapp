/**
 * Conduit UCPI Checkout - Embeddable Payment Widget
 *
 * Usage:
 * <script src="https://yoursite.com/conduit-checkout.js"></script>
 * <script>
 *   ConduitCheckout.init({
 *     sellerAddress: '0x4f118f99a4e8bb384061bcfe081e3bbdec28482d',
 *     baseUrl: 'https://yoursite.com', // Your webapp deployment URL
 *     verifyPayment: true, // Enable backend verification (default: true)
 *     onSuccess: function(data) { console.log('Payment completed!', data); },
 *     onError: function(error) { console.log('Payment failed:', error); },
 *     onCancel: function() { console.log('Payment cancelled'); }
 *   });
 * </script>
 *
 * Then create checkout buttons:
 * <button onclick="ConduitCheckout.open({ amount: '50.00', description: 'Premium Plan' })">
 *   Pay with USDC
 * </button>
 */

(function(window) {
  'use strict';

  // Contract state constants
  const VERIFIED_STATES = ['ACTIVE', 'COMPLETED', 'CLAIMED', 'RESOLVED', 'DISPUTED'];
  const PENDING_STATES = ['OK', 'IN-PROCESS'];
  const FAILED_STATES = ['NEVER_FUNDED'];

  const ConduitCheckout = {
    config: {
      sellerAddress: null,
      baseUrl: null,
      tokenSymbol: 'USDC', // 'USDC' or 'USDT'
      expiryDays: 7, // Default expiry in days
      mode: 'popup', // 'popup' or 'redirect'
      verifyPayment: true, // Enable backend verification
      verificationTimeout: 30000, // 30 seconds max polling
      verificationInterval: 2000, // Poll every 2 seconds
      webhookUrl: null, // Optional: Auto-send verified data to your backend
      webhookSecret: null, // Optional: HMAC secret for webhook signature
      onSuccess: function(data) { console.log('Payment success:', data); },
      onError: function(error) { console.error('Payment error:', error); },
      onCancel: function() { console.log('Payment cancelled'); },
      onVerifying: null // Optional callback during verification
    },

    popup: null,
    messageListener: null,
    currentPayment: null, // Store expected payment data

    /**
     * Initialize the Conduit Checkout widget
     * @param {Object} options - Configuration options
     * @param {string} options.sellerAddress - Merchant wallet address (required)
     * @param {string} options.baseUrl - Base URL of the checkout page (required)
     * @param {string} [options.tokenSymbol='USDC'] - Token to use ('USDC' or 'USDT')
     * @param {number} [options.expiryDays=7] - Days until auto-release to seller
     * @param {string} [options.mode='popup'] - Display mode: 'popup' or 'redirect'
     * @param {boolean} [options.verifyPayment=true] - Enable backend verification
     * @param {number} [options.verificationTimeout=30000] - Max time to poll (ms)
     * @param {number} [options.verificationInterval=2000] - Poll interval (ms)
     * @param {Function} [options.onSuccess] - Success callback
     * @param {Function} [options.onError] - Error callback
     * @param {Function} [options.onCancel] - Cancel callback
     * @param {Function} [options.onVerifying] - Verification callback
     */
    init: function(options) {
      if (!options.sellerAddress) {
        throw new Error('ConduitCheckout: sellerAddress is required');
      }
      if (!options.baseUrl) {
        throw new Error('ConduitCheckout: baseUrl is required');
      }

      // Merge options with defaults
      Object.assign(this.config, options);

      // Clean up baseUrl (remove trailing slash)
      this.config.baseUrl = this.config.baseUrl.replace(/\/$/, '');

      console.log('ConduitCheckout initialized:', this.config);
    },

    /**
     * Open checkout for a payment
     * @param {Object} params - Payment parameters
     * @param {string|number} params.amount - Payment amount in USDC/USDT
     * @param {string} params.description - Payment description
     * @param {string} [params.orderId] - Optional order ID
     * @param {string} [params.email] - Optional buyer email
     * @param {number} [params.expiryTimestamp] - Optional custom expiry (Unix timestamp)
     * @param {string} [params.webhookUrl] - Optional webhook URL for payment verification
     * @param {Object} [params.metadata] - Optional metadata to include
     */
    open: function(params) {
      if (!this.config.sellerAddress || !this.config.baseUrl) {
        throw new Error('ConduitCheckout: Please call init() first');
      }
      if (!params.amount) {
        throw new Error('ConduitCheckout: amount is required');
      }
      if (!params.description) {
        throw new Error('ConduitCheckout: description is required');
      }

      // Store expected payment data for verification
      this.currentPayment = {
        amount: parseFloat(params.amount),
        description: params.description,
        tokenSymbol: params.tokenSymbol || this.config.tokenSymbol,
        orderId: params.orderId
      };

      const checkoutUrl = this.buildCheckoutUrl(params);
      console.log('Opening checkout:', checkoutUrl);

      if (this.config.mode === 'redirect') {
        window.location.href = checkoutUrl;
      } else if (this.config.mode === 'popup') {
        this.openPopup(checkoutUrl);
      } else {
        throw new Error('ConduitCheckout: Invalid mode. Use "popup" or "redirect"');
      }
    },

    /**
     * Build the checkout URL with all parameters
     * @private
     */
    buildCheckoutUrl: function(params) {
      const url = new URL('/contract-create', this.config.baseUrl);

      // Required parameters
      url.searchParams.set('seller', this.config.sellerAddress);
      url.searchParams.set('amount', params.amount.toString());
      url.searchParams.set('description', params.description);
      url.searchParams.set('tokenSymbol', params.tokenSymbol || this.config.tokenSymbol);

      // Optional parameters
      if (params.orderId) {
        url.searchParams.set('order_id', params.orderId);
      }
      if (params.email) {
        url.searchParams.set('email', params.email);
      }
      if (params.webhookUrl) {
        url.searchParams.set('webhook_url', params.webhookUrl);
      }

      // Calculate expiry timestamp if not provided
      if (params.expiryTimestamp) {
        url.searchParams.set('epoch_expiry', params.expiryTimestamp.toString());
      } else {
        const expiryDays = params.expiryDays || this.config.expiryDays;
        const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryDays * 24 * 60 * 60);
        url.searchParams.set('epoch_expiry', expiryTimestamp.toString());
      }

      // Return URL for redirect after payment
      url.searchParams.set('return', window.location.href);

      // Add metadata as JSON if provided
      if (params.metadata) {
        url.searchParams.set('metadata', JSON.stringify(params.metadata));
      }

      return url.toString();
    },

    /**
     * Open checkout in a popup window
     * @private
     */
    openPopup: function(url) {
      const width = 500;
      const height = 700;
      const left = (window.screen.width / 2) - (width / 2);
      const top = (window.screen.height / 2) - (height / 2);

      this.popup = window.open(
        url,
        'conduit-checkout',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!this.popup) {
        alert('Please allow popups for this website to complete payment.');
        return;
      }

      // Setup message listener for popup communication
      this.setupMessageListener();

      // Check if popup was closed
      const checkPopupClosed = setInterval(() => {
        if (this.popup && this.popup.closed) {
          clearInterval(checkPopupClosed);
          this.cleanup();
        }
      }, 500);
    },

    /**
     * Verify payment by polling resultservice
     * @param {string} contractId - Contract ID to verify
     * @returns {Promise<Object>} Verified payment data
     * @private
     */
    verifyPayment: async function(contractId) {
      const startTime = Date.now();
      const timeout = this.config.verificationTimeout || 30000;
      const interval = this.config.verificationInterval || 2000;

      console.log('🔍 Starting payment verification for contract:', contractId);

      // Call onVerifying callback if provided
      if (this.config.onVerifying) {
        try {
          this.config.onVerifying({ contractId, status: 'verifying' });
        } catch (err) {
          console.error('Error in onVerifying callback:', err);
        }
      }

      while (Date.now() - startTime < timeout) {
        try {
          const response = await fetch(
            `${this.config.baseUrl}/api/results`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contractid: contractId,
                sellerWalletId: this.config.sellerAddress
              })
            }
          );

          if (!response.ok) {
            console.warn('⚠️ Verification API error:', response.status, response.statusText);
            await this.sleep(interval);
            continue;
          }

          const data = await response.json();
          console.log('🔍 Verification response:', data);

          // No results yet - keep polling
          if (data.count === 0) {
            console.log('⏳ Contract not found in database yet, polling again...');
            await this.sleep(interval);
            continue;
          }

          const result = data.results[0];

          // Security check: Seller address must match
          if (result.sellerWalletId.toLowerCase() !== this.config.sellerAddress.toLowerCase()) {
            throw new Error('Security violation: Seller address mismatch');
          }

          // Check if payment is verified (funds on blockchain)
          if (VERIFIED_STATES.includes(result.state)) {
            console.log('✅ Payment verified successfully');

            // Optional: Verify amount matches
            if (this.currentPayment && this.currentPayment.amount) {
              const expectedAmount = parseFloat(this.currentPayment.amount);
              const actualAmount = parseFloat(result.amount);
              if (Math.abs(expectedAmount - actualAmount) > 0.001) {
                console.warn('⚠️ Amount mismatch:', { expected: expectedAmount, actual: actualAmount });
                throw new Error('Security violation: Amount mismatch');
              }
            }

            // Optional: Verify token matches
            if (this.currentPayment && this.currentPayment.tokenSymbol) {
              if (result.currencySymbol !== this.currentPayment.tokenSymbol) {
                console.warn('⚠️ Token mismatch:', { expected: this.currentPayment.tokenSymbol, actual: result.currencySymbol });
                throw new Error('Security violation: Token mismatch');
              }
            }

            return {
              contractId: result.contractid,
              chainAddress: result.chainAddress,
              seller: result.sellerWalletId,
              amount: result.amount,
              currencySymbol: result.currencySymbol,
              description: result.description,
              state: result.state,
              verified: true,
              verifiedAt: new Date().toISOString()
            };
          }

          // Check if payment failed
          if (FAILED_STATES.includes(result.state)) {
            throw new Error('Payment verification failed: Contract was never funded');
          }

          // Payment still pending - keep polling
          if (PENDING_STATES.includes(result.state)) {
            console.log('⏳ Payment still pending (state:', result.state, '), polling again in', interval, 'ms');
            await this.sleep(interval);
            continue;
          }

          // Unknown state - log and keep polling
          console.warn('⚠️ Unknown contract state:', result.state);
          await this.sleep(interval);

        } catch (error) {
          // If it's a security violation, throw immediately
          if (error.message.includes('Security violation')) {
            throw error;
          }

          // If it's a failed payment, throw immediately
          if (error.message.includes('Payment verification failed')) {
            throw error;
          }

          // Other errors - log and continue polling
          console.error('❌ Verification error (will retry):', error);
          await this.sleep(interval);
        }
      }

      // Timeout reached
      throw new Error('Payment verification timeout - please contact support');
    },

    /**
     * Sleep helper for polling
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     * @private
     */
    sleep: function(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Generate HMAC-SHA256 signature for webhook
     * @param {string} message - Message to sign
     * @param {string} secret - Secret key
     * @returns {Promise<string>} Hex-encoded signature
     * @private
     */
    generateHMAC: async function(message, secret) {
      if (!window.crypto || !window.crypto.subtle) {
        console.warn('⚠️ Web Crypto API not available, webhook will not be signed');
        return null;
      }

      try {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(message);

        const key = await window.crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );

        const signature = await window.crypto.subtle.sign(
          'HMAC',
          key,
          messageData
        );

        // Convert to hex string
        return Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } catch (error) {
        console.error('Failed to generate HMAC:', error);
        return null;
      }
    },

    /**
     * Automatically send verified payment to merchant's webhook
     * @param {Object} verifiedData - Verified payment data
     * @returns {Promise<void>}
     * @private
     */
    sendWebhook: async function(verifiedData) {
      if (!this.config.webhookUrl) {
        return; // No webhook configured, skip
      }

      try {
        console.log('📤 Sending webhook to:', this.config.webhookUrl);

        const payload = {
          ...verifiedData,
          orderId: this.currentPayment?.orderId,
          email: this.currentPayment?.email,
          metadata: this.currentPayment?.metadata,
          timestamp: Math.floor(Date.now() / 1000)
        };

        const headers = {
          'Content-Type': 'application/json',
        };

        // Generate HMAC signature if secret provided
        if (this.config.webhookSecret) {
          const signature = await this.generateHMAC(
            JSON.stringify(payload),
            this.config.webhookSecret
          );
          if (signature) {
            headers['X-Conduit-Signature'] = signature;
          }
        }

        const response = await fetch(this.config.webhookUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          console.error('❌ Webhook delivery failed:', response.status, response.statusText);
          // Don't throw - still call onSuccess even if webhook fails
        } else {
          console.log('✅ Webhook delivered successfully');
        }
      } catch (error) {
        console.error('❌ Webhook error:', error);
        // Don't throw - still call onSuccess even if webhook fails
      }
    },

    /**
     * Setup postMessage listener for iframe/popup communication
     * @private
     */
    setupMessageListener: function() {
      if (this.messageListener) {
        window.removeEventListener('message', this.messageListener);
      }

      this.messageListener = async (event) => {
        // Verify origin matches baseUrl
        const expectedOrigin = new URL(this.config.baseUrl).origin;
        if (event.origin !== expectedOrigin) {
          return;
        }

        const message = event.data;
        console.log('📨 Received postMessage:', message);

        switch (message.type) {
          case 'contract_created':
            console.log('📝 Contract created:', message.data);
            break;

          case 'payment_completed':
            // Verify payment before calling onSuccess
            if (this.config.verifyPayment !== false) {
              try {
                console.log('🔍 Payment completed postMessage received, starting verification...');

                const verifiedData = await this.verifyPayment(message.data.contractId);

                console.log('✅ Payment verified');

                // Send webhook BEFORE calling onSuccess
                await this.sendWebhook(verifiedData);

                // THEN call onSuccess
                console.log('✅ Calling onSuccess');
                this.config.onSuccess(verifiedData);
                this.cleanup();

              } catch (error) {
                console.error('❌ Payment verification failed:', error);
                this.config.onError(error.message || 'Payment verification failed');
              }
            } else {
              // Skip verification (not recommended for production)
              console.warn('⚠️ Payment verification is disabled - calling onSuccess without verification');
              this.config.onSuccess(message.data);
              this.cleanup();
            }
            break;

          case 'payment_error':
            this.config.onError(message.error || 'Payment failed');
            break;

          case 'payment_cancelled':
            this.config.onCancel();
            this.cleanup();
            break;
        }
      };

      window.addEventListener('message', this.messageListener);
    },

    /**
     * Cleanup event listeners
     * @private
     */
    cleanup: function() {
      if (this.messageListener) {
        window.removeEventListener('message', this.messageListener);
        this.messageListener = null;
      }
      this.currentPayment = null;
    },

    /**
     * Close any open checkout
     */
    close: function() {
      if (this.popup && !this.popup.closed) {
        this.popup.close();
      }
      this.cleanup();
    }
  };

  // Expose to window
  window.ConduitCheckout = ConduitCheckout;

})(window);
