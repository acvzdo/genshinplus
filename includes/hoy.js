document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  if (document.body.dataset.page !== 'hoy') return;
  const GC = window.GC, API = window.GenshinAPI, Plan = window.Plan, X = window.GCX;
  const { esc, fmt } = GC;
  const $ = s => document.querySelector(s);
  const SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const ORDER = [1, 2, 3, 4, 5, 6, 0];
  const today = X.gameDay();
  const REAL = {};
  let sel = today;

  const plans = Plan.tracked();
  const items = X.aggregate(plans);
  const byPid = {}; plans.forEach(p => { byPid[p.id] = p; });
  const faces = names => {
    const ids = Array.from(new Set(names));
    return `<div class="who-faces" aria-label="Le sirve a">${ids.map(id => {
      const p = byPid[id]; if (!p) return '';
      return `<span class="who-face" title="${esc(p.name)}">${GC.img(GC.planIcon(p), 'who-img', p.name, 40, 40)}</span>`;
    }).join('')}</div>`;
  };
  const matCard = (i, who) => `<div class="mat-card static" title="${esc(who)}">
    ${GC.img(API.materialIconSources(i.id), '', i.name, 40, 40)}
    <span class="count">x${fmt(i.count)}</span><span class="name">${esc(i.name)}</span></div>`;
  const whoTxt = i => i.who.map(w => `${w.name} x${fmt(w.count)}`).join(', ');
  const empty = txt => `<p class="muted mb-0">${txt}</p>`;

  function tabs() {
    $('#day-tabs').innerHTML = ORDER.map(d => `<button type="button" class="chip day-tab" role="tab" data-d="${d}" aria-selected="${d === sel}" aria-pressed="${d === sel}">${SHORT[d]}${d === today ? ' · hoy' : ''}</button>`).join('');
  }

  function books() {
    const open = [];
    X.NATIONS.forEach(n => n.books.forEach((k, bi) => {
      if (sel === 0 || [[1, 4], [2, 5], [3, 6]][bi].includes(sel)) open.push(`${k[0][0].toUpperCase() + k[0].slice(1)} (${n.name})`);
    }));
    $('#books-open').textContent = sel === 0
      ? 'Los domingos se abren todos los dominios.'
      : `${X.DAY_NAMES[sel]}: ${open.join(', ')}.`;

    const mine = items.filter(i => i.sec === 'tal').map(i => {
      const d = X.domainOf(i), real = REAL[i.id];
      if (real) return { i, d: Object.assign({ nation: (real.domain || (d && d.nation) || 'Dominio'), label: (d && d.label) || i.name }, d || {}, { days: real.days, nation: real.domain || (d && d.nation) || 'Dominio' }) };
      return { i, d };
    });
    const todayOnes = mine.filter(m => m.d && (sel === 0 || m.d.days.includes(sel)));
    const unknown = mine.filter(m => !m.d);
    if (!plans.length) { $('#books-list').innerHTML = empty('Aún no tienes personajes en el tracker. <a href="personajes.html">Elige uno</a> para ver aquí qué farmear.'); return; }
    if (!mine.length) { $('#books-list').innerHTML = empty('No te falta ningún libro de talento. ¡Buen trabajo!'); return; }
    let html = '';
    if (todayOnes.length) {
      const byGroup = new Map();
      todayOnes.forEach(({ i, d }) => { const k = d.nation; (byGroup.get(k) || byGroup.set(k, { d, items: [] }).get(k)).items.push(i); });
      html += Array.from(byGroup.values()).map(g => {
        const its = g.items.slice().sort((a, b) => Number(b.id) - Number(a.id));
        const title = /dominio/i.test(g.d.nation) ? g.d.nation : 'Dominio de ' + g.d.nation;
        return `
        <h3 class="tile-eyebrow mt-2">${esc(title)}</h3>
        <div class="mat-list">${its.map(i => matCard(i, whoTxt(i))).join('')}</div>
        <div class="small muted mt-1">Le sirve a:</div>${faces(its.flatMap(i => i.who.map(w => w.id)))}`;
      }).join('');
    } else if (mine.length) {
      html += empty(`Ningún libro que necesitas se abre el ${X.DAY_NAMES[sel].toLowerCase()}. Puedes descansar o ver otro día.`);
    }
    if (unknown.length) html += `<h3 class="tile-eyebrow mt-3">Otros libros de talento</h3><div class="mat-list">${unknown.map(m => matCard(m.i, whoTxt(m.i))).join('')}</div><p class="muted small">No pude saber en qué día se abren; revisa el dominio en el juego.</p>`;
    $('#books-list').innerHTML = html;
  }

  function simple(sec, sel2, none) {
    const its = items.filter(i => i.sec === sec);
    $(sel2).innerHTML = its.length
      ? `<div class="mat-list">${its.map(i => matCard(i, whoTxt(i))).join('')}</div><div class="small muted mt-2">Le sirve a:</div>${faces(its.flatMap(i => i.who.map(w => w.id)))}`
      : empty(plans.length ? none : 'Aún no tienes personajes en el tracker.');
  }

  function resin() {
    const r = X.resin(items);
    $('#resin-info').innerHTML = r.total
      ? `${X.resinIcon(40)} Para lo que te falta de libros y jefes necesitas ≈ <b>${fmt(r.total)}</b> de resina (unos ${r.days < 1 ? 'menos de 1' : (Math.round(r.days * 10) / 10).toString().replace('.', ',')} día(s) de regeneración).`
      : 'No hay nada pendiente que gaste resina.';
  }

  function render() { tabs(); books(); }
  $('#day-tabs').addEventListener('click', e => { const b = e.target.closest('.day-tab'); if (!b) return; sel = Number(b.dataset.d); render(); });
  $('#hoy-sub').textContent = `Hoy es ${X.DAY_NAMES[today].toLowerCase()} (el reinicio del juego es a las 4:00). Qué te conviene farmear según tu tracker.`;
  render();
  Promise.all(items.filter(i => i.sec === 'tal').map(i => X.bookInfo(i).then(r => { if (r) REAL[i.id] = r; }))).then(() => { if (Object.keys(REAL).length) books(); });
  simple('weekly', '#weekly-list', 'No te falta ningún material de jefe semanal.');
  simple('boss', '#boss-list', 'No te falta ningún material de jefe de mundo.');
  resin();
});
