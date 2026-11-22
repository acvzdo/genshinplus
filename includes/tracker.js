document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  if (document.body.dataset.page !== 'tracker') return;

  const GC = window.GC, API = window.GenshinAPI, Plan = window.Plan;
  const UI = {
    confirm: o => (GC.ui ? GC.ui.confirm(o) : Promise.resolve(window.confirm(o.title + (o.text ? '\n' + o.text : '')))),
    toast: (t, i) => { if (GC.ui) GC.ui.toast(t, i); }
  };
  const { esc, fmt } = GC;
  const $ = s => document.querySelector(s);
  const listEl = $('#track-list'), emptyEl = $('#track-empty'), sumEl = $('#track-summary');
  const X = window.GCX;
  const hrs = d => d < 1 ? 'menos de 1 día' : (Math.round(d * 10) / 10).toString().replace('.', ',') + ' días';

  const avatar = p => GC.img(GC.planIcon(p), 'char-img-slot track-avatar', p.name, 64, 64);

  function resinLine(p) {
    if (!X) return '';
    const r = X.resin(X.aggregate([p]));
    return r.total ? `<p class="muted small mb-1 resin-line">${X.resinIcon(30)} Resina estimada para lo que falta: ≈ ${fmt(r.total)}</p>` : '';
  }

  const SORT_KEY = 'gc_track_sort', TEAMS_KEY = 'gc_teams_v1';
  let sortMode = GC.store.get(SORT_KEY, 'mine');
  if (!['mine', 'close', 'name'].includes(sortMode)) sortMode = 'mine';

  const byRank = plans => plans.slice().sort((a, b) => (a.rank != null ? a.rank : (a.added || 0)) - (b.rank != null ? b.rank : (b.added || 0)));
  function ordered(plans) {
    let l = byRank(plans);
    if (sortMode === 'name') l.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    if (sortMode === 'close') {
      const pc = p => { const r = Plan.progress(p); return r.total && r.pct === 100 ? -1 : r.pct; };
      l.sort((a, b) => pc(b) - pc(a));
    }
    return l.sort((a, b) => (b.next ? 1 : 0) - (a.next ? 1 : 0));
  }
  function move(id, dir) {
    const list = byRank(Plan.tracked());
    const i = list.findIndex(p => p.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((p, k) => { if (p.rank !== k * 10) { p.rank = k * 10; Plan.save(p); } });
    render();
  }
  function setNext(id) {
    const p = Plan.get(id); if (!p) return;
    const turnOn = !p.next;
    Plan.tracked().forEach(q => { if (q.next && q.id !== id) { q.next = false; Plan.save(q); } });
    p.next = turnOn; Plan.save(p);
    render();
    UI.toast(turnOn ? `${p.name} es tu siguiente objetivo` : 'Objetivo quitado', 'info');
  }

  const openSet = new Set();
  function card(p, first, last) {
    const pr = Plan.progress(p);
    const pending = (p.needs || []).filter(n => Plan.frac(p, n) < 1);
    const chips = [];
    if (p.tgt > p.cur) chips.push(`Nivel ${p.cur} → ${p.tgt}`);
    const ts = Plan.talentSummary(p);
    if (ts) chips.push(ts);
    if (p.wp) chips.push(`Arma: ${p.wp.name}${p.wp.tgt > p.wp.cur ? ` (${p.wp.cur} → ${p.wp.tgt})` : ''}`);

    const matsHtml = (p.needs || []).map(n => {
      const d = Plan.frac(p, n) >= 1;
      return `<button type="button" class="mat-card ${d ? 'is-done' : ''}" data-pid="${esc(p.id)}" data-k="${esc(n.k)}" aria-pressed="${d}" title="${esc(n.name)}">
        <span class="tick" aria-hidden="true">✓</span>
        ${GC.img(API.materialIconSources(n.id), '', n.name, 40, 40)}
        <span class="count">x${fmt(n.count)}</span><span class="name">${esc(n.name)}</span></button>`;
    }).join('');

    const complete = pr.total > 0 && pr.pct === 100;
    return `
      <article class="tile track-card el-${esc(p.element || 'none')} ${p.next ? 'is-next' : ''}" data-id="${esc(p.id)}">
        ${p.next ? '<span class="next-flag">★ Siguiente objetivo</span>' : ''}
        <div class="d-flex align-items-center gap-3">
          <a class="track-link d-flex align-items-center gap-3 flex-grow-1 text-decoration-none" style="min-width:0;color:inherit" href="detalle.html?char=${encodeURIComponent(p.id)}" aria-label="Abrir plan de ${esc(p.name)}">
            ${avatar(p)}
            <div class="flex-grow-1" style="min-width:0">
              <h2 class="tile-title mb-0">${esc(p.name)}</h2>
              <div class="muted small">${[p.element, p.weapon, p.stars ? p.stars + ' estrellas' : ''].filter(Boolean).map(esc).join(' · ')}</div>
            </div>
          </a>
          <div class="ring ${complete ? 'is-done' : ''}" style="--p:${pr.pct}" role="img" aria-label="Completado ${pr.pct}%"><span>${pr.pct}%</span></div>
        </div>
        <div class="progress" role="progressbar" aria-label="Progreso de ${esc(p.name)}" aria-valuenow="${pr.pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" style="width:${pr.pct}%"></div>
        </div>
        <div class="track-meta">${chips.map(c => `<span class="badge-soft">${esc(c)}</span>`).join('') || '<span class="badge-soft">Sin cambios en el plan</span>'}</div>
        ${resinLine(p)}
        <p class="muted small mb-0">${pr.total
          ? (complete ? 'Tienes todos los materiales.' : `${pr.done} de ${pr.total} materiales listos · faltan ${pr.total - pr.done}`)
          : 'Este plan no tiene materiales.'}</p>
        ${(p.needs || []).length ? `<details class="track-details" data-pid="${esc(p.id)}" ${openSet.has(p.id) ? 'open' : ''}><summary>Materiales (${pending.length} por conseguir) · pulsa para marcar</summary><div class="mat-list">${matsHtml}</div></details>` : ''}
        <div class="d-flex gap-2 flex-wrap align-items-center">
          <button type="button" class="btn-ghost next-btn" data-next="${esc(p.id)}" aria-pressed="${!!p.next}" title="Marcar como siguiente objetivo">${p.next ? '★ Siguiente' : '☆ Siguiente'}</button>
          ${sortMode === 'mine' ? `<span class="move-btns"><button type="button" class="btn-ghost move-btn" data-move="${esc(p.id)}" data-dir="-1" aria-label="Subir a ${esc(p.name)}" ${first ? 'disabled' : ''}>▲</button><button type="button" class="btn-ghost move-btn" data-move="${esc(p.id)}" data-dir="1" aria-label="Bajar a ${esc(p.name)}" ${last ? 'disabled' : ''}>▼</button></span>` : ''}
          <a class="btn-apple text-decoration-none" href="detalle.html?char=${encodeURIComponent(p.id)}">Editar plan</a>
          <button type="button" class="btn-ghost" data-remove="${esc(p.id)}">Quitar</button>
        </div>
      </article>`;
  }

  function render() {
    listEl.querySelectorAll('details[open]').forEach(d => openSet.add(d.dataset.pid));
    listEl.querySelectorAll('details:not([open])').forEach(d => openSet.delete(d.dataset.pid));
    const plans = Plan.tracked();
    emptyEl.hidden = plans.length > 0;
    sumEl.hidden = plans.length === 0;
    const list = ordered(plans);
    listEl.innerHTML = list.map((p, i) => card(p, i === 0, i === list.length - 1)).join('');
    $('#track-sort').value = sortMode;
    renderTeams();
    $('#total-wrap').hidden = plans.length === 0;
    if (!$('#total-box').hidden) renderTotal();
    if (plans.length) {
      const avg = Math.round(plans.reduce((s, p) => s + Plan.progress(p).pct, 0) / plans.length);
      sumEl.textContent = `${plans.length} personaje${plans.length === 1 ? '' : 's'} en seguimiento · progreso general ${avg}%`;
    }
  }

  listEl.addEventListener('click', e => {
    const m = e.target.closest('.mat-card[data-pid]');
    if (m) {
      const p = Plan.get(m.dataset.pid);
      if (!p) return;
      p.done = p.done || {};
      if (p.done[m.dataset.k]) delete p.done[m.dataset.k]; else p.done[m.dataset.k] = true;
      Plan.save(p);
      render();
      return;
    }
    const mv = e.target.closest('[data-move]');
    if (mv) { move(mv.dataset.move, Number(mv.dataset.dir)); return; }
    const nx = e.target.closest('[data-next]');
    if (nx) { setNext(nx.dataset.next); return; }
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    const p = Plan.get(b.dataset.remove);
    if (!p) return;
    UI.confirm({ title: `¿Quitar a ${p.name} del tracker?`, text: 'Tu plan se conserva como borrador.', ok: 'Sí, quitar', icon: 'warning', image: 'includes/images/quit.png', danger: true }).then(ok => {
      if (!ok) return;
      Plan.untrack(p.id);
      render();
      UI.toast(`${p.name} quitado del tracker`, 'info');
    });
  });

  $('#track-sort').addEventListener('change', e => { sortMode = e.target.value; GC.store.set(SORT_KEY, sortMode); render(); });

  const teams = () => GC.store.get(TEAMS_KEY, []);
  const saveTeams = t => GC.store.set(TEAMS_KEY, t);
  const openTeams = new Set();
  function teamCard(t) {
    const all = Plan.tracked();
    const members = t.members.map(id => all.find(p => p.id === id)).filter(Boolean);
    const avg = members.length ? Math.round(members.reduce((s, p) => s + Plan.progress(p).pct, 0) / members.length) : 0;
    const faces = members.map(p => `<span class="who-face" title="${esc(p.name)}">${GC.img(GC.planIcon(p), 'who-img', p.name, 40, 40)}</span>`).join('');
    let detail = '';
    if (openTeams.has(t.id) && members.length) {
      const items = X.aggregate(members), r = X.resin(items);
      detail = items.length
        ? X.SEC_ORDER.map(sec => {
            const its = items.filter(i => i.sec === sec);
            return its.length ? `<h3 class="tile-eyebrow mt-3">${esc(X.SEC_LABEL[sec])}</h3><div class="mat-list">${its.map(i => `<div class="mat-card static" title="${esc(i.who.map(w => w.name + ' x' + fmt(w.count)).join(', '))}">${GC.img(API.materialIconSources(i.id), '', i.name, 40, 40)}<span class="count">x${fmt(i.count)}</span><span class="name">${esc(i.name)}</span></div>`).join('')}</div>` : '';
          }).join('') + (r.total ? `<p class="small muted mt-3 mb-0">${X.resinIcon(26)} Resina estimada: ≈ ${fmt(r.total)} (aprox.)</p>` : '')
        : '<p class="muted mt-3 mb-0">Este equipo tiene todos los materiales.</p>';
    }
    return `<article class="tile team-card" data-team="${esc(t.id)}">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h3 class="tile-title mb-0">${esc(t.name)}</h3>
        <span class="muted small">${members.length} personaje${members.length === 1 ? '' : 's'} · avance ${avg}%</span>
      </div>
      <div class="who-faces">${faces || '<span class="muted small">Sin personajes en el tracker</span>'}</div>
      <div class="progress mt-2" role="progressbar" aria-label="Avance de ${esc(t.name)}" aria-valuenow="${avg}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${avg}%"></div></div>
      <div class="d-flex gap-2 flex-wrap mt-3">
        <button type="button" class="btn-ghost" data-team-toggle="${esc(t.id)}" aria-expanded="${openTeams.has(t.id)}">${openTeams.has(t.id) ? 'Ocultar lo que falta' : 'Ver lo que falta'}</button>
        <button type="button" class="btn-ghost" data-team-edit="${esc(t.id)}">Editar</button>
        <button type="button" class="btn-ghost" data-team-del="${esc(t.id)}">Eliminar</button>
      </div>${detail}</article>`;
  }
  function renderTeams() {
    const has = Plan.tracked().length > 0;
    $('#teams-wrap').hidden = !has;
    const list = teams();
    $('#teams-list').innerHTML = list.length ? list.map(teamCard).join('')
      : '<p class="muted mb-0">Agrupa personajes en equipos (por ejemplo, "Abismo") para ver cuánto falta de todo el grupo.</p>';
  }
  async function teamDialog(team) {
    const all = Plan.tracked();
    if (!all.length) return;
    const cur = team ? team.members : [];
    if (!window.Swal) {
      const name = window.prompt('Nombre del equipo:', team ? team.name : '');
      if (!name) return;
      const t = team || { id: 't' + Date.now().toString(36), members: all.map(p => p.id) };
      t.name = name.slice(0, 40);
      const l = teams(); const i = l.findIndex(x => x.id === t.id);
      if (i >= 0) l[i] = t; else l.push(t);
      saveTeams(l); render(); return;
    }
    const r = await Swal.fire({
      title: team ? 'Editar equipo' : 'Nuevo equipo',
      html: `<input id="tm-name" class="swal2-input" maxlength="40" placeholder="Nombre del equipo" value="${esc(team ? team.name : '')}">
        <div class="tm-pick" role="group" aria-label="Personajes">${all.map(p => `<label class="tm-opt"><input type="checkbox" value="${esc(p.id)}" ${cur.includes(p.id) ? 'checked' : ''}>${GC.img(GC.planIcon(p), 'who-img', p.name, 32, 32)}<span>${esc(p.name)}</span></label>`).join('')}</div>`,
      showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', confirmButtonColor: '#1976D2', cancelButtonColor: '#6B7280', reverseButtons: true,
      preConfirm: () => {
        const name = document.getElementById('tm-name').value.trim();
        const members = Array.from(document.querySelectorAll('.tm-pick input:checked')).map(i => i.value);
        if (!name) { Swal.showValidationMessage('Ponle un nombre al equipo'); return false; }
        if (!members.length) { Swal.showValidationMessage('Elige al menos un personaje'); return false; }
        return { name, members };
      }
    });
    if (!r.isConfirmed) return;
    const l = teams();
    if (team) { const i = l.findIndex(x => x.id === team.id); if (i >= 0) l[i] = Object.assign({}, team, r.value); }
    else l.push({ id: 't' + Date.now().toString(36), name: r.value.name, members: r.value.members });
    saveTeams(l); render(); UI.toast('Equipo guardado');
  }
  $('#btn-team-new').addEventListener('click', () => teamDialog(null));
  $('#teams-list').addEventListener('click', async e => {
    const tg = e.target.closest('[data-team-toggle]');
    if (tg) { const id = tg.dataset.teamToggle; if (openTeams.has(id)) openTeams.delete(id); else openTeams.add(id); render(); return; }
    const ed = e.target.closest('[data-team-edit]');
    if (ed) { teamDialog(teams().find(t => t.id === ed.dataset.teamEdit)); return; }
    const del = e.target.closest('[data-team-del]');
    if (del) {
      const t = teams().find(x => x.id === del.dataset.teamDel); if (!t) return;
      if (await UI.confirm({ title: `¿Eliminar el equipo "${t.name}"?`, text: 'Los personajes y sus planes no se borran.', ok: 'Sí, eliminar', icon: 'warning', danger: true })) {
        saveTeams(teams().filter(x => x.id !== t.id)); openTeams.delete(t.id); render(); UI.toast('Equipo eliminado', 'info');
      }
    }
  });

  function renderTotal() {
    const plans = Plan.tracked();
    const items = X.aggregate(plans);
    const box = $('#total-box');
    if (!items.length) { box.innerHTML = '<h2 class="tile-title">¡Nada pendiente!</h2><p class="muted mb-0">Tienes todos los materiales de tus planes.</p>'; return; }
    const r = X.resin(items);
    const sections = X.SEC_ORDER.map(sec => {
      const its = items.filter(i => i.sec === sec);
      if (!its.length) return '';
      const cards = its.map(i => `<div class="mat-card static" title="${esc(i.who.map(w => w.name + ' x' + fmt(w.count)).join(', '))}">
          ${GC.img(API.materialIconSources(i.id), '', i.name, 40, 40)}
          <span class="count">x${fmt(i.count)}</span><span class="name">${esc(i.name)}</span></div>`).join('');
      return `<h3 class="tile-eyebrow mt-3">${esc(X.SEC_LABEL[sec])}</h3><div class="mat-list">${cards}</div>`;
    }).join('');
    const resinHtml = r.total ? `
      <h3 class="tile-eyebrow mt-4">Resina estimada</h3>
      <p class="mb-1 resin-line">${X.resinIcon(44)} <b>≈ ${fmt(r.total)}</b> de resina · unos ${hrs(r.days)} de regeneración natural</p>
      <ul class="small muted mb-1">${r.parts.map(p => `<li>${esc(p.label)}: ${p.runs} vuelta(s) · ${fmt(p.resin)}${p.extra ? ' · ' + esc(p.extra) : ''}</li>`).join('')}</ul>
      <p class="small muted mb-0">Estimación con promedios aproximados. No incluye Mora, EXP ni materiales locales.</p>` : '';
    box.innerHTML = `<h2 class="tile-title">Total de todos tus personajes</h2>
      <p class="muted small mb-0">Esto es lo que falta sumando tus ${plans.length} plan(es). No hace falta hacerlo todo ya: ve a tu ritmo.</p>${sections}${resinHtml}`;
  }
  $('#btn-total').addEventListener('click', () => {
    const box = $('#total-box'), btn = $('#btn-total');
    const open = box.hidden;
    box.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Ocultar el total' : 'Total de todos tus personajes';
    if (open) renderTotal();
  });

  $('#btn-export').addEventListener('click', () => {
    if (!Object.keys(Plan.all()).length) { UI.toast('Todavía no tienes planes para exportar', 'info'); return; }
    const blob = new Blob([X.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `genshin-plus-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    UI.toast('Progreso exportado');
  });
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let text;
    try { text = await file.text(); } catch (err) { UI.toast('No se pudo leer el archivo', 'error'); return; }
    let mode = 'merge';
    if (window.Swal) {
      const r = await Swal.fire({ title: 'Importar progreso', text: '¿Combinar con lo que ya tienes o reemplazarlo todo?', icon: 'question',
        showDenyButton: true, showCancelButton: true, confirmButtonText: 'Combinar', denyButtonText: 'Reemplazar', cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1976D2', denyButtonColor: '#D32F2F', cancelButtonColor: '#6B7280' });
      if (r.isDismissed) return;
      mode = r.isDenied ? 'replace' : 'merge';
    } else if (!window.confirm('Se combinará el respaldo con tus planes actuales. ¿Continuar?')) return;
    try {
      const n = X.importJson(text, mode);
      render();
      UI.toast(`${n} plan(es) importado(s)`);
    } catch (err) {
      if (window.Swal) Swal.fire({ title: 'No se pudo importar', text: err.message, icon: 'error', confirmButtonColor: '#1976D2' });
      else window.alert(err.message);
    }
  });

  render();
});
