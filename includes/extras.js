(function () {
  'use strict';
  const Plan = window.Plan;

  const SEC_ORDER = ['mora', 'xp', 'asc', 'boss', 'weekly', 'tal', 'mobs', 'crown'];
  const SEC_LABEL = {
    mora: 'Mora', xp: 'Libros de EXP', asc: 'Ascensión del personaje', boss: 'Jefe de mundo',
    weekly: 'Jefe semanal', tal: 'Libros de talento', mobs: 'Materiales de enemigos (sin resina)', crown: 'Corona de la sabiduría'
  };
  const normName = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const isBook = n => /^(ensenanzas?|guia|filosofia|teachings?|guide|philosophy)\b/.test(normName(n.name)) || (Number(n.id) >= 104301 && Number(n.id) <= 104399);
  const remaining = (plan, n) => Math.ceil(n.count * (1 - Plan.frac(plan, n)));

  function aggregate(plans) {
    const m = new Map();
    plans.forEach(p => (p.needs || []).forEach(n => {
      const r = remaining(p, n);
      if (r <= 0 || n.sec === 'wp') return;
      const sec = n.sec === 'tal' && !isBook(n) ? 'mobs' : n.sec;
      const key = sec + '|' + n.id;
      const it = m.get(key) || { sec, id: n.id, name: n.name, count: 0, who: [] };
      it.count += r;
      it.who.push({ id: p.id, name: p.name, count: r });
      m.set(key, it);
    }));
    return Array.from(m.values()).sort((a, b) =>
      SEC_ORDER.indexOf(a.sec) - SEC_ORDER.indexOf(b.sec) || b.count - a.count);
  }

  const RESIN_SVG = `<svg class="resin-ico" viewBox="0 0 24 24" width="SZ" height="SZ" role="img" aria-label="Resina"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8FD3FF"/><stop offset="1" stop-color="#3B82F6"/></linearGradient></defs><circle cx="12" cy="12" r="11" fill="#1E3A8A"/><path d="M15.5 4.8A8 8 0 1 0 19.2 15 6.6 6.6 0 0 1 15.5 4.8z" fill="url(#rg)"/></svg>`;
  window.__resinFallback = img => { const s = document.createElement('span'); s.innerHTML = RESIN_SVG.replace(/SZ/g, img.width || 18); img.replaceWith(s.firstChild); };
  const resinIcon = (s = 18) => `<img class="resin-ico" src="includes/images/resina.webp" width="${s}" height="${s}" alt="Resina" onerror="if(!this.dataset.t){this.dataset.t=1;this.src='includes/images/resina.png'}else{window.__resinFallback(this)}">`;

  const RESIN = {
    perDay: 180,
    bookRun: 20,
    bookEqPerRun: 9,
    weeklyRun: 30,
    weeklyDropsPerRun: 2,
    bossRun: 40,
    bossDropsPerRun: 2.5
  };
  const bookTier = n => {
    const t = String(n.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/^(guia|guide)/.test(t)) return 1;
    if (/^(filosofia|philosophy)/.test(t)) return 2;
    if (/^(ensenanza|teaching)/.test(t)) return 0;
    return ((Number(n.id) - 104301) % 3 + 3) % 3;
  };
  const BOOK_EQ = [1, 3, 9];

  function resin(items) {
    let eq = 0, weekly = 0, boss = 0;
    items.forEach(i => {
      if (i.sec === 'tal' && domainOf(i)) eq += i.count * BOOK_EQ[bookTier(i)];
      else if (i.sec === 'weekly') weekly += i.count;
      else if (i.sec === 'boss') boss += i.count;
    });
    const bookRuns = Math.ceil(eq / RESIN.bookEqPerRun);
    const weeklyRuns = Math.ceil(weekly / RESIN.weeklyDropsPerRun);
    const bossRuns = Math.ceil(boss / RESIN.bossDropsPerRun);
    const parts = [
      { label: 'Libros de talento', runs: bookRuns, resin: bookRuns * RESIN.bookRun },
      { label: 'Jefe semanal', runs: weeklyRuns, resin: weeklyRuns * RESIN.weeklyRun, extra: weeklyRuns ? `≈ ${Math.ceil(weeklyRuns / 3)} semana(s)` : '' },
      { label: 'Jefe de mundo', runs: bossRuns, resin: bossRuns * RESIN.bossRun }
    ].filter(p => p.runs > 0);
    const total = parts.reduce((s, p) => s + p.resin, 0);
    return { total, days: total / RESIN.perDay, parts };
  }

  const NATIONS = [
    { name: 'Mondstadt', books: [['libertad', 'freedom'], ['resistencia', 'resistance'], ['balada', 'poesia', 'ballad']] },
    { name: 'Liyue', books: [['prosperidad', 'prosperity'], ['diligencia', 'diligence'], ['oro', 'gold']] },
    { name: 'Inazuma', books: [['transitoriedad', 'fugacidad', 'transience'], ['elegancia', 'elegance'], ['luz', 'light']] },
    { name: 'Sumeru', books: [['amonestacion', 'admonicion', 'admonition'], ['ingenio', 'ingenuity'], ['praxis']] },
    { name: 'Fontaine', books: [['equidad', 'equity'], ['justicia', 'justice'], ['orden', 'order']] },
    { name: 'Natlan', books: [['contencion', 'contention'], ['encendido', 'ignicion', 'kindling'], ['conflicto', 'conflict']] },
    { name: 'Snezhaya', books: [['amor', 'love'], ['tenacidad', 'tenacity'], ['gloria', 'glory']] }
  ];
  const DAYS_OF = [[1, 4], [2, 5], [3, 6]];
  const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function domainOf(n) {
    if (!n || (n.sec !== 'tal' && n.sec !== 'mobs') || !isBook(n)) return null;
    const t = norm(n.name);
    if (!/ensenanza|guia|filosofia|teaching|guide|philosophy/.test(t) && !(Number(n.id) >= 104301 && Number(n.id) <= 104399)) return null;
    for (let ni = 0; ni < NATIONS.length; ni++) {
      for (let bi = 0; bi < 3; bi++) {
        if (NATIONS[ni].books[bi].some(k => new RegExp('\\b' + k + '\\b').test(t)))
          return { nation: NATIONS[ni].name, book: bi, label: NATIONS[ni].books[bi][0], days: DAYS_OF[bi] };
      }
    }
    const idx = Number(n.id) - 104301;
    if (idx >= 0 && idx < NATIONS.length * 9) {
      const g = Math.floor(idx / 3);
      return { nation: NATIONS[Math.floor(g / 3)].name, book: g % 3, label: NATIONS[Math.floor(g / 3)].books[g % 3][0], days: DAYS_OF[g % 3] };
    }
    return null;
  }
  const opensOn = (d, day) => day === 0 || d.days.includes(day);
  const gameDay = () => new Date(Date.now() - 4 * 3600 * 1000).getDay();

  const DAYS_KEY = 'gc_bookdays_v1';
  const DAY_RE = [/dom|sun/, /lun|mon/, /mar|tue/, /mi[eé]|wed/, /jue|thu/, /vie|fri/, /s[aá]b|sat/];
  const parseDay = t => { const s = norm(t); return DAY_RE.findIndex(r => r.test(s)); };
  async function bookInfo(n) {
    const store = window.GC.store, cache = store.get(DAYS_KEY, {});
    if (cache[n.id]) return cache[n.id];
    try {
      const d = await window.GenshinAPI.getMaterial(n.name);
      const days = d && Array.isArray(d.daysOfWeek) ? Array.from(new Set(d.daysOfWeek.map(parseDay).filter(i => i >= 0))) : [];
      if (days.length) {
        const out = { days, domain: (d.dropDomainName || '').toString() };
        cache[n.id] = out; store.set(DAYS_KEY, cache);
        return out;
      }
    } catch (e) { }
    return null;
  }

  const KEY = 'gc_plans_v2';
  const TEAMS_KEY = 'gc_teams_v1';
  function exportJson() {
    return JSON.stringify({ app: 'genshin-plus', version: 1, exported: new Date().toISOString(), plans: Plan.all(), teams: window.GC.store.get(TEAMS_KEY, []) }, null, 2);
  }
  function importJson(text, mode) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('El archivo no es un JSON válido.'); }
    const plans = o && o.app === 'genshin-plus' && o.plans && typeof o.plans === 'object' ? o.plans : null;
    if (!plans) throw new Error('Este archivo no es un respaldo de Genshin +.');
    const ok = {};
    Object.keys(plans).forEach(id => {
      const p = plans[id];
      if (p && typeof p === 'object' && p.id === id && typeof p.name === 'string' && Array.isArray(p.needs)) ok[id] = p;
    });
    const count = Object.keys(ok).length;
    if (!count) throw new Error('El respaldo no contiene planes válidos.');
    const base = mode === 'replace' ? {} : Plan.all();
    Object.keys(ok).forEach(id => {
      if (!base[id] || (ok[id].updated || 0) >= (base[id].updated || 0)) base[id] = ok[id];
    });
    window.GC.store.set(KEY, base);
    if (Array.isArray(o.teams)) {
      const valid = o.teams.filter(t => t && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.members))
        .map(t => ({ id: t.id, name: t.name.slice(0, 40), members: t.members.filter(m => typeof m === 'string') }));
      const cur = mode === 'replace' ? [] : window.GC.store.get(TEAMS_KEY, []);
      valid.forEach(t => { const i = cur.findIndex(c => c.id === t.id); if (i >= 0) cur[i] = t; else cur.push(t); });
      window.GC.store.set(TEAMS_KEY, cur);
    }
    return count;
  }

  window.GCX = { resinIcon, bookInfo, aggregate, remaining, resin, RESIN, SEC_LABEL, SEC_ORDER, NATIONS, DAY_NAMES, domainOf, opensOn, gameDay, exportJson, importJson };
})();
