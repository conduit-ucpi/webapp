/**
 * Conduit UCPI Checkout - Embeddable Payment Widget
 *
 * Usage:
 * <script src="https://yoursite.com/conduit-checkout.js"></script>
 * <script>
 *   ConduitCheckout.init({
 *     sellerAddress: '0x4f118f99a4e8bb384061bcfe081e3bbdec28482d',
 *     baseUrl: 'https://yoursite.com', // Your webapp deployment URL
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

  const ConduitCheckout = {
    config: {
      sellerAddress: null,
      baseUrl: null,
      tokenSymbol: 'USDC', // 'USDC' or 'USDT'
      expiryDays: 7, // Default expiry in days
      mode: 'popup', // 'popup' or 'redirect'
      onSuccess: function(data) { console.log('Payment success:', data); },
      onError: function(error) { console.error('Payment error:', error); },
      onCancel: function() { console.log('Payment cancelled'); }
    },

    popup: null,
    messageListener: null,

    /**
     * Initialize the Conduit Checkout widget
     * @param {Object} options - Configuration options
     * @param {string} options.sellerAddress - Merchant wallet address (required)
     * @param {string} options.baseUrl - Base URL of the checkout page (required)
     * @param {string} [options.tokenSymbol='USDC'] - Token to use ('USDC' or 'USDT')
     * @param {number} [options.expiryDays=7] - Days until auto-release to seller
     * @param {string} [options.mode='popup'] - Display mode: 'popup' or 'redirect'
     * @param {Function} [options.onSuccess] - Success callback
     * @param {Function} [options.onError] - Error callback
     * @param {Function} [options.onCancel] - Cancel callback
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
     * Setup postMessage listener for iframe/popup communication
     * @private
     */
    setupMessageListener: function() {
      if (this.messageListener) {
        window.removeEventListener('message', this.messageListener);
      }

      this.messageListener = (event) => {
        // Verify origin matches baseUrl
        const expectedOrigin = new URL(this.config.baseUrl).origin;
        if (event.origin !== expectedOrigin) {
          return;
        }

        const message = event.data;
        console.log('Received postMessage:', message);

        switch (message.type) {
          case 'contract_created':
            console.log('Contract created:', message.data);
            break;

          case 'payment_completed':
            this.config.onSuccess(message.data);
            this.cleanup();
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
