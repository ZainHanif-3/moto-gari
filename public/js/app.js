/* =========================================================
   MotoGari — frontend (vanilla JS + fetch, no build step)
   Built by ZN DEVELOPER — CEO Zain Hanif
   ========================================================= */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const PKR = (n) => 'Rs ' + Number(n).toLocaleString('en-PK');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    products: [],      // last filtered response
    cache: new Map(),  // id -> product (for cart lookups)
    filters: { search: '', model: '', category: '', min: '', max: '', sort: 'featured' },
    cart: [],
  };

  /* ---------------- toasts ---------------- */
  function toast(msg, err) {
    const wrap = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' err' : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 2600);
  }

  /* ---------------- catalogue ---------------- */
  function queryString() {
    const f = state.filters;
    const p = new URLSearchParams();
    if (f.search) p.set('search', f.search);
    if (f.model) p.set('model', f.model);
    if (f.category) p.set('category', f.category);
    if (f.min !== '' && !Number.isNaN(+f.min)) p.set('min', f.min);
    if (f.max !== '' && !Number.isNaN(+f.max)) p.set('max', f.max);
    if (f.sort) p.set('sort', f.sort);
    const s = p.toString();
    return s ? '?' + s : '';
  }

  async function loadProducts() {
    const countEl = $('#resultsCount');
    try {
      const res = await fetch('/api/products' + queryString());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.products = data.items;
      data.items.forEach((p) => state.cache.set(p.id, p));
      renderGrid();
      countEl.textContent = `${data.items.length} of 20 parts shown` +
        (state.filters.model ? ` · model ${state.filters.model}` : '') +
        (state.filters.category ? ` · ${state.filters.category}` : '');
    } catch (e) {
      countEl.textContent = 'Could not load parts — is the server running?';
      toast('Failed to load products', true);
    }
  }

  function badgeClass(b) {
    if (b === 'Sale') return 'badge-Sale';
    if (b === 'Best seller') return 'badge-Best';
    if (b === 'New') return 'badge-New';
    return 'badge-Genuine';
  }

  function cardHTML(p) {
    const off = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const specRows = Object.entries(p.specs || {}).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const stockTxt = p.stock === 0 ? 'Out of stock' : p.stock <= 10 ? `Only ${p.stock} left` : 'In stock';
    return `
    <article class="p-card reveal" data-id="${p.id}">
      <div class="p-flip">
        <div class="p-face p-front">
          <div class="p-media">
            <img src="${p.image}" alt="${p.name} — spare part for ${p.fits}" loading="lazy" width="600" height="450">
            <span class="badge ${badgeClass(p.badge)}">${p.badge}</span>
            <span class="p-fit">${p.fits}</span>
            <span class="p-stock ${p.stock <= 10 ? 'low' : ''}">${stockTxt}</span>
          </div>
          <div class="p-body">
            <p class="p-brand">${p.brand} · ${p.sku}</p>
            <h3>${p.name}</h3>
            <p class="p-desc">${p.description}</p>
            <div class="p-price">
              <span class="now">${PKR(p.price)}</span>
              ${p.oldPrice ? `<span class="was">${PKR(p.oldPrice)}</span><span class="off">-${off}%</span>` : ''}
            </div>
            <div class="p-actions">
              <button class="btn btn-primary btn-add" type="button" data-add="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>Add to cart</button>
              <button class="btn btn-mini btn-specs" type="button" data-specs="${p.id}" aria-label="Show specifications for ${p.name}">Specs</button>
            </div>
          </div>
        </div>
        <div class="p-face p-back" aria-hidden="true">
          <h4>Specifications</h4>
          <dl>${specRows}</dl>
          <button class="btn btn-mini btn-back" type="button" data-back="${p.id}">← Back to part</button>
          <p class="p-back-note">In stock: ${p.stock} units · category: ${p.category} · fits ${p.fits}. Confirmed on a call before dispatch.</p>
        </div>
      </div>
    </article>`;
  }

  function renderGrid() {
    const grid = $('#productGrid');
    const empty = $('#emptyState');
    if (!state.products.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.innerHTML = state.products.map(cardHTML).join('');
    $$('.p-card', grid).forEach((card) => {
      observeReveal(card);
      attachTilt(card);
    });
  }

  function attachTilt(card) {
    if (reduced || window.matchMedia('(hover: none)').matches) return;
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', (px * 12).toFixed(2) + 'deg');
      card.style.setProperty('--rx', (-py * 12).toFixed(2) + 'deg');
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }

  /* ---------------- filters UI ---------------- */
  async function loadChips() {
    try {
      const [cats, models] = await Promise.all([fetch('/api/categories'), fetch('/api/models')]);
      const catData = await cats.json();
      const modelData = await models.json();
      $('#catChips').innerHTML =
        `<button class="chip is-active" data-cat="" type="button">All <b>20</b></button>` +
        catData.map((c) => `<button class="chip" data-cat="${c.name}" type="button">${c.name} <b>${c.count}</b></button>`).join('');
      $('#fCategory').innerHTML =
        `<option value="">All categories</option>` +
        catData.map((c) => `<option value="${c.name}">${c.name} (${c.count})</option>`).join('');
      // model counts next to nav chips
      modelData.forEach((m) => {
        const btn = $(`[data-nav-model="${m.model === 'CG70 / CG125' ? '' : m.model}"]`);
        if (btn && m.model !== 'CG70 / CG125') btn.textContent = `${m.model} (${m.count})`;
      });
    } catch (e) { /* chips are non-critical */ }
  }

  function setFilter(patch, scroll) {
    Object.assign(state.filters, patch);
    // reflect in inputs
    $('#fSearch').value = state.filters.search;
    $('#fModel').value = state.filters.model;
    $('#fCategory').value = state.filters.category;
    $('#fMin').value = state.filters.min;
    $('#fMax').value = state.filters.max;
    $('#fSort').value = state.filters.sort;
    $('#navSearch').value = state.filters.search;
    $$('.chip-model').forEach((b) => b.classList.toggle('is-active', (b.dataset.navModel || '') === state.filters.model));
    $$('#catChips .chip').forEach((b) => b.classList.toggle('is-active', (b.dataset.cat || '') === state.filters.category));
    loadProducts();
    if (scroll) $('#products').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  function bindFilters() {
    $('#fSearch').addEventListener('input', debounce((e) => setFilter({ search: e.target.value }), 320));
    $('#navSearch').addEventListener('input', debounce((e) => setFilter({ search: e.target.value }), 320));
    $('#fModel').addEventListener('change', (e) => setFilter({ model: e.target.value }));
    $('#fCategory').addEventListener('change', (e) => setFilter({ category: e.target.value }));
    $('#fMin').addEventListener('input', debounce((e) => setFilter({ min: e.target.value }), 400));
    $('#fMax').addEventListener('input', debounce((e) => setFilter({ max: e.target.value }), 400));
    $('#fSort').addEventListener('change', (e) => setFilter({ sort: e.target.value }));
    $('#fClear').addEventListener('click', clearFilters);
    $('#emptyClear').addEventListener('click', clearFilters);

    $$('.chip-model').forEach((b) => b.addEventListener('click', () => setFilter({ model: b.dataset.navModel }, true)));
    $('#catChips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) setFilter({ category: chip.dataset.cat }, false);
    });

    // grid actions (delegated)
    $('#productGrid').addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      const specs = e.target.closest('[data-specs]');
      const back = e.target.closest('[data-back]');
      if (add) addToCart(add.dataset.add);
      if (specs) { const c = specs.closest('.p-card'); c.classList.add('is-flipped'); $('.p-back', c).setAttribute('aria-hidden', 'false'); }
      if (back) { const c = back.closest('.p-card'); c.classList.remove('is-flipped'); $('.p-back', c).setAttribute('aria-hidden', 'true'); }
    });

    // footer deep links
    $$('[data-foot-model]').forEach((a) => a.addEventListener('click', () => setFilter({ model: a.dataset.footModel, category: '' }, true)));
    $$('[data-foot-cat]').forEach((a) => a.addEventListener('click', () => setFilter({ category: a.dataset.footCat, model: '' }, true)));
  }

  function clearFilters() {
    setFilter({ search: '', model: '', category: '', min: '', max: '', sort: 'featured' });
  }

  /* ---------------- cart ---------------- */
  function loadCart() {
    try { state.cart = JSON.parse(localStorage.getItem('motoGariCart')) || []; }
    catch (e) { state.cart = []; }
    state.cart = state.cart.filter((l) => l && l.id && l.qty > 0);
  }
  function saveCart() {
    localStorage.setItem('motoGariCart', JSON.stringify(state.cart));
    const n = state.cart.reduce((s, l) => s + l.qty, 0);
    const badge = $('#cartBadge');
    badge.textContent = n;
    badge.classList.add('pop');
    setTimeout(() => badge.classList.remove('pop'), 260);
  }
  async function ensureCached(id) {
    if (state.cache.has(id)) return state.cache.get(id);
    try {
      const r = await fetch('/api/products/' + id);
      if (r.ok) { const p = await r.json(); state.cache.set(id, p); return p; }
    } catch (e) { /* ignore */ }
    return null;
  }
  async function addToCart(id) {
    const p = await ensureCached(id);
    if (!p) return toast('Product not found', true);
    const line = state.cart.find((l) => l.id === id);
    const inCart = line ? line.qty : 0;
    if (inCart + 1 > p.stock) return toast(`Only ${p.stock} in stock`, true);
    if (line) line.qty += 1; else state.cart.push({ id, qty: 1 });
    saveCart(); renderCart();
    toast(`${p.name} added to cart`);
  }
  function setQty(id, qty) {
    const line = state.cart.find((l) => l.id === id);
    if (!line) return;
    if (qty <= 0) state.cart = state.cart.filter((l) => l.id !== id);
    else line.qty = Math.min(qty, 100);
    saveCart(); renderCart();
  }
  async function cartSubtotal() {
    let total = 0;
    for (const line of state.cart) {
      const p = await ensureCached(line.id);
      if (p) total += p.price * line.qty;
    }
    return total;
  }
  async function renderCart() {
    const box = $('#cartItems');
    if (!state.cart.length) {
      box.innerHTML = `<div class="cart-empty"><span class="big">🛒</span><p>Your cart is empty.</p><p>Add a part to get started — payment is on delivery.</p></div>`;
      $('#cartSubtotal').textContent = PKR(0);
      $('#checkoutBtn').disabled = true;
      $('#checkoutBtn').style.opacity = '.5';
      return;
    }
    $('#checkoutBtn').disabled = false;
    $('#checkoutBtn').style.opacity = '1';
    const rows = [];
    for (const line of state.cart) {
      const p = await ensureCached(line.id);
      if (!p) continue;
      rows.push(`
        <div class="cart-item" data-line="${p.id}">
          <img src="${p.image}" alt="${p.name}" width="64" height="64">
          <div>
            <div class="ci-name">${p.name}</div>
            <div class="ci-price">${PKR(p.price)} · ${p.fits}</div>
            <div class="ci-qty">
              <button type="button" data-dec="${p.id}" aria-label="Decrease quantity">−</button>
              <span>${line.qty}</span>
              <button type="button" data-inc="${p.id}" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <button class="ci-remove" type="button" data-del="${p.id}" aria-label="Remove ${p.name}">🗑</button>
        </div>`);
    }
    box.innerHTML = rows.join('');
    const total = await cartSubtotal();
    $('#cartSubtotal').textContent = PKR(total);
    $('#checkoutTotal').textContent = PKR(total);
  }

  function bindCart() {
    $('#cartItems').addEventListener('click', (e) => {
      const inc = e.target.closest('[data-inc]');
      const dec = e.target.closest('[data-dec]');
      const del = e.target.closest('[data-del]');
      if (inc) { const l = state.cart.find((x) => x.id === inc.dataset.inc); setQty(inc.dataset.inc, l.qty + 1); }
      if (dec) { const l = state.cart.find((x) => x.id === dec.dataset.dec); setQty(dec.dataset.dec, l.qty - 1); }
      if (del) setQty(del.dataset.del, 0);
    });
    $('#cartBtn').addEventListener('click', openCart);
    $('#cartClose').addEventListener('click', closeCart);
    $('#overlay').addEventListener('click', () => { closeCart(); closeCheckout(); });
    $('#checkoutBtn').addEventListener('click', () => { if (state.cart.length) openCheckout(); });
    $('#checkoutClose').addEventListener('click', closeCheckout);
    $('#successClose').addEventListener('click', () => { closeCheckout(); closeCart(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeCart(); closeCheckout(); }
    });
  }

  function openCart() {
    $('#cartDrawer').classList.add('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'false');
    const ov = $('#overlay'); ov.hidden = false; requestAnimationFrame(() => ov.classList.add('show'));
    $('#cartClose').focus();
  }
  function closeCart() {
    $('#cartDrawer').classList.remove('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'true');
    const ov = $('#overlay'); ov.classList.remove('show');
    setTimeout(() => { if (!$('#checkoutModal').classList.contains('open')) ov.hidden = true; }, 350);
  }
  function openCheckout() {
    closeCart();
    $('#orderSuccess').hidden = true;
    $('#checkoutForm').hidden = false;
    $('#formError').hidden = true;
    $('#checkoutModal').classList.add('open');
    $('#checkoutModal').setAttribute('aria-hidden', 'false');
    const ov = $('#overlay'); ov.hidden = false; requestAnimationFrame(() => ov.classList.add('show'));
    $('#cName').focus();
  }
  function closeCheckout() {
    $('#checkoutModal').classList.remove('open');
    $('#checkoutModal').setAttribute('aria-hidden', 'true');
    const ov = $('#overlay'); ov.classList.remove('show');
    setTimeout(() => { ov.hidden = true; }, 350);
  }

  async function submitOrder(e) {
    e.preventDefault();
    const errBox = $('#formError');
    errBox.hidden = true;
    const payload = {
      name: $('#cName').value.trim(),
      phone: $('#cPhone').value.trim(),
      city: $('#cCity').value.trim(),
      address: $('#cAddress').value.trim(),
      note: $('#cNote').value.trim(),
      items: state.cart.map((l) => ({ id: l.id, qty: l.qty })),
    };
    const btn = $('#placeOrder');
    btn.disabled = true; btn.textContent = 'Placing order…';
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        errBox.textContent = data.error || 'Order failed';
        errBox.hidden = false;
        return;
      }
      $('#orderId').textContent = data.orderId;
      $('#orderTotal').textContent = PKR(data.total);
      $('#checkoutForm').hidden = true;
      $('#orderSuccess').hidden = false;
      state.cart = []; saveCart(); renderCart();
      toast('Order ' + data.orderId + ' placed — we will call you');
    } catch (e2) {
      errBox.textContent = 'Network error — please try again.';
      errBox.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = 'Place order';
    }
  }

  /* ---------------- page chrome ---------------- */
  function bindChrome() {
    const nav = $('#nav');
    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 24);
      // parallax
      $$('.parallax').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) return;
        const speed = parseFloat(el.dataset.speed || '0.08');
        const offset = (r.top + r.height / 2 - innerHeight / 2) * speed;
        el.style.transform = `translateY(${(-offset).toFixed(1)}px)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const burger = $('#hamburger');
    burger.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    $$('#navLinks a').forEach((a) => a.addEventListener('click', () => {
      document.body.classList.remove('nav-open');
      burger.setAttribute('aria-expanded', 'false');
    }));
  }

  /* ---------------- reveal + counters ---------------- */
  let revealObserver;
  function observeReveal(el) {
    if (!revealObserver) return el.classList.add('in');
    revealObserver.observe(el);
  }
  function initReveal() {
    if (!('IntersectionObserver' in window) || reduced) {
      $$('.reveal').forEach((el) => el.classList.add('in'));
      return;
    }
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); revealObserver.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    $$('.reveal').forEach((el) => revealObserver.observe(el));

    // generic tilt for feature cards
    if (!reduced && !window.matchMedia('(hover: none)').matches) {
      $$('.tilt').forEach((el) => {
        el.addEventListener('mousemove', (e) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          el.style.transform = `perspective(900px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg) translateY(-5px)`;
        });
        el.addEventListener('mouseleave', () => { el.style.transform = ''; });
      });
    }
  }

  function initCounters() {
    const nums = $$('.stat-num');
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      if (reduced) { el.textContent = target + suffix; return; }
      const dur = 1500;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-PK') + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (!('IntersectionObserver' in window)) return nums.forEach(run);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.5 });
    nums.forEach((n) => io.observe(n));
  }

  /* ---------------- three.js hero scene ---------------- */
  function initHero3D() {
    const canvas = $('#heroCanvas');
    if (!canvas || typeof THREE === 'undefined' || window.__threeFailed || reduced) return;
    try {
      const wrap = $('.hero-canvas-wrap');
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0, 9.5);

      // --- sprocket (gear) built from an extruded shape ---
      function gearGeometry(teeth, rOut, rIn, depth) {
        const shape = new THREE.Shape();
        const step = (Math.PI * 2) / teeth;
        for (let i = 0; i < teeth; i++) {
          const a = i * step;
          const a1 = a + step * 0.22;
          const a2 = a + step * 0.36;
          const a3 = a + step * 0.62;
          const a4 = a + step * 0.78;
          const pts = [
            [Math.cos(a) * rIn, Math.sin(a) * rIn],
            [Math.cos(a1) * rOut, Math.sin(a1) * rOut],
            [Math.cos(a2) * rOut, Math.sin(a2) * rOut],
            [Math.cos(a3) * rIn, Math.sin(a3) * rIn],
          ];
          pts.forEach(([x, y], idx) => { if (i === 0 && idx === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
          void a4;
        }
        const hole = new THREE.Path();
        hole.absarc(0, 0, rIn * 0.42, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 6,
        });
        geo.center();
        return geo;
      }

      const metal = new THREE.MeshStandardMaterial({ color: 0x9AA6B8, metalness: 0.95, roughness: 0.3 });
      const metalDark = new THREE.MeshStandardMaterial({ color: 0x39404E, metalness: 0.9, roughness: 0.42 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xE4002B, metalness: 0.6, roughness: 0.35, emissive: 0x3A000C, emissiveIntensity: 0.6 });
      const rubber = new THREE.MeshStandardMaterial({ color: 0x11141B, metalness: 0.1, roughness: 0.95 });

      const world = new THREE.Group();
      scene.add(world);

      // main sprocket
      const sprocket = new THREE.Group();
      const gear = new THREE.Mesh(gearGeometry(18, 2.5, 2.05, 0.42), metal);
      sprocket.add(gear);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.6, 32), metalDark);
      hub.rotation.x = Math.PI / 2;
      sprocket.add(hub);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 16, 80), redMat);
      sprocket.add(ring);
      for (let i = 0; i < 6; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.3), metalDark);
        spoke.position.set(Math.cos((i / 6) * Math.PI * 2) * 0.9, Math.sin((i / 6) * Math.PI * 2) * 0.9, 0);
        spoke.rotation.z = (i / 6) * Math.PI * 2;
        sprocket.add(spoke);
      }
      sprocket.position.set(2.5, -0.2, 0);
      sprocket.rotation.x = 0.35;
      world.add(sprocket);

      // wheel rim behind it
      const wheel = new THREE.Group();
      const tyre = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.55, 24, 96), rubber);
      wheel.add(tyre);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.2, 20, 96), metal);
      wheel.add(rim);
      const hub2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.5, 24), metal);
      hub2.rotation.x = Math.PI / 2;
      wheel.add(hub2);
      for (let i = 0; i < 8; i++) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.3, 8), metal);
        s.rotation.z = (i / 8) * Math.PI;
        wheel.add(s);
      }
      wheel.position.set(-3.4, 1.4, -2.5);
      wheel.rotation.y = 0.5;
      wheel.scale.setScalar(0.92);
      world.add(wheel);

      // brake disc floating left-bottom
      const disc = new THREE.Group();
      const discPlate = new THREE.Mesh(gearGeometry(0, 1.7, 1.05, 0.22), new THREE.MeshStandardMaterial({ color: 0xB9C2D2, metalness: 1, roughness: 0.22 }));
      disc.add(discPlate);
      const discRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.1, 14, 64), metalDark);
      disc.add(discRing);
      disc.position.set(-2.4, -2.1, 1.6);
      disc.rotation.set(0.6, -0.4, 0);
      world.add(disc);

      // lights — rim-lit studio look
      scene.add(new THREE.AmbientLight(0x46536B, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 1.15);
      key.position.set(6, 7, 6);
      scene.add(key);
      const redLight = new THREE.PointLight(0xE4002B, 2.2, 30);
      redLight.position.set(-5, -2, 5);
      scene.add(redLight);
      const cyanLight = new THREE.PointLight(0x22D3EE, 1.9, 30);
      cyanLight.position.set(5, 4, 3);
      scene.add(cyanLight);
      const backLight = new THREE.DirectionalLight(0x88A0FF, 0.6);
      backLight.position.set(-4, 2, -6);
      scene.add(backLight);

      function resize() {
        const w = wrap.clientWidth || window.innerWidth;
        const h = wrap.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resize();
      window.addEventListener('resize', resize);

      // mouse parallax
      const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      window.addEventListener('mousemove', (e) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5);
        mouse.ty = (e.clientY / window.innerHeight - 0.5);
      }, { passive: true });

      let visible = true;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.02 }).observe($('.hero'));
      }

      const clock = new THREE.Clock();
      function loop() {
        requestAnimationFrame(loop);
        if (!visible) return;
        const t = clock.getElapsedTime();
        sprocket.rotation.z = t * 0.55;
        wheel.rotation.z = -t * 0.35;
        disc.rotation.z = t * 0.8;
        world.position.y = Math.sin(t * 0.7) * 0.16;
        mouse.x += (mouse.tx - mouse.x) * 0.05;
        mouse.y += (mouse.ty - mouse.y) * 0.05;
        world.rotation.y = mouse.x * 0.5;
        world.rotation.x = mouse.y * 0.32;
        camera.position.x = mouse.x * 1.4;
        camera.position.y = -mouse.y * 1.0;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      }
      loop();
      document.body.classList.add('hero3d-on');
    } catch (err) {
      console.warn('3D hero disabled:', err);
      document.body.classList.remove('hero3d-on');
    }
  }

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    saveCart();
    bindFilters();
    bindCart();
    bindChrome();
    initReveal();
    initCounters();
    $('#checkoutForm').addEventListener('submit', submitOrder);
    loadChips();
    loadProducts();
    renderCart();
    initHero3D();

    // stats data (API-powered small refresh of the counter area is intentionally avoided —
    // stats are static marketing numbers, /api/stats powers the admin page)
    fetch('/api/stats').then((r) => r.json()).then((s) => {
      document.title = `MotoGari — Honda CG70 & CG125 Spare Parts in Pakistan (${s.products} parts)`;
    }).catch(() => {});
  });
})();
