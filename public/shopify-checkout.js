// InstantEscrow USDC Checkout Button
// Universal script for ANY Shopify store

(function() {
  'use strict';

  // Configuration - Automatically detect the webapp domain from where script was loaded
  const scriptSrc = document.currentScript ? document.currentScript.src : '';
  if (!scriptSrc) {
    console.error('InstantEscrow: Unable to detect script source. Script must be loaded with a proper src attribute.');
    return; // Exit early if we can't determine the base URL
  }
  const baseUrl = new URL(scriptSrc).origin;
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
    console.log('InstantEscrow: Starting product data extraction...');

    // Debug: Check what global objects are available
    console.log('InstantEscrow: Available globals:', {
      hasShopifyAnalytics: !!window.ShopifyAnalytics,
      hasShopifyMeta: !!(window.ShopifyAnalytics && window.ShopifyAnalytics.meta),
      hasShopifyProduct: !!(window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product),
      hasWindowMeta: !!window.meta,
      hasShopify: !!window.Shopify
    });

    // Try to get Shopify's product data from various sources
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
      const product = window.ShopifyAnalytics.meta.product;
      console.log('InstantEscrow: Found ShopifyAnalytics product:', product);
      return {
        id: product.id,
        title: product.title || product.name,
        price: product.price ? (product.price / 100).toFixed(2) : '',
        image: product.image,
        variant_id: product.variants?.[0]?.id,
        variants: product.variants || []
      };
    }

    // Try window.meta if available (some themes)
    if (window.meta && window.meta.product) {
      const product = window.meta.product;
      console.log('InstantEscrow: Found window.meta product:', product);
      return {
        id: product.id,
        title: product.title,
        price: product.price ? (product.price / 100).toFixed(2) : '',
        image: product.featured_image,
        variant_id: product.variants?.[0]?.id,
        variants: product.variants || []
      };
    }

    // Check for JSON-LD structured data
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'Product') {
          console.log('InstantEscrow: Found JSON-LD product data:', data);
          return {
            id: data.productID || data.sku || '',
            title: data.name || '',
            price: data.offers?.price || data.offers?.[0]?.price || '',
            image: data.image?.[0] || data.image || '',
            variant_id: '',
            variants: []
          };
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }

    console.log('InstantEscrow: No structured data found, trying DOM extraction...');

    // Try to get from meta tags
    const productId = document.querySelector('meta[property="product:id"]')?.content ||
                      document.querySelector('meta[property="og:product:id"]')?.content;

    const productTitle = document.querySelector('meta[property="og:title"]')?.content ||
                        document.querySelector('meta[name="og:title"]')?.content ||
                        document.querySelector('meta[property="twitter:title"]')?.content;

    const productPrice = document.querySelector('meta[property="product:price:amount"]')?.content ||
                        document.querySelector('meta[property="og:price:amount"]')?.content ||
                        document.querySelector('meta[name="product:price:amount"]')?.content;

    const productImage = document.querySelector('meta[property="og:image"]')?.content ||
                        document.querySelector('meta[property="og:image:secure_url"]')?.content;

    console.log('InstantEscrow: Meta tag extraction results:', {
      productId,
      productTitle,
      productPrice,
      productImage
    });

    // Try to get selected variant
    const variantSelect = document.querySelector('[name="id"]');
    const selectedVariant = variantSelect ? variantSelect.value : null;

    // Advanced title extraction from DOM
    let finalTitle = productTitle;
    if (!finalTitle) {
      const titleSelectors = [
        'h1[class*="product"]',
        'h1.product-title',
        'h1.product__title',
        '[data-product-title]',
        '.product-single__title',
        '.product__title',
        '.product-title',
        '[class*="product-title"]',
        '[class*="product__title"]',
        'h1',
        '.page-title'
      ];

      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent?.trim()) {
          finalTitle = element.textContent.trim()
            .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
            .replace(/(.+?)\1+/g, '$1') // Remove duplicates like "Title Title"
            .trim();
          console.log(`InstantEscrow: Found title using selector "${selector}":`, finalTitle);
          break;
        }
      }

      // Fallback to document title
      if (!finalTitle) {
        finalTitle = document.title.split(' – ')[0].split(' | ')[0].split(' - ')[0].trim();
        console.log('InstantEscrow: Using document title as fallback:', finalTitle);
      }
    }

    // Advanced price extraction from DOM
    let finalPrice = productPrice;
    if (!finalPrice) {
      const priceSelectors = [
        '[data-product-price]',
        '[data-price]',
        '.price__regular .price-item--regular',
        '.product__price .price-item--regular',
        '.product__price',
        '.price-item--regular',
        '.price',
        '.price--regular',
        '.current-price',
        '.product-price',
        '.price-current',
        '[class*="price"]:not([class*="compare"]):not([class*="compare-at"])',
        'span.money',
        '.money'
      ];

      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const priceText = element.textContent || element.getAttribute('data-price') || element.getAttribute('data-product-price');
          const match = priceText?.match(/[\d,]+\.?\d*/);
          if (match) {
            finalPrice = match[0].replace(/,/g, '');
            console.log(`InstantEscrow: Found price using selector "${selector}":`, finalPrice);
            break;
          }
        }
      }
    }

    const result = {
      id: productId || '',
      title: finalTitle || 'Product',
      price: finalPrice || '',
      image: productImage || '',
      variant_id: selectedVariant || '',
      variants: []
    };

    console.log('InstantEscrow: Final extracted product data:', result);
    return result;
  }

  // Handle button click
  function handleCheckout() {
    const product = getProductData();
    console.log('InstantEscrow: Product data detected:', product);
    const shop = window.Shopify ? window.Shopify.shop : window.location.hostname;

    // Get selected variant
    const variantSelect = document.querySelector('[name="id"]');
    const variantId = variantSelect ? variantSelect.value : product.variants[0]?.id;

    // Get quantity
    const quantityInput = document.querySelector('[name="quantity"]');
    const quantity = quantityInput ? quantityInput.value : 1;

    // If we don't have title or price, try to extract from the page
    let finalTitle = product.title;
    let finalPrice = product.price;

    if (!finalTitle) {
      // Try multiple selectors for product title
      finalTitle = document.querySelector('h1.product__title')?.textContent?.trim() ||
                   document.querySelector('.product-title')?.textContent?.trim() ||
                   document.querySelector('[class*="product__title"]')?.textContent?.trim() ||
                   document.querySelector('h1')?.textContent?.trim() ||
                   document.title.split(' – ')[0] || // Often title is "Product Name – Store Name"
                   'Product';
    }

    if (!finalPrice) {
      // Try multiple selectors for price
      const priceSelectors = [
        '.price__regular .price-item--regular',
        '.product__price',
        '.price-item--regular',
        '[class*="price"]:not([class*="compare"])',
        '[data-product-price]',
        'span.money'
      ];

      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent || element.getAttribute('data-price');
          const match = text?.match(/[\d,]+\.?\d*/);
          if (match) {
            finalPrice = match[0].replace(',', '');
            break;
          }
        }
      }
    }

    // Build checkout URL
    const params = new URLSearchParams({
      shop: shop,
      product_id: product.id || '',
      variant_id: variantId || '',
      quantity: quantity,
      title: finalTitle || 'Product',
      price: finalPrice || '0',
      image: product.image || '',
      return_url: window.location.href
    });

    console.log('InstantEscrow: Final checkout params:', {
      title: finalTitle,
      price: finalPrice,
      variant_id: variantId
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