(function () {
  'use strict';

  const KEY = 'gc_plans_v2';
  const CAPS = [20, 40, 50, 60, 70, 80];
  const WEAPON_MAX = [40, 50, 60, 70, 80, 90];
  const HEROS_WIT_EXP = 20000;
  const MORA_PER_BOOK = 4000;

  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  const EXP_STEP = [1000,1325,1700,2150,2625,3150,3725,4350,5000,5700,6450,7225,8050,8925,9825,10750,11725,12725,13775,15500,16725,17950,19200,20500,21825,23175,24575,26000,27450,28950,30500,32100,33750,35475,37225,39050,40950,42925,45000,47050,49250,51525,53875,56325,58850,61450,64125,66900,69750,71700,74625,77625,80650,83725,86850,89975,93150,96325,99500,104725,108000,111250,114500,117775,121075,124425,127825,131350,135000,136875,140900,145225,149975,155200,161100,167775,175475,184425,194925,208450,223425,241525,263625,290850,324800,367625,422350,493300,586675];
  const CUM = [0, 0];
  for (let L = 1; L <= 89; L++) CUM[L + 1] = CUM[L] + EXP_STEP[L - 1];

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const exactLevel = L => L <= 20 || (L >= 40 && L % 10 === 0);

  function expBetween(a, b) {
    a = clamp(Math.floor(a) || 1, 1, 90);
    b = clamp(Math.floor(b) || 1, 1, 90);
    if (b <= a) return { exp: 0, exact: true };
    return { exp: CUM[b] - CUM[a], exact: exactLevel(a) && exactLevel(b) };
  }

  function numKeys(obj, prefix) {
    const re = new RegExp('^' + prefix + '\\d+$');
    return Object.keys(obj || {}).filter(k => re.test(k))
      .sort((x, y) => parseInt(x.slice(prefix.length), 10) - parseInt(y.slice(prefix.length), 10));
  }

  function classifyAscension(costs) {
    const keys = numKeys(costs, 'ascend');
    const inFirst = new Set(((keys.length && costs[keys[0]]) || []).map(i => String(i.id)));
    const map = new Map();
    keys.forEach(k => (costs[k] || []).forEach(it => {
      const sid = String(it.id), n = Number(it.id);
      if (n === 202 || map.has(sid)) return;
      let g;
      if (n >= 104100 && n < 104200) g = 'gem';
      else if (n >= 112000 && n < 113000) g = 'common';
      else g = inFirst.has(sid) ? 'local' : 'boss';
      map.set(sid, g);
    }));
    return map;
  }

  function classifyTalents(costs) {
    const keys = numKeys(costs, 'lvl');
    const st = new Map();
    keys.forEach((k, idx) => (costs[k] || []).forEach(it => {
      const sid = String(it.id);
      const s = st.get(sid) || { first: idx, last: idx, firstCount: Number(it.count) || 0 };
      s.last = idx;
      st.set(sid, s);
    }));
    const lastIdx = keys.length - 1;
    const map = new Map();
    st.forEach((s, sid) => {
      const n = Number(sid);
      let g;
      if (n === 202) g = 'mora';
      else if (s.first === lastIdx && s.last === lastIdx && s.firstCount === 1) g = 'crown';
      else if (n >= 104300 && n < 104400) g = 'book';
      else if (n >= 112000 && n < 113000) g = 'common';
      else if (n >= 113000 && n < 114000) g = 'weekly';
      else g = s.first >= 5 ? 'weekly' : 'book';
      map.set(sid, g);
    });
    return map;
  }

  function addTo(map, it, times) {
    const k = String(it.id);
    const t = map.get(k) || { id: it.id, name: it.name, count: 0 };
    t.count += (Number(it.count) || 0) * (times || 1);
    map.set(k, t);
  }

  const SEC_ORDER = { mora: 0, xp: 1, asc: 2, boss: 3, weekly: 4, tal: 5, crown: 6, wp: 7 };
  const GRP_ORDER = { gem: 0, local: 1, book: 0, common: 2 };
  function sortNeeds(list) {
    return list.sort((x, y) =>
      (SEC_ORDER[x.sec] - SEC_ORDER[y.sec]) ||
      ((GRP_ORDER[x.grp] || 0) - (GRP_ORDER[y.grp] || 0)) ||
      (x.sec === 'wp' ? 0 : Number(x.id) - Number(y.id)));
  }

  const weaponMax = costs => {
    const n = numKeys(costs, 'ascend').length;
    return n >= 1 ? WEAPON_MAX[Math.min(n, 6) - 1] : 90;
  };

  function compute(plan, data) {
    data = data || {};
    const needs = [];
    const br = { mora: { asc: 0, lvl: 0, tal: 0, wp: 0, total: 0 }, exp: { exp: 0, books: 0, exact: true } };
    const lvOk = plan.tgt > plan.cur;

    if (lvOk && data.char && data.char.costs) {
      const costs = data.char.costs, groups = classifyAscension(costs), sums = new Map();
      numKeys(costs, 'ascend').forEach((k, i) => {
        const cap = CAPS[i];
        if (cap >= plan.cur && cap < plan.tgt) (costs[k] || []).forEach(it => addTo(sums, it));
      });
      sums.forEach(it => {
        if (Number(it.id) === 202) { br.mora.asc += it.count; return; }
        const g = groups.get(String(it.id)) || 'local', sec = g === 'boss' ? 'boss' : 'asc';
        needs.push({ k: sec + ':' + it.id, sec, grp: g, id: it.id, name: it.name, count: it.count });
      });
    }

    if (lvOk) {
      const x = expBetween(plan.cur, plan.tgt);
      br.exp = { exp: x.exp, books: Math.ceil(x.exp / HEROS_WIT_EXP), exact: x.exact };
      br.mora.lvl = br.exp.books * MORA_PER_BOOK;
    }

    if (data.tal && data.tal.costs) {
      const costs = data.tal.costs, groups = classifyTalents(costs), sums = new Map();
      (plan.talents || []).forEach(t => {
        if (!t.on) return;
        for (let lv = Math.max(2, t.cur + 1); lv <= Math.min(10, t.tgt); lv++) {
          (costs['lvl' + lv] || []).forEach(it => addTo(sums, it));
        }
      });
      sums.forEach(it => {
        if (Number(it.id) === 202) { br.mora.tal += it.count; return; }
        const g = groups.get(String(it.id)) || 'book';
        if (g === 'common') {
          const same = needs.find(n => n.k === 'asc:' + it.id);
          if (same) { same.count += it.count; return; }
          needs.push({ k: 'asc:' + it.id, sec: 'asc', grp: 'common', id: it.id, name: it.name, count: it.count });
          return;
        }
        const sec = g === 'weekly' ? 'weekly' : g === 'crown' ? 'crown' : 'tal';
        needs.push({ k: sec + ':' + it.id, sec, grp: g, id: it.id, name: it.name, count: it.count });
      });
    }

    if (plan.wp && data.wp && data.wp.costs) {
      const costs = data.wp.costs, w = plan.wp, sums = new Map();
      if (w.tgt > w.cur) {
        numKeys(costs, 'ascend').forEach((k, i) => {
          const cap = CAPS[i];
          if (cap >= w.cur && cap < w.tgt) (costs[k] || []).forEach(it => addTo(sums, it));
        });
      }
      sums.forEach(it => {
        if (Number(it.id) === 202) { br.mora.wp += it.count; return; }
        needs.push({ k: 'wp:' + it.id, sec: 'wp', grp: 'wp', id: it.id, name: it.name, count: it.count });
      });
    }

    const m = br.mora;
    m.total = m.asc + m.lvl + m.tal + m.wp;
    if (m.total > 0) needs.push({ k: 'mora', sec: 'mora', grp: 'mora', id: 202, name: 'Mora', count: m.total });
    if (br.exp.books > 0) needs.push({ k: 'xp', sec: 'xp', grp: 'xp', id: 104003, name: 'Sabiduría del héroe', count: br.exp.books });
    return { needs: sortNeeds(needs), br };
  }

  function frac(plan, n) {
    if (plan.done && plan.done[n.k]) return 1;
    const h = Number(plan.have && plan.have[n.k]) || 0;
    return n.count > 0 ? Math.min(1, h / n.count) : 1;
  }

  function progress(plan) {
    const needs = (plan && plan.needs) || [];
    if (!needs.length) return { pct: 0, done: 0, total: 0 };
    let sum = 0, done = 0;
    needs.forEach(n => { const f = frac(plan, n); sum += f; if (f >= 1) done++; });
    const pct = done === needs.length ? 100 : Math.min(99, Math.floor(sum / needs.length * 100));
    return { pct, done, total: needs.length };
  }

  const all = () => store.get(KEY, {});
  const get = id => all()[id] || null;
  function save(plan) {
    const a = all();
    plan.updated = Date.now();
    a[plan.id] = plan;
    return store.set(KEY, a);
  }
  function remove(id) { const a = all(); delete a[id]; store.set(KEY, a); }
  function untrack(id) { const p = get(id); if (p) { p.tracked = false; save(p); } }
  function tracked() {
    return Object.values(all()).filter(p => p && p.tracked).sort((a, b) => (a.added || 0) - (b.added || 0));
  }

  const snapshot = c => ({ id: c.id, apiId: c.apiId, name: c.name, element: c.element || '', weapon: c.weapon || '', stars: c.stars || 0, icon: c.icon || '' });

  function blank(c) {
    return Object.assign(snapshot(c), {
      cur: 1, tgt: 1,
      talents: [0, 1, 2].map(() => ({ on: false, cur: 1, tgt: 10 })),
      wp: null, have: {}, done: {}, needs: [], tracked: false, added: 0, updated: 0
    });
  }

  function talentSummary(p) {
    const act = (p.talents || []).filter(t => t.on && t.tgt > t.cur);
    if (!act.length) return '';
    const same = act.every(t => t.cur === act[0].cur && t.tgt === act[0].tgt);
    return same
      ? `${act.length} talento${act.length > 1 ? 's' : ''}: nv ${act[0].cur} → ${act[0].tgt}`
      : 'Talentos: ' + act.map(t => `${t.cur}→${t.tgt}`).join(' · ');
  }

  window.Plan = {
    CAPS, all, get, save, remove, untrack, tracked, blank, snapshot,
    compute, progress, frac, expBetween, weaponMax, talentSummary
  };
})();
