
window.ph = function (w, h, t) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
    `<rect width='100%' height='100%' fill='#EFEFEF'/>` +
    `<text x='50%' y='50%' fill='#6E6E73' font-family='sans-serif' font-size='${Math.max(10, Math.round(Math.min(w, h) / 4))}' ` +
    `text-anchor='middle' dominant-baseline='middle'>${t || 'IMG'}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

(function () {
  'use strict';

  const ELEMENTS = ['Pyro', 'Hydro', 'Electro', 'Cryo', 'Anemo', 'Geo', 'Dendro'];
  const WEAPONS = ['Espada', 'Mandoble', 'Lanza', 'Arco', 'Catalizador'];

  const CHARACTERS = [
    { id: 'diluc', name: 'Diluc', element: 'Pyro', weapon: 'Mandoble', stars: 5 },
    { id: 'jean', name: 'Jean', element: 'Anemo', weapon: 'Espada', stars: 5 },
    { id: 'keqing', name: 'Keqing', element: 'Electro', weapon: 'Espada', stars: 5 },
    { id: 'xiangling', name: 'Xiangling', element: 'Pyro', weapon: 'Lanza', stars: 4 },
    { id: 'kaeya', name: 'Kaeya', element: 'Cryo', weapon: 'Espada', stars: 4 },
    { id: 'zhongli', name: 'Zhongli', element: 'Geo', weapon: 'Lanza', stars: 5 },
    { id: 'raiden', name: 'Raiden Shogun', element: 'Electro', weapon: 'Lanza', stars: 5 },
    { id: 'nahida', name: 'Nahida', element: 'Dendro', weapon: 'Catalizador', stars: 5 },
    { id: 'furina', name: 'Furina', element: 'Hydro', weapon: 'Espada', stars: 5 },
    { id: 'xingqiu', name: 'Xingqiu', element: 'Hydro', weapon: 'Espada', stars: 4 },
    { id: 'venti', name: 'Venti', element: 'Anemo', weapon: 'Arco', stars: 5 },
    { id: 'ganyu', name: 'Ganyu', element: 'Cryo', weapon: 'Arco', stars: 5 }
  ];

  const EXTRAS = [
    { id: 'anastasya', name: 'Anastasya', aliases: ['Tsaritsa', 'La Zarina', 'Zarina'], element: 'Cryo', weapon: 'Arco', stars: 5, version: '7.3', icon: 'UI_AvatarIcon_Tsaritsa', altIcons: ['UI_AvatarIcon_Anastasya', 'UI_AvatarIcon_Anastasia', 'UI_AvatarIcon_Anastasiya', 'UI_AvatarIcon_Tsaritsa_Card'] },
    { id: 'danica', name: 'Danica', aliases: [], element: 'Electro', weapon: 'Mandoble', stars: 5, version: '7.3', icon: 'UI_AvatarIcon_Danica' }
  ];
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  function withExtras(list) {
    const have = new Set();
    list.forEach(c => { have.add(norm(c.id)); have.add(norm(c.name)); });
    const add = EXTRAS.filter(x => ![x.id, x.name, ...x.aliases].some(n => have.has(norm(n))));
    return list.concat(add);
  }

  const LEAK = {
    anastasya: { book: [104365, 'del amor'], gem: [104161, 'Jade shivada'], local: [101275, 'Flor frigifeérica'], mob: [[112149, 'Semilla quimérica'], [112150, 'Célula quimérica simbiótica'], [112151, 'Organismo quimérico primigenio']], boss: [990002, 'Ancla estabilizadora rota', true], weekly: [990004, '???', true] },
    danica: { book: [104371, 'de la gloria'], gem: [104141, 'Amatista vajrada'], local: [101276, 'Hierbalana'], mob: [[112146, 'Lumiesquirla etérea'], [112147, 'Quebracristal etéreo'], [112148, 'Petreoescama etérea']], boss: [990003, '???', true], weekly: [113088, 'Rama marchita retorcida', true] }
  };
  const localBoss = { 990002: 'Anclamareas', 990003: '???', 990004: '???' };
  const SHORT = { anastasya: 'ana', danica: 'danica' };
  function leakData(c) {
    const L = LEAK[c.id];
    if (!L) return null;
    const m = (id, name, count) => ({ id, name, count });
    const gems = [m(L.gem[0], 'Esquirla de ' + L.gem[1].toLowerCase()), m(L.gem[0] + 1, 'Fragmento de ' + L.gem[1].toLowerCase()), m(L.gem[0] + 2, 'Trozo de ' + L.gem[1].toLowerCase()), m(L.gem[0] + 3, L.gem[1] + ' (gema)')];
    const g = (i, n) => Object.assign({}, gems[i], { count: n });
    const local = (n) => m(L.local[0], L.local[1], n);
    const boss = (n) => m(L.boss[0], L.boss[1] + (L.boss[2] ? '' : ' (por confirmar)'), n);
    const mob = (t, n) => m(L.mob[t - 1][0], L.mob[t - 1][1], n);
    const mora = n => m(202, 'Mora', n);
    const book = (t, n) => m(L.book[0] + t - 1, ['Enseñanzas', 'Guía', 'Filosofía'][t - 1] + ' ' + L.book[1], n);
    const weekly = n => m(L.weekly[0], L.weekly[1] + (L.weekly[2] ? '' : ' (por confirmar)'), n);
    const crown = () => m(104319, 'Corona de la sabiduría', 1);
    const ascend = {
      ascend1: [mora(20000), g(0, 1), mob(1, 3), local(3)],
      ascend2: [mora(40000), g(1, 3), mob(1, 15), local(10), boss(2)],
      ascend3: [mora(60000), g(1, 6), mob(2, 12), local(20), boss(4)],
      ascend4: [mora(80000), g(2, 3), mob(2, 18), local(30), boss(8)],
      ascend5: [mora(100000), g(2, 6), mob(3, 12), local(45), boss(12)],
      ascend6: [mora(120000), g(3, 6), mob(3, 24), local(60), boss(20)]
    };
    const lvl = {
      lvl2: [mora(12500), mob(1, 6), book(1, 3)],
      lvl3: [mora(17500), mob(2, 3), book(2, 2)],
      lvl4: [mora(25000), mob(2, 4), book(2, 4)],
      lvl5: [mora(30000), mob(2, 6), book(2, 6)],
      lvl6: [mora(37500), mob(2, 9), book(2, 9)],
      lvl7: [mora(120000), mob(3, 4), book(3, 4), weekly(1)],
      lvl8: [mora(260000), mob(3, 6), book(3, 6), weekly(1)],
      lvl9: [mora(450000), mob(3, 9), book(3, 12), weekly(2)],
      lvl10: [mora(700000), mob(3, 12), book(3, 16), weekly(2), crown()]
    };
    return { char: { name: c.name, costs: ascend, provisional: true }, tal: { costs: lvl, provisional: true } };
  }
  CHARACTERS.splice(0, CHARACTERS.length, ...withExtras(CHARACTERS));

  const ID_ALIAS = { shougun: 'raiden', qin: 'jean' };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const fmt = n => n.toLocaleString('es-PE');
  const byId = id => CHARACTERS.find(c => c.id === id);
  const byName = (a, b) => a.name.localeCompare(b.name, 'es');

  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
  };

  const API = window.GenshinAPI;
  const apiData = {};

  function img(src, cls, alt, w, h) {
    return API.imgHtml(src, cls, alt, w, h);
  }
  function charSources(c) {
    const fromApi = apiData[c.id] ? API.characterIconSources(apiData[c.id]) : API.iconSources(c.icon);
    const alt = (c.altIcons || []).flatMap(i => API.iconSources(i));
    return [...(c.localIcon ? [c.localIcon] : []), ...fromApi, ...alt];
  }
  const planIcon = p => {
    const c = byId(p.id);
    const local = [`includes/images/${p.id}.webp`, `includes/images/chars/${p.id}.png`];
    return [...(c ? charSources(c) : []), ...API.iconSources(p.icon), ...local];
  };
  const charImg = (c, cls, size) => img(charSources(c), cls, c.name, size, size);

  const ROSTER_KEY = 'gc_roster_v2';
  const ROSTER_TTL = 7 * 24 * 3600 * 1000;
  const roster = { started: false, phase: 'idle', done: 0, total: 0 };
  const rosterListeners = [];
  const statusListeners = [];
  const onRoster = fn => rosterListeners.push(fn);
  const onRosterStatus = fn => statusListeners.push(fn);
  const notifyStatus = () => statusListeners.forEach(fn => fn(roster));

  function fromApi(d) {
    const e = API.toRosterEntry(d);
    if (!e) return null;
    e.id = ID_ALIAS[e.id] || e.id;
    return e;
  }
  const slim = c => ({ id: c.id, apiId: c.apiId, name: c.name, element: c.element, weapon: c.weapon, stars: c.stars, icon: c.icon, version: c.version || '' });

  function applyList(list) {
    CHARACTERS.splice(0, CHARACTERS.length, ...withExtras(list).sort(byName));
    rosterListeners.forEach(fn => fn());
  }

  function loadRoster() {
    if (roster.started) return;
    roster.started = true;
    const cached = store.get(ROSTER_KEY, null);
    const hasCache = !!(cached && Array.isArray(cached.list) && cached.list.length);
    if (hasCache) applyList(cached.list);
    if (hasCache && Date.now() - cached.t < ROSTER_TTL) { roster.phase = 'ready'; notifyStatus(); return; }

    roster.phase = 'loading'; notifyStatus();
    API.getAllCharacters((done, total) => { roster.done = done; roster.total = total; notifyStatus(); })
      .then(arr => {
        const seen = new Set(), list = [];
        arr.forEach(d => {
          const c = fromApi(d);
          if (!c || seen.has(c.id)) return;
          seen.add(c.id);
          apiData[c.id] = d;
          list.push(c);
        });
        if (!list.length) throw new Error('lista vacía');
        store.set(ROSTER_KEY, { t: Date.now(), list: list.map(slim) });
        applyList(list);
        roster.phase = 'ready'; notifyStatus();
      })
      .catch(() => { roster.phase = hasCache ? 'ready' : 'error'; notifyStatus(); });
  }

  const THEME_KEY = 'gc_theme';
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    document.documentElement.setAttribute('data-bs-theme', t);
  }
  (function () {
    let t = store.get(THEME_KEY, null);
    if (t !== 'dark' && t !== 'light') t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    applyTheme(t);
  })();
  function toggleTheme() {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(t); store.set(THEME_KEY, t);
    const b = document.getElementById('theme-toggle');
    if (b) { b.setAttribute('aria-pressed', String(t === 'dark')); b.innerHTML = themeIcon(t); b.title = t === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'; }
  }
  const themeIcon = t => t === 'dark'
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>';

  function initNav() {
    const nav = document.querySelector('nav.navbar');
    if (!nav) return;
    let here = (location.pathname.split('/').pop() || 'index.html');
    if (here === 'detalle.html') here = 'personajes.html';
    const ic = d => `<svg class="nav-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const links = [
      ['index.html', 'Inicio', ic('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>')],
      ['personajes.html', 'Personajes', ic('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14c2.6 0 4.5 1.8 4.5 4.6"/>')],
      ['hoy.html', 'Hoy', ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>')],
      ['tracker.html', 'Tracker', ic('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 9l2 2 3.5-4"/><path d="M8 16h8"/>')]
    ];
    let n = 0;
    try { n = window.Plan ? window.Plan.tracked().length : 0; } catch (e) { n = 0; }
    nav.innerHTML = `
      <div class="container nav-inner">
        <a class="navbar-brand" href="index.html" aria-label="Genshin +, inicio">
          <span class="brand-mark" aria-hidden="true"><img src="includes/images/ayaka.png" alt="" width="34" height="34" class="brand-img"></span>
          <span class="brand-text">Genshin <b>+</b></span>
        </a>
        <div class="navbar-nav nav-links" role="navigation" aria-label="Principal">
          ${links.map(([href, label, icon]) => `<a class="nav-link ${href === here ? 'active' : ''}" href="${href}" ${href === here ? 'aria-current="page"' : ''}>${icon}<span class="nav-label">${label}</span>${href === 'tracker.html' && n ? `<span class="nav-count" aria-label="${n} en seguimiento">${n}</span>` : ''}</a>`).join('')}
        </div>
        <button type="button" class="theme-btn" id="theme-toggle" aria-pressed="${document.documentElement.dataset.theme === 'dark'}" title="Cambiar tema">${themeIcon(document.documentElement.dataset.theme)}</button>
      </div>`;
    const tb = document.getElementById('theme-toggle');
    if (tb) tb.addEventListener('click', toggleTheme);
  }

  function initIndex() {
    const goals = $('#goals-list');
    const plans = window.Plan ? window.Plan.tracked() : [];
    if (!plans.length) {
      goals.innerHTML = '<p class="muted mb-0">Aún no hay personajes en el tracker. Elige uno en el catálogo, arma su plan y envíalo.</p>';
    } else {
      goals.innerHTML = plans.slice(0, 4).map(p => {
        const pr = window.Plan.progress(p);
        return `<a class="goal-row" href="tracker.html">
          ${img(planIcon(p), 'goal-img', p.name, 36, 36)}
          <div class="flex-grow-1"><div class="fw-semibold">${esc(p.name)}</div>
          <div class="progress mt-1" role="progressbar" aria-label="Progreso de ${esc(p.name)}" aria-valuenow="${pr.pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${pr.pct}%"></div></div></div>
          <span class="muted small">${pr.pct}%</span></a>`;
      }).join('');
    }
    $('#goals-count').textContent = plans.length;

    const notes = $('#daily-notes');
    notes.value = store.get('gc_notes', '');
    let t;
    notes.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => store.set('gc_notes', notes.value), 300); });

    const today = new Date().toISOString().slice(0, 10);
    let daily = store.get('gc_daily', {});
    if (daily.date !== today) daily = { date: today, items: {} };
    $$('.daily-check').forEach(cb => {
      cb.checked = !!daily.items[cb.dataset.key];
      cb.addEventListener('change', () => { daily.items[cb.dataset.key] = cb.checked; store.set('gc_daily', daily); });
    });
  }

  function initCatalog() {
    const f = { q: '', element: '', weapon: '', stars: '', fav: false, sort: 'name' };
    const FAV_KEY = 'gc_favs';
    let favs = new Set(store.get(FAV_KEY, []));
    const vnum = v => { const m = String(v || '').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; };
    const grid = $('#catalog');
    const count = $('#result-count');
    const status = $('#catalog-status');

    function chips(containerId, values, key, fmtLabel) {
      const box = $(containerId);
      box.innerHTML = [['', 'Todos'], ...values.map(v => [String(v), fmtLabel ? fmtLabel(v) : v])]
        .map(([v, l]) => `<button type="button" class="chip" data-v="${esc(v)}" aria-pressed="${v === ''}">${esc(l)}</button>`).join('');
      box.addEventListener('click', e => {
        const b = e.target.closest('.chip'); if (!b) return;
        f[key] = b.dataset.v;
        $$('.chip', box).forEach(x => x.setAttribute('aria-pressed', x === b));
        render();
      });
    }
    chips('#f-element', ELEMENTS, 'element');
    chips('#f-weapon', WEAPONS, 'weapon');
    chips('#f-stars', [5, 4], 'stars', v => v + ' estrellas');

    function render() {
      const q = f.q.trim().toLowerCase();
      const plans = window.Plan ? window.Plan.all() : {};
      const list = CHARACTERS.filter(c =>
        (!q || c.name.toLowerCase().includes(q)) &&
        (!f.element || c.element === f.element) &&
        (!f.weapon || c.weapon === f.weapon) &&
        (!f.stars || String(c.stars) === f.stars) &&
        (!f.fav || favs.has(c.id)));
      const maxV = Math.max(0, ...CHARACTERS.map(c => vnum(c.version)));
      const cmp = {
        name: (a, b) => a.name.localeCompare(b.name, 'es'),
        stars: (a, b) => (b.stars || 0) - (a.stars || 0) || a.name.localeCompare(b.name, 'es'),
        element: (a, b) => (a.element || '').localeCompare(b.element || '', 'es') || a.name.localeCompare(b.name, 'es'),
        version: (a, b) => vnum(b.version) - vnum(a.version) || a.name.localeCompare(b.name, 'es')
      }[f.sort] || ((a, b) => 0);
      list.sort((a, b) => (favs.has(b.id) - favs.has(a.id)) || cmp(a, b));
      count.textContent = `${list.length} personaje${list.length === 1 ? '' : 's'}`;
      grid.innerHTML = list.length ? list.map(c => `
 <div class="char-wrap">
        <button type="button" class="fav-btn" data-fav="${esc(c.id)}" aria-pressed="${favs.has(c.id)}" aria-label="${favs.has(c.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}: ${esc(c.name)}">${favs.has(c.id) ? '♥' : '♡'}</button>
        <a class="char-card el-${c.element || 'none'}" data-char="${esc(c.id)}" href="detalle.html?char=${encodeURIComponent(c.id)}" aria-label="Ver detalles de ${esc(c.name)}">
          ${maxV && vnum(c.version) === maxV ? '<span class="new-badge">Nuevo</span>' : ''}
          ${charImg(c, 'char-img-slot', 96)}
          <div class="name">${esc(c.name)}</div>
          <div class="el-text">${esc(c.element || '')}</div>
          ${c.stars ? `<div class="char-stars" role="img" aria-label="${c.stars} estrellas">${'✦'.repeat(Number(c.stars))}</div>` : ''}
          <div class="d-flex gap-1 mt-2 flex-wrap justify-content-center">
            ${c.weapon ? `<span class="badge-soft">${esc(c.weapon)}</span>` : ''}
            ${c.stars ? `<span class="badge-soft badge-stars">${c.stars} estrellas</span>` : ''}
            ${plans[c.id] && plans[c.id].tracked ? '<span class="badge-soft badge-ok">En el tracker</span>' : ''}
          </div></a></div>`).join('')
        : '<div class="empty-state">No hay personajes que coincidan con tu búsqueda.</div>';
    }

    function updateStatus(r) {
      if (r.phase === 'loading') status.textContent = r.total ? `Cargando catálogo completo... ${r.done}/${r.total}` : 'Cargando catálogo completo...';
      else if (r.phase === 'error') status.textContent = 'No se pudo cargar el catálogo completo; se muestran los personajes locales.';
      else status.textContent = '';
    }

    $('#search').addEventListener('input', e => { f.q = e.target.value; render(); });
    $('#sort').addEventListener('change', e => { f.sort = e.target.value; render(); });
    $('#f-fav').addEventListener('click', e => {
      f.fav = !f.fav;
      e.currentTarget.setAttribute('aria-pressed', String(f.fav));
      render();
    });
    grid.addEventListener('click', e => {
      const b = e.target.closest('.fav-btn');
      if (!b) return;
      e.preventDefault();
      const id = b.dataset.fav;
      if (favs.has(id)) favs.delete(id); else favs.add(id);
      store.set(FAV_KEY, Array.from(favs));
      render();
    });
    onRoster(render);
    onRosterStatus(updateStatus);
    updateStatus(roster);
    Promise.race([API.cdnReady, new Promise(r => setTimeout(r, 1200))]).then(render);
  }

  async function fetchChar(c) {
    let firstErr = null;
    for (const q of [c.name, ...(c.aliases || (byId(c.id) && byId(c.id).aliases) || [])]) {
      try { const d = await API.getCharacter(q); if (d) return d; } catch (e) { firstErr = firstErr || e; }
    }
    if (c.apiId) {
      try { const d = await API.getCharacter(c.apiId); if (d) return d; } catch (e) { firstErr = firstErr || e; }
    }
    if (firstErr) throw firstErr;
    return null;
  }

  function ensureData(id) {
    const c = byId(id);
    if (!c) return Promise.resolve(null);
    if (apiData[id]) return Promise.resolve(apiData[id]);
    return fetchChar(c).then(d => { if (d && d.costs) apiData[id] = d; return d; });
  }

  function apiErrorHtml(prefix, e) {
    const reason = (e && e.message) || 'error desconocido';
    const link = e && e.url ? `; <a href="${esc(e.url)}" target="_blank" rel="noopener">probar esta URL</a>` : '';
    return `${esc(prefix)} <span class="small">(${esc(reason)}${link})</span>`;
  }

  function registerCharacter(d) {
    const c = fromApi(d);
    if (!c) return null;
    if (!byId(c.id)) CHARACTERS.push(c);
    apiData[c.id] = d;
    return byId(c.id);
  }

  const ui = {
    async confirm({ title, text, ok = 'Aceptar', cancel = 'Cancelar', icon = 'question', danger = false, image = '' }) {
      if (!window.Swal) return window.confirm(title + (text ? '\n' + text : ''));
      const ok_ = image && await new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = image; });
      const pic = ok_ ? { imageUrl: image, imageWidth: 110, imageHeight: 110, imageAlt: '' } : { icon };
      const r = await Swal.fire({ title, text, ...pic, showCancelButton: true, confirmButtonText: ok, cancelButtonText: cancel,
        confirmButtonColor: danger ? '#D32F2F' : '#1976D2', cancelButtonColor: '#6B7280', reverseButtons: true, focusCancel: danger });
      return r.isConfirmed;
    },
    toast(title, icon = 'success') {
      if (!window.Swal) return;
      Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 2200, timerProgressBar: true });
    }
  };
  window.GC = { SHORT, localBoss, planIcon, leakData, ui, byId, onRoster, apiData, charSources, ensureData, registerCharacter, apiErrorHtml, esc, fmt, img, store };

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.site-foot')) {
      const ft = document.createElement('footer');
      ft.className = 'site-foot';
      ft.textContent = 'Proyecto de fans sin fines de lucro. No está afiliado ni respaldado por HoYoverse. Genshin Impact y sus imágenes son de HoYoverse.';
      document.body.appendChild(ft);
    }
    loadRoster();
    initNav();
    const page = document.body.dataset.page;
    if (page === 'index') initIndex();
    if (page === 'personajes') initCatalog();
  });
})();
