/**
 * Conduit UCPI Checkout - Embeddable Payment Widget
 *
 * Usage:
 * <script src="https://yoursite.com/conduit-checkout.js"></script>
 * <script>
 *   ConduitCheckout.init({
 *     sellerAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
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
      mode: 'popup', // 'popup', 'modal', or 'redirect'
      onSuccess: function(data) { console.log('Payment success:', data); },
      onError: function(error) { console.error('Payment error:', error); },
      onCancel: function() { console.log('Payment cancelled'); }
    },

    modal: null,
    iframe: null,
    popup: null,
    messageListener: null,

    /**
     * Initialize the Conduit Checkout widget
     * @param {Object} options - Configuration options
     * @param {string} options.sellerAddress - Merchant wallet address (required)
     * @param {string} options.baseUrl - Base URL of the checkout page (required)
     * @param {string} [options.tokenSymbol='USDC'] - Token to use ('USDC' or 'USDT')
     * @param {number} [options.expiryDays=7] - Days until auto-release to seller
     * @param {string} [options.mode='popup'] - Display mode: 'popup', 'modal', or 'redirect'
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
      } else if (this.config.mode === 'modal') {
        this.openModal(checkoutUrl);
      } else {
        throw new Error('ConduitCheckout: Invalid mode. Use "popup", "modal", or "redirect"');
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
     * Open checkout in a modal iframe overlay
     * @private
     */
    openModal: function(url) {
      // Create modal overlay
      this.modal = document.createElement('div');
      this.modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
      `;

      // Create iframe container
      const container = document.createElement('div');
      container.style.cssText = `
        position: relative;
        width: 90%;
        max-width: 500px;
        height: 90%;
        max-height: 700px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      `;

      // Create close button
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '&times;';
      closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        border-radius: 4px;
        z-index: 1;
      `;
      closeButton.onclick = () => {
        this.config.onCancel();
        this.closeModal();
      };

      // Create iframe
      this.iframe = document.createElement('iframe');
      this.iframe.src = url;
      this.iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
      `;

      container.appendChild(closeButton);
      container.appendChild(this.iframe);
      this.modal.appendChild(container);
      document.body.appendChild(this.modal);

      // Setup message listener for iframe communication
      this.setupMessageListener();

      // Close modal on overlay click
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.config.onCancel();
          this.closeModal();
        }
      });
    },

    /**
     * Close the modal
     * @private
     */
    closeModal: function() {
      if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
      }
      this.modal = null;
      this.iframe = null;
      this.cleanup();
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
            if (this.config.mode === 'modal') {
              setTimeout(() => this.closeModal(), 2000);
            }
            this.cleanup();
            break;

          case 'payment_error':
            this.config.onError(message.error || 'Payment failed');
            break;

          case 'payment_cancelled':
            this.config.onCancel();
            if (this.config.mode === 'modal') {
              this.closeModal();
            }
            this.cleanup();
            break;

          case 'close_modal':
            if (this.config.mode === 'modal') {
              this.closeModal();
            }
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
      if (this.modal) {
        this.closeModal();
      }
      this.cleanup();
    }
  };

  // Expose to window
  window.ConduitCheckout = ConduitCheckout;

})(window);
