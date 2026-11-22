document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  if (document.body.dataset.page !== 'detalle') return;

  const GC = window.GC, API = window.GenshinAPI, Plan = window.Plan;
  const { esc, fmt } = GC;
  const $ = s => document.querySelector(s);
  const UI = {
    confirm: o => (GC.ui ? GC.ui.confirm(o) : Promise.resolve(window.confirm(o.title + (o.text ? '\n' + o.text : '')))),
    toast: (t, i) => { if (GC.ui) GC.ui.toast(t, i); }
  };

  const $$ = s => Array.from(document.querySelectorAll(s));
  const id = new URLSearchParams(location.search).get('char');

  const TALENT_TYPES = ['Ataque normal', 'Habilidad elemental', 'Estallido elemental'];
  const TALENT_KEYS = ['M1', 'E', 'Q'];
  const WEAPON_CACHE_KEY = 'gc_weapons_v1';
  const WEAPON_TTL = 7 * 24 * 3600 * 1000;

  const S = {
    char: null,
    plan: null,
    data: { char: null, tal: null, wp: null },
    ready: { char: false, tal: false, wp: true },
    err: { char: null, tal: null, wp: null },
    wpDiag: null,
    weapons: [],
    calc: { needs: [], br: { mora: { asc: 0, lvl: 0, tal: 0, wp: 0, total: 0 }, exp: { exp: 0, books: 0, exact: true } } },
    touched: false
  };
  let started = false, saveTimer = null;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const toInt = v => { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

  const matCard = n => `
    <button type="button" class="mat-card ${S.plan.done[n.k] ? 'is-done' : ''}" data-k="${esc(n.k)}" aria-pressed="${!!S.plan.done[n.k]}" title="${esc(n.name)}: pulsa para marcar que ya lo tienes">
      <span class="tick" aria-hidden="true">✓</span>
      ${GC.img(API.materialIconSources(n.id), '', n.name, 48, 48)}
      <span class="count">x${fmt(n.count)}</span>
      <span class="name">${esc(n.name)}</span>
    </button>`;

  const partMsg = (part, okText) =>
    S.ready[part] ? okText : (S.err[part] ? 'No se pudo cargar desde genshin-db.' : 'Cargando...');

  function fillGrid(sel, sec, emptyText) {
    const items = S.calc.needs.filter(n => n.sec === sec);
    $(sel).innerHTML = items.length ? items.map(matCard).join('') : `<p class="tile-note mb-0">${esc(emptyText)}</p>`;
  }

  const BOSS_KEY = 'gc_bosses_v5';
  const bossMem = new Map();
  const bossStore = () => { try { return JSON.parse(localStorage.getItem(BOSS_KEY) || '{}'); } catch (e) { return {}; } };
  const bossSave = (k, v) => { try { const o = bossStore(); o[k] = v; localStorage.setItem(BOSS_KEY, JSON.stringify(o)); } catch (e) { } };

  async function lookupBoss(n) {
    const cached = bossStore()[n.id];
    if (cached) return cached;
    let r = null;
    try { r = await lookupBossFromSources(n); } catch (e) { r = null; }
    if (!r && window.GC_BOSSES) {
      try { r = await window.GC_BOSSES.resolve(n); if (r) bossSave(n.id, r); } catch (e) { r = null; }
    }
    return r;
  }
  async function lookupBossFromSources(n) {
    const m = await API.getMaterial(n.name);
    const src = (m && Array.isArray(m.sources) ? m.sources : []).map(String);
    const line = src.find(t => /jefe|boss|domin|derrota|defeat|obtenid|obtained|recompensa|reward|reto|challenge/i.test(t)) || src[0] || '';
    const name = cleanBossName(line);
    if (!name) return null;
    try {
      const e = await API.getEnemy(name);
      const imgs = (e && e.images) || {};
      console.info('[jefe]', n.name, '->', e && e.name, imgs);
      const icon = pickEnemyFile(imgs);
      const hasUrl = Object.values(imgs).some(v => typeof v === 'string' && /^https?:\/\//.test(v));
      if (e && e.name) { const out = { name: e.name, icon, images: imgs }; if (icon || hasUrl) bossSave(n.id, out); return out; }
    } catch (e) { }
    return { name, icon: '', images: {} };
  }

  function pickEnemyFile(imgs) {
    const keys = ['filename_icon', 'filename_side', 'filename_enemy', 'filename_image', 'filename_monster'];
    for (const k of keys) if (typeof imgs[k] === 'string' && imgs[k]) return imgs[k];
    const any = Object.keys(imgs).find(k => /^filename_/.test(k) && typeof imgs[k] === 'string' && imgs[k]);
    return any ? imgs[any] : '';
  }

  function cleanBossName(line) {
    let t = String(line || '').trim();
    if (t.includes(':')) t = t.split(':').pop().trim();
    t = t.replace(/\s*\([^)]*\)\s*$/g, '').trim();
    const rules = [
      /^(obtenid[oa]s?|conseguid[oa]s?|se obtiene|botín|recompensa)\s+/i,
      /^(al\s+)?(derrotar|vencer|completar|superar)\s+/i,
      /^(del?\s+)?(reto|desafío|combate|jefe)\s+(del?\s+)?/i,
      /^(obtained|dropped|drops?)\s+(from|by)\s+/i,
      /^(challenge|trounce)\s+reward\s+(of|from)\s+/i,
      /^(del|de|al)\s+/i
    ];
    for (let i = 0; i < 4; i++) rules.forEach(r => { t = t.replace(r, '').trim(); });
    return t;
  }

  function renderBoss(sec, boxSel, label) {
    const box = $(boxSel);
    const n = S.calc.needs.find(x => x.sec === sec);
    if (!n) { box.innerHTML = ''; box.dataset.id = ''; return; }
    if (box.dataset.id === String(n.id)) return;
    box.dataset.id = String(n.id);
    box.innerHTML = '';
    const local = GC.localBoss && GC.localBoss[n.id];
    (local ? Promise.resolve({ name: local, icon: '' }) : lookupBoss(n)).then(async b => {
      if (!b || box.dataset.id !== String(n.id)) return;
      if (!API.monsterIconSources(b.icon, b.images).length && window.GC_BOSSES) {
        try { b = Object.assign({}, b, { icon: await window.GC_BOSSES.findIcon(b.name) }); } catch (e) { }
        if (box.dataset.id !== String(n.id)) return;
      }
      box.innerHTML = `<div class="boss-box">
        ${GC.img([...API.monsterIconSources(b.icon, b.images), ...API.materialIconSources(n.id)], 'boss-img', b.name, 72, 72)}
        <div><div class="small muted">${esc(label)}</div><div class="fw-bold">${esc(b.name)}</div></div></div>`;
    }).catch(() => { box.dataset.id = ''; });
  }

  const noLevel = () => !(S.plan.tgt > S.plan.cur);

  function renderLevelState() {
    $$('[data-tgt]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.tgt) === S.plan.tgt)));
  }

  function renderSections() {
    const pick = 'Elige un nivel objetivo arriba.';
    fillGrid('#asc-grid', 'asc', noLevel() ? pick : partMsg('char', 'No necesitas materiales de ascensión en este rango.'));
    fillGrid('#boss-grid', 'boss', noLevel() ? pick : partMsg('char', 'Sin jefe de ascensión en este rango.'));
    const talPick = 'Marca un talento y elige su nivel.';
    const talEmpty = S.ready.tal && !S.data.tal ? 'Sin datos de talentos en genshin-db.' : partMsg('tal', talPick);
    fillGrid('#tal-grid', 'tal', talEmpty);
    fillGrid('#weekly-grid', 'weekly', S.ready.tal && !S.data.tal ? talEmpty : partMsg('tal', 'Sin jefe semanal en la selección.'));
    renderBoss('boss', '#boss-info', 'Jefe de mundo');
    renderBoss('weekly', '#weekly-info', 'Jefe semanal');
    fillGrid('#crown-grid', 'crown', '');
    $('#crown-box').hidden = !S.calc.needs.some(n => n.sec === 'crown');
  }

  function renderMora() {
    const m = S.calc.br.mora;
    const rows = [['Ascensión', m.asc], ['Subida de nivel', m.lvl], ['Talentos', m.tal]];
    $('#mora-toggle').hidden = m.total === 0;
    $('#mora-list').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v ? fmt(v) : '0'}</dd>`).join('') +
      `<dt class="mora-total">Total</dt><dd class="mora-total">${fmt(m.total)}</dd>`;
  }

  function renderXp() {
    const x = S.calc.br.exp;
    $('#xp-box').innerHTML = `
      ${GC.img(API.iconSources('UI_ItemIcon_104003'), 'img-slot-icon m-0', 'Sabiduría del héroe', 48, 48)}
      <div><div class="xp-count">${fmt(x.books)}</div>
      <div class="small">Sabiduría del héroe<br>${x.exp ? (x.exact ? '' : '≈ ') + fmt(x.exp) + ' EXP' : 'Nivel 1 → ' + (noLevel() ? '?' : S.plan.tgt)}</div></div>`;
    $('#xp-toggle').hidden = x.books === 0;
    $('#xp-note').textContent = x.exact || !x.exp ? '' : 'EXP aproximada: entre fases de ascensión es una estimación.';
  }

  function renderSend(msg) {
    const pr = Plan.progress(S.plan);
    $('#send-pct').textContent = pr.pct + '%';
    $('#send-count').textContent = pr.total ? `${pr.done} de ${pr.total} materiales listos` : 'Aún no hay nada seleccionado';
    $('#send-bar').style.width = pr.pct + '%';
    $('#send-bar-wrap').setAttribute('aria-valuenow', pr.pct);
    const rs = $('#send-resin');
    if (rs && window.GCX) {
      const r = window.GCX.resin(window.GCX.aggregate([S.plan]));
      rs.hidden = !r.total;
      rs.textContent = r.total ? `Resina estimada para lo que falta: ≈ ${fmt(r.total)}` : '';
    }
    const tr = !!S.plan.tracked;
    $('#btn-send').hidden = tr;
    $('#btn-unsend').hidden = !tr;
    const m = $('#send-msg');
    if (msg) m.textContent = msg;
    else if (tr) m.innerHTML = 'En el tracker. Los cambios se guardan solos. <a href="tracker.html">Ver tracker</a>';
    else m.textContent = 'Pulsa un material cuando ya lo tengas y envía el plan al tracker.';
  }
  function refreshProgress() {
    const byK = new Map(S.calc.needs.map(n => [n.k, n]));
    $$('[data-k]').forEach(el => {
      const n = byK.get(el.dataset.k);
      const d = !!n && Plan.frac(S.plan, n) >= 1;
      el.classList.toggle('is-done', d);
      if (el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed', String(d));
    });
    renderSend();
  }

  function toggleDone(k) {
    if (!S.plan) return;
    if (S.plan.done[k]) delete S.plan.done[k]; else S.plan.done[k] = true;
    S.touched = true;
    refreshProgress();
    schedulePersist();
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('.mat-card[data-k], .tile-toggle[data-k]');
    if (el) toggleDone(el.dataset.k);
  });

  function recompute() {
    S.calc = Plan.compute(S.plan, S.data);
    S.plan.needs = S.calc.needs;
  }
  const canSave = () => S.ready.char && S.ready.tal && (!S.plan.wp || S.ready.wp);

  function persist() {
    if (!S.plan || !canSave()) return;
    if (!(S.touched || S.plan.tracked || Plan.get(S.plan.id))) return;
    clearTimeout(saveTimer);
    Plan.save(S.plan);
  }
  function schedulePersist() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 250); }
  window.addEventListener('pagehide', persist);

  function renderAll() {
    renderLevelState();
    renderSections();
    renderMora();
    renderXp();
    refreshProgress();
  }
  const onData = () => { recompute(); renderAll(); persist(); };
  function onChange() {
    if (!S.plan) return;
    recompute();
    renderLevelState();
    renderSections();
    renderMora();
    renderXp();
    refreshProgress();
    schedulePersist();
  }

  const setTarget = n => {
    if (!S.plan) return;
    S.plan.tgt = n;
    S.touched = true;
    const inp = $('#lvl-tgt');
    if (inp) inp.value = n > S.plan.cur ? n : '';
    onChange();
  };
  $('#lvl-tgt').addEventListener('input', () => {
    const n = toInt($('#lvl-tgt').value);
    if (n === null) { setTarget(1); return; }
    S.plan.tgt = clamp(n, 1, 90); S.touched = true; onChange();
  });
  $('#lvl-tgt').addEventListener('change', () => { if (S.plan) $('#lvl-tgt').value = S.plan.tgt > S.plan.cur ? S.plan.tgt : ''; });
  $$('[data-tgt]').forEach(b => b.addEventListener('click', () => {
    if (!S.plan) return;
    const n = Number(b.dataset.tgt);
    setTarget(S.plan.tgt === n ? 1 : n);
  }));

  function talentRowsHtml() {
    const tal = S.data.tal;
    const opts = sel => Array.from({ length: 9 }, (_, j) => `<option value="${j + 2}" ${j + 2 === sel ? 'selected' : ''}>${j + 2}</option>`).join('');
    return S.plan.order.map((i, pos) => {
      const t = S.plan.talents[i];
      const info = tal && tal['combat' + (i + 1)];
      const file = tal && tal.images && tal.images['filename_combat' + (i + 1)];
      const name = (info && info.name) || TALENT_TYPES[i];
      return `<div class="talent-row ${t.on ? '' : 'off'}" data-i="${i}">
        <span class="rank" aria-label="Prioridad ${pos + 1}">${pos + 1}</span>
        <span class="move">
          <button type="button" class="t-move" data-dir="-1" aria-label="Subir prioridad de ${esc(name)}" ${pos === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="t-move" data-dir="1" aria-label="Bajar prioridad de ${esc(name)}" ${pos === 2 ? 'disabled' : ''}>▼</button>
        </span>
        <input type="checkbox" class="t-on" id="t-on-${i}" ${t.on ? 'checked' : ''} aria-label="Subir ${esc(name)}">
        <label for="t-on-${i}" class="talent-icon-wrap">${GC.img([...(file ? API.iconSources(file) : []), `includes/images/${['m1', 'e', 'q'][i]}${GC.SHORT[S.plan.id] || S.plan.id}.png`], 'talent-icon', name, 48, 48)}</label>
        <div class="talent-name"><div class="fw-semibold"><span class="key-badge" aria-hidden="true">${TALENT_KEYS[i]}</span> ${esc(name)}</div><div class="small muted">${esc(TALENT_TYPES[i])}</div></div>
        <div class="talent-lv">
          <span class="small">Hasta nv</span>
          <select class="form-select form-select-sm t-tgt" aria-label="Nivel objetivo de ${esc(name)}" ${t.on ? '' : 'disabled'}>${opts(t.tgt)}</select>
        </div></div>`;
    }).join('');
  }
  $('#talent-rows').addEventListener('click', e => {
    const b = e.target.closest('.t-move');
    if (!b || !S.plan || b.disabled) return;
    const i = Number(b.closest('.talent-row').dataset.i);
    const pos = S.plan.order.indexOf(i), to = pos + Number(b.dataset.dir);
    if (to < 0 || to > 2) return;
    [S.plan.order[pos], S.plan.order[to]] = [S.plan.order[to], S.plan.order[pos]];
    S.touched = true;
    $('#talent-rows').innerHTML = talentRowsHtml();
    schedulePersist();
  });
  $('#talent-rows').addEventListener('change', e => {
    const row = e.target.closest('.talent-row');
    if (!row || !S.plan) return;
    const t = S.plan.talents[Number(row.dataset.i)];
    if (e.target.classList.contains('t-on')) {
      t.on = e.target.checked;
      row.classList.toggle('off', !t.on);
      row.querySelectorAll('select').forEach(x => { x.disabled = !t.on; });
    }
    if (e.target.classList.contains('t-tgt')) t.tgt = Number(e.target.value);
    t.cur = 1;
    S.touched = true;
    onChange();
  });

  $('#btn-send').addEventListener('click', () => {
    if (!S.plan) return;
    if (!canSave()) { renderSend('Espera a que carguen los datos de genshin-db.'); return; }
    if (!S.plan.needs.length) { renderSend('Elige un nivel objetivo o algún talento primero.'); return; }
    S.plan.tracked = true;
    if (!S.plan.added) S.plan.added = Date.now();
    S.touched = true;
    persist();
    renderSend();
    UI.toast('Plan enviado al tracker');
  });
  $('#btn-unsend').addEventListener('click', async () => {
    if (!S.plan) return;
    if (!await UI.confirm({ title: '¿Quitar del tracker?', text: 'Tu plan sigue guardado como borrador.', ok: 'Sí, quitar', icon: 'warning', image: 'includes/images/quit.png', danger: true })) return;
    S.plan.tracked = false;
    persist();
    renderSend('Quitado del tracker. Tu plan sigue guardado como borrador.');
    UI.toast('Quitado del tracker', 'info');
  });
  $('#btn-reset').addEventListener('click', async () => {
    if (!S.plan) return;
    if (!await UI.confirm({ title: '¿Reiniciar selecciones?', text: 'Se borran el nivel objetivo, los talentos, el arma y los materiales marcados.', ok: 'Sí, reiniciar', icon: 'warning', image: 'includes/images/rei.png', danger: true })) return;
    Object.assign(S.plan, { tgt: 1, wp: null, have: {}, done: {}, order: [1, 2, 0] });
    S.plan.talents = [0, 1, 2].map(() => ({ on: false, cur: 1, tgt: 10 }));
    S.touched = true;
    $('#lvl-tgt').value = '';
    $('#talent-rows').innerHTML = talentRowsHtml();
    recompute();
    renderAll();
    persist();
    UI.toast('Selecciones reiniciadas');
  });

  function regionKey(r) {
    const t = String(r || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return ['mondstadt', 'liyue', 'inazuma', 'sumeru', 'fontaine', 'natlan', 'snezhnaya'].find(k => t.includes(k)) || '';
  }
  function setRegion(c) {
    const d = S.data.char || {};
    const r = d.region || d.association || (GC.byId && GC.byId(c.id) && GC.byId(c.id).region) || '';
    document.querySelector('.hud').dataset.region = regionKey(r);
  }

  function renderHero(c) {
    setRegion(c);
    const im = (S.data.char && S.data.char.images) || {};
    const splash = im.filename_gachaSplash ? API.iconSources(im.filename_gachaSplash) : [];
    const mine = `includes/images/splash${GC.SHORT[c.id] || c.id}.png`;
    const srcs = GC.leakData(c) ? [mine, ...splash, ...GC.charSources(c)] : [...splash, ...GC.charSources(c), mine];
    $('#hero-img-wrap').innerHTML = GC.img(srcs, 'hud-img', c.name, 400, 600);
  }

  async function fetchTalents(c) {
    let err = null;
    for (const q of [c.name, c.apiId]) {
      if (q === undefined || q === null || q === '') continue;
      try { const d = await API.getTalents(q); if (d && d.costs) return d; } catch (e) { err = err || e; }
    }
    if (err) throw err;
    return null;
  }

  function showError(e) {
    $('#load-note').innerHTML = GC.apiErrorHtml('No se pudo conectar con genshin-db. Los cambios no se guardarán hasta que carguen los datos.', e);
  }

  function setBleed() {
    const h = document.querySelector('.hud');
    if (!h) return;
    const left = Math.max(0, Math.round(h.getBoundingClientRect().left) - 8);
    h.style.setProperty('--bleed', (window.innerWidth >= 992 ? left : 0) + 'px');
  }
  window.addEventListener('resize', setBleed);
  setBleed();

  function start(c) {
    started = true;
    S.char = c;
    S.plan = Object.assign(Plan.blank(c), Plan.get(c.id) || {}, Plan.snapshot(c));
    if (!Array.isArray(S.plan.order) || S.plan.order.length !== 3 || [0, 1, 2].some(k => !S.plan.order.includes(k))) S.plan.order = [1, 2, 0];
    S.plan.cur = 1; S.plan.talents.forEach(t => { t.cur = 1; if (t.tgt < 2) t.tgt = 10; });
    S.plan.wp = null; S.ready.wp = true;
    document.title = `${c.name} - Genshin Companion`;
    $('#char-title').textContent = c.name;
    $('#hero').classList.add('el-' + (c.element || 'none'));
    $('#hero-name').textContent = c.name;
    $('#hero-meta').textContent = [c.element, c.weapon].filter(Boolean).join(' · ');
    document.body.dataset.el = c.element || '';
    const st = $('#hero-stars');
    st.textContent = c.stars ? '✦'.repeat(Number(c.stars)) : '';
    st.setAttribute('role', 'img');
    st.setAttribute('aria-label', c.stars ? `${c.stars} estrellas` : '');
    $('#load-note').textContent = '';
    $('#lvl-tgt').value = S.plan.tgt > S.plan.cur ? S.plan.tgt : '';
    $('#mora-icon').innerHTML = GC.img(API.iconSources('UI_ItemIcon_202'), 'img-slot-icon m-0', 'Mora', 44, 44);
    $('#talent-rows').innerHTML = talentRowsHtml();
    renderHero(c);
    recompute();
    renderAll();

    const leak = GC.leakData(c);
    if (leak && !GC.apiData[c.id]) {
      S.data.char = leak.char; S.ready.char = true; S.err.char = null;
      S.data.tal = leak.tal; S.ready.tal = true; S.err.tal = null;
      $('#load-note').textContent = 'Datos provisionales: genshin-db aún no tiene a este personaje. Las cantidades vienen de filtraciones y los nombres marcados "por confirmar" pueden cambiar.';
      $('#talent-rows').innerHTML = talentRowsHtml();
      onData();
      return;
    }
    GC.ensureData(c.id).then(d => {
      if (!d || !d.costs) throw new Error('genshin-db no encontró los datos de este personaje');
      S.data.char = d; S.ready.char = true; S.err.char = null;
      renderHero(c);
      onData();
    }).catch(e => { S.err.char = e; showError(e); renderAll(); });

    fetchTalents(c).then(t => {
      S.data.tal = t; S.ready.tal = true; S.err.tal = null;
      $('#talent-rows').innerHTML = talentRowsHtml();
      onData();
    }).catch(e => { S.err.tal = e; showError(e); renderAll(); });

  }

  function tryStart() {
    if (started) return;
    const c = GC.byId(id);
    if (c) start(c);
  }

  async function fetchDirect() {
    if (started || !id) return;
    $('#load-note').textContent = 'Consultando genshin-db...';
    try {
      const d = (await API.getCharacter(id.replace(/-/g, ' '))) || (await API.getCharacter(id));
      const c = d && GC.registerCharacter(d);
      if (c && !started) { start(c); return; }
    } catch (e) {
      if (!started) $('#load-note').innerHTML = GC.apiErrorHtml('No se pudo conectar con genshin-db.', e);
      return;
    }
    if (!started) {
      $('#char-title').textContent = 'Personaje no encontrado';
      $('#load-note').textContent = 'Vuelve al catálogo y elige un personaje de la lista.';
    }
  }

  if (!id) {
    $('#char-title').textContent = 'Elige un personaje';
    $('#load-note').textContent = 'Abre esta página desde el catálogo.';
  } else {
    GC.onRoster(tryStart);
    tryStart();
    setTimeout(fetchDirect, 1500);
  }
});
