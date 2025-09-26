/* app.js — integrated with backend via Api
   Changes: checkout phone handling, save phone to address, show phone in orders
*/

/* ---------- Shortcuts & utilities ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const toast = (msg) => { const t = $('#toast'); if (!t) { console.log('TOAST:', msg); return; } t.textContent = msg; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2200); };
const money = (n) => '₹' + Number(n || 0).toFixed(2);
const todayLocalDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDaysISO = (isoDate, days) => { const d = new Date(isoDate); d.setDate(d.getDate() + days); return d.toISOString(); };

/* Safe event helpers */
function on(selector, event, handler) { const el = document.querySelector(selector); if (!el) return false; el.addEventListener(event, handler); return true; }
function onAll(selector, handler) { const nodes = document.querySelectorAll(selector); if (!nodes || !nodes.length) return false; nodes.forEach(n => handler(n)); return true; }

/* ---------- Header / nav helper ---------- */
function setHeaderMode(mode) {
  const header = document.querySelector('header');
  if (!header) return;
  if (mode === 'hidden') { header.style.display = 'none'; return; }
  header.style.display = '';

  const allButtons = ['.navbtn', '#btnReset', '#btnLogin', '#btnLogout', '#btnCart', '#navAvatar', '#navUser', '#cartCount', '#btnAdmin'];
  allButtons.forEach(sel => $$(sel).forEach(el => el.classList.add('hidden')));

  if (mode === 'login') {
    $$('#btnAdmin').forEach(el => el.classList.remove('hidden'));
  } else {
    $$('.navbtn').forEach(el => el.classList.remove('hidden'));
    $$('#btnReset').forEach(el => el.classList.remove('hidden'));
    $$('#btnCart').forEach(el => el.classList.remove('hidden'));
    $$('#btnLogin').forEach(el => el.classList.remove('hidden'));
    $$('#btnLogout').forEach(el => el.classList.remove('hidden'));
    $$('#navAvatar').forEach(el => el.classList.remove('hidden'));
    $$('#navUser').forEach(el => el.classList.remove('hidden'));
    $$('#btnAdmin').forEach(el => el.classList.remove('hidden'));
    $$('#cartCount').forEach(el => el.classList.remove('hidden'));
  }
}

/* ---------- Auth token handling ---------- */
let AUTH = { token: localStorage.getItem('token') || null, user: null };
try { if (AUTH.token) Api.setAuthToken(AUTH.token); else Api.clearAuthToken(); } catch (e) { console.warn('Api not ready', e); }

function saveToken(t) {
  AUTH.token = t || null;
  if (t) { localStorage.setItem('token', t); Api.setAuthToken(t); }
  else { localStorage.removeItem('token'); Api.clearAuthToken(); }
}

/* ---------- Quick helpers ---------- */
function dedupeOrders(arr) {
  const seen = new Map();
  (arr || []).forEach(o => { if (o && o.id != null && !seen.has(o.id)) seen.set(o.id, o); });
  return Array.from(seen.values());
}

/* ---------- Cart ---------- */
let CART = [];
function cartCount() { return CART.reduce((s, i) => s + (i.qty || 0), 0); }
function renderCartIcon() { const el = $('#cartCount'); if (el) el.textContent = cartCount(); }
function addToCart(bookId, qty = 1) { const it = CART.find(c => String(c.bookId) === String(bookId)); if (it) it.qty += qty; else CART.push({ bookId, qty }); renderCartIcon(); toast('Added to cart'); }
function removeFromCart(bookId) { CART = CART.filter(c => String(c.bookId) !== String(bookId)); renderCartIcon(); }
function updateCartQty(bookId, qty) { const it = CART.find(c => String(c.bookId) === String(bookId)); if (!it) return; it.qty = Math.max(1, Number(qty || 1)); renderCartIcon(); }

/* ---------- Admin edit state ---------- */
let ADMIN_EDIT_BOOK_ID = null;

/* ---------- Navigation & sections ---------- */
function setActiveNav(key) { $$('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.nav === key)); }
async function showSection(id) {
  try {
    ['loginSection', 'registerSection', 'homeSection', 'catalogSection', 'checkoutSection', 'ordersSection', 'profileSection', 'adminPanel']
      .forEach(s => { const el = document.getElementById(s); if (el) el.classList.add('hidden'); });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');

    if (id === 'loginSection' || id === 'registerSection') {
      setHeaderMode('login');
    } else {
      if (AUTH.user?.is_admin) setHeaderMode('hidden'); else setHeaderMode('full');
    }

    if (id === 'homeSection') { await renderLibrary(); await renderHomeCatalog(); }
    if (id === 'catalogSection') { await renderCatalog(); }
    if (id === 'checkoutSection') { await renderCheckout(); }
    if (id === 'ordersSection') { await renderOrders(); }
    if (id === 'profileSection') { await renderProfile(); }
    if (id === 'adminPanel') { await renderAdminPanel(); }
  } catch (err) { console.error('showSection error:', err); toast('UI error — see console'); }
}

/* ---------- Auth flows (login/register) ---------- */
on('#formRegister', 'submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  try {
    const out = await Api.register({ name: data.name, email: data.email, password: data.password, phone: data.phone || '', bio: data.bio || '' });
    saveToken(out.token); AUTH.user = out.user; toast('Registered & signed in'); await renderNav();
    if (AUTH.user?.is_admin) { setActiveNav('admin'); showSection('adminPanel'); } else { setActiveNav('home'); showSection('homeSection'); }
  } catch (err) { console.error(err); toast(err?.message || 'Register failed'); }
});

on('#formLogin', 'submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  try {
    const out = await Api.login({ email: data.email, password: data.password });
    saveToken(out.token); AUTH.user = out.user; toast('Logged in'); await renderNav();
    if (AUTH.user?.is_admin) { setActiveNav('admin'); showSection('adminPanel'); } else { setActiveNav('home'); showSection('homeSection'); }
  } catch (err) { console.error(err); toast(err?.message || 'Login failed'); }
});

/* Login/Logout header buttons */
const btnLoginEl = $('#btnLogin'); if (btnLoginEl) btnLoginEl.onclick = () => { setActiveNav('login'); showSection('loginSection'); };
const btnLogoutEl = $('#btnLogout'); if (btnLogoutEl) btnLogoutEl.onclick = () => { saveToken(null); AUTH.user = null; toast('Logged out'); renderNav(); setActiveNav('login'); showSection('loginSection'); };

/* Google sign-in buttons (if present) */
const googleSignInButtons = $$('.google-signin-btn');
googleSignInButtons.forEach(button => {
  button.addEventListener('click', async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await firebase.auth().signInWithPopup(provider);
      const firebaseToken = await result.user.getIdToken();
      const out = await Api.loginWithGoogle(firebaseToken);
      saveToken(out.token);
      AUTH.user = out.user;
      toast('Signed in with Google');
      await renderNav();
      if (AUTH.user?.is_admin) { setActiveNav('admin'); showSection('adminPanel'); } else { setActiveNav('home'); showSection('homeSection'); }
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      toast(error.message || 'An error occurred during sign-in.');
    }
  });
});

/* nav button handler */
onAll('.navbtn', (b) => {
  b.onclick = async () => {
    const key = b.dataset.nav;
    if (!AUTH.token && key !== 'login') { toast('Please login first'); setActiveNav('login'); showSection('loginSection'); return; }
    if (AUTH.user?.is_admin) {
      const allowed = ['catalog', 'admin'];
      if (!allowed.includes(key)) { toast('Admin: use Admin panel or Catalog'); setActiveNav('admin'); showSection('adminPanel'); return; }
    }
    setActiveNav(key);
    if (key === 'home') showSection('homeSection');
    if (key === 'catalog') showSection('catalogSection');
    if (key === 'orders') showSection('ordersSection');
    if (key === 'profile') showSection('profileSection');
    if (key === 'admin') showSection('adminPanel');
  };
});

/* ---------- Nav rendering ---------- */
async function renderNav() {
  try {
    if (AUTH.token && !AUTH.user) {
      try { AUTH.user = await Api.getProfile(AUTH.token); } catch (e) { console.warn('renderNav: profile fetch failed', e); saveToken(null); AUTH.user = null; }
    }
  } catch (e) {
    console.warn('renderNav profile error', e);
    saveToken(null); AUTH.user = null;
  }

  const navUser = $('#navUser'), btnLogin = $('#btnLogin'), btnLogout = $('#btnLogout'), av = $('#navAvatar');
  const navHomeBtn = $$('[data-nav="home"]')?.[0] || null;
  const navOrdersBtn = $$('[data-nav="orders"]')?.[0] || null;
  const navProfileBtn = $$('[data-nav="profile"]')?.[0] || null;
  const navCatalogBtn = $$('[data-nav="catalog"]')?.[0] || null;

  if (AUTH.user) {
    if (btnLogin) btnLogin.classList.add('hidden');
    if (btnLogout) btnLogout.classList.remove('hidden');

    if (navUser) { navUser.textContent = AUTH.user.name || 'User'; navUser.classList.remove('hidden'); }
    if (av) {
      if (AUTH.user.profile_pic) { const bust = `${AUTH.user.profile_pic}?v=${Date.now()}`; av.style.backgroundImage = `url("${bust}")`; av.classList.remove('hidden'); } else av.classList.add('hidden');
    }

    if (AUTH.user.is_admin) {
      if (navHomeBtn) navHomeBtn.classList.add('hidden');
      if (navOrdersBtn) navOrdersBtn.classList.add('hidden');
      if (navProfileBtn) navProfileBtn.classList.add('hidden');
      if (navCatalogBtn) navCatalogBtn?.classList.remove('hidden');
      setHeaderMode('hidden');
    } else {
      if (navHomeBtn) navHomeBtn.classList.remove('hidden');
      if (navOrdersBtn) navOrdersBtn.classList.remove('hidden');
      if (navProfileBtn) navProfileBtn.classList.remove('hidden');
      if (navCatalogBtn) navCatalogBtn.classList.remove('hidden');
      setHeaderMode('full');
    }
  } else {
    if (btnLogin) btnLogin.classList.remove('hidden');
    if (btnLogout) btnLogout.classList.add('hidden');
    if (navUser) navUser.classList.add('hidden');
    if (av) av.classList.add('hidden');
    setHeaderMode('login');
  }

  renderCartIcon();
}
renderNav();

/* Switch login/register */
const sToReg = $('#switchToRegister'); if (sToReg) sToReg.addEventListener('click', () => { showSection('registerSection'); });
const sToLog = $('#switchToLogin'); if (sToLog) sToLog.addEventListener('click', () => { showSection('loginSection'); });

/* Delegated profile/address/card handlers (prevents duplicates) */
document.addEventListener('submit', async (e) => {
  if (e.target.matches('#formAddress')) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await Api.addAddress(AUTH.token, data);
      e.target.reset();
      toast('Address saved');
      await renderProfile();
    } catch (err) { console.error('addAddress', err); toast(err?.message || 'Address save failed'); }
    return;
  }

  if (e.target.matches('#formCard')) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const payload = { name: data.name, number: data.number.replace(/\s+/g, ''), expiry: data.expiry, cvv: data.cvv, default: data.default === 'yes' };
    try {
      await Api.addCard(AUTH.token, payload);
      e.target.reset();
      toast('Card saved');
      await renderProfile();
    } catch (err) { console.error('addCard', err); toast(err?.message || 'Card save failed'); }
    return;
  }
});

/* Delegated clicks for address/card actions */
document.addEventListener('click', async (e) => {
  if (e.target.matches('[data-del-addr]')) {
    const id = e.target.dataset.delAddr;
    try { await Api.deleteAddress(AUTH.token, id); toast('Address deleted'); await renderProfile(); } catch (err) { console.error(err); toast(err?.message || 'Delete failed'); }
    return;
  }
  if (e.target.matches('[data-del-card]')) {
    const id = e.target.dataset.delCard;
    try { await Api.deleteCard(AUTH.token, id); toast('Deleted'); await renderProfile(); } catch (err) { console.error(err); toast(err?.message || 'Delete failed'); }
    return;
  }
  if (e.target.matches('[data-make-default]')) {
    const id = e.target.dataset.makeDefault;
    try { await Api.setDefaultCard(AUTH.token, id, true); toast('Default updated'); await renderProfile(); } catch (err) { console.error(err); toast(err?.message || 'Update failed'); }
    return;
  }
});

/* Admin quick-login + logout */
const btnAdmin = $('#btnAdmin');
if (btnAdmin) btnAdmin.addEventListener('click', async () => {
  const email = prompt('Admin email:'); if (!email) return;
  const password = prompt('Admin password:'); if (!password) return;
  try {
    const out = await Api.login({ email, password });
    if (!out.user || !out.user.is_admin) { toast('Not an admin account'); Api.clearAuthToken(); return; }
    saveToken(out.token); AUTH.user = out.user; toast('Admin signed in'); await renderNav();
    setHeaderMode('hidden');
    setActiveNav('admin');
    showSection('adminPanel');
  } catch (err) { console.error(err); toast(err?.message || 'Admin login failed'); }
});
const adminLogoutBtn = $('#adminLogout'); if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', () => { saveToken(null); AUTH.user = null; Api.clearAuthToken(); toast('Admin logged out'); renderNav(); showSection('loginSection'); });

/* Health check */
(async () => { try { if (Api && Api.health) await Api.health(); } catch (e) { /* ignore */ } })();

/* ---------- Books (Home grid + Catalog + Modal) ---------- */
let BOOK_CACHE = new Map();
async function fetchBooks(page = 1, limit = 50) { const res = await Api.getBooks(page, limit); (res.books || []).forEach(b => BOOK_CACHE.set(String(b.id), b)); return res.books || []; }
async function fetchBookById(id) { if (BOOK_CACHE.has(String(id))) return BOOK_CACHE.get(String(id)); const b = await Api.getBookById(id); BOOK_CACHE.set(String(b.id), b); return b; }

async function renderHomeCatalog() {
  try {
    const books = await fetchBooks(1, 24);
    const grid = $('#homeBookGrid'); if (!grid) return;
    grid.innerHTML = books.map(b => `
      <div class="card book-card">
        <div class="book-cover" style="background-image:url('${b.image_url || b.cover || ''}')"></div>
        <div class="pillbar"><span class="tag small">${b.author || ''}</span><span class="tag small">Stock: ${b.stock ?? '-'}</span></div>
        <h2 class="home-book-title" data-book="${b.id}" style="cursor:pointer">${b.title}</h2>
        <p class="small muted">${(b.description || '').slice(0, 90)}...</p>
        <p class="price">${money(b.price)}</p>
        <div class="row">
          <button class="btn primary" data-home-buy="${b.id}">Buy</button>
          <button class="btn" data-home-rent="${b.id}">Rent</button>
        </div>
        <div style="margin-top:8px">
          <button class="btn" data-home-gift="${b.id}">Gift</button>
          <button class="btn ghost" data-home-addcart="${b.id}">Add to Cart</button>
        </div>
      </div>
    `).join('') || '<p class="muted">No books available.</p>';

    onAll('#homeBookGrid [data-home-buy]', el => el.onclick = () => startCheckout([{ bookId: el.dataset.homeBuy, qty: 1 }], 'buy'));
    onAll('#homeBookGrid [data-home-rent]', el => el.onclick = () => startCheckout([{ bookId: el.dataset.homeRent, qty: 1 }], 'rent'));
    onAll('#homeBookGrid [data-home-gift]', el => el.onclick = () => startCheckout([{ bookId: el.dataset.homeGift, qty: 1 }], 'gift'));
    onAll('#homeBookGrid [data-home-addcart]', el => el.onclick = () => addToCart(el.dataset.homeAddcart, 1));
    onAll('#homeBookGrid .home-book-title', el => el.onclick = () => openBookModal(el.dataset.book));
  } catch (e) { console.error('renderHomeCatalog error', e); toast('Failed loading books'); }
}

async function renderCatalog(filter = '') {
  try {
    const q = (filter || '').trim();
    const books = q ? (await Api.searchBooks(q, 1, 60)).books || [] : await fetchBooks(1, 60);
    const grid = $('#bookGrid'); if (!grid) return;
    grid.innerHTML = books.map(b => `
      <div class="card book-card">
        <div class="book-cover" style="background-image:url('${b.image_url || b.cover || ''}')"></div>
        <div class="pillbar"><span class="tag small">${b.author || ''}</span><span class="tag small">Stock: ${b.stock ?? '-'}</span></div>
        <h2 class="book-title" data-book="${b.id}" style="cursor:pointer">${b.title}</h2>
        <p class="small muted">${(b.description || '').slice(0, 90)}...</p>
        <p class="price">${money(b.price)}</p>
        <div class="row">
          <button class="btn primary" data-buy="${b.id}">Buy</button>
          <button class="btn" data-rent="${b.id}">Rent</button>
        </div>
        <div style="margin-top:8px">
          <button class="btn" data-gift="${b.id}">Gift</button>
          <button class="btn ghost" data-addcart="${b.id}">Add to Cart</button>
        </div>
      </div>
    `).join('') || '<p class="muted">No books found.</p>';

    onAll('#bookGrid [data-buy]', el => el.onclick = () => startCheckout([{ bookId: el.dataset.buy, qty: 1 }], 'buy'));
    onAll('#bookGrid [data-rent]', el => el.onclick = () => startCheckout([{ bookId: el.dataset.rent, qty: 1 }], 'rent'));
    onAll('#bookGrid [data-gift]', el => el.onclick = () => startCheckout([{ bookId: el.dataset.gift, qty: 1 }], 'gift'));
    onAll('#bookGrid [data-addcart]', el => el.onclick = () => addToCart(el.dataset.addcart, 1));
    onAll('#bookGrid .book-title', el => el.onclick = () => openBookModal(el.dataset.book));
  } catch (e) { console.error('renderCatalog error', e); toast('Failed loading catalog'); }
}

on('#searchBtn', 'click', () => renderCatalog($('#searchInput') ? $('#searchInput').value : ''));
on('#clearSearchBtn', 'click', () => { if ($('#searchInput')) $('#searchInput').value = ''; renderCatalog(''); });

let currentModalBook = null;
async function openBookModal(id) {
  try {
    const b = await fetchBookById(id); if (!b) return;
    currentModalBook = b;
    $('#bmAuthor') && ($('#bmAuthor').textContent = b.author || '');
    $('#bmStock') && ($('#bmStock').textContent = 'Stock: ' + (b.stock ?? '-'));
    $('#bmTitle') && ($('#bmTitle').textContent = b.title);
    $('#bmDesc') && ($('#bmDesc').textContent = b.description || '');
    $('#bmPrice') && ($('#bmPrice').textContent = money(b.price));
    $('#bmCover') && ($('#bmCover').style.backgroundImage = `url("${b.image_url || b.cover || ''}")`);
    $('#bookModal') && $('#bookModal').classList.add('show');
  } catch (e) { console.error('openBookModal', e); toast('Failed to open book'); }
}
on('#bmClose', 'click', () => $('#bookModal')?.classList.remove('show'));
on('#bmAddCart', 'click', () => { if (currentModalBook) addToCart(currentModalBook.id, 1); });
on('#bmBuy', 'click', () => { if (currentModalBook) { startCheckout([{ bookId: currentModalBook.id, qty: 1 }], 'buy'); $('#bookModal')?.classList.remove('show'); } });
on('#bmRent', 'click', () => { if (currentModalBook) { startCheckout([{ bookId: currentModalBook.id, qty: 1 }], 'rent'); $('#bookModal')?.classList.remove('show'); } });
on('#bmGift', 'click', () => { if (currentModalBook) { startCheckout([{ bookId: currentModalBook.id, qty: 1 }], 'gift'); $('#bookModal')?.classList.remove('show'); } });

/* ---------- Cart drawer ---------- */
const drawer = $('#cartDrawer');
if (drawer) {
  const btnCart = $('#btnCart'); if (btnCart) btnCart.onclick = async () => { await renderCartDrawer(); drawer.classList.add('open'); };
  const cartClose = $('#cartClose'); if (cartClose) cartClose.onclick = () => drawer.classList.remove('open');
}
on('#cartToCheckout', 'click', () => { if (!CART.length) { toast('Cart is empty'); return; } startCheckout(CART, 'buy'); drawer?.classList.remove('open'); });

async function withBook(item) { const b = await fetchBookById(item.bookId); return { ...item, book: b }; }
async function renderCartDrawer() {
  try {
    const items = await Promise.all(CART.map(withBook));
    const wrap = $('#cartItems'); if (!wrap) return;
    wrap.innerHTML = items.length ? items.map(i => `
      <div class="card">
        <div class="cart-line">
          <div class="thumb" style="background-image:url('${i.book.image_url || i.book.cover || ''}')"></div>
          <div class="cart-line-info">
            <h3>${i.book.title}</h3>
            <div class="row">
              <div><span class="muted small">Unit</span><div class="price">${money(i.book.price)}</div></div>
              <div>
                <span class="muted small">Qty</span>
                <div class="pillbar">
                  <button class="btn small" data-incdec="-|${i.book.id}">-</button>
                  <span class="kbd" id="qty_${i.book.id}">${i.qty}</span>
                  <button class="btn small" data-incdec="+|${i.book.id}">+</button>
                  <button class="btn bad small" data-rem="${i.book.id}">Remove</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('') : '<p class="muted">Your cart is empty.</p>';

    const subtotal = items.reduce((s, x) => s + (x.book.price || 0) * x.qty, 0);
    const cartSubtotal = $('#cartSubtotal'); if (cartSubtotal) cartSubtotal.textContent = money(subtotal);

    onAll('#cartItems [data-incdec]', (b) => { b.onclick = () => { const [op, id] = b.dataset.incdec.split('|'); const cur = CART.find(c => String(c.bookId) === String(id))?.qty || 1; const next = op === '+' ? cur + 1 : cur - 1; updateCartQty(id, next); renderCartDrawer(); }; });
    onAll('#cartItems [data-rem]', (b) => { b.onclick = () => { removeFromCart(b.dataset.rem); renderCartDrawer(); }; });
  } catch (e) { console.error('renderCartDrawer', e); toast('Failed to render cart'); }
}

/* ---------- Checkout ---------- */
function startCheckout(items, mode) { CART = items.slice(); renderCartIcon(); setActiveNav('checkout'); showSection('checkoutSection'); renderCheckout(mode); }

async function renderCheckout(presetMode = null) {
  try {
    if (!AUTH.token) { setActiveNav('login'); showSection('loginSection'); return; }
    if (!AUTH.user) AUTH.user = await Api.getProfile(AUTH.token);

    const items = await Promise.all(CART.map(withBook));
    const ckItemsEl = $('#ckItems'); if (!ckItemsEl) return;
    ckItemsEl.innerHTML = items.length ? items.map(i => `
      <div class="card">
        <div class="line">
          <div class="thumb" style="background-image:url('${i.book.image_url || i.book.cover || ''}')"></div>
          <div class="info">
            <h3>${i.book.title}</h3>
            <div class="row">
              <div><span class="muted small">Unit</span><div class="price">${money(i.book.price)}</div></div>
              <div><span class="muted small">Qty</span><input type="number" min="1" value="${i.qty}" data-qty="${i.book.id}" /></div>
            </div>
          </div>
        </div>
      </div>
    `).join('') : '<p class="muted">No items. Add from catalog.</p>';

    const ckMode = $('#ckMode'); if (!ckMode) return; if (presetMode) ckMode.value = presetMode;
    const rentBlock = $('#rentBlock'), giftBlock = $('#giftBlock'), shippingWrap = $('#shippingWrap');
    const refreshBlocks = () => {
      const mode = ckMode.value; const isRent = mode === 'rent'; const isGift = mode === 'gift'; const needsShipping = mode === 'buy';
      if (rentBlock) rentBlock.classList.toggle('hidden', !isRent);
      if (giftBlock) giftBlock.classList.toggle('hidden', !isGift);
      if (shippingWrap) shippingWrap.classList.toggle('hidden', !needsShipping);
      const paySel = $('#ckPayMethod');
      if (paySel) { const codOpt = Array.from(paySel.options).find(o => o.value === 'cod'); if (codOpt) codOpt.disabled = !needsShipping; if (!needsShipping && paySel.value === 'cod') paySel.value = 'card'; }
      computeSummary();
    };
    ckMode.onchange = refreshBlocks;

    // Load addresses (for checkout) and fill select
    const addrSel = $('#ckSavedAddr'); let addresses = [];
    try { addresses = await Api.listAddresses(AUTH.token); } catch { addresses = []; }
    if (addrSel) {
      if (addresses.length) {
        addrSel.innerHTML = addresses.filter(a => a.id).map(a => `<option value="${a.id}">${a.label} — ${a.city} (${a.zip})</option>`).join('');
      } else { addrSel.innerHTML = '<option value="">No saved addresses</option>'; addrSel.value = ''; }
    }

    // Save new address button
    const btnSaveNewAddr = $('#btnSaveNewAddr'); if (btnSaveNewAddr) btnSaveNewAddr.onclick = async () => {
      const inputs = $$('#ckNewAddr [data-addr]'); const data = {}; inputs.forEach(i => data[i.dataset.addr] = i.value.trim());
      if (!data.label || !data.recipient || !data.street || !data.city || !data.state || !data.zip) { toast('Fill all address fields'); return; }
      try {
        // include phone if provided
        if ($('#ckNewAddr [data-addr="phone"]')) data.phone = ($('#ckNewAddr [data-addr="phone"]').value || '').trim();
        await Api.addAddress(AUTH.token, data);
        toast('Address saved');
        inputs.forEach(i => (i.value = ''));
        // refresh checkout UI (addresses will include phone)
        await renderCheckout($('#ckMode')?.value);
      }
      catch (err) { console.error('save addr', err); toast(err?.message || 'Address save failed'); }
    };

    // Cards
    const cardSel = $('#ckSavedCard'); const cards = await Api.listCards(AUTH.token).catch(() => []);
    if (cardSel) cardSel.innerHTML = (cards || []).map(c => `<option value="${c.id}">${c.card_name || c.name} •••• ${String(c.card_number || '').slice(-4)}</option>`).join('') || '<option value="">No saved cards</option>';

    onAll('#ckItems [data-qty]', (inp) => { inp.onchange = () => { updateCartQty(inp.dataset.qty, parseInt(inp.value || '1', 10)); renderCheckout(ckMode.value); }; });
    on('#ckSpeed', 'change', computeSummary); on('#ckRental', 'change', computeSummary);
    const ckPayMethod = $('#ckPayMethod'); if (ckPayMethod) ckPayMethod.onchange = () => { $('#cardSelectWrap')?.classList.toggle('hidden', $('#ckPayMethod').value !== 'card'); computeSummary(); };

    function computeSummary() {
      const mode = ckMode.value; const rentalDays = parseInt($('#ckRental')?.value || '30', 10); const needsShipping = (mode === 'buy');
      const shipMap = { standard: 30, express: 70, priority: 120 }; const shipKey = $('#ckSpeed')?.value || 'standard'; const shipFee = needsShipping ? (shipMap[shipKey] || 0) : 0;
      const payMethod = $('#ckPayMethod')?.value || 'card'; const codFee = (needsShipping && payMethod === 'cod') ? 10 : 0;
      const rentFactor = (mode === 'rent') ? (rentalDays === 30 ? 0.35 : 0.55) : 1.0;
      const lineItems = CART.map(ci => { const b = BOOK_CACHE.get(String(ci.bookId)); const unit = (b?.price || 0) * rentFactor; return { id: b?.id, title: b?.title || 'Item', qty: ci.qty, unit, total: unit * ci.qty }; });
      const subtotal = lineItems.reduce((s, x) => s + x.total, 0); const total = subtotal + shipFee + codFee;
      const today = todayLocalDate(); const dueISO = (mode === 'rent') ? addDaysISO(today + 'T00:00:00Z', rentalDays) : null;
      const etaDaysMap = { standard: 5, express: 3, priority: 1 }; const etaISO = needsShipping ? addDaysISO(today + 'T00:00:00Z', etaDaysMap[shipKey] || 5) : null;
      const summaryEl = $('#ckSummary'); if (summaryEl) {
        summaryEl.innerHTML = `
          <h2>Summary</h2>
          <table class="table">
            <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
            <tbody>
              ${lineItems.map(i => `<tr><td>${i.title}</td><td>${i.qty}</td><td>${money(i.unit)}</td><td>${money(i.total)}</td></tr>`).join('')}
              ${needsShipping ? `<tr><td colspan="3" class="right muted">Shipping (${shipKey})</td><td>${money(shipFee)}</td></tr>` : ''}
              ${needsShipping && payMethod === 'cod' ? `<tr><td colspan="3" class="right muted">COD fee</td><td>${money(codFee)}</td></tr>` : ''}
              ${mode === 'rent' ? `<tr><td colspan="3" class="right muted">Rental period</td><td>${rentalDays} days</td></tr>` : ''}
              ${needsShipping ? `<tr><td colspan="3" class="right muted">Estimated delivery</td><td>${new Date(etaISO).toLocaleDateString()}</td></tr>` : ''}
            </tbody>
            <tfoot><tr><th colspan="3" class="right">Grand total</th><th>${money(total)}</th></tr></tfoot>
          </table>
          <p class="small muted">Order date: ${today}. ${mode === 'rent' ? 'Due: ' + new Date(dueISO).toLocaleDateString() : ''}</p>
        `;
      }
      return { lineItems, subtotal, shipFee, codFee, total, mode, rentalDays, dueDateISO: dueISO, payMethod, needsShipping, deliveryEtaISO: etaISO, shipKey };
    }

    let lastSummary = computeSummary(); refreshBlocks();

    // Pay button logic
    const btnPay = $('#btnPay');
    if (btnPay) {
      btnPay.onclick = async () => {
        const lastSummary2 = computeSummary();
        const mode = lastSummary2.mode;
        if (mode === 'gift') { const ge = $('#ckGiftEmail')?.value.trim() || ''; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ge)) { toast('Enter a valid gift email'); return; } }
        let shipping_address_id = null, shipping_speed = null;
        if (lastSummary2.needsShipping) { shipping_address_id = $('#ckSavedAddr')?.value || null; if (!shipping_address_id) { toast('Select or add an address'); return; } shipping_speed = lastSummary2.shipKey; }
        let saved_card_id = null; if (lastSummary2.payMethod === 'card') { saved_card_id = $('#ckSavedCard')?.value || null; if (!saved_card_id) { toast('Add a card in Profile or choose another method'); return; } }

        // Phone handling
        const phone = ($('#ckPhone')?.value || '').trim();
        if (!phone) { toast('Enter a phone number for the order'); return; }
        const savePhoneToAddr = !!($('#ckSavePhone')?.checked);
        // If user just saved a "new address", the ckNewAddr save button should be used instead — otherwise if the address exists we can update it when savePhoneToAddr=true.

        const orderData = {
          mode,
          items: CART.map(ci => ({ book_id: ci.bookId, quantity: ci.qty })),
          shipping_address_id,
          shipping_speed,
          payment_method: lastSummary2.payMethod,
          saved_card_id,
          notes: $('#ckNotes')?.value || null,
          rental_duration: mode === 'rent' ? lastSummary2.rentalDays : null,
          gift_email: mode === 'gift' ? ($('#ckGiftEmail')?.value || '').trim() : null,
          shipping_fee: lastSummary2.shipFee,
          cod_fee: lastSummary2.codFee,
          delivery_eta: lastSummary2.deliveryEtaISO || null,
          phone, // snapshot phone
          save_phone_to_address: savePhoneToAddr // optional request to save phone to address
        };

        if (btnPay.disabled) return;
        btnPay.disabled = true;
        try {
          // Place order on server (server is authoritative about totals)
          const resp = await Api.placeOrder(AUTH.token, orderData);
          // If server returns the created order object, prefer that for display
          const createdOrder = resp && (resp.order || resp.data || null);
          toast('Order placed');

          CART = []; renderCartIcon();
          setActiveNav('orders'); showSection('ordersSection');

          // Refresh orders to show server data
          await renderOrders();

          // if server returns a fresh profile (e.g. updated address with phone) refresh nav/profile
          await renderNav();

        } catch (err) {
          console.error('placeOrder', err);
          toast(err?.message || 'Order failed');
        } finally {
          btnPay.disabled = false;
        }
      };
    }

  } catch (e) { console.error('renderCheckout', e); toast('Checkout failed (see console)'); }
}

/* ---------- Orders ---------- */
async function renderOrders() {
  try {
    if (!AUTH.token) { setActiveNav('login'); showSection('loginSection'); return; }
    let orders = [];
    try { const out = await Api.getOrders(AUTH.token); orders = out || []; } catch (err) { console.error(err); $('#ordersList') && ($('#ordersList').innerHTML = '<p class="muted">Failed to load orders.</p>'); return; }

    // normalize to array and dedupe
    orders = Array.isArray(orders) ? orders : (orders.orders || []);
    orders = dedupeOrders(orders);

    if (!orders.length) { $('#ordersList') && ($('#ordersList').innerHTML = '<p class="muted">No orders yet.</p>'); return; }

    const shipMap = { standard: 30, express: 70, priority: 120 };

    const out = orders.map((o, idx) => {
      const shipFee = (o.shipping_fee != null) ? Number(o.shipping_fee) : (o.shipping_speed ? (shipMap[o.shipping_speed] || 0) : 0);
      const codFee = (o.cod_fee != null) ? Number(o.cod_fee) : ((o.payment_method === 'cod') ? 10 : 0);
      const items = (o.items || []);
      const itemsHTML = items.map(i => `<tr><td>${i.title || i.book_id}</td><td>${i.quantity}</td><td>${money(i.price)}</td><td>${money((i.price || 0) * (i.quantity || 0))}</td></tr>`).join('');
      const itemsTotal = items.reduce((s, it) => s + ((Number(it.price || 0)) * (Number(it.quantity || 0))), 0);
      const grandTotal = itemsTotal + shipFee + codFee;

      const userSeq = idx + 1;
      let etaText = '-';
      if (o.delivery_eta) etaText = new Date(o.delivery_eta).toLocaleDateString();
      else if (o.shipping_speed && o.created_at) {
        const mapDays = { standard: 5, express: 3, priority: 1 };
        const days = mapDays[o.shipping_speed] || 5;
        etaText = new Date(addDaysISO(o.created_at, days)).toLocaleDateString();
      } else if (o.shipping_speed) {
        etaText = 'Depends on ' + o.shipping_speed;
      }

      return `
        <div class="card">
          <div class="pillbar">
            <span class="tag">#${userSeq}</span>
            <span class="tag small">ServerID:${o.id}</span>
            <span class="tag small">${(o.mode || '').toUpperCase()}</span>
            <span class="tag small">${new Date(o.created_at || o.dateISO || Date.now()).toLocaleString()}</span>
            <span class="tag small">${o.payment_method === 'cod' ? 'COD' : 'Prepaid'}</span>
            ${o.rental_end ? `<span class="tag small">Due ${new Date(o.rental_end).toLocaleDateString()}</span>` : ''}
            ${o.gift_email ? `<span class="tag small">Gift to ${o.gift_email}</span>` : ''}
            ${o.status ? `<span class="tag small">${o.status}</span>` : ''}
          </div>
          <div class="hr"></div>
          <table class="table">
            <thead><tr><th>Book</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
            <tbody>
              ${itemsHTML}
              ${(shipFee > 0) ? `<tr><td colspan="3" class="right muted">Shipping</td><td>${money(shipFee)}</td></tr>` : ''}
              ${(codFee > 0) ? `<tr><td colspan="3" class="right muted">COD fee</td><td>${money(codFee)}</td></tr>` : ''}
            </tbody>
            <tfoot><tr><th colspan="3" class="right">Grand total</th><th>${money(grandTotal)}</th></tr></tfoot>
          </table>
          ${(shipFee > 0 || o.shipping_speed) ? `<p class="small muted">Estimated delivery: ${etaText}</p>` : ''}
          <p class="small muted">Payment: ${o.payment_method || 'unknown'}</p>
          <p class="small muted">Phone: ${o.phone || (o.shipping_address && o.shipping_address.phone) || '-'}</p>
        </div>
      `;
    }).join('');
    const ordersList = $('#ordersList'); if (ordersList) ordersList.innerHTML = out;
  } catch (e) { console.error('renderOrders', e); toast('Failed to render orders'); }
}

/* ---------- Library ---------- */
async function renderLibrary() {
  try {
    if (!AUTH.token) { setActiveNav('login'); showSection('loginSection'); return; }
    let lib = null;
    try { lib = await Api.getLibrary(AUTH.token); } catch { }
    if (!lib) {
      const orders = await Api.getOrders(AUTH.token).catch(() => []);
      const owned = [], rented = [];
      for (const o of orders) { if (o.mode === 'buy') (o.items || []).forEach(i => owned.push(i.book_id)); if (o.mode === 'rent') (o.items || []).forEach(i => rented.push({ id: i.book_id, rental_end: o.rental_end })); }
      lib = { owned: [...new Set(owned)].map(id => ({ book: { id }, purchased_at: null })), rented: rented.map(r => ({ book: { id: r.id }, rental_end: r.rental_end })) };
    }

    const ownedCards = await Promise.all((lib.owned || []).map(async ob => {
      const b = await fetchBookById(ob.book.id); return `
      <div class="card">
        <div class="pillbar"><span class="tag small">Owned</span><span class="tag small">${b.author || ''}</span></div>
        <h3>${b.title}</h3>
        <button class="btn" data-read="${b.id}" data-title="${b.title}">Read</button>
      </div>`;
    }));
    const todayISO = new Date().toISOString();
    const rentedCards = await Promise.all((lib.rented || []).map(async rb => {
      const b = await fetchBookById(rb.book.id); const active = rb.rental_end && todayISO < new Date(rb.rental_end).toISOString(); return `
      <div class="card">
        <div class="pillbar"><span class="tag small">${active ? 'Rental (Active)' : 'Rental (Expired)'}</span><span class="tag small">${b.author || ''}</span></div>
        <h3>${b.title}</h3>
        <p class="small muted">Due: ${rb.rental_end ? new Date(rb.rental_end).toLocaleDateString() : '-'}</p>
        <button class="btn ${active ? '' : 'ghost'}" data-read="${active ? b.id : ''}" data-title="${b.title}" ${active ? '' : 'disabled'}>Read</button>
      </div>`;
    }));
    const libraryOwnedEl = $('#libraryOwned'), libraryRentedEl = $('#libraryRented');
    if (libraryOwnedEl) libraryOwnedEl.innerHTML = ownedCards.join('') || '<p class="muted">No purchased books yet.</p>';
    if (libraryRentedEl) libraryRentedEl.innerHTML = rentedCards.join('') || '<p class="muted">No rentals yet.</p>';
    onAll('#libraryOwned [data-read], #libraryRented [data-read]', (btn) => { if (!btn.hasAttribute('disabled')) btn.onclick = () => openReader(btn.dataset.title); });
  } catch (e) { console.error('renderLibrary', e); toast('Failed to render library'); }
}
function openReader(title) { $('#readerTitle') && ($('#readerTitle').textContent = title); $('#readerBody') && ($('#readerBody').textContent = 'This is a sample reader.'); $('#readerModal')?.classList.add('show'); }
on('#readerClose', 'click', () => $('#readerModal')?.classList.remove('show'));

/* ---------- Profile ---------- */
async function renderProfile() {
  try {
    if (!AUTH.token) { setActiveNav('login'); showSection('loginSection'); return; }
    const u = await Api.getProfile(AUTH.token).catch(() => null);
    if (!u) { const pv = $('#profileView'); if (pv) pv.innerHTML = '<p class="muted">Failed to load profile</p>'; return; }
    AUTH.user = u;
    const pfUrl = u.profile_pic ? `${u.profile_pic}?v=${Date.now()}` : '';
    const profileView = $('#profileView'); if (!profileView) return;
    profileView.innerHTML = `
      <div class="profile-head">
        <div class="avatar-lg" id="pfAvatar" style="${pfUrl ? `background-image:url('${pfUrl}')` : ''}"></div>
        <div class="profile-meta">
          <div><span class="muted">Name</span><div>${u.name || ''}</div></div>
          <div><span class="muted">Email</span><div>${u.email || ''}</div></div>
          <div><span class="muted">Phone</span><div>${u.phone || '-'}</div></div>
          <div><span class="muted">Bio</span><div>${u.bio || '-'}</div></div>
        </div>
      </div>
      <div class="pillbar" style="margin-top:8px"><button id="peStart" class="btn">Edit profile</button></div>
    `;
    on('#peStart', 'click', () => {
      $('#profileView')?.classList.add('hidden'); $('#profileEdit')?.classList.remove('hidden');
      $('#peName') && ($('#peName').value = u.name || ''); $('#pePhone') && ($('#pePhone').value = u.phone || ''); $('#peBio') && ($('#peBio').value = u.bio || '');
      const preview = $('#pePicPreview'); if (preview) preview.style.backgroundImage = u.profile_pic ? `url("${u.profile_pic}?v=${Date.now()}")` : '';
    });

    const urlInput = $('#pePicUrl'), fileInput = $('#pePicFile'), preview = $('#pePicPreview');
    if (fileInput) { fileInput.onchange = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { if (preview) { preview.style.backgroundImage = `url("${ev.target.result}")`; preview.dataset.src = ev.target.result; } }; r.readAsDataURL(f); }; }
    if (urlInput) urlInput.oninput = (e) => { const v = e.target.value.trim(); if (v && preview) { preview.style.backgroundImage = `url("${v}")`; preview.dataset.src = v; } };

    on('#peSave', 'click', async () => {
      const name = $('#peName')?.value.trim(); if (!name) { toast('Name is required'); return; }
      let profilePicUrl = AUTH.user?.profile_pic || '';
      const picFile = $('#pePicFile')?.files?.[0] || null;
      if (picFile) {
        try { const up = await Api.uploadProfilePic(AUTH.token, picFile); profilePicUrl = up?.url || profilePicUrl; } catch (e) { console.error('uploadProfilePic', e); toast(e?.message || 'Image upload failed'); return; }
      } else { const urlInputVal = ($('#pePicUrl')?.value || '').trim(); if (urlInputVal) profilePicUrl = urlInputVal; }
      const body = { name, phone: $('#pePhone')?.value.trim(), bio: $('#peBio')?.value.trim(), profile_pic: profilePicUrl };
      try { await Api.updateProfile(AUTH.token, body); toast('Profile updated'); $('#profileEdit')?.classList.add('hidden'); $('#profileView')?.classList.remove('hidden'); await renderNav(); renderProfile(); } catch (err) { console.error('updateProfile', err); toast(err?.message || 'Update failed'); }
    });

    on('#peCancel', 'click', () => { $('#profileEdit')?.classList.add('hidden'); $('#profileView')?.classList.remove('hidden'); });

    const cpBtn = document.getElementById('cpSave'); if (cpBtn) cpBtn.onclick = async () => {
      const cur = ($('#cpCurrent')?.value || '').trim(), nxt = ($('#cpNew')?.value || '').trim(), cfm = ($('#cpConfirm')?.value || '').trim();
      if (!cur || !nxt || !cfm) { toast('Fill all password fields'); return; }
      if (nxt !== cfm) { toast('New passwords do not match'); return; }
      if (nxt.length < 6) { toast('New password must be at least 6 chars'); return; }
      try { await Api.changePassword(AUTH.token, { current: cur, next: nxt }); toast('Password updated'); $('#cpCurrent').value = ''; $('#cpNew').value = ''; $('#cpConfirm').value = ''; } catch (e) { console.error('changePassword', e); toast(e?.message || 'Password update failed'); }
    };

    // Addresses & Cards: only for normal users (admin profile hides these)
    if (!AUTH.user?.is_admin) {
      const addrs = await Api.listAddresses(AUTH.token).catch(() => []);
      const addrList = $('#addrList');
      if (addrList) {
        addrList.innerHTML = (addrs || []).map(a => `
          <div class="card">
            <div class="pillbar">
              <span class="tag">${a.label}</span>
              <span class="tag small">${a.city}, ${a.state}</span>
              <span class="tag small">PIN ${a.zip}</span>
            </div>
            <p>${a.recipient} — ${a.street}</p>
            <p class="small muted">Phone: ${a.phone || '-'}</p>
            <button class="btn bad small" data-del-addr="${a.id}">Delete</button>
          </div>
        `).join('') || '<p class="small muted">No addresses yet</p>';
      }

      const cards = await Api.listCards(AUTH.token).catch(() => []);
      const cardList = $('#cardList');
      if (cardList) {
        cardList.innerHTML = (cards || []).map(c => `
          <div class="card">
            <div class="pillbar">
              <span class="tag">${c.card_name || c.name}</span>
              <span class="tag small">•••• ${String(c.card_number || '').slice(-4)}</span>
              <span class="tag small">${c.expiry}</span>
              ${c.is_default ? '<span class="tag" style="background:rgba(52,211,153,.2);border-color:rgba(52,211,153,.5)">Default</span>' : ''}
            </div>
            <div class="pillbar">
              <button class="btn small" data-make-default="${c.id}">Make default</button>
              <button class="btn bad small" data-del-card="${c.id}">Delete</button>
            </div>
          </div>
        `).join('') || '<p class="small muted">No cards yet</p>';
      }
    } else {
      const addrList = $('#addrList'); if (addrList) addrList.innerHTML = '<p class="small muted">Admin — addresses hidden</p>';
      const cardList = $('#cardList'); if (cardList) cardList.innerHTML = '<p class="small muted">Admin — cards hidden</p>';
    }

  } catch (e) { console.error('renderProfile overall error', e); toast('Failed to render profile'); }
}

/* ---------- Admin panel renderer (unchanged) ---------- */
async function renderAdminPanel(view = 'orders') {
  try {
    if (!AUTH.token) { toast('Login as admin'); setActiveNav('login'); showSection('loginSection'); return; }
    if (!AUTH.user) { try { AUTH.user = await Api.getProfile(AUTH.token); } catch { saveToken(null); AUTH.user = null; toast('Admin session invalid'); setActiveNav('login'); showSection('loginSection'); return; } }
    if (!AUTH.user.is_admin) { toast('Access denied'); return; }

    const main = document.getElementById('adminMain'); if (!main) return;
    main.innerHTML = '<p class="muted">Loading...</p>';

    const tabOrders = $('#adminViewOrders'), tabUsers = $('#adminViewUsers'), tabBooks = $('#adminViewBooks');
    if (tabOrders) tabOrders.classList.toggle('active', view === 'orders');
    if (tabUsers) tabUsers.classList.toggle('active', view === 'users');
    if (tabBooks) tabBooks.classList.toggle('active', view === 'books');

    if (view === 'orders') {
      const raw = await Api.getAdminOrders(AUTH.token).catch(() => []);
      const orders = dedupeOrders(Array.isArray(raw) ? raw : (raw.orders || []));
      if (!orders.length) { main.innerHTML = '<p class="muted">No orders found.</p>'; return; }
      main.innerHTML = orders.map(o => {
        const items = (o.items || []).map(i => `<li>${i.title || i.book_id} — ${i.quantity} × ${money(i.price || 0)}</li>`).join('');
        const itemsTotal = (o.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
        const shipFee = (o.shipping_fee != null) ? Number(o.shipping_fee) : (o.shipping_speed ? ({ standard: 30, express: 70, priority: 120 }[o.shipping_speed] || 0) : 0);
        const codFee = (o.cod_fee != null) ? Number(o.cod_fee) : ((o.payment_method === 'cod') ? 10 : 0);
        const grandTotal = itemsTotal + shipFee + codFee;
        let etaText = o.delivery_eta ? new Date(o.delivery_eta).toLocaleDateString() : (o.shipping_speed && o.created_at ? new Date(addDaysISO(o.created_at, ({ standard: 5, express: 3, priority: 1 }[o.shipping_speed] || 5))).toLocaleDateString() : (o.shipping_speed ? 'Depends on ' + o.shipping_speed : '-'));
        return `<div class="card">
          <div class="pillbar">
            <span class="tag">#${o.id}</span>
            <span class="tag small">${(o.mode || '').toUpperCase()}</span>
            <span class="tag small">${new Date(o.created_at || '').toLocaleString()}</span>
            <span class="tag small">${o.payment_method ? o.payment_method.toUpperCase() : 'UNKNOWN'}</span>
            ${o.status ? `<span class="tag small">${o.status}</span>` : ''}
          </div>
          <h3>Order #${o.id} — ${o.user_name || o.user_email || ''}</h3>
          <p class="small muted">Phone: ${o.phone || (o.shipping_address && o.shipping_address.phone) || '-'}</p>
          <p class="small muted">Items:</p><ul>${items}</ul>
          <div class="hr"></div>
          <p class="small muted">Items total: ${money(itemsTotal)}</p>
          ${shipFee ? `<p class="small muted">Shipping: ${money(shipFee)} (${o.shipping_speed || 'custom'})</p>` : ''}
          ${codFee ? `<p class="small muted">COD fee: ${money(codFee)}</p>` : ''}
          <p class="small muted"><strong>Grand total: ${money(grandTotal)}</strong></p>
          ${(shipFee || o.shipping_speed) ? `<p class="small muted">Estimated delivery: ${etaText}</p>` : ''}
        </div>`;
      }).join('');
    } else if (view === 'users') {
      const users = await Api.getAdminUsers(AUTH.token).catch(() => []);
      main.innerHTML = users.length ? users.map(u => `
        <div class="card">
          <div class="pillbar"><span class="tag">#${u.id}</span>${u.is_admin ? '<span class="tag small">ADMIN</span>' : ''}</div>
          <h3>${u.name}</h3>
          <p class="small muted">${u.email} • ${u.phone || '-'}</p>
          <p class="small muted">Addresses: ${u.addresses_count} • Cards: ${u.cards_count}</p>
        </div>
      `).join('') : '<p class="muted">No users</p>';
    } else if (view === 'books') {
      const booksResp = await Api.getBooks(1, 1000).catch(() => ({ books: [] }));
      const books = (booksResp.books || booksResp || []);
      const list = books.map(b => `
        <div class="card admin-book-card" data-book-id="${b.id}">
          <div class="pillbar">
            <span class="tag">#${b.id}</span>
            <span class="tag small">${b.author || ''}</span>
            <span class="tag small">Stock: <input class="admin-stock-input" data-book-id="${b.id}" type="number" min="0" value="${b.stock ?? 0}" style="width:80px;padding:4px;border-radius:6px;background:transparent;border:1px solid rgba(255,255,255,.06);" /></span>
          </div>
          <h3 style="margin-bottom:6px">${b.title}</h3>
          <p class="small muted">${(b.description || '').slice(0, 160)}${(b.description || '').length > 160 ? '...' : ''}</p>
          <div class="pillbar" style="margin-top:8px">
            <button class="btn" data-edit-book="${b.id}">Edit</button>
            <button class="btn bad" data-delete-book="${b.id}">Delete</button>
            <button class="btn ghost" data-view-catalog="${b.id}">View in Catalog</button>
          </div>
        </div>
      `).join('');
      main.innerHTML = list || '<p class="muted">No books</p>';

      onAll('.admin-book-card [data-edit-book]', (el) => {
        el.onclick = async () => {
          const id = el.dataset.editBook;
          try {
            const b = await Api.getBookById(id).catch(() => null); if (!b) { toast('Book not found'); return; }
            ADMIN_EDIT_BOOK_ID = id;
            $('#adminBookForm [name="title"]') && ($('#adminBookForm [name="title"]').value = b.title || '');
            $('#adminBookForm [name="author"]') && ($('#adminBookForm [name="author"]').value = b.author || '');
            $('#adminBookForm [name="price"]') && ($('#adminBookForm [name="price"]').value = (b.price || 0));
            $('#adminBookForm [name="stock"]') && ($('#adminBookForm [name="stock"]').value = (b.stock || 0));
            $('#adminBookForm [name="image_url"]') && ($('#adminBookForm [name="image_url"]').value = b.image_url || b.cover || '');
            $('#adminBookForm [name="description"]') && ($('#adminBookForm [name="description"]').value = b.description || '');
            toast('Edit mode: update fields and click Save Book');
            $('#adminBookForm [name="title"]')?.focus();
          } catch (err) { console.error('admin edit', err); toast(err?.message || 'Failed to load book'); }
        };
      });

      onAll('.admin-book-card [data-delete-book]', (el) => {
        el.onclick = async () => {
          const id = el.dataset.deleteBook;
          if (!confirm('Delete book #' + id + '? This action cannot be undone.')) return;
          try { await Api.deleteBookAdmin(AUTH.token, id); toast('Deleted'); await renderAdminPanel('books'); await renderCatalog(); } catch (err) { console.error('deleteBookAdmin', err); toast(err?.message || 'Delete failed'); }
        };
      });

      onAll('.admin-book-card [data-view-catalog]', (el) => { el.onclick = () => { const id = el.dataset.viewCatalog; setActiveNav('catalog'); showSection('catalogSection'); renderCatalog().then(() => { openBookModal(id); }).catch(() => { }); }; });

      onAll('.admin-stock-input', (inp) => {
        inp.onchange = async () => {
          const id = inp.dataset.bookId; const newStock = Number(inp.value || 0);
          try { await Api.updateBookAdmin(AUTH.token, id, { stock: newStock }); toast('Stock updated'); await renderCatalog(); } catch (err) { console.error('updateStock', err); toast(err?.message || 'Stock update failed'); }
        };
      });
    }
  } catch (e) { console.error('renderAdminPanel', e); toast('Admin panel failed to load'); }
}
on('#adminViewOrders', 'click', () => renderAdminPanel('orders'));
on('#adminViewUsers', 'click', () => renderAdminPanel('users'));
on('#adminViewBooks', 'click', () => renderAdminPanel('books'));

/* Admin Add/Edit Book handler */
on('#adminBookForm', 'submit', async (e) => {
  e.preventDefault();
  if (!AUTH.token || !AUTH.user?.is_admin) { toast('Admin only'); return; }
  const fd = new FormData(e.target);
  const body = {
    title: fd.get('title'),
    author: fd.get('author'),
    price: Number(fd.get('price')) || 0,
    stock: Number(fd.get('stock')) || 0,
    image_url: fd.get('image_url') || null,
    description: fd.get('description') || null
  };
  try {
    if (ADMIN_EDIT_BOOK_ID) {
      await Api.updateBookAdmin(AUTH.token, ADMIN_EDIT_BOOK_ID, body);
      toast('Book updated'); ADMIN_EDIT_BOOK_ID = null;
    } else {
      await Api.createBookAdmin(AUTH.token, body);
      toast('Book created');
    }
    e.target.reset();
    await renderAdminPanel('books'); await renderCatalog();
  } catch (err) { console.error('create/update book admin', err); toast(err?.message || 'Create/update failed'); }
});
on('#adminBookCancel', (ev) => { ev.preventDefault(); ADMIN_EDIT_BOOK_ID = null; $('#adminBookForm')?.reset(); toast('Canceled edit'); });

/* ---------- Reset demo ---------- */
on('#btnReset', 'click', () => { CART = []; renderCartIcon(); if (AUTH.token) { toast('Client reset. You are still logged in.'); } else { setActiveNav('login'); showSection('loginSection'); toast('Client reset.'); } });

/* ---------- Init ---------- */
(async function init() {
  try {
    if (AUTH.token) {
      try { AUTH.user = await Api.getProfile(AUTH.token); setActiveNav(AUTH.user?.is_admin ? 'admin' : 'home'); showSection(AUTH.user?.is_admin ? 'adminPanel' : 'homeSection'); }
      catch (e) { console.warn('init profile failed', e); saveToken(null); setActiveNav('login'); showSection('loginSection'); }
    } else {
      setActiveNav('login'); showSection('loginSection');
    }

    setInterval(() => {
      const ordersSection = document.getElementById('ordersSection');
      if (ordersSection && !ordersSection.classList.contains('hidden')) { renderOrders().catch(e => console.error('auto-refresh orders failed', e)); }
    }, 60000);
  } catch (err) { console.error('init error', err); toast('App initialization failed — check console'); }
})();
