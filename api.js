/* ========================================================================
   api.js — BookNook API Client (robust edition)
   - Centralizes all HTTP calls
   - Timeouts, retries, error normalization
   - JWT token handling (set/clear), header helpers
   - Pagination helpers, search helpers
   - Optional local fallback (for offline dev)
   - Response mappers to keep frontend shape stable
   ======================================================================== */

(function attachApi() {
    "use strict";

    // ---------- Config ----------
    const API_BASE_URL = "https://project-backend-zt54.onrender.com/api";
    const DEFAULT_TIMEOUT_MS = 12000;
    const DEFAULT_RETRIES = 1;
    const isDev = typeof window !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1");

    // ---------- Token handling ----------
    let __token = null;
    try {
        const t = localStorage.getItem("token");
        if (t) __token = t;
    } catch { }

    function setAuthToken(t) {
        __token = t || null;
        try {
            if (t) localStorage.setItem("token", t);
            else localStorage.removeItem("token");
        } catch { }
    }
    function clearAuthToken() { setAuthToken(null); }
    function authHeader(t) {
        const k = t || __token;
        return k ? { Authorization: `Bearer ${k}` } : {};
    }

    // ---------- Utils ----------
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try { return await fetch(url, { ...options, signal: controller.signal }); }
        finally { clearTimeout(id); }
    }

    function isNetworkError(err) {
        return err?.name === "AbortError" || /NetworkError|Failed to fetch|load failed/i.test(err?.message || "");
    }

    function normalizeError(err, fallbackMsg = "Request failed") {
        if (!err) return new Error(fallbackMsg);
        if (err instanceof Error) return err;
        const e = new Error(typeof err === "string" ? err : (err.message || fallbackMsg));
        if (err.status) e.status = err.status;
        if (err.data) e.data = err.data;
        return e;
    }

    async function apiRequest(endpoint, { method = "GET", body = null, token = null, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, retry = DEFAULT_RETRIES } = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const baseHeaders = { "Content-Type": "application/json", ...authHeader(token) };
        const request = { method, headers: { ...baseHeaders, ...headers }, body: body != null ? JSON.stringify(body) : undefined };

        let lastErr;
        for (let attempt = 0; attempt <= retry; attempt++) {
            try {
                const res = await fetchWithTimeout(url, request, timeoutMs);
                let data = null;
                const text = await res.text();
                try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }

                if (!res.ok) {
                    const e = new Error((data && data.message) || `${res.status} ${res.statusText}`);
                    e.status = res.status; e.data = data;
                    throw e;
                }
                return data;
            } catch (err) {
                lastErr = err;
                const net = isNetworkError(err);
                const is4xx = err?.status && err.status >= 400 && err.status < 500;
                if (!net && (is4xx || attempt === retry)) break;
                if (attempt < retry) await sleep(300 * (attempt + 1));
            }
        }
        throw normalizeError(lastErr);
    }

    // Multipart upload helper
    async function apiUpload(endpoint, formData, { token = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = { ...authHeader(token) }; // no Content-Type
        try {
            const res = await fetchWithTimeout(url, { method: "POST", headers, body: formData }, timeoutMs);
            let data = null;
            const text = await res.text();
            try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }
            if (!res.ok) {
                const e = new Error((data && data.message) || `${res.status} ${res.statusText}`);
                e.status = res.status; e.data = data;
                throw e;
            }
            return data;
        } catch (err) { throw normalizeError(err); }
    }

    // Shorthands
    const GET = (e, opt = {}) => apiRequest(e, { ...opt, method: "GET" });
    const POST = (e, b, opt = {}) => apiRequest(e, { ...opt, method: "POST", body: b });
    const PUT = (e, b, opt = {}) => apiRequest(e, { ...opt, method: "PUT", body: b });
    const DEL = (e, opt = {}) => apiRequest(e, { ...opt, method: "DELETE" });

    // ---------- Shape mappers ----------
    function mapBook(raw) {
        if (!raw) return null;
        return {
            id: raw.id,
            title: raw.title,
            author: raw.author,
            price: Number(raw.price || 0),
            stock: raw.stock,
            description: raw.description || raw.desc || "",
            image_url: raw.image_url || raw.cover || ""
        };
    }
    function mapBooksPage(raw) {
        const books = (raw?.books || raw || []).map(mapBook);
        const page = raw?.page ?? 1;
        const total = raw?.total ?? books.length;
        return { books, page, total };
    }
    function mapUser(raw) {
        if (!raw) return null;
        return {
            id: raw.id,
            name: raw.name,
            email: raw.email,
            phone: raw.phone || "",
            bio: raw.bio || "",
            profile_pic: raw.profile_pic || "",
            addresses: Array.isArray(raw.addresses) ? raw.addresses : [],
            cards: Array.isArray(raw.cards) ? raw.cards : [],
            is_admin: !!raw.is_admin
        };
    }

    // ---------- Local Fallback (dev only) ----------
    const localFallback = {
        catalog: [
            { id: 'b1', title: 'The Pragmatic Programmer', author: 'Andrew Hunt', price: 599, stock: 8, description: 'Timeless tips for pragmatic software development.', image_url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=640&auto=format&fit=crop' },
            { id: 'b2', title: 'Clean Code', author: 'Robert C. Martin', price: 549, stock: 12, description: 'Principles of writing clean, maintainable software.', image_url: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=640&auto=format&fit=crop' },
            { id: 'b3', title: 'Atomic Habits', author: 'James Clear', price: 399, stock: 20, description: 'A framework for improving every day.', image_url: 'https://images.unsplash.com/photo-1544937950-fa07a98d237f?q=80&w=640&auto=format&fit=crop' }
        ],
        user: null,
        token: null,
        orders: [],
        addresses: [],
        cards: []
    };

    async function maybeUseFallback(fn) {
        try { return await fn(); }
        catch (e) {
            if (!isDev) throw e;
            if (isNetworkError(e) || e?.status === 0) return "__FALLBACK__";
            throw e;
        }
    }

    // ---------- Public API ----------
    // Health
    async function health() {
        const res = await maybeUseFallback(() => GET("/health", { timeoutMs: 5000 }));
        if (res === "__FALLBACK__") return { status: "ok", db: false, timestamp: new Date().toISOString() };
        return res;
    }

    // Auth
    async function register(user) {
        const data = await POST("/auth/register", user);
        if (data?.token) setAuthToken(data.token);
        return { token: data.token, user: mapUser(data.user) };
    }
    async function login(credentials) {
        const data = await POST("/auth/login", credentials);
        if (data?.token) setAuthToken(data.token);
        return { token: data.token, user: mapUser(data.user) };
    }

    // ADD THIS NEW FUNCTION RIGHT AFTER THE LOGIN FUNCTION
    async function loginWithGoogle(token) {
        // Sends the Firebase token to a new backend endpoint we will create
        const data = await POST("/auth/google-login", { token });

        // If successful, it saves our app's own JWT token
        if (data?.token) setAuthToken(data.token);
        return { token: data.token, user: mapUser(data.user) };
    }

    // Profile
    async function getProfile(token) {
        const res = await maybeUseFallback(() => GET("/users/profile", { token }));
        if (res === "__FALLBACK__") {
            if (!localFallback.user) {
                localFallback.user = {
                    id: "u1", name: "Demo User", email: "demo@example.com",
                    phone: "", bio: "", profile_pic: "",
                    addresses: localFallback.addresses, cards: localFallback.cards
                };
            }
            return localFallback.user;
        }
        return mapUser(res);
    }
    async function updateProfile(token, body) {
        const data = await PUT("/users/profile", body, { token });
        if (data && typeof data === "object" && ("id" in data || "user" in data)) {
            return mapUser(data.user || data);
        }
        return { message: data?.message || "updated" };
    }
    async function changePassword(token, body) {
        const data = await PUT("/users/password", body, { token });
        return { message: data?.message || "password_updated" };
    }

    // ✅ Unified uploadProfilePic (tries /picture then /pic)
    async function uploadProfilePic(token, file) {
        const fd = new FormData();
        fd.append("avatar", file);
        try {
            const data = await apiUpload("/users/profile/picture", fd, { token });
            if (data?.user) return mapUser(data.user);
            return data;
        } catch (e) {
            if (e?.status === 404) {
                const fd2 = new FormData();
                fd2.append("file", file);
                return await apiUpload("/users/profile/pic", fd2, { token });
            }
            throw e;
        }
    }

    // Addresses
    async function listAddresses(token) {
        const res = await GET("/users/addresses", { token });
        const arr = Array.isArray(res) ? res : (Array.isArray(res?.addresses) ? res.addresses : []);
        return arr.map(a => ({
            id: a.id ?? a.address_id ?? a.addr_id ?? a.uuid ?? a._id ?? null,
            label: a.label ?? a.tag ?? a.title ?? "Address",
            recipient: a.recipient ?? a.name ?? a.contact_name ?? "",
            street: a.street ?? a.line1 ?? a.address1 ?? "",
            city: a.city ?? "", state: a.state ?? a.region ?? "",
            zip: a.zip ?? a.postal_code ?? a.pincode ?? a.pin ?? ""
        })).filter(a => a.id);
    }
    async function addAddress(token, addr) {
        const body = { label: addr.label, recipient: addr.recipient, street: addr.street, city: addr.city, state: addr.state, zip: addr.zip };
        const data = await POST("/users/addresses", body, { token });
        const a = data?.address || data || {};
        return { id: a.id ?? a.address_id ?? a.addr_id ?? data?.id ?? null };
    }
    async function deleteAddress(token, id) {
        const data = await DEL(`/users/addresses/${id}`, { token });
        return { message: data?.message || "deleted" };
    }

    // Cards
    async function listCards(token) {
        const res = await maybeUseFallback(() => GET("/users/cards", { token }));
        if (res === "__FALLBACK__") return localFallback.cards.slice();
        return Array.isArray(res) ? res : [];
    }
    async function addCard(token, card) {
        const data = await POST("/users/cards", card, { token });
        return { id: data?.id || null };
    }
    async function setDefaultCard(token, id, is_default) {
        const data = await PUT(`/users/cards/${id}/default`, { is_default }, { token });
        return { message: data?.message || "updated" };
    }
    async function deleteCard(token, id) {
        const data = await DEL(`/users/cards/${id}`, { token });
        return { message: data?.message || "deleted" };
    }

    // Books
    async function getBooks(page = 1, limit = 20) {
        const res = await maybeUseFallback(() => GET(`/books?page=${page}&limit=${limit}`));
        if (res === "__FALLBACK__") return { books: localFallback.catalog.map(mapBook), page: 1, total: localFallback.catalog.length };
        return mapBooksPage(res);
    }
    async function searchBooks(query, page = 1, limit = 20) {
        const q = encodeURIComponent(query || "");
        const res = await maybeUseFallback(() => GET(`/books/search?query=${q}&page=${page}&limit=${limit}`));
        if (res === "__FALLBACK__") {
            const ll = (localFallback.catalog || []).filter(b => {
                const needle = (query || "").toLowerCase();
                return b.title.toLowerCase().includes(needle) || b.author.toLowerCase().includes(needle);
            });
            return { books: ll.map(mapBook), page: 1, total: ll.length };
        }
        return mapBooksPage(res);
    }
    async function getBookById(id) {
        const res = await maybeUseFallback(() => GET(`/books/${id}`));
        if (res === "__FALLBACK__") {
            const found = (localFallback.catalog || []).find(b => String(b.id) === String(id));
            if (!found) throw new Error("Book not found (offline fallback)");
            return mapBook(found);
        }
        return mapBook(res);
    }

    // Orders
    async function placeOrder(token, orderData) { return await POST("/orders", orderData, { token }); }
    async function getOrders(token) {
        const res = await maybeUseFallback(() => GET("/orders", { token }));
        if (res === "__FALLBACK__") return localFallback.orders.slice();
        return Array.isArray(res) ? res : [];
    }
    async function getOrderById(token, id) { return await GET(`/orders/${id}`, { token }); }

    // Admin
    async function getAdminOrders(token) { return await GET('/admin/orders', { token }); }
    async function getAdminUsers(token) { return await GET('/admin/users', { token }); }
    async function createBookAdmin(token, payload) { return await POST('/admin/books', payload, { token }); }
    async function updateBookAdmin(token, id, payload) { return await PUT(`/admin/books/${id}`, payload, { token }); }
    async function deleteBookAdmin(token, id) { return await DEL(`/admin/books/${id}`, { token }); }

    // Library
    async function getLibrary(token) {
        const res = await maybeUseFallback(() => GET("/library", { token }));
        if (res === "__FALLBACK__") {
            const owned = [], rented = [];
            (localFallback.orders || []).forEach(o => {
                if (o.mode === "buy") (o.items || []).forEach(i => owned.push({ book: { id: i.book_id }, purchased_at: o.created_at || null }));
                if (o.mode === "rent") (o.items || []).forEach(i => rented.push({ book: { id: i.book_id }, rental_end: o.rental_end || null }));
            });
            return { owned, rented };
        }
        return res || { owned: [], rented: [] };
    }

    // Gifts
    async function getMyGifts(token) {
        const res = await maybeUseFallback(() => GET("/gifts/mine", { token }));
        if (res === "__FALLBACK__") {
            // Fallback: simulate some gifts for demo
            return [];
        }
        return Array.isArray(res) ? res : [];
    }

    async function claimGifts(token) {
        const res = await POST("/gifts/claim", {}, { token });
        return res || { claimed: 0 };
    }

    async function claimSpecificGift(token, giftId) {
        const res = await POST(`/gifts/claim/${giftId}`, {}, { token });
        return res || { claimed: 0 };
    }

    async function markGiftAsRead(token, giftId) {
        const res = await POST(`/gifts/read/${giftId}`, {}, { token });
        return res || { marked_read: 0 };
    }

    async function markAllGiftsAsRead(token) {
        const res = await POST("/gifts/read-all", {}, { token });
        return res || { marked_read: 0 };
    }

    // Pagination helper
    async function* iterateBooks({ pageStart = 1, pageSize = 50, maxPages = 10, query = null } = {}) {
        let page = pageStart;
        for (let i = 0; i < maxPages; i++) {
            const data = query ? await searchBooks(query, page, pageSize) : await getBooks(page, pageSize);
            const list = data?.books || [];
            if (!list.length) return;
            yield list;
            page++;
            if (list.length < pageSize) return;
        }
    }

    // ---------- Expose ----------
    window.Api = {
        API_BASE_URL,
        setAuthToken, clearAuthToken,
        health,
        register, login,
        loginWithGoogle,
        getProfile, updateProfile, changePassword, uploadProfilePic,
        listAddresses, addAddress, deleteAddress,
        listCards, addCard, setDefaultCard, deleteCard,
        getBooks, searchBooks, getBookById,
        placeOrder, getOrders, getOrderById,
        getLibrary,
        getMyGifts, claimGifts, claimSpecificGift, markGiftAsRead, markAllGiftsAsRead,
        getAdminOrders, getAdminUsers, createBookAdmin, updateBookAdmin, deleteBookAdmin,
        apiRequest, GET, POST, PUT, DEL, iterateBooks
    };
})();
