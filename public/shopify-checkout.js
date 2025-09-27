// InstantEscrow USDC Checkout Button
// Universal script for ANY Shopify store

(function() {
  'use strict';

  // Configuration - Automatically detect the webapp domain from where script was loaded
  const scriptSrc = document.currentScript ? document.currentScript.src : '';
  const baseUrl = scriptSrc ? new URL(scriptSrc).origin : 'https://test.conduit-ucpi.com';
  const CHECKOUT_URL = baseUrl + '/shopify/quick-checkout';
  const BUTTON_STYLES = `
    .instant-usdc-button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      width: 100%;
      margin-top: 10px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .instant-usdc-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    }
    .instant-usdc-button:active {
      transform: translateY(0);
    }
    .instant-usdc-button svg {
      width: 20px;
      height: 20px;
    }
    .instant-usdc-badge {
      background: #f0f8ff;
      border: 1px solid #667eea;
      padding: 8px 12px;
      border-radius: 6px;
      margin-top: 10px;
      font-size: 14px;
      color: #333;
      text-align: center;
    }
  `;

  // Add styles to page
  function addStyles() {
    if (document.getElementById('instant-usdc-styles')) return;

    const style = document.createElement('style');
    style.id = 'instant-usdc-styles';
    style.textContent = BUTTON_STYLES;
    document.head.appendChild(style);
  }

  // Create the Buy with USDC button
  function createButton() {
    const button = document.createElement('button');
    button.className = 'instant-usdc-button';
    button.type = 'button';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
      </svg>
      Buy with USDC - Instant Checkout
    `;

    const badge = document.createElement('div');
    badge.className = 'instant-usdc-badge';
    badge.innerHTML = '🔒 Protected by 14-day escrow • No gas fees';

    return { button, badge };
  }

  // Get product data from the page
  function getProductData() {
    // Try to get Shopify's product data
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
      return window.ShopifyAnalytics.meta.product;
    }

    // Fallback: try to get from meta tags
    const productId = document.querySelector('meta[property="product:id"]')?.content;
    const productTitle = document.querySelector('meta[property="og:title"]')?.content || document.title;
    const productPrice = document.querySelector('meta[property="product:price:amount"]')?.content;
    const productImage = document.querySelector('meta[property="og:image"]')?.content;

    // Try to get selected variant
    const variantSelect = document.querySelector('[name="id"]');
    const selectedVariant = variantSelect ? variantSelect.value : null;

    return {
      id: productId,
      title: productTitle,
      price: productPrice,
      image: productImage,
      variant_id: selectedVariant,
      variants: []
    };
  }

  // Handle button click
  function handleCheckout() {
    const product = getProductData();
    const shop = window.Shopify ? window.Shopify.shop : window.location.hostname;

    // Get selected variant
    const variantSelect = document.querySelector('[name="id"]');
    const variantId = variantSelect ? variantSelect.value : product.variants[0]?.id;

    // Get quantity
    const quantityInput = document.querySelector('[name="quantity"]');
    const quantity = quantityInput ? quantityInput.value : 1;

    // Build checkout URL
    const params = new URLSearchParams({
      shop: shop,
      product_id: product.id || '',
      variant_id: variantId || '',
      quantity: quantity,
      title: product.title || '',
      price: product.price || '',
      image: product.image || '',
      return_url: window.location.href
    });

    // Open checkout in new window or redirect
    const checkoutWindow = window.open(
      `${CHECKOUT_URL}?${params.toString()}`,
      'instantEscrowCheckout',
      'width=500,height=700,top=100,left=100'
    );

    // If popup blocked, redirect instead
    if (!checkoutWindow || checkoutWindow.closed || typeof checkoutWindow.closed === 'undefined') {
      window.location.href = `${CHECKOUT_URL}?${params.toString()}`;
    }
  }

  // Add button to product forms
  function addButtonToForms() {
    // Find all product forms
    const forms = document.querySelectorAll('form[action*="/cart/add"]');

    forms.forEach(form => {
      // Skip if button already added
      if (form.querySelector('.instant-usdc-button')) return;

      const { button, badge } = createButton();

      // Add click handler
      button.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        handleCheckout();
      });

      // Find the add to cart button and insert our button after it
      const addToCartBtn = form.querySelector('[type="submit"], [name="add"], .btn--add-to-cart, .product-form__submit');
      if (addToCartBtn) {
        addToCartBtn.parentElement.insertBefore(button, addToCartBtn.nextSibling);
        addToCartBtn.parentElement.insertBefore(badge, button.nextSibling);
      } else {
        // Fallback: append to form
        form.appendChild(button);
        form.appendChild(badge);
      }
    });
  }

  // Add button to cart page
  function addButtonToCart() {
    // Check if we're on cart page
    if (!window.location.pathname.includes('/cart')) return;

    const checkoutButton = document.querySelector('[name="checkout"], .cart__checkout-button');
    if (!checkoutButton || document.querySelector('.instant-usdc-button')) return;

    const { button, badge } = createButton();
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
      </svg>
      Express Checkout with USDC
    `;

    button.addEventListener('click', function(e) {
      e.preventDefault();

      // Get cart data
      fetch('/cart.js')
        .then(r => r.json())
        .then(cart => {
          const params = new URLSearchParams({
            shop: window.Shopify.shop,
            cart: JSON.stringify(cart),
            type: 'cart',
            return_url: window.location.href
          });

          window.location.href = `${CHECKOUT_URL}?${params.toString()}`;
        });
    });

    checkoutButton.parentElement.insertBefore(button, checkoutButton);
    checkoutButton.parentElement.insertBefore(badge, button.nextSibling);
  }

  // Initialize
  function init() {
    addStyles();
    addButtonToForms();
    addButtonToCart();

    // Watch for dynamic content changes (for SPAs)
    const observer = new MutationObserver(() => {
      addButtonToForms();
      addButtonToCart();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API for merchants
  window.InstantEscrow = {
    checkout: handleCheckout,
    refresh: init
  };
})();