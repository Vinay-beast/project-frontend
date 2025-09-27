/* app.js — integrated with backend via Api (defensive + admin edit/delete)
   Fixes:
   - Prevent duplicated form/button handlers via delegation
   - Guarded renderProfile to coalesce repeated calls
   - Defensive dedupe of addresses/cards before rendering
   - Debug logs for script load & profile renders
*/

// Debug: detect duplicate script execution
console.log('LOADED app.js', Date.now());

// ---------- Shortcuts & utilities ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const toast = (msg) => { const t = $('#toast'); if (!t) { console.log('TOAST:', msg); return; } t.textContent = msg; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2200); };
const money = (n) => '₹' + Number(n || 0).toFixed(2);
const todayLocalDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDaysISO = (isoDate, days) => { const d = new Date(isoDate); d.setDate(d.getDate() + days); return d.toISOString(); };

// Safe event helpers
function on(selector, event, handler) { const el = document.querySelector(selector); if (!el) return false; el.addEventListener(event, handler); return true; }
function onAll(selector, handler) { const nodes = document.querySelectorAll(selector); if (!nodes || !nodes.length) return false; nodes.forEach(n => handler(n)); return true; }

// ---------- New Enhanced Features ----------

// Wishlist functionality
let userWishlist = JSON.parse(localStorage.getItem('bookNookWishlist') || '[]');

function addToWishlist(bookId) {
  if (!userWishlist.includes(bookId)) {
    userWishlist.push(bookId);
    localStorage.setItem('bookNookWishlist', JSON.stringify(userWishlist));
    toast('📚 Book added to wishlist!');
    updateWishlistUI();
  } else {
    toast('Book already in wishlist');
  }
}

function removeFromWishlist(bookId) {
  userWishlist = userWishlist.filter(id => id !== bookId);
  localStorage.setItem('bookNookWishlist', JSON.stringify(userWishlist));
  toast('Removed from wishlist');
  updateWishlistUI();
}

function updateWishlistUI() {
  // Update wishlist heart icons
  $$('.wishlist-btn').forEach(btn => {
    const bookId = parseInt(btn.dataset.bookId);
    const isInWishlist = userWishlist.includes(bookId);
    btn.innerHTML = isInWishlist ? '❤️' : '🤍';
    btn.classList.toggle('active', isInWishlist);
  });

  // Update wishlist count badge
  const wishlistCount = $('#wishlistCount');
  if (wishlistCount) {
    if (userWishlist.length > 0) {
      wishlistCount.textContent = userWishlist.length;
      wishlistCount.classList.remove('hidden');
    } else {
      wishlistCount.classList.add('hidden');
    }
  }
}

// Search functionality
let searchTimeout;
function handleSearch(query) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (query.length > 2) {
      filterBooks(query);
    } else {
      showAllBooks();
    }
  }, 300);
}

function filterBooks(query) {
  const books = $$('.book-card');
  books.forEach(card => {
    const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
    const author = card.querySelector('.author')?.textContent.toLowerCase() || '';
    const genre = card.querySelector('.genre')?.textContent.toLowerCase() || '';

    const matches = title.includes(query.toLowerCase()) ||
      author.includes(query.toLowerCase()) ||
      genre.includes(query.toLowerCase());

    card.style.display = matches ? 'block' : 'none';

    if (matches) {
      card.style.animation = 'slideIn 0.3s ease';
    }
  });
}

function showAllBooks() {
  $$('.book-card').forEach(card => {
    card.style.display = 'block';
    card.style.animation = 'slideIn 0.3s ease';
  });
}

// Dark/Light theme toggle (enhanced)
function toggleTheme() {
  const currentTheme = document.body.dataset.theme || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = newTheme;
  localStorage.setItem('bookNookTheme', newTheme);
  toast(`Switched to ${newTheme} theme`);
}

// Book quick view modal
function showBookQuickView(bookId) {
  // Find book data and show in modal
  const modal = $('#quickViewModal');
  if (modal) {
    modal.classList.add('show');
    // Populate modal with book details
  }
}

// Enhanced loading states
function showLoading(element) {
  if (element) {
    element.innerHTML = '<div class="loading"></div> Loading...';
  }
}

function hideLoading(element, originalContent) {
  if (element) {
    element.innerHTML = originalContent;
  }
}

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
    ['loginSection', 'registerSection', 'homeSection', 'catalogSection', 'checkoutSection', 'ordersSection', 'profileSection', 'wishlistSection', 'adminPanel']
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
    if (id === 'wishlistSection') { await renderWishlist(); }
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
    if (key === 'wishlist') showSection('wishlistSection');
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

      // Update notifications when logged in (with safety check and retry)
      setTimeout(async () => {
        if (typeof updateNavNotifications === 'function') {
          console.log('DEBUG: Calling updateNavNotifications from renderNav');
          try {
            await updateNavNotifications();

            // Additional check after 2 seconds to ensure notifications are updated
            setTimeout(async () => {
              console.log('DEBUG: Re-checking notifications after delay');
              await updateNavNotifications();
            }, 2000);

          } catch (e) {
            console.error('Failed to update notifications in renderNav:', e);
          }
        } else {
          console.error('DEBUG: updateNavNotifications function not found');
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
    console.log('DEBUG: delegated formAddress submit', Date.now());
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

  // Add Card
  if (e.target.matches('#formCard')) {
    e.preventDefault();
    console.log('DEBUG: delegated formCard submit', Date.now());
    const data = Object.fromEntries(new FormData(e.target).entries());
    const payload = { name: data.name, number: data.number.replace(/\s+/g, ''), expiry: data.expiry, cvv: data.cvv, default: data.default === 'yes' };
    try {
      await Api.addCard(AUTH.token, payload);
      e.target.reset();
      toast('Card saved');
      await renderProfile();
    } catch (err) {
      console.error('addCard', err);
      toast(err?.message || 'Card save failed');
    }
    return;
  }
});

document.addEventListener('click', async (e) => {
  // Delete address
  if (e.target.matches('[data-del-addr]')) {
    const id = e.target.dataset.delAddr;
    console.log('DEBUG: delegated delete address click', id, Date.now());
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

  // Delete card
  if (e.target.matches('[data-del-card]')) {
    const id = e.target.dataset.delCard;
    console.log('DEBUG: delegated delete card click', id, Date.now());
    try {
      await Api.deleteCard(AUTH.token, id);
      toast('Deleted');
      await renderProfile();
    } catch (err) {
      console.error('deleteCard', err);
      toast(err?.message || 'Delete failed');
    }
    return;
  }

  // Make default card
  if (e.target.matches('[data-make-default]')) {
    const id = e.target.dataset.makeDefault;
    console.log('DEBUG: delegated make-default click', id, Date.now());
    try {
      await Api.setDefaultCard(AUTH.token, id, true);
      toast('Default updated');
      await renderProfile();
    } catch (err) {
      console.error('setDefaultCard', err);
      toast(err?.message || 'Update failed');
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
      <div class="card book-card" data-book-id="${b.id}" style="position: relative;">
        <button class="wishlist-btn ${userWishlist.includes(b.id) ? 'active' : ''}" data-book-id="${b.id}">
          ${userWishlist.includes(b.id) ? '❤️' : '🤍'}
        </button>
        <div class="book-cover" style="background-image:url('${b.image_url || b.cover || ''}')"></div>
        <div class="pillbar"><span class="tag small">${b.author || ''}</span><span class="tag small">Stock: ${b.stock ?? '-'}</span></div>
        <h2 class="book-title" data-book="${b.id}" style="cursor:pointer">${b.title}</h2>
        <p class="small muted">${(b.description || '').slice(0, 90)}...</p>
        <p class="price gradient-text">${money(b.price)}</p>
        <div class="row">
          <button class="btn primary" data-buy="${b.id}">🛒 Buy</button>
          <button class="btn" data-rent="${b.id}">📚 Rent</button>
        </div>
        <div style="margin-top:8px">
          <button class="btn ghost" data-gift="${b.id}">🎁 Gift</button>
          <button class="btn ghost" data-addcart="${b.id}">Add to Cart</button>
        </div>
      </div>
    `).join('') || '<p class="muted">No books found.</p>';

    onAll('#bookGrid [data-buy]', el => el.onclick = () => startCheckout([{ bookId: el.dataset.buy, qty: 1 }], 'buy'));
    onAll('#bookGrid [data-rent]', el => el.onclick = () => startCheckout([{ bookId: el.dataset.rent, qty: 1 }], 'rent'));
    onAll('#bookGrid [data-gift]', el => el.onclick = () => startCheckout([{ bookId: el.dataset.gift, qty: 1 }], 'gift'));
    onAll('#bookGrid [data-addcart]', el => el.onclick = () => addToCart(el.dataset.addcart, 1));
    onAll('#bookGrid .book-title', el => el.onclick = () => openBookModal(el.dataset.book));

    // Update wishlist UI after rendering
    updateWishlistUI();
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
      if (paySel) { const codOpt = Array.from(paySel.options).find(o => o.value === 'cod'); if (codOpt) codOpt.disabled = !needsShipping; if (!needsShipping && paySel.value === 'cod') paySel.value = 'card'; }
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

    const btnPay = $('#btnPay');
    if (btnPay) {
      btnPay.onclick = async () => {
        const lastSummary2 = computeSummary();
        const mode = lastSummary2.mode;
        if (mode === 'gift') { const ge = $('#ckGiftEmail')?.value.trim() || ''; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ge)) { toast('Enter a valid gift email'); return; } }
        let shipping_address_id = null, shipping_speed = null;
        if (lastSummary2.needsShipping) { shipping_address_id = $('#ckSavedAddr')?.value || null; if (!shipping_address_id) { toast('Select or add an address'); return; } shipping_speed = lastSummary2.shipKey; }
        let saved_card_id = null; if (lastSummary2.payMethod === 'card') { saved_card_id = $('#ckSavedCard')?.value || null; if (!saved_card_id) { toast('Add a card in Profile or choose another method'); return; } }
        const orderData = { mode, items: CART.map(ci => ({ book_id: ci.bookId, quantity: ci.qty })), shipping_address_id, shipping_speed, payment_method: lastSummary2.payMethod, saved_card_id, notes: $('#ckNotes')?.value || null, rental_duration: mode === 'rent' ? lastSummary2.rentalDays : null, gift_email: mode === 'gift' ? ($('#ckGiftEmail')?.value || '').trim() : null, shipping_fee: lastSummary2.shipFee, cod_fee: lastSummary2.codFee, delivery_eta: lastSummary2.deliveryEtaISO || null };

        if (btnPay.disabled) return;
        btnPay.disabled = true;
        try {
          await Api.placeOrder(AUTH.token, orderData);
          toast('Order placed');
          CART = []; renderCartIcon();
          setActiveNav('orders'); showSection('ordersSection'); await renderOrders();
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

    // Create gift cards
    const giftCards = await Promise.all((gifts || []).map(async g => {
      const b = g.title ? g : await fetchBookById(g.book_id);
      const isClaimed = !!g.claimed_at;
      const claimStatus = isClaimed ? 'Claimed' : 'Unclaimed';
      const claimColor = isClaimed ? 'good' : 'warn';
      return `
      <div class="card">
        <div class="pillbar">
          <span class="tag small" style="background: rgba(var(--${claimColor}), .2); border-color: var(--${claimColor}); color: var(--${claimColor})">${claimStatus}</span>
          <span class="tag small">${(b.author || g.author || '')}</span>
        </div>
        <h3>${b.title || g.title}</h3>
        <p class="small muted">Received: ${g.created_at ? new Date(g.created_at).toLocaleDateString() : '-'}</p>
        ${isClaimed ?
          `<button class="btn" data-read="${b.id || g.book_id}" data-title="${b.title || g.title}">Read</button>` :
          `<button class="btn primary" data-claim-gift="${g.id}">Claim Gift</button>`
        }
      </div>`;
    }));

    // Count unclaimed gifts for notification badge
    const unclaimedGifts = gifts.filter(g => !g.claimed_at).length;
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

    onAll('#libraryOwned [data-read], #libraryRented [data-read], #libraryGifts [data-read]', (btn) => { if (!btn.hasAttribute('disabled')) btn.onclick = () => openReader(btn.dataset.title); });

    // Handle gift claiming
    onAll('#libraryGifts [data-claim-gift]', (btn) => {
      btn.onclick = async () => {
        try {
          const result = await Api.claimGifts(AUTH.token);
          toast(`Claimed ${result.claimed || 0} gift${result.claimed === 1 ? '' : 's'}!`);

          // Immediately update notifications and library
          await updateNavNotifications();
          await renderLibrary(); // Refresh to show updated status
        } catch (e) {
          console.error('Claim gifts failed:', e);
          toast(e?.message || 'Failed to claim gifts');
        }
      };
    });
  } catch (e) { console.error('renderLibrary', e); toast('Failed to render library'); }
}
function openReader(title) { $('#readerTitle') && ($('#readerTitle').textContent = title); $('#readerBody') && ($('#readerBody').textContent = 'This is a sample reader.'); $('#readerModal')?.classList.add('show'); }
on('#readerClose', 'click', () => $('#readerModal')?.classList.remove('show'));

// ---------- Navigation Notifications ----------
async function updateNavNotifications() {
  console.log('DEBUG: updateNavNotifications called, token:', !!AUTH.token);
  try {
    if (!AUTH.token) {
      console.log('DEBUG: No token, skipping notification update');
      // Hide notification elements when not logged in
      const notificationBtn = $('#btnNotifications');
      if (notificationBtn) {
        notificationBtn.style.display = 'none';
      }
      return;
    }

    console.log('DEBUG: Fetching gifts...');
    const gifts = await Api.getMyGifts(AUTH.token).catch(e => {
      console.error('DEBUG: Error fetching gifts:', e);
      return [];
    });
    console.log('DEBUG: Gifts received:', gifts);

    const unclaimedGifts = gifts.filter(g => !g.claimed_at);
    console.log('DEBUG: Unclaimed gifts:', unclaimedGifts.length);

    const notificationBtn = $('#btnNotifications');
    const notificationBadge = $('#navNotificationBadge');

    console.log('DEBUG: Notification elements found:', {
      btn: !!notificationBtn,
      badge: !!notificationBadge
    });

    if (notificationBtn) {
      // Always show notification button when logged in
      notificationBtn.style.display = 'inline-flex';

      if (notificationBadge) {
        if (unclaimedGifts.length > 0) {
          notificationBadge.textContent = unclaimedGifts.length;
          notificationBadge.classList.remove('hidden');
          notificationBadge.style.display = 'inline-block';
          notificationBtn.title = `${unclaimedGifts.length} unclaimed gift${unclaimedGifts.length === 1 ? '' : 's'}`;
          console.log('DEBUG: Notification badge updated to:', unclaimedGifts.length);

          // Make the notification button more visible with red glow
          notificationBtn.style.background = 'rgba(239, 68, 68, 0.1)';
          notificationBtn.style.borderColor = '#ef4444';
          notificationBtn.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
        } else {
          notificationBadge.classList.add('hidden');
          notificationBadge.style.display = 'none';
          notificationBtn.title = 'Gift Notifications (No new notifications)';
          console.log('DEBUG: Notification badge hidden (no unclaimed gifts)');

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

// Manual test function for debugging
window.testNotifications = async function () {
  console.log('=== MANUAL NOTIFICATION TEST ===');
  try {
    if (!AUTH.token) {
      console.log('No auth token found');
      return;
    }

    console.log('Calling updateNavNotifications...');
    await updateNavNotifications();

    console.log('Test completed. Check above logs for details.');
  } catch (e) {
    console.error('Test failed:', e);
  }
};

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
      const isClaimed = !!g.claimed_at;
      const timeAgo = new Date(g.created_at).toLocaleDateString();

      // Get sender info from the backend data
      const senderEmail = g.sender_email || 'Unknown sender';
      const senderName = g.sender_name || senderEmail;

      return `
        <div class="notification-item ${isClaimed ? '' : 'unread'}" data-gift-id="${g.id}" data-claimed="${isClaimed}">
          <h4>${b.title || g.title}</h4>
          <p>From: ${senderName} (${senderEmail})</p>
          <p>Received: ${timeAgo}</p>
          <div style="margin-top: 8px;">
            <span class="tag tiny ${isClaimed ? 'good' : 'warn'}">${isClaimed ? '✓ Claimed' : '🎁 Click to Claim'}</span>
          </div>
        </div>
      `;
    }));

    notificationList.innerHTML = notificationItems.join('');

    // Handle notification clicks (claim gifts)
    onAll('.notification-item[data-claimed="false"]', (item) => {
      item.onclick = async () => {
        try {
          const result = await Api.claimGifts(AUTH.token);
          toast(`Claimed ${result.claimed || 0} gift${result.claimed === 1 ? '' : 's'}!`);

          // Update UI
          await updateNavNotifications();
          await renderLibrary();
          $('#notificationModal')?.classList.remove('show');
        } catch (e) {
          console.error('Claim gift failed:', e);
          toast(e?.message || 'Failed to claim gift');
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
  console.log('DEBUG: renderProfile called', Date.now());

  if (__renderProfileLock) {
    __renderProfileQueued = true;
    console.log('DEBUG: renderProfile queued because lock is active');
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

    if (!AUTH.user?.is_admin) {
      let addrs = await Api.listAddresses(AUTH.token).catch(() => []);
      let cards = await Api.listCards(AUTH.token).catch(() => []);
      const dedupeById = (arr) => { const m = new Map(); (arr || []).forEach(a => { if (a && a.id != null && !m.has(String(a.id))) m.set(String(a.id), a); }); return Array.from(m.values()); };
      addrs = dedupeById(addrs);
      cards = dedupeById(cards);

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

    // Payment method breakdown
    const cardPayments = ordersArray.filter(o => o.payment_method === 'card').length;
    const codPayments = ordersArray.filter(o => o.payment_method === 'cod').length;
    const upiPayments = ordersArray.filter(o => o.payment_method === 'upi').length;

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
                <td><span class="status-badge completed">CARD</span></td>
                <td><strong>${cardPayments}</strong></td>
                <td>${ordersArray.length ? ((cardPayments / ordersArray.length) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td><span class="status-badge pending">UPI</span></td>
                <td><strong>${upiPayments}</strong></td>
                <td>${ordersArray.length ? ((upiPayments / ordersArray.length) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td><span class="status-badge cancelled">COD</span></td>
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
                <button class="btn ghost small" onclick="editBook(${b.id})" style="font-size: 0.8rem; padding: 4px 8px;">✏️ Edit</button>
                <button class="btn bad small" onclick="deleteBook(${b.id})" style="font-size: 0.8rem; padding: 4px 8px;">🗑️ Delete</button>
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
      form.image_url.value = book.image_url || '';
      form.description.value = book.description || '';

      // Show preview if image exists
      updateBookPreview(book.image_url);
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

// Image URL input handler for live preview
on('input[name="image_url"]', 'input', (e) => {
  updateBookPreview(e.target.value);
});

// Admin search functionality
on('#adminSearch', 'input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const rows = document.querySelectorAll('.admin-table tbody tr');

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
});// Admin Add/Edit Book handler
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

// ---------- New Feature Functions ----------

// Render wishlist
async function renderWishlist() {
  const wishlistGrid = $('#wishlistGrid');
  if (!wishlistGrid) return;

  if (userWishlist.length === 0) {
    wishlistGrid.innerHTML = '<p class="muted">Your wishlist is empty. Add some books to get started!</p>';
    return;
  }

  try {
    const books = await Api.getBooks();
    const wishlistBooks = books.filter(book => userWishlist.includes(book.id));

    wishlistGrid.innerHTML = wishlistBooks.map(book => `
      <div class="card book-card" data-book-id="${book.id}">
        <div style="position: relative;">
          <button class="wishlist-btn active" data-book-id="${book.id}">❤️</button>
          <img src="${book.cover_url || 'https://via.placeholder.com/150x200?text=No+Cover'}" 
               alt="${book.title}" 
               style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px;">
        </div>
        <div style="padding: 10px 0;">
          <h3>${book.title}</h3>
          <p class="author small muted">by ${book.author}</p>
          <p class="genre badge">${book.genre}</p>
          <div class="pillbar" style="margin-top: 10px;">
            <span class="tag">${money(book.price)}</span>
            <button class="btn primary tiny" onclick="addToCart(${book.id})">Add to Cart</button>
          </div>
        </div>
      </div>
    `).join('');

    updateWishlistUI();
  } catch (err) {
    console.error('renderWishlist error:', err);
    wishlistGrid.innerHTML = '<p class="muted">Error loading wishlist</p>';
  }
}

// Event Handlers for New Features
document.addEventListener('click', (e) => {
  // Wishlist button handler
  if (e.target.classList.contains('wishlist-btn')) {
    const bookId = parseInt(e.target.dataset.bookId);
    const isActive = e.target.classList.contains('active');

    if (isActive) {
      removeFromWishlist(bookId);
    } else {
      addToWishlist(bookId);
    }
  }

  // Theme toggle handler
  if (e.target.id === 'btnTheme') {
    toggleTheme();
  }

  // FAB handler
  if (e.target.id === 'fabMain') {
    showFABMenu();
  }

  // Wishlist modal handlers
  if (e.target.id === 'btnWishlist') {
    showWishlistModal();
  }

  if (e.target.id === 'closeWishlistModal') {
    hideWishlistModal();
  }

  if (e.target.id === 'closeQuickViewModal') {
    hideQuickViewModal();
  }
});

// Search input handler
const searchInput = $('#searchBooks');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    handleSearch(e.target.value);
  });
}

// Modal functions
function showWishlistModal() {
  const modal = $('#wishlistModal');
  if (modal) {
    renderWishlistModal();
    modal.classList.add('show');
  }
}

function hideWishlistModal() {
  const modal = $('#wishlistModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

function hideQuickViewModal() {
  const modal = $('#quickViewModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

async function renderWishlistModal() {
  const wishlistContent = $('#wishlistContent');
  if (!wishlistContent) return;

  if (userWishlist.length === 0) {
    wishlistContent.innerHTML = '<p class="muted">Your wishlist is empty</p>';
    return;
  }

  try {
    const books = await Api.getBooks();
    const wishlistBooks = books.filter(book => userWishlist.includes(book.id));

    wishlistContent.innerHTML = `
      <div class="wishlist-grid">
        ${wishlistBooks.map(book => `
          <div class="card small">
            <img src="${book.cover_url || 'https://via.placeholder.com/100x150?text=No+Cover'}" 
                 alt="${book.title}" 
                 style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;">
            <h4>${book.title}</h4>
            <p class="small muted">${book.author}</p>
            <div class="pillbar">
              <span class="tag">${money(book.price)}</span>
              <button class="btn tiny" onclick="removeFromWishlist(${book.id}); renderWishlistModal();">Remove</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    wishlistContent.innerHTML = '<p class="muted">Error loading wishlist</p>';
  }
}

// Initialize theme
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('bookNookTheme') || 'dark';
  document.body.dataset.theme = savedTheme;

  // Update wishlist count
  const wishlistCount = $('#wishlistCount');
  if (wishlistCount) {
    if (userWishlist.length > 0) {
      wishlistCount.textContent = userWishlist.length;
      wishlistCount.classList.remove('hidden');
    } else {
      wishlistCount.classList.add('hidden');
    }
  }
});

// FAB Menu functionality
function showFABMenu() {
  const actions = [
    { icon: '🔍', text: 'Search', action: () => $('#searchBooks')?.focus() },
    { icon: '❤️', text: 'Wishlist', action: () => showWishlistModal() },
    { icon: '🛒', text: 'Cart', action: () => openCartDrawer() },
    { icon: '🌙', text: 'Theme', action: () => toggleTheme() }
  ];

  // Create temporary menu
  const menu = document.createElement('div');
  menu.style.cssText = `
    position: fixed;
    bottom: 90px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 101;
  `;

  actions.forEach((action, index) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: none;
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      cursor: pointer;
      font-size: 20px;
      transition: all 0.3s ease;
      animation: slideIn 0.3s ease ${index * 0.1}s backwards;
    `;
    btn.innerHTML = action.icon;
    btn.title = action.text;
    btn.onclick = () => {
      action.action();
      document.body.removeChild(menu);
    };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);

  // Remove menu after 5 seconds or on outside click
  setTimeout(() => {
    if (document.body.contains(menu)) {
      document.body.removeChild(menu);
    }
  }, 5000);

  document.addEventListener('click', function removeMenu(e) {
    if (!menu.contains(e.target) && e.target.id !== 'fabMain') {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
      document.removeEventListener('click', removeMenu);
    }
  });
}


