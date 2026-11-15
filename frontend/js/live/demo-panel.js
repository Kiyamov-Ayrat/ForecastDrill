/* Демо-панель управления имитатором телеметрии */
(function () {
  'use strict';
  const L = window.FDLive;
  if (!L) { console.warn('[Демо-панель] не найден FDLive: добавьте window.FDLive в live.js'); return; }

  const TYPES = { sticking: 'Прихват', kick: 'Флюидопроявление', loss: 'Поглощение' };
  const PHASE = { precursor: 'нарастание', event: 'пик', recovery: 'спад' };
  const ALLOWED = ['admin', 'ml_engineer', 'supervisor'];

  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:16px;bottom:16px;width:320px;z-index:50;background:var(--card);' +
    'color:var(--tx);border:1px solid var(--bd);border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.25);' +
    'font-size:13px;display:none';
  document.body.appendChild(box);

  let status = null, wells = [], selWell = null, collapsed = false, lastFetch = 0, busy = false;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const visible = () => st.role && st.user && ALLOWED.includes(st.user.role);

  async function fetchAll() {
    busy = true;
    try {
      status = await L.api('/simulation');
      wells = await L.api('/wells');
      if (!wells.some(w => w.id === selWell)) selWell = wells.length ? wells[0].id : null;
      lastFetch = Date.now();
    } catch (e) { status = null; }
    busy = false;
    draw();
  }

  async function act(path, method, body, okMsg) {
    try { status = await L.api(path, { method, body }); if (okMsg) toast(okMsg); }
    catch (e) { toast(e.message); }
    draw();
  }

  function draw() {
    if (!status) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    const cur = status.modes.find(m => m.key === status.mode);
    const eps = status.episodes.map(e => {
      const w = wells.find(x => x.id === e.well_id);
      return `<div>Скв. ${esc(w ? w.name : '?')}: ${TYPES[e.type].toLowerCase()}, ${PHASE[e.phase]} ${Math.round(e.severity * 100)} %</div>`;
    }).join('') || '<div class="tag">Активных осложнений нет</div>';
    box.innerHTML = `<div id="dpHead" style="padding:10px 12px;cursor:pointer;font-weight:700">🧪 Демо: имитатор телеметрии
        <span style="float:right">${collapsed ? '▴' : '▾'}</span></div>
      <div style="padding:0 12px 12px;${collapsed ? 'display:none' : ''}">
        <label style="display:block;margin-bottom:6px">Режим
          <select id="dpMode" style="width:100%">${status.modes.map(m =>
            `<option value="${m.key}" ${m.key === status.mode ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}</select></label>
        <div class="tag" style="margin-bottom:8px">${esc(cur ? cur.description : '')}</div>
        <label style="display:block;margin-bottom:6px">Скважина
          <select id="dpWell" style="width:100%">${wells.map(w =>
            `<option value="${w.id}" ${w.id === selWell ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
          ${Object.keys(TYPES).map(k => `<button class="btn sec" data-type="${k}">${TYPES[k]}</button>`).join('')}</div>
        <button class="btn sec" id="dpStop" style="margin-bottom:8px">Остановить осложнения</button>
        <div>${eps}</div></div>`;
    box.querySelector('#dpHead').onclick = () => { collapsed = !collapsed; draw(); };
    box.querySelector('#dpMode').onchange = e =>
      act('/simulation', 'PUT', { mode: e.target.value }, 'Режим имитатора изменён');
    box.querySelector('#dpWell').onchange = e => { selWell = e.target.value; };
    box.querySelectorAll('[data-type]').forEach(b => b.onclick = () => selWell &&
      act('/simulation/trigger', 'POST', { well_id: selWell, type: b.dataset.type }, 'Запущено: ' + TYPES[b.dataset.type]));
    box.querySelector('#dpStop').onclick = () => act('/simulation/stop', 'POST', {}, 'Осложнения завершаются');
  }

  setInterval(() => {
    if (!visible()) { box.style.display = 'none'; status = null; return; }
    if (busy || box.contains(document.activeElement)) return;     // не мешаем, пока пользователь выбирает
    if (!status || Date.now() - lastFetch > 5000) fetchAll();
  }, 1000);
})();