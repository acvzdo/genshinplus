(function () {
  'use strict';

  const API_BASE = 'https://genshin-db-api.vercel.app/api/v5';
  const RESULT_LANGUAGE = 'Spanish';
  const QUERY_LANGUAGES = 'English,Spanish';
  const TIMEOUT_MS = 12000;

  const CDN_BASES = [
    'https://enka.network/ui/',
    'https://gi.yatta.moe/assets/UI/'
  ];

  const PLACEHOLDER = './imagenes/placeholder.png';

  const cache = new Map();

  let lastError = null;
  function fail(url, reason) {
    lastError = { url, reason };
    try { console.warn('[genshin-db] ' + reason + ' -> ' + url); } catch (e) { }
    const err = new Error(reason);
    err.url = url;
    return err;
  }

  function fetchJson(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    return fetch(url, { signal: ctrl.signal })
      .then(
        r => {
          if (r.status === 404) return null;
          if (!r.ok) throw fail(url, 'HTTP ' + r.status);
          return r.json().catch(() => { throw fail(url, 'respuesta no válida'); });
        },
        err => { throw fail(url, err && err.name === 'AbortError' ? 'tiempo de espera agotado' : 'sin conexión o bloqueado por CORS'); }
      )
      .finally(() => clearTimeout(timer));
  }

  const LANG_VARIANTS = [
    { queryLanguages: 'English,Spanish', resultLanguage: 'Spanish' },
    { queryLanguages: 'english,spanish', resultLanguage: 'spanish' }
  ];
  let langIdx = 0;

  async function getJson(folder, params) {
    let err = null;
    for (let n = 0; n < LANG_VARIANTS.length; n++) {
      const i = (langIdx + n) % LANG_VARIANTS.length;
      const qs = new URLSearchParams(Object.assign({}, LANG_VARIANTS[i], params));
      try {
        const r = await fetchJson(`${API_BASE}/${folder}?${qs.toString()}`);
        langIdx = i;
        return r;
      } catch (e) {
        err = e;
        if (!/^HTTP/.test(e.message)) break;
      }
    }
    throw err;
  }

  function apiGet(folder, query, extra) {
    const key = folder + '|' + String(query) + '|' + JSON.stringify(extra || {});
    if (cache.has(key)) return cache.get(key);
    const p = getJson(folder, Object.assign({ query: String(query) }, extra || {})).then(d => {
      if (d === null || d === undefined || d === false) return null;
      if (Array.isArray(d)) return d.length ? d[0] : null;
      return typeof d === 'object' && Object.keys(d).length ? d : null;
    });
    cache.set(key, p);
    p.catch(() => cache.delete(key));
    return p;
  }

  const apiRaw = (folder, params) => getJson(folder, params || {});

  const getCharacter = idOrName => apiGet('characters', idOrName);
  const getMaterial = (idOrName, extra) => apiGet('materials', idOrName, extra);
  const getWeapon = name => apiGet('weapons', name);
  const getEnemy = name => apiGet('enemies', name);

  async function getAll(folder, onProgress, opts) {
    const allowPerName = !(opts && opts.allowPerName === false);
    try {
      const r = await apiRaw(folder, {
        query: 'names', matchCategories: 'true', verboseCategories: 'true'
      });
      if (Array.isArray(r) && r.length > 20 && r[0] && typeof r[0] === 'object' && r[0].name) {
        if (onProgress) onProgress(r.length, r.length);
        return r;
      }
    } catch (e) { }
    if (!allowPerName) throw new Error('La API no permite descargar todo en una petición');

    const names = await apiRaw(folder, { query: 'names', matchCategories: 'true' });
    if (!Array.isArray(names) || !names.length) throw new Error('La API no devolvió la lista');

    const out = [];
    let next = 0, done = 0;
    async function worker() {
      while (next < names.length) {
        const n = names[next++];
        try {
          const d = await apiGet(folder, n);
          if (d && d.name) out.push(d);
        } catch (e) { }
        done++;
        if (onProgress) onProgress(done, names.length);
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker));
    if (!out.length) throw new Error('No se pudo descargar ningún elemento');
    return out;
  }
  const getAllCharacters = onProgress => getAll('characters', onProgress);
  const getTalents = name => apiGet('talents', name);

  function sumCosts(costs, keys, mult) {
    const m = new Map();
    keys.forEach((k, idx) => {
      ((costs && costs[k]) || []).forEach(it => {
        const key = String(it.id);
        const t = m.get(key) || { id: it.id, name: it.name, count: 0, first: idx };
        t.count += (Number(it.count) || 0) * (mult || 1);
        m.set(key, t);
      });
    });
    return Array.from(m.values());
  }

  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  function normElement(v) {
    const s = String(v || '').toLowerCase();
    if (/pyro|fire|fuego/.test(s)) return 'Pyro';
    if (/hydro|water|agua/.test(s)) return 'Hydro';
    if (/electro|elec/.test(s)) return 'Electro';
    if (/cryo|ice|hielo/.test(s)) return 'Cryo';
    if (/anemo|wind|viento/.test(s)) return 'Anemo';
    if (/geo|rock|roca/.test(s)) return 'Geo';
    if (/dendro|grass|planta/.test(s)) return 'Dendro';
    return '';
  }
  function normWeapon(v) {
    const s = String(v || '').toLowerCase();
    if (/claymore|mandoble|greatsword/.test(s)) return 'Mandoble';
    if (/sword|espada/.test(s)) return 'Espada';
    if (/pole|lanza|asta/.test(s)) return 'Lanza';
    if (/bow|arco/.test(s)) return 'Arco';
    if (/catalyst|catalizador/.test(s)) return 'Catalizador';
    return '';
  }
  function normStars(v) {
    const n = Number(v);
    if (n === 4 || n === 5) return n;
    const s = String(v || '').toUpperCase();
    if (s.includes('ORANGE')) return 5;
    if (s.includes('PURPLE')) return 4;
    return 0;
  }

  function toRosterEntry(d) {
    if (!d || !d.name) return null;
    const icon = (d.images && d.images.filename_icon) || '';
    if (/^UI_AvatarIcon_Player/i.test(icon)) return null;
    const raw = icon.replace(/^UI_AvatarIcon_/i, '');
    return {
      id: raw ? slug(raw) : 'c' + d.id,
      apiId: d.id,
      name: d.name,
      element: normElement(d.elementText || d.elementType || d.element),
      weapon: normWeapon(d.weaponText || d.weaponType),
      stars: normStars(d.rarity),
      version: d.version ? String(d.version) : '',
      icon
    };
  }

  let bases = CDN_BASES.slice();
  const PREF_KEY = 'gc_cdn_pref';
  try {
    const pref = localStorage.getItem(PREF_KEY);
    if (pref && bases.includes(pref)) bases = [pref].concat(bases.filter(b => b !== pref));
  } catch (e) { }

  const cdnReady = new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 4000);
    CDN_BASES.forEach(b => {
      const im = new Image();
      im.onload = () => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        bases = [b].concat(CDN_BASES.filter(x => x !== b));
        try { localStorage.setItem(PREF_KEY, b); } catch (e) { }
        resolve(b);
      };
      im.src = b + 'UI_ItemIcon_202.png';
    });
  });

  [API_BASE, bases[0]].forEach(u => {
    try {
      const l = document.createElement('link');
      l.rel = 'preconnect'; l.href = new URL(u).origin;
      document.head.appendChild(l);
    } catch (e) { }
  });

  const cdnUrls = filename => bases.map(b => `${b}${filename}.png`);

  function iconSources(filename) { return filename ? cdnUrls(filename) : []; }

  function monsterIconSources(filename, images) {
    const out = [];
    if (images) Object.keys(images).forEach(k => {
      if (typeof images[k] === 'string' && /^https?:\/\//.test(images[k])) out.push(images[k]);
    });
    if (filename) {
      out.push(`https://gi.yatta.moe/assets/UI/monster/${filename}.png`);
      out.push(`https://enka.network/ui/${filename}.png`);
      out.push(`https://gi.yatta.moe/assets/UI/${filename}.png`);
    }
    return out;
  }

  function characterIconSources(data) {
    const out = [];
    const img = (data && data.images) || {};
    if (img.filename_icon) out.push(...cdnUrls(img.filename_icon));
    ['mihoyo_icon', 'hoyowiki_icon'].forEach(k => {
      if (typeof img[k] === 'string' && /^https?:\/\//.test(img[k])) out.push(img[k]);
    });
    return out;
  }

  function materialIconSources(id, data) {
    const out = [];
    const img = (data && data.images) || {};
    if (img.filename_icon) out.push(...cdnUrls(img.filename_icon));
    out.push(...cdnUrls(`UI_ItemIcon_${id}`));
    const own = { 990002: 'bana', 990003: 'bdanica', 990004: 'b2ana' }[id];
    if (own) out.push(`includes/images/${own}.png`);
    return out;
  }

  const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  function imgHtml(sources, cls, alt, w, h) {
    const list = (Array.isArray(sources) ? sources : [sources]).filter(Boolean);
    const first = list[0] || PLACEHOLDER;
    const rest = JSON.stringify(list.slice(1));
    return `<img src="${esc(first)}" data-srcs="${esc(rest)}" class="${cls}" alt="${esc(alt)}" width="${w}" height="${h}" loading="lazy" decoding="async" onerror="gcImgError(this)">`;
  }

  window.gcImgError = function (el) {
    let rest = [];
    try { rest = JSON.parse(el.dataset.srcs || '[]'); } catch (e) { rest = []; }
    if (rest.length) {
      el.dataset.srcs = JSON.stringify(rest.slice(1));
      el.src = rest[0];
      return;
    }
    if (!el.dataset.phTried && !window.__gcPlaceholderMissing) {
      el.dataset.phTried = '1';
      el.src = PLACEHOLDER;
      return;
    }
    if (el.dataset.phTried) window.__gcPlaceholderMissing = true;
    el.onerror = null;
    el.src = typeof window.ph === 'function' ? window.ph(el.width || 64, el.height || 64, 'IMG') : '';
  };

  function classify(id) {
    const n = Number(id);
    if (n === 202) return 'mora';
    if (n >= 104100 && n < 104200) return 'gem';
    if (n >= 113000 && n < 114000) return 'boss';
    if (n >= 112000 && n < 113000) return 'common';
    return 'local';
  }

  function ascensionPlan(data, cur, tgt, caps) {
    const costs = data && data.costs;
    if (!costs) return null;
    const keys = [];
    caps.forEach((cap, i) => { if (cap >= cur && cap < tgt) keys.push('ascend' + (i + 1)); });
    const order = { mora: 0, gem: 1, boss: 2, common: 3, local: 4 };
    return sumCosts(costs, keys)
      .map(t => ({ id: t.id, name: t.name, count: t.count, group: classify(t.id) }))
      .sort((a, b) => order[a.group] - order[b.group] || a.id - b.id);
  }

  window.GenshinAPI = {
    API_BASE, PLACEHOLDER, cdnReady,
    getCharacter, getMaterial, getWeapon, getEnemy, getTalents, getAll, getAllCharacters, toRosterEntry,
    iconSources, monsterIconSources, characterIconSources, materialIconSources,
    imgHtml, ascensionPlan, sumCosts, classify, normWeapon, normElement,
    getLastError: () => lastError
  };
})();
