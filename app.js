/* app.js — BookNook E-commerce Platform Frontend */

// ---------- Shortcuts & utilities ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const toast = (msg, type = 'info') => {
  const t = $('#toast');
  if (!t) { console.log('TOAST:', msg); return; }

  // Add type-based styling
  t.className = 'show';
  if (type === 'success') {
    t.style.background = 'linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(52, 211, 153, 0.1))';
    t.style.borderColor = 'rgba(52, 211, 153, 0.3)';
  } else if (type === 'error') {
    t.style.background = 'linear-gradient(135deg, rgba(248, 113, 113, 0.2), rgba(248, 113, 113, 0.1))';
    t.style.borderColor = 'rgba(248, 113, 113, 0.3)';
  } else {
    t.style.background = 'linear-gradient(135deg, var(--panel), var(--soft))';
    t.style.borderColor = 'rgba(255, 255, 255, 0.1)';
  }

  t.textContent = msg;
  t.style.display = 'block';

  // Auto hide after animation
  setTimeout(() => {
    t.style.display = 'none';
    t.className = '';
  }, 2500);
};
const money = (n) => '₹' + Number(n || 0).toFixed(2);
const todayLocalDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDaysISO = (isoDate, days) => { const d = new Date(isoDate); d.setDate(d.getDate() + days); return d.toISOString(); };

// Safe event helpers
function on(selector, event, handler) { const el = document.querySelector(selector); if (!el) return false; el.addEventListener(event, handler); return true; }
function onAll(selector, handler) { const nodes = document.querySelectorAll(selector); if (!nodes || !nodes.length) return false; nodes.forEach(n => handler(n)); return true; }

// ---------- Header / nav helper ----------
function setHeaderMode(mode) {
  const header = document.querySelector('header');
  if (!header) return;
  if (mode === 'hidden') { header.style.display = 'none'; return; }
  header.style.display = '';

  const allButtons = ['.navbtn', '#btnReset', '#btnLogin', '#btnLogout', '#btnCart', '#navAvatar', '#navUser', '#cartCount', '#btnAdmin', '#btnNotifications'];
  allButtons.forEach(sel => $$(sel).forEach(el => el.classList.add('hidden')));

  if (mode === 'login') {
    // On login page: only show admin button
    $$('#btnAdmin').forEach(el => el.classList.remove('hidden'));
  } else {
    // After login: show main navigation without login/admin/reset buttons
    $$('.navbtn').forEach(el => el.classList.remove('hidden'));
    $$('#btnCart').forEach(el => el.classList.remove('hidden'));
    $$('#btnLogout').forEach(el => el.classList.remove('hidden'));
    $$('#navAvatar').forEach(el => el.classList.remove('hidden'));
    $$('#navUser').forEach(el => el.classList.remove('hidden'));
    $$('#btnNotifications').forEach(el => el.classList.remove('hidden'));
    $$('#cartCount').forEach(el => el.classList.remove('hidden'));
    // Hide: login, admin, reset buttons when logged in
    $$('#btnLogin').forEach(el => el.classList.add('hidden'));
    $$('#btnAdmin').forEach(el => el.classList.add('hidden'));
    $$('#btnReset').forEach(el => el.classList.add('hidden'));
  }
}

// ---------- Auth token handling ----------
let AUTH = { token: localStorage.getItem('token') || null, user: null };
try { if (AUTH.token) Api.setAuthToken(AUTH.token); else Api.clearAuthToken(); } catch (e) { console.warn('Api not ready', e); }

function saveToken(t) {
  AUTH.token = t || null;
  if (t) { localStorage.setItem('token', t); Api.setAuthToken(t); }
  else { localStorage.removeItem('token'); Api.clearAuthToken(); }
}

// ---------- Quick helpers ----------
function dedupeOrders(arr) {
  const seen = new Map();
  (arr || []).forEach(o => { if (o && o.id != null && !seen.has(o.id)) seen.set(o.id, o); });
  return Array.from(seen.values());
}

// ---------- Cart ----------
let CART = [];
function cartCount() { return CART.reduce((s, i) => s + (i.qty || 0), 0); }
function renderCartIcon() { const el = $('#cartCount'); if (el) el.textContent = cartCount(); }
function addToCart(bookId, qty = 1) { const it = CART.find(c => String(c.bookId) === String(bookId)); if (it) it.qty += qty; else CART.push({ bookId, qty }); renderCartIcon(); toast('Added to cart'); }
function removeFromCart(bookId) { CART = CART.filter(c => String(c.bookId) !== String(bookId)); renderCartIcon(); }
function updateCartQty(bookId, qty) { const it = CART.find(c => String(c.bookId) === String(bookId)); if (!it) return; it.qty = Math.max(1, Number(qty || 1)); renderCartIcon(); }

// ---------- Admin edit state ----------
let ADMIN_EDIT_BOOK_ID = null;

// ---------- Navigation & sections ----------
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

// ---------- Auth flows ----------
on('#formRegister', 'submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  try {
    const out = await Api.register({ name: data.name, email: data.email, password: data.password, phone: data.phone || '', bio: data.bio || '' });
    saveToken(out.token); AUTH.user = out.user; toast('Registered & signed in');
    await renderNav();
    if (AUTH.user?.is_admin) {
      setActiveNav('admin');
      showSection('adminPanel');
    } else {
      setActiveNav('home');
      showSection('homeSection');
    }
  } catch (err) { console.error(err); toast(err?.message || 'Register failed'); }
});

on('#formLogin', 'submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  try {
    const out = await Api.login({ email: data.email, password: data.password });
    saveToken(out.token); AUTH.user = out.user; toast('Logged in');
    await renderNav();
    if (AUTH.user?.is_admin) {
      setActiveNav('admin');
      showSection('adminPanel');
    } else {
      setActiveNav('home');
      showSection('homeSection');
    }
  } catch (err) { console.error(err); toast(err?.message || 'Login failed'); }
});

// Login/Logout header buttons
const btnLoginEl = $('#btnLogin'); if (btnLoginEl) btnLoginEl.onclick = () => { setActiveNav('login'); showSection('loginSection'); };
const btnLogoutEl = $('#btnLogout'); if (btnLogoutEl) btnLogoutEl.onclick = () => { saveToken(null); AUTH.user = null; localStorage.removeItem('isAdminMode'); toast('Logged out'); renderNav(); setActiveNav('login'); showSection('loginSection'); };

// Google sign-in (if used)
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

// Nav button handler
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

// ---------- Nav rendering ----------
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

      // Update notifications when logged in
      setTimeout(async () => {
        if (typeof updateNavNotifications === 'function') {
          try {
            await updateNavNotifications();

            // Additional check after 2 seconds to ensure notifications are updated
            setTimeout(async () => {
              await updateNavNotifications();
            }, 2000);

          } catch (e) {
            console.error('Failed to update notifications in renderNav:', e);
          }
        }
      }, 100); // Small delay to ensure DOM is ready
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

// Switch between login and register
const sToReg = $('#switchToRegister'); if (sToReg) sToReg.addEventListener('click', () => { showSection('registerSection'); });
const sToLog = $('#switchToLogin'); if (sToLog) sToLog.addEventListener('click', () => { showSection('loginSection'); });

// --------- Single delegated handlers for profile forms & lists (prevents duplicate bindings) ----------
document.addEventListener('submit', async (e) => {
  // Add Address
  if (e.target.matches('#formAddress')) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await Api.addAddress(AUTH.token, data);
      e.target.reset();
      toast('Address saved');
      await renderProfile();
    } catch (err) {
      console.error('addAddress', err);
      toast(err?.message || 'Address save failed');
    }
    return;
  }
});

document.addEventListener('click', async (e) => {
  // Delete address
  if (e.target.matches('[data-del-addr]')) {
    const id = e.target.dataset.delAddr;
    try {
      await Api.deleteAddress(AUTH.token, id);
      toast('Address deleted');
      await renderProfile();
    } catch (err) {
      console.error('deleteAddress', err);
      toast(err?.message || 'Delete failed');
    }
    return;
  }
});

// ---------- Admin quick-login + logout ----------
const btnAdmin = $('#btnAdmin');
const adminLoginModal = $('#adminLoginModal');
const closeAdminModal = $('#closeAdminModal');
const cancelAdminLogin = $('#cancelAdminLogin');
const formAdminLogin = $('#formAdminLogin');

// Show admin login modal
if (btnAdmin) btnAdmin.addEventListener('click', () => {
  adminLoginModal.classList.remove('hidden');
  adminLoginModal.classList.add('show');
  $('#adminEmail').focus();
});

// Close modal handlers
if (closeAdminModal) closeAdminModal.addEventListener('click', () => {
  adminLoginModal.classList.add('hidden');
  adminLoginModal.classList.remove('show');
});

if (cancelAdminLogin) cancelAdminLogin.addEventListener('click', () => {
  adminLoginModal.classList.add('hidden');
  adminLoginModal.classList.remove('show');
});

// Close modal when clicking outside
adminLoginModal?.addEventListener('click', (e) => {
  if (e.target === adminLoginModal) {
    adminLoginModal.classList.add('hidden');
    adminLoginModal.classList.remove('show');
  }
});

// Handle admin login form submission
if (formAdminLogin) formAdminLogin.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = $('#adminEmail').value.trim();
  const password = $('#adminPassword').value.trim();

  if (!email || !password) {
    toast('Please fill in all fields');
    return;
  }

  try {
    const out = await Api.login({ email, password });
    if (!out.user || !out.user.is_admin) {
      toast('Not an admin account');
      Api.clearAuthToken();
      return;
    }

    saveToken(out.token);
    AUTH.user = out.user;

    // Store admin state in localStorage
    localStorage.setItem('isAdminMode', 'true');

    toast('Admin signed in successfully!');
    await renderNav();

    // Close the modal
    adminLoginModal.classList.add('hidden');
    adminLoginModal.classList.remove('show');

    // Clear form
    formAdminLogin.reset();

    // Show admin panel
    setHeaderMode('hidden');
    setActiveNav('admin');
    showSection('adminPanel');
  } catch (err) {
    console.error(err);
    toast(err?.message || 'Admin login failed');
  }
});
const adminLogoutBtn = $('#adminLogout'); if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', () => { saveToken(null); AUTH.user = null; Api.clearAuthToken(); localStorage.removeItem('isAdminMode'); toast('Admin logged out'); renderNav(); showSection('loginSection'); });

// ---------- Health check ----------
(async () => { try { if (Api && Api.health) await Api.health(); } catch (e) { /* ignore */ } })();

// ---------- Books (Home grid + Catalog + Modal) ----------
let BOOK_CACHE = new Map();
async function fetchBooks(page = 1, limit = 50) { const res = await Api.getBooks(page, limit); (res.books || []).forEach(b => BOOK_CACHE.set(String(b.id), b)); return res.books || []; }
async function fetchBookById(id) { if (BOOK_CACHE.has(String(id))) return BOOK_CACHE.get(String(id)); const b = await Api.getBookById(id); BOOK_CACHE.set(String(b.id), b); return b; }

// ---------- Wishlist ----------
let USER_WISHLIST = new Set();

async function loadWishlist() {
  if (!AUTH.token) return;
  try {
    const wishlist = await Api.getWishlist(AUTH.token);
    USER_WISHLIST = new Set(wishlist.map(w => String(w.book_id)));
  } catch (e) { console.error('Failed to load wishlist', e); }
}

async function toggleWishlist(bookId) {
  if (!AUTH.token) { toast('Please login first'); return; }
  const id = String(bookId);
  try {
    if (USER_WISHLIST.has(id)) {
      await Api.removeFromWishlist(AUTH.token, bookId);
      USER_WISHLIST.delete(id);
      toast('Removed from wishlist');
    } else {
      await Api.addToWishlist(AUTH.token, bookId);
      USER_WISHLIST.add(id);
      toast('Added to wishlist ❤️', 'success');
    }
    updateWishlistButtons();
    renderWishlistSection();
    updateWishlistCount();
  } catch (e) { console.error('Wishlist toggle failed', e); toast(e?.message || 'Wishlist action failed'); }
}

function updateWishlistButtons() {
  $$('[data-wishlist]').forEach(btn => {
    const bookId = String(btn.dataset.wishlist);
    const inWishlist = USER_WISHLIST.has(bookId);
    btn.textContent = inWishlist ? '❤️' : '🤍';
    btn.title = inWishlist ? 'Remove from wishlist' : 'Add to wishlist';
    btn.classList.toggle('wishlisted', inWishlist);
  });
}

async function updateWishlistCount() {
  const countEl = $('#wishlistCount');
  if (countEl) countEl.textContent = USER_WISHLIST.size;
}

async function renderWishlistSection() {
  if (!AUTH.token) return;
  const wishlistEl = $('#libraryWishlist');
  if (!wishlistEl) return;
  
  try {
    const wishlist = await Api.getWishlist(AUTH.token);
    if (!wishlist.length) {
      wishlistEl.innerHTML = '<p class="muted">No books in your wishlist yet. Click ❤️ on any book to save it for later.</p>';
      return;
    }

    const cards = wishlist.map(w => `
      <div class="card">
        <div class="book-cover-sm" style="background-image:url('${w.image_url || w.cover || ''}')"></div>
        <div class="pillbar"><span class="tag small">${w.author || ''}</span></div>
        <h3>${w.title}</h3>
        <p class="price">${money(w.price)}</p>
        <div class="row">
          <button class="btn primary small" data-wishlist-buy="${w.book_id}">Buy</button>
          <button class="btn small" data-wishlist-rent="${w.book_id}">Rent</button>
          <button class="btn bad small" data-wishlist-remove="${w.book_id}">Remove</button>
        </div>
      </div>
    `).join('');

    wishlistEl.innerHTML = cards;
    updateWishlistCount();

    // Attach event handlers
    onAll('#libraryWishlist [data-wishlist-buy]', el => el.onclick = () => startCheckout([{ bookId: el.dataset.wishlistBuy, qty: 1 }], 'buy'));
    onAll('#libraryWishlist [data-wishlist-rent]', el => el.onclick = () => startCheckout([{ bookId: el.dataset.wishlistRent, qty: 1 }], 'rent'));
    onAll('#libraryWishlist [data-wishlist-remove]', el => el.onclick = async () => {
      await toggleWishlist(el.dataset.wishlistRemove);
    });
  } catch (e) { console.error('renderWishlistSection error', e); }
}

async function renderHomeCatalog() {
  try {
    await loadWishlist();
    const books = await fetchBooks(1, 24);
    const grid = $('#homeBookGrid'); if (!grid) return;
    grid.innerHTML = books.map(b => `
      <div class="card book-card">
        <div class="book-cover" style="background-image:url('${b.image_url || b.cover || ''}')">
          <button class="wishlist-btn ${USER_WISHLIST.has(String(b.id)) ? 'wishlisted' : ''}" data-wishlist="${b.id}" title="${USER_WISHLIST.has(String(b.id)) ? 'Remove from wishlist' : 'Add to wishlist'}">${USER_WISHLIST.has(String(b.id)) ? '❤️' : '🤍'}</button>
        </div>
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
    onAll('#homeBookGrid [data-wishlist]', el => el.onclick = (e) => { e.stopPropagation(); toggleWishlist(el.dataset.wishlist); });
  } catch (e) { console.error('renderHomeCatalog error', e); toast('Failed loading books'); }
}

async function renderCatalog(filter = '') {
  try {
    await loadWishlist();
    const q = (filter || '').trim();
    const books = q ? (await Api.searchBooks(q, 1, 60)).books || [] : await fetchBooks(1, 60);
    const grid = $('#bookGrid'); if (!grid) return;
    grid.innerHTML = books.map(b => `
      <div class="card book-card">
        <div class="book-cover" style="background-image:url('${b.image_url || b.cover || ''}')">
          <button class="wishlist-btn ${USER_WISHLIST.has(String(b.id)) ? 'wishlisted' : ''}" data-wishlist="${b.id}" title="${USER_WISHLIST.has(String(b.id)) ? 'Remove from wishlist' : 'Add to wishlist'}">${USER_WISHLIST.has(String(b.id)) ? '❤️' : '🤍'}</button>
        </div>
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
    onAll('#bookGrid [data-wishlist]', el => el.onclick = (e) => { e.stopPropagation(); toggleWishlist(el.dataset.wishlist); });
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

// ---------- Cart drawer ----------
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

// ---------- Checkout ----------
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
      if (paySel) { const codOpt = Array.from(paySel.options).find(o => o.value === 'cod'); if (codOpt) codOpt.disabled = !needsShipping; if (!needsShipping && paySel.value === 'cod') paySel.value = 'razorpay'; }
      computeSummary();
    };
    ckMode.onchange = refreshBlocks;

    const addrSel = $('#ckSavedAddr'); let addresses = [];
    try { addresses = await Api.listAddresses(AUTH.token); } catch { addresses = []; }
    if (addrSel) {
      if (addresses.length) addrSel.innerHTML = addresses.filter(a => a.id).map(a => `<option value="${a.id}">${a.label} — ${a.city} (${a.zip})</option>`).join('');
      else { addrSel.innerHTML = '<option value="">No saved addresses</option>'; addrSel.value = ''; }
    }

    const btnSaveNewAddr = $('#btnSaveNewAddr'); if (btnSaveNewAddr) btnSaveNewAddr.onclick = async () => {
      const inputs = $$('#ckNewAddr [data-addr]'); const data = {}; inputs.forEach(i => data[i.dataset.addr] = i.value.trim());
      if (!data.label || !data.recipient || !data.street || !data.city || !data.state || !data.zip) { toast('Fill all address fields'); return; }
      try { await Api.addAddress(AUTH.token, data); toast('Address saved'); inputs.forEach(i => (i.value = '')); await renderCheckout($('#ckMode')?.value); }
      catch (err) { console.error('save addr', err); toast(err?.message || 'Address save failed'); }
    };

    onAll('#ckItems [data-qty]', (inp) => { inp.onchange = () => { updateCartQty(inp.dataset.qty, parseInt(inp.value || '1', 10)); renderCheckout(ckMode.value); }; });
    on('#ckSpeed', 'change', computeSummary); on('#ckRental', 'change', computeSummary);
    const ckPayMethod = $('#ckPayMethod'); if (ckPayMethod) ckPayMethod.onchange = computeSummary;

    function computeSummary() {
      const mode = ckMode.value; const rentalDays = parseInt($('#ckRental')?.value || '30', 10); const needsShipping = (mode === 'buy');
      const shipMap = { standard: 30, express: 70, priority: 120 }; const shipKey = $('#ckSpeed')?.value || 'standard'; const shipFee = needsShipping ? (shipMap[shipKey] || 0) : 0;
      const payMethod = $('#ckPayMethod')?.value || 'razorpay'; const codFee = (needsShipping && payMethod === 'cod') ? 10 : 0;
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

    const btnPay = $('#btnPay');
    if (btnPay) {
      btnPay.onclick = async () => {
        const lastSummary2 = computeSummary();
        const mode = lastSummary2.mode;
        if (mode === 'gift') { const ge = $('#ckGiftEmail')?.value.trim() || ''; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ge)) { toast('Enter a valid gift email'); return; } }
        let shipping_address_id = null, shipping_speed = null;
        if (lastSummary2.needsShipping) { shipping_address_id = $('#ckSavedAddr')?.value || null; if (!shipping_address_id) { toast('Select or add an address'); return; } shipping_speed = lastSummary2.shipKey; }
        const orderData = { mode, items: CART.map(ci => ({ book_id: ci.bookId, quantity: ci.qty })), shipping_address_id, shipping_speed, payment_method: lastSummary2.payMethod, notes: $('#ckNotes')?.value || null, rental_duration: mode === 'rent' ? lastSummary2.rentalDays : null, gift_email: mode === 'gift' ? ($('#ckGiftEmail')?.value || '').trim() : null, shipping_fee: lastSummary2.shipFee, cod_fee: lastSummary2.codFee, delivery_eta: lastSummary2.deliveryEtaISO || null };

        if (btnPay.disabled) return;
        btnPay.disabled = true;
        try {
          // Handle Razorpay payment method
          if (lastSummary2.payMethod === 'razorpay') {
            await placeOrderWithRazorpay(orderData, lastSummary2.total, 'razorpay');
          } else {
            // Handle other payment methods (COD)
            await Api.placeOrder(AUTH.token, orderData);
            toast('Order placed');
            CART = []; renderCartIcon();
            setActiveNav('orders'); showSection('ordersSection'); await renderOrders();
          }
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

// ---------- Orders ----------
async function renderOrders() {
  try {
    if (!AUTH.token) { setActiveNav('login'); showSection('loginSection'); return; }
    let orders = [];
    try { orders = await Api.getOrders(AUTH.token); } catch (err) { console.error(err); $('#ordersList') && ($('#ordersList').innerHTML = '<p class="muted">Failed to load orders.</p>'); return; }

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
            <span class="tag">Order #${userSeq}</span>
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
        </div>
      `;
    }).join('');
    const ordersList = $('#ordersList'); if (ordersList) ordersList.innerHTML = out;
  } catch (e) { console.error('renderOrders', e); toast('Failed to render orders'); }
}

// ---------- Library ----------
async function renderLibrary() {
  try {
    if (!AUTH.token) { setActiveNav('login'); showSection('loginSection'); return; }
    let lib = null;
    try { lib = await Api.getLibrary(AUTH.token); } catch { }
    if (!lib) {
      const orders = await Api.getOrders(AUTH.token).catch(() => []);
      const owned = [], rented = [];
      // Only include buy orders in owned, exclude gift orders
      for (const o of orders) {
        if (o.mode === 'buy') (o.items || []).forEach(i => owned.push(i.book_id));
        if (o.mode === 'rent') (o.items || []).forEach(i => rented.push({ id: i.book_id, rental_end: o.rental_end }));
        // Gift orders are handled separately and should NOT appear in owned section
      }
      lib = { owned: [...new Set(owned)].map(id => ({ book: { id }, purchased_at: null })), rented: rented.map(r => ({ book: { id: r.id }, rental_end: r.rental_end })) };
    }

    // Get user's gifts
    let gifts = [];
    try { gifts = await Api.getMyGifts(AUTH.token); } catch { }

    const ownedCards = await Promise.all((lib.owned || []).map(async ob => {
      const b = await fetchBookById(ob.book.id); return `
      <div class="card">
        <div class="pillbar"><span class="tag small">Owned</span><span class="tag small">${b.author || ''}</span></div>
        <h3>${b.title}</h3>
        <div class="row">
          <button class="btn" data-read="${b.id}" data-title="${b.title}">Read</button>
        </div>
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

    // Create gift cards
    const giftCards = await Promise.all((gifts || []).map(async g => {
      const b = g.title ? g : await fetchBookById(g.book_id);
      const isClaimed = !!g.read_at; // Use read_at instead of claimed_at
      const claimStatus = isClaimed ? 'In Library' : 'New Gift';
      const claimColor = isClaimed ? 'good' : 'brand';
      return `
      <div class="card">
        <div class="pillbar">
          <span class="tag small" style="background: rgba(var(--${claimColor}), .2); border-color: var(--${claimColor}); color: var(--${claimColor})">${claimStatus}</span>
          <span class="tag small">${(b.author || g.author || '')}</span>
        </div>
        <h3>${b.title || g.title}</h3>
        <p class="small muted">Received: ${g.created_at ? new Date(g.created_at).toLocaleDateString() : '-'}</p>
        ${isClaimed ?
          `<button class="btn" data-read="${g.book_id}" data-title="${b.title || g.title}">Read</button>` :
          `<button class="btn primary" data-claim-gift="${g.id}">Add to Library</button>`
        }
      </div>`;
    }));

    // Count unclaimed gifts for library badge (use read_at)
    const unclaimedGifts = gifts.filter(g => !g.read_at).length;
    const giftBadge = $('#giftNotificationBadge');
    if (giftBadge) {
      if (unclaimedGifts > 0) {
        giftBadge.classList.remove('hidden');
        giftBadge.title = `${unclaimedGifts} unclaimed gift${unclaimedGifts === 1 ? '' : 's'}`;
      } else {
        giftBadge.classList.add('hidden');
      }
    }

    const libraryOwnedEl = $('#libraryOwned'), libraryRentedEl = $('#libraryRented'), libraryGiftsEl = $('#libraryGifts');
    if (libraryOwnedEl) libraryOwnedEl.innerHTML = ownedCards.join('') || '<p class="muted">No purchased books yet.</p>';
    if (libraryRentedEl) libraryRentedEl.innerHTML = rentedCards.join('') || '<p class="muted">No rentals yet.</p>';
    if (libraryGiftsEl) libraryGiftsEl.innerHTML = giftCards.join('') || '<p class="muted">No gifts received yet.</p>';

    // Render wishlist section
    await renderWishlistSection();

    onAll('#libraryOwned [data-read], #libraryRented [data-read], #libraryGifts [data-read]', (btn) => {
      if (!btn.hasAttribute('disabled')) {
        btn.onclick = () => openReader(btn.dataset.title, btn.dataset.read);
      }
    });

    // Handle gift claiming
    onAll('#libraryGifts [data-claim-gift]', (btn) => {
      btn.onclick = async () => {
        try {
          const giftId = btn.dataset.claimGift;
          const result = await Api.claimSpecificGift(AUTH.token, giftId);

          if (result.claimed > 0) {
            toast('Gift added to your library!', 'success');

            // Immediately update notifications and library
            await updateNavNotifications();
            await renderLibrary(); // Refresh to show updated status
          } else {
            toast('Gift was already in your library or not found', 'warn');
          }
        } catch (e) {
          console.error('Add gift to library failed:', e);
          toast(e?.message || 'Failed to add gift to library', 'error');
        }
      };
    });
  } catch (e) { console.error('renderLibrary', e); toast('Failed to render library'); }
}

// Enhanced openReader function with Azure book content
async function openReader(title, bookId) {
  try {
    if (!bookId) {
      console.error('No book ID provided to openReader');
      toast('Unable to open book - missing book ID');
      return;
    }

    // Check authentication first
    if (!AUTH.token) {
      console.error('User not authenticated');
      toast('Please login first to read books');
      setActiveNav('login');
      showSection('loginSection');
      return;
    }

    // Show modal with loading state
    $('#readerTitle') && ($('#readerTitle').textContent = title);
    $('#readerBody') && ($('#readerBody').innerHTML = '<div class="loading">Loading book content...</div>');
    $('#readerModal')?.classList.add('show');

    // Fetch book reading access
    const bookData = await Api.getBookReadingAccess(AUTH.token, bookId);

    if (bookData.readingUrl) {
      // Create book content display based on content type
      let contentHtml = '';

      if (bookData.contentType === 'pdf') {
        // Direct PDF viewer (simpler, allows downloads but works reliably)
        contentHtml = `
          <div class="book-reader">
            <div class="reader-info">
              <p><strong>Access Type:</strong> ${bookData.accessType === 'rental' ? '📅 Rental' : '✅ Purchased'}</p>
              ${bookData.expiresAt ? `<p><strong>Expires:</strong> ${new Date(bookData.expiresAt).toLocaleDateString()}</p>` : ''}
              ${bookData.pageCount ? `<p><strong>Pages:</strong> ${bookData.pageCount}</p>` : ''}
              <p class="small muted">� Reading access verified for purchased/rented content</p>
            </div>
            <div id="secureReaderContainer"></div>
          </div>`;
      } else if (bookData.contentType === 'html') {
        // For HTML content, we could fetch and display it
        contentHtml = `
          <div class="book-reader">
            <div class="reader-info">
              <p><strong>Access Type:</strong> ${bookData.accessType === 'rental' ? '📅 Rental' : '✅ Purchased'}</p>
              ${bookData.expiresAt ? `<p><strong>Expires:</strong> ${new Date(bookData.expiresAt).toLocaleDateString()}</p>` : ''}
            </div>
            <div class="book-content">
              <iframe 
                src="${bookData.readingUrl}" 
                width="100%" 
                height="500px" 
                frameborder="0"
                style="border: 1px solid #ddd; border-radius: 4px;">
              </iframe>
            </div>
          </div>`;
      } else {
        // For other formats, provide download link
        contentHtml = `
          <div class="book-reader">
            <div class="reader-info">
              <p><strong>Access Type:</strong> ${bookData.accessType === 'rental' ? '📅 Rental' : '✅ Purchased'}</p>
              ${bookData.expiresAt ? `<p><strong>Expires:</strong> ${new Date(bookData.expiresAt).toLocaleDateString()}</p>` : ''}
              <p><strong>Format:</strong> ${bookData.contentType.toUpperCase()}</p>
            </div>
            <div class="download-section">
              <p>This book is available as a ${bookData.contentType.toUpperCase()} file.</p>
              <a href="${bookData.readingUrl}" class="btn primary" target="_blank">📖 Open Book</a>
            </div>
          </div>`;
      }

      $('#readerBody') && ($('#readerBody').innerHTML = contentHtml);

      // If using secure PDF reader, initialize it
      if (bookData.contentType === 'pdf' && document.getElementById('secureReaderContainer')) {
        setTimeout(async () => {
          try {
            const reader = new SecurePDFReader('secureReaderContainer');
            // Pass auth token and book ID for proper proxy handling
            const authToken = AUTH.token?.replace('Bearer ', '') || AUTH.token;
            await reader.loadPDF(bookData.readingUrl, title, authToken, bookId);
          } catch (error) {
            console.error('Secure reader failed, falling back to iframe:', error);
            // Fallback to iframe if secure reader fails - but use backend proxy
            const authToken = AUTH.token?.replace('Bearer ', '') || AUTH.token;
            const proxyUrl = bookData.readingUrl.includes('blob.core.windows.net')
              ? `https://project-backend-zt54.onrender.com/api/secure-reader/${bookId}?token=${authToken}`
              : bookData.readingUrl;

            document.getElementById('secureReaderContainer').innerHTML = `
              <iframe 
                src="${proxyUrl}" 
                width="100%" 
                height="500px" 
                frameborder="0"
                style="border: 1px solid #ddd; border-radius: 4px;">
                <p>Unable to load book viewer. Please try again later.</p>
              </iframe>`;
          }
        }, 100);
      }
    } else {
      $('#readerBody') && ($('#readerBody').innerHTML = '<p class="error">Unable to load book content. Please try again later.</p>');
    }

  } catch (error) {
    console.error('Error opening book reader:', error);
    let errorMessage = 'Unable to open book.';

    if (error.status === 401) {
      errorMessage = 'Authentication failed. Please login again.';
      // Clear invalid token and redirect to login
      saveToken(null);
      AUTH.user = null;
      setActiveNav('login');
      showSection('loginSection');
    } else if (error.status === 403) {
      if (error.message.includes('do not have access')) {
        errorMessage = 'You do not have access to this book. Please purchase or rent it first.';
      } else if (error.message.includes('expired')) {
        errorMessage = 'Your rental period for this book has expired.';
      } else {
        errorMessage = 'Access denied. Please purchase or rent this book first.';
      }
    } else if (error.status === 404) {
      errorMessage = 'Book content not found. Please contact support.';
    } else if (error.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    } else if (error.message.includes('Invalid token')) {
      errorMessage = 'Session expired. Please login again.';
      saveToken(null);
      AUTH.user = null;
      setActiveNav('login');
      showSection('loginSection');
    }

    $('#readerBody') && ($('#readerBody').innerHTML = `<p class="error">${errorMessage}</p>`);
    toast(errorMessage, 'error');
  }
}

on('#readerClose', 'click', () => $('#readerModal')?.classList.remove('show'));

// ---------- Navigation Notifications ----------
async function updateNavNotifications() {
  try {
    if (!AUTH.token) {
      // Hide notification elements when not logged in
      const notificationBtn = $('#btnNotifications');
      if (notificationBtn) {
        notificationBtn.style.display = 'none';
      }
      return;
    }

    const gifts = await Api.getMyGifts(AUTH.token).catch(e => {
      console.error('Error fetching gifts:', e);
      return [];
    });

    // Count unread gifts for notifications (simplified)
    const unreadGifts = gifts.filter(g => !g.read_at);

    const notificationBtn = $('#btnNotifications');
    const notificationBadge = $('#navNotificationBadge');

    if (notificationBtn) {
      // Always show notification button when logged in
      notificationBtn.style.display = 'inline-flex';

      if (notificationBadge) {
        if (unreadGifts.length > 0) {
          notificationBadge.textContent = unreadGifts.length;
          notificationBadge.classList.remove('hidden');
          notificationBadge.style.display = 'inline-block';
          notificationBtn.title = `${unreadGifts.length} unread notification${unreadGifts.length === 1 ? '' : 's'}`;

          // Make the notification button more visible with red glow
          notificationBtn.style.background = 'rgba(239, 68, 68, 0.1)';
          notificationBtn.style.borderColor = '#ef4444';
          notificationBtn.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
        } else {
          notificationBadge.classList.add('hidden');
          notificationBadge.style.display = 'none';
          notificationBtn.title = 'Gift Notifications (No new notifications)';

          // Reset button appearance
          notificationBtn.style.background = 'transparent';
          notificationBtn.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          notificationBtn.style.boxShadow = 'none';
        }
      }
    }
  } catch (e) {
    console.error('updateNavNotifications error:', e);
  }
}

async function renderNotificationModal() {
  try {
    if (!AUTH.token) return;

    const gifts = await Api.getMyGifts(AUTH.token).catch(() => []);
    const notificationList = $('#notificationList');

    if (!notificationList) return;

    if (gifts.length === 0) {
      notificationList.innerHTML = '<p class="muted" style="padding: 20px; text-align: center;">No gift notifications</p>';
      return;
    }

    const notificationItems = await Promise.all(gifts.map(async g => {
      const b = g.title ? g : await fetchBookById(g.book_id).catch(() => ({ title: 'Unknown Book', author: 'Unknown' }));
      const isRead = !!g.read_at; // Simplified: only read/unread status
      const timeAgo = new Date(g.created_at).toLocaleDateString();

      // Get sender info from the backend data  
      const senderEmail = g.sender_email || 'Unknown sender';
      const senderName = g.sender_name || senderEmail;

      // Different styling based on read/unread status
      const itemClass = isRead ? 'read' : 'unread';
      const unreadIndicator = isRead ? '' : '<span class="tag tiny" style="background: var(--brand); color: white;">●</span>';

      return `
        <div class="notification-item ${itemClass}" data-gift-id="${g.id}" data-read="${isRead}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h4 style="margin: 0; flex: 1;">${b.title || g.title}</h4>
            ${unreadIndicator}
          </div>
          <p style="margin: 4px 0;"><strong>🎁 Gift from:</strong> ${senderName}</p>
          <p style="margin: 4px 0;"><strong>📧 Email:</strong> ${senderEmail}</p>
          <p style="margin: 4px 0;"><strong>📅 Received:</strong> ${timeAgo}</p>
          <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center;">
            ${!isRead ? `<button class="btn small primary" data-claim-single="${g.id}">📚 Add to Library</button>` : '<span class="tag tiny good">✅ In Your Library</span>'}
          </div>
        </div>
      `;
    }));

    notificationList.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <h3 style="margin: 0;">🎁 Gift Notifications</h3>
        <span class="tag small">${gifts.length} total</span>
      </div>
      ${notificationItems.join('')}
    `;

    // Handle individual gift claiming (now adds to library)
    onAll('[data-claim-single]', (btn) => {
      btn.onclick = async () => {
        try {
          const giftId = btn.dataset.claimSingle;
          const result = await Api.claimSpecificGift(AUTH.token, giftId);

          if (result.claimed > 0) {
            toast('Gift added to your library!', 'success');

            // Update UI
            await updateNavNotifications();
            await renderLibrary();
            await renderNotificationModal(); // Refresh the modal to show updated status
          } else {
            toast('Gift was already in library or not found', 'warn');
          }
        } catch (e) {
          console.error('Add gift to library failed:', e);
          toast(e?.message || 'Failed to add gift to library', 'error');
        }
      };
    });

  } catch (e) {
    console.error('renderNotificationModal', e);
  }
}

// ---------- Profile (guarded) ----------
let __renderProfileLock = false;
let __renderProfileQueued = false;

async function renderProfile() {
  if (__renderProfileLock) {
    __renderProfileQueued = true;
    return;
  }

  __renderProfileLock = true;
  try {
    // Update navigation notifications regardless of profile loading success
    if (typeof updateNavNotifications === 'function') {
      try {
        console.log('DEBUG: Updating notifications from renderProfile');
        await updateNavNotifications();
      } catch (e) {
        console.error('Failed to update notifications in profile:', e);
      }
    }

    if (!AUTH.token) {
      console.log('DEBUG: No AUTH token, redirecting to login');
      setActiveNav('login'); showSection('loginSection'); return;
    }

    console.log('DEBUG: Calling Api.getProfile with token');
    const u = await Api.getProfile(AUTH.token).catch((error) => {
      console.error('DEBUG: Api.getProfile failed:', error);
      return null;
    });

    if (!u) {
      console.log('DEBUG: No user data received from API');
      const pv = $('#profileView');
      if (pv) pv.innerHTML = '<p class="muted">Failed to load profile</p>';
      return;
    }

    console.log('DEBUG: Successfully received user data from API');
    AUTH.user = u;

    // Debug: Check what we're receiving from the backend
    console.log('Profile user object:', u);
    console.log('Has password field:', u.has_password);

    const pfUrl = u.profile_pic ? `${u.profile_pic}?v=${Date.now()}` : '';
    const profileView = $('#profileView'); if (!profileView) return;

    // Check if user signed up with Google (Google users have has_password = 0)
    // Fallback: Also check if the user was created recently and profile_pic looks like a Google URL
    const isGoogleUser = u.has_password === 0 ||
      (u.has_password === undefined && u.profile_pic && u.profile_pic.includes('googleusercontent.com'));
    console.log('Is Google user:', isGoogleUser, 'has_password:', u.has_password, 'profile_pic:', u.profile_pic);

    profileView.innerHTML = `
      <div class="profile-head">
        <div class="avatar-lg" id="pfAvatar" style="${pfUrl ? `background-image:url('${pfUrl}')` : ''}"></div>
        <div class="profile-meta">
          <div><span class="muted">Name</span><div>${u.name || ''}</div></div>
          <div><span class="muted">Email</span><div>${u.email || ''}</div></div>
          <div><span class="muted">Phone</span><div>${u.phone || '-'}</div></div>
          <div><span class="muted">Bio</span><div>${u.bio || '-'}</div></div>
          <div><span class="muted">Account Type</span><div>${isGoogleUser ? '🔗 Google Account' : '📧 Email Account'}</div></div>
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
      const phone = $('#pePhone')?.value.trim();
      const bio = $('#peBio')?.value.trim();
      let profilePicUrl = AUTH.user?.profile_pic || '';

      const picFile = $('#pePicFile')?.files?.[0] || null;
      if (picFile) {
        // Upload with user data since backend requires name
        try {
          const userData = { name, phone, bio };
          const result = await Api.uploadProfilePic(AUTH.token, picFile, userData);
          toast('Profile updated', 'success');
          $('#profileEdit')?.classList.add('hidden');
          $('#profileView')?.classList.remove('hidden');
          await renderNav();
          renderProfile();
          return; // Exit early since profile is already updated
        } catch (e) {
          console.error('uploadProfilePic', e);
          toast(e?.message || 'Image upload failed');
          return;
        }
      } else {
        // Handle URL input or no profile pic change
        const urlInputVal = ($('#pePicUrl')?.value || '').trim();
        if (urlInputVal) profilePicUrl = urlInputVal;
      }

      // Update profile without file upload
      const body = { name, phone, bio, profile_pic: profilePicUrl };
      try {
        await Api.updateProfile(AUTH.token, body);
        toast('Profile updated', 'success');
        $('#profileEdit')?.classList.add('hidden');
        $('#profileView')?.classList.remove('hidden');
        await renderNav();
        renderProfile();
      } catch (err) {
        console.error('updateProfile', err);
        toast(err?.message || 'Update failed', 'error');
      }
    });

    on('#peCancel', 'click', () => { $('#profileEdit')?.classList.add('hidden'); $('#profileView')?.classList.remove('hidden'); });

    // Show/hide password section with debug logging
    const passwordSection = document.querySelector('#profileSection .password-section');
    console.log('Password section found:', !!passwordSection, 'Should hide for Google user:', isGoogleUser);

    if (passwordSection) {
      if (isGoogleUser) {
        passwordSection.style.display = 'none';
        console.log('Hiding password section for Google user');
      } else {
        passwordSection.style.display = 'block';
        console.log('Showing password section for email user');
      }
    } else {
      console.log('Password section not found in DOM');
    }

    const cpBtn = document.getElementById('cpSave');
    if (cpBtn) {
      if (!isGoogleUser) {
        console.log('Attaching password change handler for email user');
        cpBtn.onclick = async () => {
          const cur = ($('#cpCurrent')?.value || '').trim(), nxt = ($('#cpNew')?.value || '').trim(), cfm = ($('#cpConfirm')?.value || '').trim();
          if (!cur || !nxt || !cfm) { toast('Fill all password fields'); return; }
          if (nxt !== cfm) { toast('New passwords do not match'); return; }
          if (nxt.length < 6) { toast('New password must be at least 6 chars'); return; }
          try { await Api.changePassword(AUTH.token, { oldPassword: cur, newPassword: nxt }); toast('Password updated', 'success'); $('#cpCurrent').value = ''; $('#cpNew').value = ''; $('#cpConfirm').value = ''; } catch (e) { console.error('changePassword', e); toast(e?.message || 'Password update failed', 'error'); }
        };
      } else {
        console.log('Removing password button for Google user');
        cpBtn.style.display = 'none';
      }
    }

    if (!AUTH.user?.is_admin) {
      let addrs = await Api.listAddresses(AUTH.token).catch(() => []);
      const dedupeById = (arr) => { const m = new Map(); (arr || []).forEach(a => { if (a && a.id != null && !m.has(String(a.id))) m.set(String(a.id), a); }); return Array.from(m.values()); };
      addrs = dedupeById(addrs);

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
            <button class="btn bad small" data-del-addr="${a.id}">Delete</button>
          </div>
        `).join('') || '<p class="small muted">No addresses yet</p>';
      }
    } else {
      const addrList = $('#addrList'); if (addrList) addrList.innerHTML = '<p class="small muted">Admin — addresses hidden</p>';
    }

  } catch (e) { console.error('renderProfile overall error', e); toast('Failed to render profile'); }
  finally {
    __renderProfileLock = false;
    if (__renderProfileQueued) {
      __renderProfileQueued = false;
      console.log('DEBUG: running queued renderProfile');
      setTimeout(() => renderProfile(), 10);
    }
  }
}

// ---------- Admin panel renderer ----------
async function renderAdminPanel(view = 'dashboard') {
  try {
    if (!AUTH.token) { toast('Login as admin'); setActiveNav('login'); showSection('loginSection'); return; }
    if (!AUTH.user) { try { AUTH.user = await Api.getProfile(AUTH.token); } catch { saveToken(null); AUTH.user = null; toast('Admin session invalid'); setActiveNav('login'); showSection('loginSection'); return; } }
    if (!AUTH.user.is_admin) { toast('Access denied'); return; }

    const main = document.getElementById('adminMain'); if (!main) return;
    main.innerHTML = '<p class="muted">Loading...</p>';

    // Update welcome message
    const welcomeName = $('#adminWelcomeName');
    if (welcomeName && AUTH.user.name) {
      welcomeName.textContent = `Welcome, ${AUTH.user.name}`;
    }

    // Update active tabs
    const tabDashboard = $('#adminViewDashboard'), tabOrders = $('#adminViewOrders'), tabUsers = $('#adminViewUsers'), tabBooks = $('#adminViewBooks'), tabAnalytics = $('#adminViewAnalytics');
    [tabDashboard, tabOrders, tabUsers, tabBooks, tabAnalytics].forEach(tab => tab?.classList.remove('primary'));

    if (view === 'dashboard' && tabDashboard) tabDashboard.classList.add('primary');
    else if (view === 'orders' && tabOrders) tabOrders.classList.add('primary');
    else if (view === 'users' && tabUsers) tabUsers.classList.add('primary');
    else if (view === 'books' && tabBooks) tabBooks.classList.add('primary');
    else if (view === 'analytics' && tabAnalytics) tabAnalytics.classList.add('primary');

    // Show/hide search bar based on view
    const searchBar = $('#adminSearchBar');
    if (searchBar) {
      if (view === 'dashboard' || view === 'analytics') {
        searchBar.classList.add('hidden');
      } else {
        searchBar.classList.remove('hidden');
      }
    }

    if (view === 'dashboard') {
      await renderAdminDashboard(main);
    } else if (view === 'analytics') {
      await renderAdminAnalytics(main);
    } else if (view === 'orders') {
      await renderAdminOrders(main);
    } else if (view === 'users') {
      await renderAdminUsers(main);
    } else if (view === 'books') {
      await renderAdminBooks(main);
    }
  } catch (e) { console.error('renderAdminPanel', e); toast('Admin panel failed to load'); }
}

// Admin Dashboard Overview
async function renderAdminDashboard(main) {
  try {
    const [orders, users, books] = await Promise.all([
      Api.getAdminOrders(AUTH.token).catch(() => []),
      Api.getAdminUsers(AUTH.token).catch(() => []),
      Api.getBooks().catch(() => ({ books: [] }))
    ]);

    const ordersArray = dedupeOrders(Array.isArray(orders) ? orders : (orders.orders || []));
    const usersArray = Array.isArray(users) ? users : (users.users || []);
    const booksArray = Array.isArray(books) ? books : (books.books || []);

    // Calculate stats
    const totalOrders = ordersArray.length;
    const totalUsers = usersArray.length;
    const totalBooks = booksArray.length;
    const totalRevenue = ordersArray.reduce((sum, order) => {
      const items = order.items || [];
      const itemsTotal = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
      return sum + itemsTotal;
    }, 0);

    const recentOrders = ordersArray.slice(0, 5);
    const recentUsers = usersArray.slice(0, 5);

    main.innerHTML = `
      <div class="admin-stats">
        <div class="stat-card orders">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${totalOrders}</div>
          <div class="stat-label">Total Orders</div>
        </div>
        <div class="stat-card users">
          <div class="stat-icon">👥</div>
          <div class="stat-value">${totalUsers}</div>
          <div class="stat-label">Total Users</div>
        </div>
        <div class="stat-card books">
          <div class="stat-icon">📚</div>
          <div class="stat-value">${totalBooks}</div>
          <div class="stat-label">Total Books</div>
        </div>
        <div class="stat-card revenue">
          <div class="stat-icon">💰</div>
          <div class="stat-value">₹${totalRevenue.toFixed(2)}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
      </div>

      <div class="quick-actions">
        <a href="#" class="quick-action" onclick="renderAdminPanel('orders')">
          📦 View All Orders
        </a>
        <a href="#" class="quick-action" onclick="renderAdminPanel('users')">
          👥 Manage Users  
        </a>
        <a href="#" class="quick-action" onclick="renderAdminPanel('books')">
          📚 Manage Books
        </a>
      </div>

      <div class="grid two" style="gap: 20px;">
        <div>
          <h3>📦 Recent Orders</h3>
          ${recentOrders.length ? `
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${recentOrders.map(o => {
      const itemsTotal = (o.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
      return `
                    <tr>
                      <td><strong>#${o.id}</strong></td>
                      <td>${o.user_name || o.user_email || 'N/A'}</td>
                      <td>₹${itemsTotal.toFixed(2)}</td>
                      <td>${new Date(o.created_at || '').toLocaleDateString()}</td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          ` : '<p class="muted">No recent orders</p>'}
        </div>

        <div>
          <h3>👥 Recent Users</h3>
          ${recentUsers.length ? `
            <div class="activity-list">
              ${recentUsers.map(u => `
                <div class="activity-item">
                  <div class="activity-icon">👤</div>
                  <div class="activity-content">
                    <div class="activity-text">${u.name || 'Unknown'}</div>
                    <div class="activity-time">${u.email}</div>
                    <div class="activity-time">Joined ${new Date(u.created_at || '').toLocaleDateString()}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p class="muted">No recent users</p>'}
        </div>
      </div>
    `;
  } catch (e) {
    console.error('renderAdminDashboard', e);
    main.innerHTML = '<p class="bad">Failed to load dashboard</p>';
  }
}

// Admin Analytics View
async function renderAdminAnalytics(main) {
  try {
    const [orders, users, books] = await Promise.all([
      Api.getAdminOrders(AUTH.token).catch(() => []),
      Api.getAdminUsers(AUTH.token).catch(() => []),
      Api.getBooks().catch(() => ({ books: [] }))
    ]);

    const ordersArray = dedupeOrders(Array.isArray(orders) ? orders : (orders.orders || []));
    const usersArray = Array.isArray(users) ? users : (users.users || []);
    const booksArray = Array.isArray(books) ? books : (books.books || []);

    // Calculate analytics data
    const totalRevenue = ordersArray.reduce((sum, order) => {
      const items = order.items || [];
      const itemsTotal = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
      return sum + itemsTotal;
    }, 0);

    // Order type breakdown
    const buyOrders = ordersArray.filter(o => !o.mode || o.mode === 'buy').length;
    const giftOrders = ordersArray.filter(o => o.mode === 'gift').length;
    const rentOrders = ordersArray.filter(o => o.mode === 'rent').length;

    // Payment method breakdown (Razorpay vs COD)
    const razorpayPayments = ordersArray.filter(o => o.payment_method === 'razorpay').length;
    const codPayments = ordersArray.filter(o => o.payment_method === 'cod').length;

    // Recent activity (last 7 days)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);
    const recentOrders = ordersArray.filter(o => new Date(o.created_at) >= recentDate);
    const recentUsers = usersArray.filter(u => new Date(u.created_at) >= recentDate);

    // Popular books (by order count)
    const bookSales = {};
    ordersArray.forEach(order => {
      (order.items || []).forEach(item => {
        const bookId = item.book_id;
        if (bookSales[bookId]) {
          bookSales[bookId].count += Number(item.quantity || 1);
          bookSales[bookId].revenue += Number(item.price || 0) * Number(item.quantity || 1);
        } else {
          bookSales[bookId] = {
            count: Number(item.quantity || 1),
            revenue: Number(item.price || 0) * Number(item.quantity || 1),
            title: item.title || `Book #${bookId}`
          };
        }
      });
    });

    const popularBooks = Object.entries(bookSales)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5);

    // Low stock books
    const lowStockBooks = booksArray
      .filter(b => Number(b.stock || 0) <= 5)
      .sort((a, b) => (a.stock || 0) - (b.stock || 0))
      .slice(0, 5);

    main.innerHTML = `
      <h3>📈 Analytics & Insights</h3>
      
      <!-- Key Performance Indicators -->
      <div class="admin-stats">
        <div class="stat-card orders">
          <div class="stat-icon">💵</div>
          <div class="stat-value">₹${(totalRevenue / ordersArray.length || 0).toFixed(0)}</div>
          <div class="stat-label">Avg Order Value</div>
        </div>
        <div class="stat-card users">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${recentOrders.length}</div>
          <div class="stat-label">Orders This Week</div>
        </div>
        <div class="stat-card books">
          <div class="stat-icon">�</div>
          <div class="stat-value">${recentUsers.length}</div>
          <div class="stat-label">New Users This Week</div>
        </div>
        <div class="stat-card revenue">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value">${lowStockBooks.length}</div>
          <div class="stat-label">Low Stock Alert</div>
        </div>
      </div>

      <div class="grid two" style="gap: 20px; margin-top: 24px;">
        <!-- Order Type Analysis -->
        <div>
          <h4>📦 Order Type Breakdown</h4>
          <table class="admin-table">
            <thead>
              <tr>
                <th>Order Type</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="status-badge completed">BUY</span></td>
                <td><strong>${buyOrders}</strong></td>
                <td>${ordersArray.length ? ((buyOrders / ordersArray.length) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td><span class="status-badge pending">GIFT</span></td>
                <td><strong>${giftOrders}</strong></td>
                <td>${ordersArray.length ? ((giftOrders / ordersArray.length) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td><span class="status-badge cancelled">RENT</span></td>
                <td><strong>${rentOrders}</strong></td>
                <td>${ordersArray.length ? ((rentOrders / ordersArray.length) * 100).toFixed(1) : 0}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Payment Methods -->
        <div>
          <h4>💳 Payment Methods</h4>
          <table class="admin-table">
            <thead>
              <tr>
                <th>Payment Type</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="status-badge completed">Razorpay</span></td>
                <td><strong>${razorpayPayments}</strong></td>
                <td>${ordersArray.length ? ((razorpayPayments / ordersArray.length) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td><span class="status-badge pending">COD</span></td>
                <td><strong>${codPayments}</strong></td>
                <td>${ordersArray.length ? ((codPayments / ordersArray.length) * 100).toFixed(1) : 0}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid two" style="gap: 20px; margin-top: 24px;">
        <!-- Popular Books -->
        <div>
          <h4>� Top Selling Books</h4>
          ${popularBooks.length ? `
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Sales</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${popularBooks.map(([bookId, data]) => `
                  <tr>
                    <td><strong>${data.title}</strong></td>
                    <td>${data.count} sold</td>
                    <td><strong>₹${data.revenue.toFixed(2)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p class="muted">No sales data available</p>'}
        </div>

        <!-- Low Stock Alert -->
        <div>
          <h4>⚠️ Low Stock Alert</h4>
          ${lowStockBooks.length ? `
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${lowStockBooks.map(b => `
                  <tr>
                    <td><strong>${b.title}</strong></td>
                    <td>${b.stock || 0}</td>
                    <td><span class="status-badge ${(b.stock || 0) === 0 ? 'cancelled' : 'pending'}">${(b.stock || 0) === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p class="muted">✅ All books are well stocked!</p>'}
        </div>
      </div>

      <!-- Business Insights -->
      <div style="margin-top: 24px;">
        <h4>💡 Business Insights</h4>
        <div class="grid" style="gap: 16px;">
          <div style="background: var(--soft); padding: 16px; border-radius: 8px; border: 1px solid var(--muted);">
            <h5>� Revenue Trends</h5>
            <p>Total Revenue: <strong>₹${totalRevenue.toFixed(2)}</strong></p>
            <p>Average Order Value: <strong>₹${(totalRevenue / ordersArray.length || 0).toFixed(2)}</strong></p>
            <p>This Week's Activity: <strong>${recentOrders.length} orders, ${recentUsers.length} new users</strong></p>
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('renderAdminAnalytics', e);
    main.innerHTML = '<p class="bad">Failed to load analytics</p>';
  }
}

// Admin Orders View  
async function renderAdminOrders(main) {
  try {
    const raw = await Api.getAdminOrders(AUTH.token).catch(() => []);
    const orders = dedupeOrders(Array.isArray(raw) ? raw : (raw.orders || []));
    if (!orders.length) {
      main.innerHTML = '<p class="muted">No orders found.</p>';
      return;
    }

    main.innerHTML = `
      <h3>📦 Orders Management</h3>
      <table class="admin-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Type</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => {
      const items = (o.items || []).map(i => `${i.title || i.book_id} (${i.quantity})`).join(', ');
      const itemsTotal = (o.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
      const shipFee = (o.shipping_fee != null) ? Number(o.shipping_fee) : (o.shipping_speed ? ({ standard: 30, express: 70, priority: 120 }[o.shipping_speed] || 0) : 0);
      const codFee = (o.cod_fee != null) ? Number(o.cod_fee) : ((o.payment_method === 'cod') ? 10 : 0);
      const grandTotal = itemsTotal + shipFee + codFee;

      // Determine order type based on mode or items
      let orderType = 'BUY';
      let typeClass = 'completed';
      if (o.mode === 'gift') {
        orderType = 'GIFT';
        typeClass = 'pending';
      } else if (o.mode === 'rent') {
        orderType = 'RENT';
        typeClass = 'cancelled';
      }

      return `
              <tr>
                <td><strong>#${o.id}</strong></td>
                <td>${o.user_name || o.user_email || 'N/A'}</td>
                <td class="small">${items || 'No items'}</td>
                <td><span class="status-badge ${typeClass}">${orderType}</span></td>
                <td><strong>₹${grandTotal.toFixed(2)}</strong></td>
                <td><span class="status-badge ${o.payment_method === 'card' ? 'completed' : 'pending'}">${(o.payment_method || 'unknown').toUpperCase()}</span></td>
                <td>${new Date(o.created_at || '').toLocaleDateString()}</td>
                <td><span class="status-badge ${o.status === 'completed' ? 'completed' : 'pending'}">${o.status || 'PENDING'}</span></td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    console.error('renderAdminOrders', e);
    main.innerHTML = '<p class="bad">Failed to load orders</p>';
  }
}

// Admin Users View
async function renderAdminUsers(main) {
  try {
    const raw = await Api.getAdminUsers(AUTH.token).catch(() => []);
    const users = Array.isArray(raw) ? raw : (raw.users || []);

    if (!users.length) {
      main.innerHTML = '<p class="muted">No users found.</p>';
      return;
    }

    main.innerHTML = `
      <h3>👥 Users Management</h3>
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Admin</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><strong>${u.id}</strong></td>
              <td>${u.name || 'N/A'}</td>
              <td>${u.email}</td>
              <td>${u.phone || 'N/A'}</td>
              <td><span class="status-badge ${u.is_admin ? 'completed' : 'pending'}">${u.is_admin ? 'ADMIN' : 'USER'}</span></td>
              <td>${new Date(u.created_at || '').toLocaleDateString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    console.error('renderAdminUsers', e);
    main.innerHTML = '<p class="bad">Failed to load users</p>';
  }
}

// Admin Books View
async function renderAdminBooks(main) {
  try {
    const raw = await Api.getBooks().catch(() => ({ books: [] }));
    const books = Array.isArray(raw) ? raw : (raw.books || []);

    if (!books.length) {
      main.innerHTML = '<p class="muted">No books found.</p>';
      return;
    }

    main.innerHTML = `
      <h3>📚 Books Management</h3>
      <table class="admin-table">
        <thead>
          <tr>
            <th>Cover</th>
            <th>Title</th>
            <th>Author</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${books.map(b => `
            <tr>
              <td>
                ${b.image_url ? `<img src="${b.image_url}" alt="${b.title}" style="width: 40px; height: 60px; object-fit: cover; border-radius: 4px;">` : '📚'}
              </td>
              <td><strong>${b.title}</strong></td>
              <td>${b.author}</td>
              <td><strong>₹${Number(b.price || 0).toFixed(2)}</strong></td>
              <td>
                <input type="number" value="${b.stock || 0}" min="0" 
                       data-book-id="${b.id}" 
                       style="width: 70px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--muted); background: var(--soft); color: var(--text);" />
              </td>
              <td>
                <button class="btn ghost small" onclick="editBook('${b.id}')" style="font-size: 0.8rem; padding: 4px 8px;">✏️ Edit</button>
                <button class="btn bad small" onclick="deleteBook('${b.id}')" style="font-size: 0.8rem; padding: 4px 8px;">🗑️ Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Add stock update functionality
    onAll('[data-book-id]', (inp) => {
      inp.onchange = async () => {
        const id = inp.dataset.bookId;
        const newStock = Number(inp.value || 0);
        try {
          await Api.updateBookAdmin(AUTH.token, id, { stock: newStock });
          toast('Stock updated');
          await renderCatalog();
        } catch (err) {
          console.error('updateStock', err);
          toast(err?.message || 'Stock update failed');
        }
      };
    });
  } catch (e) {
    console.error('renderAdminBooks', e);
    main.innerHTML = '<p class="bad">Failed to load books</p>';
  }
}

// Event handlers for admin navigation
on('#adminViewDashboard', 'click', () => renderAdminPanel('dashboard'));
on('#adminViewOrders', 'click', () => renderAdminPanel('orders'));
on('#adminViewUsers', 'click', () => renderAdminPanel('users'));
on('#adminViewBooks', 'click', () => renderAdminPanel('books'));
on('#adminViewAnalytics', 'click', () => renderAdminPanel('analytics'));

// Book management functions
window.editBook = async (bookId) => {
  try {
    const book = await Api.getBookById(bookId);
    ADMIN_EDIT_BOOK_ID = bookId;

    const form = $('#adminBookForm');
    if (form) {
      form.title.value = book.title || '';
      form.author.value = book.author || '';
      form.price.value = book.price || '';
      form.stock.value = book.stock || '';
      form.description.value = book.description || '';

      // Set page count if available
      if (form.page_count) {
        form.page_count.value = book.page_count || '';
      }

      // Note: File inputs (cover_image, book_content, book_sample) cannot be pre-populated for security reasons
      // Show a message if the book already has content
      if (book.image_url || book.cover) {
        toast('This book already has a cover image. Upload a new one to replace it.', 'info');
      }
      if (book.content_url) {
        toast('This book already has content. Upload new content to replace it.', 'info');
      }
    }
    toast('Book loaded for editing');
  } catch (err) {
    console.error('editBook', err);
    toast('Failed to load book for editing');
  }
};

window.deleteBook = async (bookId) => {
  if (!confirm('Are you sure you want to delete this book? This action cannot be undone.')) {
    return;
  }

  try {
    await Api.deleteBookAdmin(AUTH.token, bookId);
    toast('Book deleted successfully');
    await renderAdminPanel('books');
  } catch (err) {
    console.error('deleteBook', err);
    toast(err?.message || 'Failed to delete book');
  }
};

// Book preview functionality
function updateBookPreview(imageUrl) {
  const preview = $('#bookImagePreview');
  const img = $('#previewImg');

  if (imageUrl && img && preview) {
    img.src = imageUrl;
    preview.classList.remove('hidden');
  } else if (preview) {
    preview.classList.add('hidden');
  }
}

// Admin search functionality
on('#adminSearch', 'input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const rows = document.querySelectorAll('.admin-table tbody tr');

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
});

// Enhanced Admin Add/Edit Book handler with file uploads
on('#adminBookForm', 'submit', async (e) => {
  e.preventDefault();
  if (!AUTH.token || !AUTH.user?.is_admin) { toast('Admin only'); return; }

  const fd = new FormData(e.target);
  const coverImageFile = fd.get('cover_image');
  const bookContentFile = fd.get('book_content');
  const bookSampleFile = fd.get('book_sample');

  const bookData = {
    title: fd.get('title'),
    author: fd.get('author'),
    price: Number(fd.get('price')) || 0,
    stock: Number(fd.get('stock')) || 0,
    description: fd.get('description') || null,
    page_count: Number(fd.get('page_count')) || 0
  };

  try {
    let bookId;
    let coverUrl = null;

    // Step 1: Create or update the basic book info
    if (ADMIN_EDIT_BOOK_ID) {
      await Api.updateBookAdmin(AUTH.token, ADMIN_EDIT_BOOK_ID, bookData);
      bookId = ADMIN_EDIT_BOOK_ID;
      toast('Book info updated');
    } else {
      const newBook = await Api.createBookAdmin(AUTH.token, bookData);
      bookId = newBook.id || newBook.book?.id;
      if (!bookId) throw new Error('Failed to get book ID from creation response');
      toast('Book created');
    }

    // Step 2: Upload cover image if provided
    if (coverImageFile && coverImageFile.size > 0) {
      try {
        const coverResult = await Api.uploadBookCover(AUTH.token, bookId, coverImageFile);
        coverUrl = coverResult.coverUrl || coverResult.url;
        toast('Book cover uploaded', 'success');

        // Update book with cover URL
        await Api.updateBookAdmin(AUTH.token, bookId, {
          image_url: coverUrl,
          cover: coverUrl
        });
      } catch (error) {
        console.error('Cover upload error:', error);
        toast('Cover upload failed: ' + (error.message || 'Unknown error'), 'error');
      }
    }

    // Step 3: Upload book content if provided
    if (bookContentFile && bookContentFile.size > 0) {
      try {
        await Api.uploadBookContent(AUTH.token, bookId, bookContentFile, bookData.page_count);
        toast('Book content uploaded', 'success');
      } catch (error) {
        console.error('Content upload error:', error);
        toast('Content upload failed: ' + (error.message || 'Unknown error'), 'error');
      }
    }

    // Step 4: Upload book sample if provided
    if (bookSampleFile && bookSampleFile.size > 0) {
      try {
        await Api.uploadBookSample(AUTH.token, bookId, bookSampleFile);
        toast('Book sample uploaded', 'success');
      } catch (error) {
        console.error('Sample upload error:', error);
        toast('Sample upload failed: ' + (error.message || 'Unknown error'), 'error');
      }
    }

    // Reset form and refresh
    ADMIN_EDIT_BOOK_ID = null;
    e.target.reset();
    await renderAdminPanel('books');
    await renderCatalog();

  } catch (err) {
    console.error('create/update book admin', err);
    toast(err?.message || 'Create/update failed', 'error');
  }
});
on('#adminBookCancel', (ev) => { ev.preventDefault(); ADMIN_EDIT_BOOK_ID = null; $('#adminBookForm')?.reset(); toast('Canceled edit'); });

// ---------- Reset demo ----------
on('#btnReset', 'click', () => { CART = []; renderCartIcon(); if (AUTH.token) { toast('Client reset. You are still logged in.'); } else { setActiveNav('login'); showSection('loginSection'); toast('Client reset.'); } });

// ---------- Init ----------
(async function init() {
  try {
    // Check if we were in admin mode before refresh
    const wasAdminMode = localStorage.getItem('isAdminMode') === 'true';

    if (AUTH.token) {
      try {
        AUTH.user = await Api.getProfile(AUTH.token);

        // Double-check admin status and localStorage consistency
        const isActualAdmin = AUTH.user?.is_admin;

        if (isActualAdmin && wasAdminMode) {
          // Valid admin session, restore admin view
          localStorage.setItem('isAdminMode', 'true');
          setHeaderMode('hidden');
          setActiveNav('admin');
          showSection('adminPanel');
        } else if (isActualAdmin && !wasAdminMode) {
          // Admin user but wasn't in admin mode, show normal view
          localStorage.removeItem('isAdminMode');
          setHeaderMode('full');
          setActiveNav('home');
          showSection('homeSection');
        } else {
          // Not admin or invalid session
          localStorage.removeItem('isAdminMode');
          setHeaderMode('full');
          setActiveNav('home');
          showSection('homeSection');
        }

        await renderNav(); // Call renderNav after everything is set up
      }
      catch (e) {
        console.warn('init profile failed', e);
        saveToken(null);
        localStorage.removeItem('isAdminMode');
        setActiveNav('login');
        showSection('loginSection');
      }
    } else {
      localStorage.removeItem('isAdminMode');
      await renderNav();
      setActiveNav('login');
      showSection('loginSection');
    }

    // Notification button event listeners
    on('#btnNotifications', 'click', async () => {
      await renderNotificationModal();
      $('#notificationModal')?.classList.add('show');
    });

    on('#notificationClose', 'click', () => {
      $('#notificationModal')?.classList.remove('show');
    });

    // Close notification modal when clicking outside
    on('#notificationModal', 'click', (e) => {
      if (e.target === $('#notificationModal')) {
        $('#notificationModal')?.classList.remove('show');
      }
    });

    setInterval(() => {
      const ordersSection = document.getElementById('ordersSection');
      if (ordersSection && !ordersSection.classList.contains('hidden')) { renderOrders().catch(e => console.error('auto-refresh orders failed', e)); }
    }, 60000);

    // Periodic notification update to ensure they stay current
    setInterval(async () => {
      if (AUTH.token && typeof updateNavNotifications === 'function') {
        console.log('DEBUG: Periodic notification check');
        try {
          await updateNavNotifications();
        } catch (e) {
          console.error('Periodic notification update failed:', e);
        }
      }
    }, 30000); // Check every 30 seconds
  } catch (err) { console.error('init error', err); toast('App initialization failed — check console'); }
})();


