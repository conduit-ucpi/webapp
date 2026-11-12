/**
 * The demo sneaker shop at /checkout-example.html.
 *
 * A fictional shop around a REAL checkout: the Pay button opens the live Stabledrop payment page
 * through conduit-checkout.js, exactly as a merchant's site would.
 *
 * ⚠️ REAL MONEY MOVES. The payment goes to the demo seller and nothing ships. An order is charged
 *    at its full price unless the buyer enters the code DEMO, which brings it down to DEMO_TOTAL.
 *    The code is offered on the page, never applied for them.
 *
 * ⚠️ NO INLINE SCRIPT OR on* HANDLERS in the HTML: the site's CSP allows scripts from 'self' only.
 */
(function () {
  'use strict';

  var DEMO_SELLER = '0x4f118f99a4e8bb384061bcfe081e3bbdec28482d';
  var DEMO_TOTAL = 0.001;
  var EXPRESS_SHIPPING = 12;
  var SIZES = ['7', '8', '9', '10', '11', '12'];
  var DEMO_CODE = 'DEMO';
  var CART_KEY = 'tread-demo-cart';
  /** The address the form opens with: plainly invented, so nobody has to type to reach the payment. */
  var SAMPLE = {
    email: 'buyer@example.com',
    firstName: 'Testy',
    lastName: 'McTestface',
    address: '123 Fake Street',
    city: 'Nowhereville',
    postcode: '00000'
  };

  var PRODUCTS = [
    // ⚠️ THE ONE PAIR ANYONE CAN AFFORD TO TEST WITH. A real payment of a tenth of a cent, so the
    //    whole checkout can be run end to end without the DEMO code. Keep it first in the grid.
    { id: 'tester-mint', name: 'The Tester', colour: 'Mint', category: 'Lifestyle', price: 0.001, tag: 'Try the checkout',
      c: { tile: '#e2f4ec', upper: '#b9ead6', panel: '#7fcfb0', accent: '#16150f', sole: '#ffffff', outsole: '#16150f', lace: '#ffffff' } },
    { id: 'drift-white', name: 'Drift Runner', colour: 'Cloud White', category: 'Running', price: 128, tag: 'New',
      c: { tile: '#eef0f3', upper: '#ffffff', panel: '#dfe3ea', accent: '#e4572e', sole: '#f7f7f5', outsole: '#2a2a2a', lace: '#c9ced8' } },
    { id: 'drift-ember', name: 'Drift Runner', colour: 'Ember', category: 'Running', price: 128,
      c: { tile: '#fbe9e2', upper: '#e4572e', panel: '#c9431f', accent: '#ffd9a8', sole: '#ffffff', outsole: '#3a1c12', lace: '#ffffff' } },
    { id: 'court-forest', name: 'Courtline Low', colour: 'Forest', category: 'Lifestyle', price: 96, tag: 'Bestseller',
      c: { tile: '#e6efe9', upper: '#f5f3ec', panel: '#1f5c43', accent: '#1f5c43', sole: '#f5f3ec', outsole: '#1f5c43', lace: '#f5f3ec' } },
    { id: 'court-sand', name: 'Courtline Low', colour: 'Sand', category: 'Lifestyle', price: 96,
      c: { tile: '#f3ece0', upper: '#e9dcc5', panel: '#cdb894', accent: '#8a6f47', sole: '#fbf7ee', outsole: '#b59a70', lace: '#fbf7ee' } },
    { id: 'summit-slate', name: 'Summit Trail', colour: 'Slate', category: 'Trail', price: 149,
      c: { tile: '#e4e8ea', upper: '#4b5a63', panel: '#33414a', accent: '#f2b632', sole: '#d9dee1', outsole: '#1b2226', lace: '#f2b632' } },
    { id: 'halo-cobalt', name: 'Halo Knit', colour: 'Cobalt', category: 'Running', price: 112, tag: 'New',
      c: { tile: '#e3e9fb', upper: '#2f55d4', panel: '#2444b0', accent: '#b9f3e4', sole: '#ffffff', outsole: '#16276b', lace: '#ffffff' } }
  ];
  var CATEGORIES = ['All', 'Running', 'Lifestyle', 'Trail'];

  // ---------- helpers ----------

  function $(id) { return document.getElementById(id); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'text') node.textContent = attrs[key];
      else if (key === 'class') node.className = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  /** Sums of prices, without the dust binary arithmetic leaves on a figure like 0.001. */
  function round(n) { return Math.round(n * 1000) / 1000; }

  /** Dollars and cents, or to the tenth of a cent for the one price that needs it. */
  function money(n) {
    var value = round(n);
    return '$' + (Math.abs(value * 100 - Math.round(value * 100)) > 1e-9 ? value.toFixed(3) : value.toFixed(2));
  }

  function productById(id) {
    return PRODUCTS.filter(function (p) { return p.id === id; })[0] || null;
  }

  /** One side-on sneaker, coloured per product. Colours come from PRODUCTS only, never from input. */
  function sneakerSvg(c) {
    var svg =
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sneaker">' +
      '<ellipse cx="164" cy="178" rx="134" ry="8" fill="#000" opacity="0.08"/>' +
      // outsole and midsole
      '<path d="M28 150 L300 150 Q304 170 286 172 L46 172 Q26 172 28 150 Z" fill="' + c.outsole + '"/>' +
      '<path d="M26 138 Q24 160 44 162 L288 162 Q304 160 300 144 L296 138 Z" fill="' + c.sole + '"/>' +
      // upper
      '<path d="M30 140 C24 112 30 84 48 72 C58 66 70 70 76 82 C84 98 100 104 116 98 L146 62 C152 54 164 54 170 60 L232 112 C258 122 290 124 298 142 L298 144 L30 144 Z" fill="' + c.upper + '"/>' +
      // heel counter
      '<path d="M30 140 C24 112 30 84 48 72 C58 66 70 70 76 82 C80 100 74 124 78 144 L30 144 Z" fill="' + c.panel + '"/>' +
      // toe cap
      '<path d="M236 114 C260 122 290 124 298 142 L298 144 L222 144 C224 132 228 122 236 114 Z" fill="' + c.panel + '"/>' +
      // side stripes
      '<path d="M112 144 L150 96 L164 96 L128 144 Z" fill="' + c.accent + '"/>' +
      '<path d="M140 144 L176 100 L188 104 L156 144 Z" fill="' + c.accent + '" opacity="0.65"/>' +
      // collar lining and heel tab
      '<path d="M52 76 C60 72 68 76 72 84 C80 98 98 106 116 100 L122 94 C102 98 88 90 80 76 C74 66 60 64 50 70 Z" fill="' + c.accent + '" opacity="0.9"/>' +
      '<rect x="36" y="62" width="10" height="20" rx="4" transform="rotate(-18 41 72)" fill="' + c.accent + '"/>' +
      // laces
      '<g stroke="' + c.lace + '" stroke-width="5" stroke-linecap="round">' +
      '<path d="M150 70 L168 84"/><path d="M164 60 L184 76"/><path d="M180 72 L198 88"/><path d="M196 84 L214 100"/>' +
      '</g>' +
      // midsole line and tread
      '<path d="M30 150 L298 150" stroke="#000" stroke-opacity="0.10" stroke-width="2"/>' +
      '<g stroke="#fff" stroke-opacity="0.25" stroke-width="3" stroke-linecap="round">' +
      '<path d="M70 167 L80 167"/><path d="M110 167 L120 167"/><path d="M150 167 L160 167"/><path d="M190 167 L200 167"/><path d="M230 167 L240 167"/><path d="M266 167 L276 167"/>' +
      '</g></svg>';
    var holder = document.createElement('div');
    holder.innerHTML = svg;
    return holder.firstChild;
  }

  var toastTimer = null;
  function toast(message) {
    var node = $('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('show'); }, 2200);
  }

  // ---------- cart ----------

  /** [{ id, size, qty }] */
  var cart = loadCart();

  function loadCart() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter(function (line) {
        return line && productById(line.id) && SIZES.indexOf(String(line.size)) !== -1 && line.qty > 0 && line.qty < 100;
      });
    } catch (e) {
      return [];
    }
  }

  function saveCart() {
    try { window.localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* private window */ }
  }

  function cartCount() {
    return cart.reduce(function (sum, line) { return sum + line.qty; }, 0);
  }

  function cartSubtotal() {
    return cart.reduce(function (sum, line) { return sum + productById(line.id).price * line.qty; }, 0);
  }

  function addToCart(id, size) {
    var line = cart.filter(function (l) { return l.id === id && l.size === size; })[0];
    if (line) line.qty += 1;
    else cart.push({ id: id, size: size, qty: 1 });
    cartChanged();
  }

  function changeQty(line, delta) {
    line.qty += delta;
    if (line.qty <= 0) cart.splice(cart.indexOf(line), 1);
    cartChanged();
  }

  function cartChanged() {
    saveCart();
    renderCart();
    renderSummary();
    if (cart.length === 0 && !$('view-checkout').hidden) showView('shop');
  }

  function shippingCost() {
    var chosen = document.querySelector('input[name="shipping"]:checked');
    return chosen && chosen.value === 'express' ? EXPRESS_SHIPPING : 0;
  }

  var demoApplied = false;

  /** What the payment will be for: the order at full price, or DEMO_TOTAL with the code entered. */
  function orderTotal(withShipping) {
    var full = cartSubtotal() + (withShipping ? shippingCost() : 0);
    return demoApplied ? Math.min(full, DEMO_TOTAL) : full;
  }

  /** The rows under an order: what it costs, the code if one is applied, and what is charged. */
  function totalsRows(withShipping) {
    var subtotal = cartSubtotal();
    var shipping = withShipping ? shippingCost() : 0;
    var total = orderTotal(withShipping);
    var discount = subtotal + shipping - total;
    var rows = [el('div', { class: 'row' }, [el('span', { text: 'Subtotal' }), el('span', { text: money(subtotal) })])];
    if (withShipping) {
      rows.push(el('div', { class: 'row muted' }, [
        el('span', { text: 'Shipping' }),
        el('span', { text: shipping ? money(shipping) : 'Free' })
      ]));
    }
    if (discount > 0) {
      rows.push(el('div', { class: 'row discount' }, [
        el('span', {}, [document.createTextNode('Discount '), el('span', { class: 'code-pill', text: DEMO_CODE })]),
        el('span', { text: '−' + money(discount) })
      ]));
    }
    rows.push(el('div', { class: 'row total' }, [el('span', { text: 'Total' }), el('span', { text: money(total) })]));
    return rows;
  }

  function lineNode(line, editable) {
    var product = productById(line.id);
    var art = el('div', { class: 'line-art', style: 'background:' + product.c.tile }, [sneakerSvg(product.c)]);
    var info = el('div', {}, [
      el('div', { class: 'line-name', text: product.name }),
      el('div', { class: 'line-sub', text: product.colour + ' · US ' + line.size + (editable ? '' : ' · Qty ' + line.qty) })
    ]);
    if (editable) {
      var minus = el('button', { type: 'button', 'aria-label': 'Decrease quantity', text: '−' });
      var plus = el('button', { type: 'button', 'aria-label': 'Increase quantity', text: '+' });
      var remove = el('button', { type: 'button', class: 'remove', text: 'Remove' });
      minus.addEventListener('click', function () { changeQty(line, -1); });
      plus.addEventListener('click', function () { changeQty(line, 1); });
      remove.addEventListener('click', function () { changeQty(line, -line.qty); });
      info.appendChild(el('div', {}, [
        el('span', { class: 'qty' }, [minus, el('span', { text: String(line.qty) }), plus]),
        remove
      ]));
    }
    return el('div', { class: 'line' }, [art, info, el('div', { class: 'line-price', text: money(product.price * line.qty) })]);
  }

  function renderCart() {
    $('cartCount').textContent = String(cartCount());
    var lines = $('cartLines');
    var foot = $('cartFoot');
    lines.textContent = '';
    foot.textContent = '';
    if (cart.length === 0) {
      lines.appendChild(el('div', { class: 'empty', text: 'Your cart is empty.' }));
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    cart.forEach(function (line) { lines.appendChild(lineNode(line, true)); });
    foot.appendChild(el('div', { class: 'totals' }, totalsRows(false)));
    var go = el('button', { type: 'button', class: 'btn btn-primary btn-block', style: 'margin-top:16px', text: 'Checkout' });
    go.addEventListener('click', function () { closeCart(); showView('checkout'); });
    foot.appendChild(go);
  }

  function renderSummary() {
    var lines = $('summaryLines');
    var totals = $('summaryTotals');
    lines.textContent = '';
    totals.textContent = '';
    cart.forEach(function (line) { lines.appendChild(lineNode(line, false)); });
    totalsRows(true).forEach(function (row) { totals.appendChild(row); });
    if (!paying) $('payBtn').textContent = payLabel();
  }

  function openCart() {
    $('drawer').classList.add('open');
    $('drawer').setAttribute('aria-hidden', 'false');
    $('scrim').hidden = false;
  }

  function closeCart() {
    $('drawer').classList.remove('open');
    $('drawer').setAttribute('aria-hidden', 'true');
    $('scrim').hidden = true;
  }

  // ---------- shop ----------

  var category = 'All';

  function renderNav() {
    var nav = $('nav');
    nav.textContent = '';
    CATEGORIES.forEach(function (name) {
      var button = el('button', { type: 'button', 'aria-pressed': String(name === category), text: name });
      button.addEventListener('click', function () {
        category = name;
        renderNav();
        renderGrid();
        showView('shop');
        $('products').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      nav.appendChild(button);
    });
  }

  function renderGrid() {
    var grid = $('grid');
    grid.textContent = '';
    var shown = PRODUCTS.filter(function (p) { return category === 'All' || p.category === category; });
    $('gridTitle').textContent = category === 'All' ? 'All sneakers' : category;
    $('gridCount').textContent = shown.length + (shown.length === 1 ? ' style' : ' styles');
    shown.forEach(function (product) { grid.appendChild(productCard(product)); });
  }

  function productCard(product) {
    var chosen = null;
    var label = el('div', { class: 'size-label' }, [el('span', { text: 'Select size (US)' })]);
    var sizes = el('div', { class: 'sizes', role: 'group', 'aria-label': 'Size' });
    SIZES.forEach(function (size) {
      var button = el('button', { type: 'button', 'aria-pressed': 'false', text: size });
      button.addEventListener('click', function () {
        chosen = size;
        Array.prototype.forEach.call(sizes.children, function (b) { b.setAttribute('aria-pressed', String(b === button)); });
        label.classList.remove('need');
        label.firstChild.textContent = 'Size US ' + size;
      });
      sizes.appendChild(button);
    });

    var add = el('button', { type: 'button', class: 'btn btn-dark btn-block', text: 'Add to cart' });
    add.addEventListener('click', function () {
      if (!chosen) {
        label.classList.add('need');
        label.firstChild.textContent = 'Pick a size first';
        return;
      }
      addToCart(product.id, chosen);
      toast(product.name + ' (US ' + chosen + ') added to cart');
      openCart();
    });

    return el('article', { class: 'card' }, [
      el('div', { class: 'card-art', style: 'background:' + product.c.tile }, [
        product.tag ? el('span', { class: 'tag', text: product.tag }) : null,
        sneakerSvg(product.c)
      ]),
      el('div', { class: 'card-body' }, [
        el('div', { class: 'card-title' }, [
          el('h3', { text: product.name }),
          el('span', { class: 'price', text: money(product.price) })
        ]),
        el('div', { class: 'card-meta', text: product.colour + ' · ' + product.category }),
        label,
        sizes,
        add
      ])
    ]);
  }

  // ---------- views ----------

  function showView(name) {
    if (name === 'checkout' && cart.length === 0) name = 'shop';
    ['shop', 'checkout', 'confirmation'].forEach(function (view) {
      $('view-' + view).hidden = view !== name;
    });
    if (name === 'checkout') renderSummary();
    window.scrollTo(0, 0);
  }

  // ---------- checkout ----------

  var paying = false;
  var order = null; // What was in the cart when Pay was pressed, for the confirmation page.
  var popupWatch = null;

  function chosenToken() {
    var chosen = document.querySelector('input[name="token"]:checked');
    return chosen ? chosen.value : 'USDC';
  }

  function payLabel() {
    return 'Pay ' + money(orderTotal(true)) + ' with ' + chosenToken();
  }

  function applyCode() {
    var entered = field('promo').toUpperCase();
    var message = $('promoMsg');
    if (demoApplied) {
      demoApplied = false;
      $('promo').value = '';
      $('promo').disabled = false;
      $('promoBtn').textContent = 'Apply';
      message.textContent = '';
    } else if (entered === DEMO_CODE) {
      demoApplied = true;
      $('promo').disabled = true;
      $('promoBtn').textContent = 'Remove';
      message.textContent = 'Code applied: this order now costs ' + money(DEMO_TOTAL) + '.';
    } else {
      message.textContent = entered ? 'That code is not valid.' : 'Enter a code first.';
    }
    renderCart();
    renderSummary();
  }

  function notice(kind, message) {
    var box = $('checkoutNotice');
    box.textContent = '';
    if (!kind) return;
    var node = el('div', { class: 'notice ' + kind }, [
      kind === 'progress' ? el('span', { class: 'spinner' }) : null,
      el('span', { text: message })
    ]);
    box.appendChild(node);
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function setPaying(on, label) {
    paying = on;
    var button = $('payBtn');
    button.disabled = on;
    button.textContent = on ? label : payLabel();
    if (!on) {
      clearInterval(popupWatch);
      popupWatch = null;
    }
  }

  function field(name) {
    return String($(name).value || '').trim();
  }

  function startPayment(event) {
    event.preventDefault();
    if (paying || cart.length === 0) return;

    var form = $('checkoutForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var token = chosenToken();
    var total = orderTotal(true);
    var orderId = 'TC-' + Date.now().toString(36).toUpperCase();
    var pairs = cartCount();
    order = {
      id: orderId,
      email: field('email'),
      firstName: field('firstName'),
      shipTo: [field('address'), field('city'), field('postcode'), $('country').value].filter(Boolean).join(', '),
      express: shippingCost() > 0,
      total: total,
      lines: cart.map(function (line) { return { id: line.id, size: line.size, qty: line.qty }; })
    };

    notice('progress', 'Complete your payment in the Stabledrop window. This page updates as soon as it is done.');
    setPaying(true, 'Waiting for payment…');

    var verifying = false;
    order.onVerifying = function () { verifying = true; };

    // The address is not passed on: nothing ships, so the payment page has no use for it.
    window.ConduitCheckout.open({
      amount: String(round(total)),
      description: 'Tread & Co. order ' + orderId + ' (' + pairs + (pairs === 1 ? ' pair' : ' pairs') + ')',
      orderId: orderId,
      // The made-up address the form opens with is not a buyer's email; leave it out.
      email: order.email === SAMPLE.email ? undefined : order.email,
      tokenSymbol: token,
      metadata: { items: order.lines.map(function (l) { return l.id + ':' + l.size + 'x' + l.qty; }).join(',') }
    });

    var popup = window.ConduitCheckout.popup;
    if (!popup) {
      // The SDK has already told them to allow popups.
      setPaying(false);
      notice('error', 'The payment window was blocked. Allow popups for this site and try again.');
      return;
    }

    // ⚠️ THE SDK SAYS NOTHING WHEN THE WINDOW IS JUST CLOSED. Without this the button would wait
    //    forever. A window that closes after paying has already posted its result, so give that
    //    message a moment to arrive before calling it abandoned.
    popupWatch = setInterval(function () {
      if (!popup.closed) return;
      clearInterval(popupWatch);
      popupWatch = null;
      setTimeout(function () {
        if (!paying || verifying) return;
        setPaying(false);
        notice('info', 'The payment window was closed before the payment finished. Your cart is still here.');
      }, 1500);
    }, 500);
  }

  function showConfirmation(data) {
    var paid = order;
    setPaying(false);
    notice(null);

    $('cName').textContent = paid.firstName || 'friend';
    $('cOrder').textContent = paid.id;
    $('cEmail').textContent = paid.email;

    var lines = $('cLines');
    lines.textContent = '';
    paid.lines.forEach(function (line) { lines.appendChild(lineNode(line, false)); });

    var amount = data && data.amount != null ? data.amount : String(round(paid.total));
    var symbol = (data && data.currencySymbol) || chosenToken();
    $('cPaid').textContent = amount + ' ' + symbol;
    $('cStatus').textContent = 'Paid and protected' + (data && data.state ? ' (' + data.state + ')' : '');
    $('cContract').textContent = (data && data.contractId) || '—';
    $('cChain').textContent = (data && data.chainAddress) || '—';
    var when = data && data.verifiedAt ? new Date(data.verifiedAt) : new Date();
    $('cVerified').textContent = isNaN(when.getTime()) ? 'Yes' : when.toLocaleString();
    $('cShipTo').textContent =
      (paid.express ? 'Express' : 'Standard') + ' delivery to ' + paid.shipTo + '. (Demo: nothing is actually sent.)';

    cart = [];
    saveCart();
    renderCart();
    showView('confirmation');
  }

  window.ConduitCheckout.init({
    sellerAddress: DEMO_SELLER,
    baseUrl: window.location.origin,
    tokenSymbol: 'USDC',
    expiryDays: 7,
    mode: 'popup',

    onVerifying: function () {
      if (!order) return;
      if (order.onVerifying) order.onVerifying();
      setPaying(true, 'Confirming payment…');
      notice('progress', 'Payment sent. Confirming it now, this takes a few seconds…');
    },
    // In a real shop the order is marked paid by the webhook on the server, not here.
    onSuccess: function (data) {
      if (order) showConfirmation(data);
    },
    onError: function (error) {
      setPaying(false);
      notice('error', 'The payment did not go through: ' + String(error) + ' Your cart is still here, so you can try again.');
    },
    onCancel: function () {
      setPaying(false);
      notice('info', 'Payment cancelled. Nothing was charged and your cart is still here.');
    }
  });

  // ---------- wiring ----------

  $('heroArt').appendChild(sneakerSvg(PRODUCTS[1].c));
  $('brand').addEventListener('click', function () { showView('shop'); });
  $('cartBtn').addEventListener('click', openCart);
  $('closeCart').addEventListener('click', closeCart);
  $('scrim').addEventListener('click', closeCart);
  $('backToShop').addEventListener('click', function () { showView('shop'); });
  $('shopAgain').addEventListener('click', function () { showView('shop'); });
  $('checkoutForm').addEventListener('submit', startPayment);
  Object.keys(SAMPLE).forEach(function (name) { $(name).value = SAMPLE[name]; });
  $('promoBtn').addEventListener('click', applyCode);
  $('promo').addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return;
    event.preventDefault(); // Enter here applies the code; it must not submit the order.
    applyCode();
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="shipping"], input[name="token"]'), function (input) {
    input.addEventListener('change', renderSummary);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeCart();
  });

  renderNav();
  renderGrid();
  renderCart();
  renderSummary();
})();
