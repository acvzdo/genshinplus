(function () {
  'use strict';
  const TABLE = [
    ["dvalin's", ['Stormterror', 'Dvalin'], 'Dvalin'],
    ['of boreas', ['Lupus Boreas', 'Andrius'], 'Lupus Boreas'],
    ['monoceros caeli', ['Childe', 'Tartaglia'], 'Childe'],
    ['foul legacy', ['Childe', 'Tartaglia'], 'Childe'],
    ['shadow of the warrior', ['Childe', 'Tartaglia'], 'Childe'],
    ["dragon lord's crown", ['Azhdaha'], 'Azhdaha'],
    ['bloodjade branch', ['Azhdaha'], 'Azhdaha'],
    ['gilded scale', ['Azhdaha'], 'Azhdaha'],
    ['molten moment', ['La Signora', 'Signora'], 'La Signora'],
    ['hellfire butterfly', ['La Signora', 'Signora'], 'La Signora'],
    ['ashen heart', ['La Signora', 'Signora'], 'La Signora'],
    ['malefic general', ['Raiden Shogun', 'Shogun'], 'Shogun Raiden'],
    ['calamitous god', ['Raiden Shogun', 'Shogun'], 'Shogun Raiden'],
    ['meaning of aeons', ['Raiden Shogun', 'Shogun'], 'Shogun Raiden'],
    ['worldspan fern', ['Everlasting Lord of Arcane Wisdom'], 'Señor de la sabiduría arcana'],
    ['primordial greenbloom', ['Everlasting Lord of Arcane Wisdom'], 'Señor de la sabiduría arcana'],
    ['everamber', ['Everlasting Lord of Arcane Wisdom'], 'Señor de la sabiduría arcana'],
    ['puppet strings', ['Scaramouche', 'Wanderer'], 'Scaramouche'],
    ['mirror of mushin', ['Scaramouche', 'Wanderer'], 'Scaramouche'],
    ["daka's bell", ['Scaramouche', 'Wanderer'], 'Scaramouche'],
    ['basalt pillar', ['Geo Hypostasis'], 'Hipóstasis Geo'],
    ['hurricane seed', ['Anemo Hypostasis'], 'Hipóstasis Anemo'],
    ['lightning prism', ['Electro Hypostasis'], 'Hipóstasis Electro'],
    ['crystalline bloom', ['Cryo Hypostasis'], 'Hipóstasis Cryo'],
    ['hoarfrost core', ['Cryo Regisvine'], 'Regisvid Cryo'],
    ['everflame seed', ['Pyro Regisvine'], 'Regisvid Pyro'],
    ['perpetual heart', ['Perpetual Mechanical Array'], 'Matriz mecánica perpetua'],
    ['kuuvahki', ['Knuckle Duckle'], 'Puñopato'],
    ['juvenile jade', ['Primo Geovishap'], 'Geovishap primigenio']
  ];
  const cache = new Map();

  async function resolve(need) {
    const key = String(need.id);
    if (cache.has(key)) return cache.get(key);
    const p = (async () => {
      const API = window.GenshinAPI;
      let en = '';
      try {
        const m = await API.getMaterial(need.id, { queryLanguages: 'English,Spanish', resultLanguage: 'English' });
        en = (m && m.name || '').toLowerCase();
      } catch (e) { }
      const row = en && TABLE.find(r => en.includes(r[0]));
      if (!row) return null;
      for (const q of row[1]) {
        try {
          const d = await API.getEnemy(q);
          const im = (d && d.images) || {};
          const file = im.filename_icon || im.filename_side || im.filename_enemy || (Object.keys(im).find(k => /^filename_/.test(k) && im[k]) ? im[Object.keys(im).find(k => /^filename_/.test(k) && im[k])] : '');
          if (d && d.name) return { name: d.name, icon: file || '', images: d.images };
        } catch (e) { }
      }
      return null;
    })();
    cache.set(key, p);
    return p;
  }
  const ALIAS = { 'puñopato': 'Knuckle Duckle', 'la sota': 'The Knave', 'sota': 'The Knave' };
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const lists = {};
  function loadList(lang) {
    if (lists[lang]) return lists[lang];
    const key = 'gc_monsters_' + lang;
    lists[lang] = (async () => {
      try {
        const c = JSON.parse(localStorage.getItem(key) || 'null');
        if (c && c.t > Date.now() - 7 * 864e5 && c.items && c.items.length) return c.items;
      } catch (e) { }
      const r = await fetch(`https://gi.yatta.moe/api/v2/${lang}/monster`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const raw = (j && j.data && j.data.items) || {};
      const items = (Array.isArray(raw) ? raw : Object.values(raw)).filter(x => x && x.name && x.icon).map(x => ({ n: norm(x.name), icon: x.icon }));
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), items })); } catch (e) { }
      return items;
    })().catch(e => { lists[lang] = null; return []; });
    return lists[lang];
  }
  const pick = (items, name) => {
    const q = norm(name);
    if (!q) return null;
    return items.find(i => i.n === q) || items.find(i => i.n.includes(q) || q.includes(i.n)) || null;
  };
  async function findIcon(name, englishName) {
    const es = pick(await loadList('es'), name);
    if (es) return es.icon;
    const en = ALIAS[norm(name)] || englishName || name;
    const hit = pick(await loadList('en'), en);
    return hit ? hit.icon : '';
  }
  window.GC_BOSSES = { resolve, findIcon };
})();
