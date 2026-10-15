(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { products: [], user: null, category: 'All', sort: 'featured', search: '', cart: [], authMode: 'login', pendingProduct: null, lastOrder: null };
  const formatPrice = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const imageFallback = "this.onerror=null;this.src='https://placehold.co/700x850/e9e6de/77796f?text=ShopQA';";

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data.error || `Request failed (${response.status})`);
      error.status = response.status; error.data = data; throw error;
    }
    return data;
  }
  function toast(message, type = 'success') {
    const el = document.createElement('div'); el.className = `toast ${type}`;
    const text = document.createElement('span'); text.textContent = message;
    const close = document.createElement('button'); close.type = 'button'; close.setAttribute('aria-label','Dismiss notification'); close.textContent = '×'; close.onclick = () => el.remove();
    el.append(text, close); $('#toastRegion').append(el);
    window.setTimeout(() => el.remove(), 4300);
  }
  function setBusy(button, busy, busyText = 'Please wait…') {
    if (busy) { button.dataset.originalText = button.innerHTML; button.disabled = true; button.innerHTML = `<span class="button-spinner"></span>${busyText}`; }
    else { button.disabled = false; if (button.dataset.originalText) button.innerHTML = button.dataset.originalText; delete button.dataset.originalText; }
  }
  function showOverlay() { $('#overlay').hidden = false; document.body.classList.add('no-scroll'); }
  function hideOverlayIfClear() {
    const anyModal = ['#authModal','#productModal'].some(s => !$(s).hidden);
    const drawerOpen = $('#cartDrawer').classList.contains('open');
    if (!anyModal && !drawerOpen) { $('#overlay').hidden = true; document.body.classList.remove('no-scroll'); }
  }
  function openCartDrawer() { $('#cartDrawer').classList.add('open'); $('#cartDrawer').setAttribute('aria-hidden','false'); showOverlay(); refreshCart().catch(handleError); }
  function closeCartDrawer() { $('#cartDrawer').classList.remove('open'); $('#cartDrawer').setAttribute('aria-hidden','true'); hideOverlayIfClear(); }
  function openAuth(mode = 'login') {
    closeCartDrawer(); state.authMode = mode; renderAuthMode(); $('#authModal').hidden = false; showOverlay();
    window.setTimeout(() => $(mode === 'register' ? '#authName' : '#authEmail').focus(), 60);
  }
  function closeModal(selector) { $(selector).hidden = true; hideOverlayIfClear(); }
  function renderAuthMode() {
    const register = state.authMode === 'register';
    $('#authTitle').textContent = register ? 'Make yourself at home.' : 'Good to see you.';
    $('#authEyebrow').textContent = register ? 'YOUR OWN LITTLE CORNER' : 'WELCOME BACK';
    $('#authIntro').textContent = register ? 'Create an account and keep your good things together.' : 'Sign in to pick up where you left off.';
    $('#nameField').hidden = !register;
    $('#authName').required = register;
    $('#authPassword').autocomplete = register ? 'new-password' : 'current-password';
    $('#authSubmit').innerHTML = register ? 'Create account <span>↗</span>' : 'Sign in <span>↗</span>';
    $$('[data-auth-mode]').forEach(b => b.classList.toggle('active', b.dataset.authMode === state.authMode));
    $('#authError').textContent = '';
  }
  async function loadProducts() {
    const params = new URLSearchParams();
    if (state.search) params.set('q', state.search);
    if (state.category !== 'All') params.set('category', state.category);
    if (state.sort !== 'featured') params.set('sort', state.sort);
    $('#productGrid').innerHTML = '<div class="loading-state">Finding the good stuff<span>…</span></div>';
    try {
      const data = await api(`/api/products?${params}`);
      state.products = data.products;
      renderProducts(data.products, data.total);
    } catch (error) {
      $('#productGrid').innerHTML = '<div class="product-empty"><h3>We could not load the collection.</h3><p>Check that the ShopQA server is running, then refresh.</p></div>';
    }
  }
  function renderProducts(products, total) {
    $('#resultsCount').textContent = state.search ? `${total} result${total === 1 ? '' : 's'} for “${state.search}”` : `${total} considered object${total === 1 ? '' : 's'}, picked for you.`;
    $('#allCount').textContent = String(state.products.length).padStart(2,'0');
    if (!products.length) {
      $('#productGrid').innerHTML = '<div class="product-empty"><h3>Nothing here just yet.</h3><p>Try another search or choose a different collection.</p><button class="button button-dark" id="resetFilters">See all objects</button></div>';
      $('#resetFilters').onclick = () => { state.search=''; state.category='All'; $('#searchInput').value=''; renderCategory(); loadProducts(); };
      return;
    }
    $('#productGrid').innerHTML = products.map(p => `
      <article class="product-card" data-testid="product-card" data-product-id="${p.id}">
        <div class="product-image-wrap" data-product-open="${p.id}" tabindex="0" role="button" aria-label="View ${safe(p.name)}">
          <img src="${safe(p.image_url)}" alt="${safe(p.name)}" loading="lazy" onerror="${imageFallback}" />
          ${p.badge ? `<span class="product-badge">${safe(p.badge)}</span>` : ''}
          <button class="quick-add" data-add="${p.id}" type="button" aria-label="Add ${safe(p.name)} to bag" data-testid="add-to-cart-${p.id}">Add to bag <span>＋</span></button>
        </div>
        <div class="product-meta"><div class="product-category">${safe(p.category)}</div><div class="product-name-row"><button class="product-name plain-product-name" data-product-open="${p.id}" type="button">${safe(p.name)}</button><span class="product-rating"><span>★</span> ${Number(p.rating).toFixed(1)}</span></div><div class="product-price-row"><span class="product-price">${formatPrice(p.price)}</span>${p.compare_at_price ? `<span class="old-price">${formatPrice(p.compare_at_price)}</span>` : ''}</div></div>
      </article>`).join('');
  }
  function renderCategory() {
    $$('.category-chip').forEach(b => b.classList.toggle('selected', b.dataset.category === state.category));
    $$('[data-category-link]').forEach(b => b.classList.toggle('active', b.dataset.categoryLink === state.category));
  }
  async function refreshUser() {
    try { const data = await api('/api/auth/me'); state.user = data.user; }
    catch (_) { state.user = null; }
    $('#accountLabel').textContent = state.user ? state.user.name.split(' ')[0] : 'Account';
    $('#accountButton').title = state.user ? `Signed in as ${state.user.email}` : 'Sign in or create an account';
    if (state.user) await refreshCart(); else { state.cart = []; updateCartBadge(); }
  }
  function updateCartBadge() {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    $('#cartCount').textContent = count; $('#drawerCount').textContent = `(${count})`;
    $('#cartCount').setAttribute('aria-label', `${count} items in bag`);
  }
  async function refreshCart() {
    if (!state.user) { state.cart = []; renderCart(); return; }
    const data = await api('/api/cart'); state.cart = data.items; renderCart();
  }
  function renderCart() {
    updateCartBadge();
    const items = state.cart;
    if (!items.length) {
      $('#cartItems').innerHTML = '<div class="empty-state"><span class="empty-symbol">◇</span><h3>A little room for good things.</h3><p>Your bag is waiting for something lovely.</p><button class="button button-dark" id="continueShopping">Explore the collection</button></div>';
      $('#cartFooter').hidden = true;
      $('#continueShopping').onclick = closeCartDrawer;
      return;
    }
    $('#cartItems').innerHTML = items.map(item => `<article class="drawer-item" data-testid="cart-item-${item.product_id}"><img src="${safe(item.image_url)}" alt="${safe(item.name)}" onerror="${imageFallback}"/><div><div class="drawer-item-category">Everyday edit</div><div class="drawer-item-name">${safe(item.name)}</div><div class="drawer-item-price">${formatPrice(item.price)}</div><div class="quantity-control"><button type="button" data-quantity="${item.product_id}" data-delta="-1" aria-label="Decrease ${safe(item.name)} quantity" ${item.quantity <= 1 ? 'disabled' : ''}>−</button><span>${item.quantity}</span><button type="button" data-quantity="${item.product_id}" data-delta="1" aria-label="Increase ${safe(item.name)} quantity" ${item.quantity >= 10 ? 'disabled' : ''}>＋</button></div></div><div><button class="remove-item" type="button" data-remove="${item.product_id}">Remove</button></div></article>`).join('');
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    $('#cartSubtotal').textContent = formatPrice(subtotal);
    const progress = Math.min(100, subtotal / 1500 * 100);
    $('#shippingProgress').style.width = `${progress}%`;
    $('#shippingMessage').textContent = subtotal >= 1500 ? 'Lovely — complimentary shipping unlocked.' : `${formatPrice(1500 - subtotal)} away from complimentary shipping.`;
    $('#cartFooter').hidden = false;
  }
  async function addToCart(productId, quantity = 1) {
    if (!state.user) { state.pendingProduct = { productId, quantity }; openAuth('login'); toast('Sign in to save your bag.','error'); return; }
    try { await api('/api/cart', { method: 'POST', body: JSON.stringify({ productId:Number(productId), quantity:Number(quantity) }) }); await refreshCart(); toast('A good choice — added to your bag.'); closeModal('#productModal'); }
    catch (error) { handleError(error); }
  }
  async function changeQuantity(productId, quantity) {
    try { await api(`/api/cart/${productId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }); await refreshCart(); }
    catch (error) { handleError(error); }
  }
  async function removeFromCart(productId) {
    try { await api(`/api/cart/${productId}`, { method:'DELETE' }); await refreshCart(); toast('Removed from your bag.'); }
    catch (error) { handleError(error); }
  }
  async function openProduct(productId) {
    const p = state.products.find(item => item.id === Number(productId));
    if (!p) { toast('That product is no longer available.','error'); return; }
    $('#productDetail').innerHTML = `<div class="product-detail-layout"><div class="product-detail-image"><img src="${safe(p.image_url)}" alt="${safe(p.name)}" onerror="${imageFallback}"/></div><div class="product-detail-copy"><div class="eyebrow"><span class="eyebrow-line"></span> ${safe(p.category.toUpperCase())}</div><h2>${safe(p.name)}</h2><div class="detail-rating">★ ${Number(p.rating).toFixed(1)} &nbsp; · &nbsp; Considered by ShopQA</div><div class="detail-price">${formatPrice(p.price)} ${p.compare_at_price ? `<span class="old-price">${formatPrice(p.compare_at_price)}</span>` : ''}</div><p>${safe(p.description)}</p><p>Designed for everyday use, with thoughtful details and a finish that feels right at home.</p><div class="detail-quantity"><label for="detailQuantity">Quantity</label><select id="detailQuantity">${Array.from({length:Math.min(10,p.stock)},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select><span class="product-category">${p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</span></div><button class="button button-dark button-wide" id="detailAdd" ${p.stock < 1 ? 'disabled' : ''}>Add to bag <span>↗</span></button><p class="secure-note">◇ &nbsp; Easy returns within 30 days.</p></div></div>`;
    $('#productModal').hidden = false; showOverlay();
    $('#detailAdd').onclick = () => addToCart(p.id, Number($('#detailQuantity').value));
  }
  async function submitAuth(event) {
    event.preventDefault(); const button = $('#authSubmit'); const errorEl = $('#authError'); errorEl.textContent = '';
    const name = $('#authName').value.trim(), email = $('#authEmail').value.trim(), password = $('#authPassword').value;
    if (state.authMode === 'register' && name.length < 2) { errorEl.textContent = 'Please enter your name (at least 2 characters).'; $('#authName').focus(); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errorEl.textContent = 'Enter a valid email address.'; $('#authEmail').focus(); return; }
    if (!password || password.length < (state.authMode === 'register' ? 8 : 1)) { errorEl.textContent = state.authMode === 'register' ? 'Password must contain at least 8 characters.' : 'Enter your password.'; $('#authPassword').focus(); return; }
    setBusy(button,true,state.authMode === 'register' ? 'Creating account…' : 'Signing in…');
    try {
      const data = await api(`/api/auth/${state.authMode}`, { method:'POST', body:JSON.stringify({ name,email,password }) });
      state.user = data.user; $('#accountLabel').textContent = state.user.name.split(' ')[0]; closeModal('#authModal'); await refreshCart(); toast(`Welcome${state.authMode === 'register' ? ' to ShopQA' : ' back'}, ${state.user.name.split(' ')[0]}.`);
      if (state.pendingProduct) { const pending = state.pendingProduct; state.pendingProduct = null; await addToCart(pending.productId,pending.quantity); }
    } catch (error) { errorEl.textContent = error.message; }
    finally { setBusy(button,false); }
  }
  async function handleAccount() {
    if (!state.user) { openAuth('login'); return; }
    const choice = window.confirm(`Signed in as ${state.user.email}.\n\nOK: view your orders\nCancel: sign out`);
    if (choice) showOrders(); else {
      try { await api('/api/auth/logout',{method:'POST',body:JSON.stringify({})}); state.user=null; state.cart=[]; $('#accountLabel').textContent='Account'; updateCartBadge(); toast('You have signed out.'); }
      catch(error) { handleError(error); }
    }
  }
  function showMainView(view) {
    $('#appMain').hidden = view !== 'home';
    $('#checkoutPage').hidden = view !== 'checkout';
    $('#ordersPage').hidden = view !== 'orders';
    $('#successPage').hidden = view !== 'success';
    window.scrollTo({top:0,behavior:'smooth'});
  }
  async function beginCheckout() {
    closeCartDrawer();
    if (!state.user) { openAuth('login'); toast('Sign in before checking out.','error'); return; }
    if (!state.cart.length) { toast('Your bag is empty. Add something first.','error'); return; }
    try {
      const me = state.user;
      $('#shippingName').value = me.name || '';
      $('#shippingEmail').value = me.email || '';
      $('#shippingAddress').value = ''; $('#shippingCity').value = ''; $('#shippingPostal').value = '';
      $('#checkoutError').textContent = '';
      renderCheckoutSummary(); showMainView('checkout');
    } catch(error) { handleError(error); }
  }
  function renderCheckoutSummary() {
    const subtotal = state.cart.reduce((sum,item)=>sum+item.line_total,0);
    const shipping = subtotal >= 1500 ? 0 : 99;
    const tax = Math.round(subtotal * 0.05);
    $('#checkoutItems').innerHTML = state.cart.map(item=>`<div class="summary-item"><img src="${safe(item.image_url)}" alt="${safe(item.name)}" onerror="${imageFallback}"/><div><strong>${safe(item.name)}</strong><small>Qty ${item.quantity} · ${formatPrice(item.price)} each</small></div><span>${formatPrice(item.line_total)}</span></div>`).join('');
    $('#checkoutTotals').innerHTML = `<div class="summary-line"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div><div class="summary-line"><span>Shipping</span><span>${shipping ? formatPrice(shipping) : 'Complimentary'}</span></div><div class="summary-line"><span>Estimated tax</span><span>${formatPrice(tax)}</span></div><div class="summary-line total"><span>Total</span><span>${formatPrice(subtotal+shipping+tax)}</span></div>`;
  }
  async function submitCheckout(event) {
    event.preventDefault(); const button = $('.place-order-button'); const errorEl = $('#checkoutError'); errorEl.textContent='';
    const form = $('#checkoutForm');
    const values = Object.fromEntries(new FormData(form).entries());
    for (const id of ['shippingName','shippingEmail','shippingAddress','shippingCity','shippingPostal']) {
      const field = $('#'+id); field.classList.remove('invalid');
      if (!field.value.trim()) { field.classList.add('invalid'); errorEl.textContent = 'Please complete all required fields.'; field.focus(); return; }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) { $('#shippingEmail').classList.add('invalid'); errorEl.textContent='Enter a valid email address.'; $('#shippingEmail').focus(); return; }
    setBusy(button,true,'Placing your demo order…');
    try {
      const data = await api('/api/orders',{method:'POST',body:JSON.stringify(values)});
      state.lastOrder = data.order; state.cart=[]; renderCart();
      $('#successOrderNumber').textContent = data.order.order_number;
      showMainView('success'); toast('Order placed successfully.');
    } catch(error) { errorEl.textContent=error.message; if(error.data?.field) { const map={shippingName:'shippingName',email:'shippingEmail',address:'shippingAddress',city:'shippingCity',postalCode:'shippingPostal'}; if(map[error.data.field]) $('#'+map[error.data.field]).focus(); } }
    finally { setBusy(button,false); }
  }
  async function showOrders() {
    if (!state.user) { openAuth('login'); return; }
    showMainView('orders'); $('#ordersContent').innerHTML='<div class="loading-state">Gathering your orders<span>…</span></div>';
    try {
      const data=await api('/api/orders');
      if(!data.orders.length){$('#ordersContent').innerHTML='<div class="orders-empty"><span class="empty-symbol">◇</span><h3>Your story starts here.</h3><p>You have not placed an order yet. Find something that feels like you.</p><button class="button button-dark" id="ordersShopNow">Explore the collection <span>↗</span></button></div>';$('#ordersShopNow').onclick=goHome;return;}
      $('#ordersContent').innerHTML=data.orders.map(o=>`<article class="order-card"><div><h3>Order ${safe(o.order_number)}</h3><p>Placed ${new Date(o.created_at.replace(' ','T')+'Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}<br/>Payment: ${safe(o.payment_method.toUpperCase())}</p><span class="order-status">${safe(o.status)}</span></div><div class="order-card-right"><strong>${formatPrice(o.total)}</strong><button data-order-detail="${o.id}">View details ↗</button></div></article>`).join('');
    } catch(error){$('#ordersContent').innerHTML=`<div class="product-empty"><h3>We couldn't load your orders.</h3><p>${safe(error.message)}</p></div>`;}
  }
  async function showOrderDetail(id) {
    try {
      const data=await api(`/api/orders/${id}`);
      const lines=data.items.map(i=>`${i.product_name} × ${i.quantity} — ${formatPrice(i.line_total)}`).join('\n');
      window.alert(`Order ${data.order.order_number}\nStatus: ${data.order.status}\n\n${lines}\n\nTotal: ${formatPrice(data.order.total)}\nShip to: ${data.order.shipping_name}, ${data.order.address}, ${data.order.city} ${data.order.postal_code}`);
    } catch(error){handleError(error);}
  }
  function goHome() { showMainView('home'); location.hash='home'; }
  function handleError(error) {
    if (error.status === 401) { state.user=null; state.cart=[]; updateCartBadge(); openAuth('login'); }
    else toast(error.message || 'Something went wrong. Please try again.', 'error');
  }

  // Global event delegation keeps the UI testable and the event model predictable.
  document.addEventListener('click', event => {
    const add = event.target.closest('[data-add]'); if(add){event.preventDefault();event.stopPropagation();addToCart(Number(add.dataset.add));return;}
    const open = event.target.closest('[data-product-open]'); if(open){event.preventDefault();openProduct(Number(open.dataset.productOpen));return;}
    const qty = event.target.closest('[data-quantity]'); if(qty){const item=state.cart.find(i=>i.product_id===Number(qty.dataset.quantity));if(item)changeQuantity(item.product_id,item.quantity+Number(qty.dataset.delta));return;}
    const remove = event.target.closest('[data-remove]'); if(remove){removeFromCart(Number(remove.dataset.remove));return;}
    const close = event.target.closest('[data-close]'); if(close){closeModal('#authModal');closeModal('#productModal');closeCartDrawer();return;}
    const authTab = event.target.closest('[data-auth-mode]'); if(authTab){state.authMode=authTab.dataset.authMode;renderAuthMode();return;}
    const detail = event.target.closest('[data-order-detail]'); if(detail){showOrderDetail(Number(detail.dataset.orderDetail));return;}
    const catLink = event.target.closest('[data-category-link]'); if(catLink){state.category=catLink.dataset.categoryLink;renderCategory();loadProducts();$('#shop').scrollIntoView({behavior:'smooth'});}
  });
  $('#categoryList').addEventListener('click',event=>{const chip=event.target.closest('[data-category]');if(!chip)return;state.category=chip.dataset.category;renderCategory();loadProducts();});
  $('#sortSelect').addEventListener('change',event=>{state.sort=event.target.value;loadProducts();});
  $('#searchToggle').addEventListener('click',()=>{$('#searchBar').hidden=!$('#searchBar').hidden;if(!$('#searchBar').hidden)$('#searchInput').focus();});
  let searchTimer; $('#searchInput').addEventListener('input',event=>{window.clearTimeout(searchTimer);state.search=event.target.value.trim();searchTimer=window.setTimeout(loadProducts,220);});
  $('#clearSearch').addEventListener('click',()=>{$('#searchInput').value='';state.search='';loadProducts();$('#searchInput').focus();});
  $('#accountButton').addEventListener('click',handleAccount);
  $('#cartButton').addEventListener('click',openCartDrawer);
  $('#overlay').addEventListener('click',()=>{closeModal('#authModal');closeModal('#productModal');closeCartDrawer();});
  $('#authForm').addEventListener('submit',submitAuth);
  $('#fillDemo').addEventListener('click',()=>{$('#authEmail').value='qa.demo@shopqa.test';$('#authPassword').value='ShopQA@123';state.authMode='login';renderAuthMode();$('#authEmail').value='qa.demo@shopqa.test';$('#authPassword').value='ShopQA@123';});
  $('#checkoutButton').addEventListener('click',beginCheckout);
  $('#continueShopping2').addEventListener('click',closeCartDrawer);
  $('#checkoutForm').addEventListener('submit',submitCheckout);
  $('#backToShop').addEventListener('click',goHome);
  $('#ordersLink').addEventListener('click',showOrders);
  $('#ordersBack').addEventListener('click',goHome);
  $('#viewOrdersButton').addEventListener('click',showOrders);
  $('#successContinue').addEventListener('click',goHome);
  $('#mobileMenu').addEventListener('click',()=>$('.main-nav').classList.toggle('open'));
  $$('.main-nav a').forEach(a=>a.addEventListener('click',()=>$('.main-nav').classList.remove('open')));
  $$('.payment-option').forEach(label=>label.addEventListener('click',()=>{$$('.payment-option').forEach(x=>x.classList.remove('selected'));label.classList.add('selected');}));
  $('#newsletterForm').addEventListener('submit',event=>{event.preventDefault();const email=$('#newsletterEmail');if(!email.checkValidity()){email.reportValidity();return;}$('#newsletterMessage').textContent='You’re on the list. Thanks for being here.';email.value='';toast('You’re on the list. Thanks for being here.');});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeModal('#authModal');closeModal('#productModal');closeCartDrawer();}});

  // Public test hooks for predictable Playwright setup and debugging.
  window.ShopQA = { api, getState:()=>({user:state.user,cart:state.cart,category:state.category,sort:state.sort}), refreshCart, refreshUser };
  async function init(){await loadProducts();await refreshUser();}
  init();
})();
