/* S-7. Качество данных для ML-инженера: поток телеметрии и разметка событий */
(function () {
  'use strict';
  const L = window.FDLive;
  if (!L) { console.warn('[Качество данных] не найден FDLive: проверьте live.js'); return; }
  const { api, Bridge, FD } = L;
  const origQuality = (typeof SCREENS !== 'undefined' && SCREENS.quality) ? SCREENS.quality : null;
  const esc = FD.esc;

  const TYPE_RU = { sticking: 'Прихват', kick: 'Флюидопроявление', loss: 'Поглощение' };
  const LABEL = {
    confirmed:   { ru: 'Подтверждено',   icon: '✔', color: 'var(--r)',   badge: 'b-r' },
    false_alarm: { ru: 'Ложная тревога', icon: '✖', color: 'var(--acc)', badge: '' },
    pending:     { ru: 'Ждёт отметки',   icon: '?', color: 'var(--y)',   badge: 'b-y' },
    unmarked:    { ru: 'Без отметки',    icon: '○', color: 'var(--mut)', badge: '' },
    norm:        { ru: 'Норма',          icon: '',  color: 'var(--g)',   badge: 'b-g' }
  };
  const CH = [['flow_out', 'Расход на выходе'], ['pit_level', 'Уровень в ёмкости'], ['spp', 'Давление на стояке'],
              ['torque', 'Момент на роторе'], ['hookload', 'Нагрузка на крюке'], ['flow_in', 'Расход на входе'],
              ['density', 'Плотность раствора']];
  const WINDOWS = [[60, '1 мин'], [300, '5 мин'], [900, '15 мин'], [3600, '1 час'], [21600, '6 часов']];

  const Q = { wellId: null, mode: 'live', windowSec: 300, archiveTo: null, custom: null,
    channels: ['flow_out', 'pit_level', 'spp', 'torque', 'hookload'], view: 'charts', label: 'all',
    data: null, events: [], selected: null, seen: null, sig: '', loading: false, error: null, periodOpen: false };

  const badge = k => `<span class="badge ${LABEL[k].badge}" ${LABEL[k].badge ? '' : 'style="background:var(--bd);color:var(--tx)"'}>${LABEL[k].icon} ${LABEL[k].ru}</span>`;
  const fmtT = iso => new Date(iso).toLocaleTimeString('ru-RU');
  const fmtDT = iso => new Date(iso).toLocaleString('ru-RU');
  const localInput = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  function resetQ() {
    Object.assign(Q, { data: null, events: [], seen: null, sig: '', selected: null, custom: null, mode: 'live', archiveTo: null, error: null });
  }
  function range() {
    if (Q.custom) return Q.custom;
    const to = Q.mode === 'live' ? new Date() : (Q.archiveTo || new Date());
    return { from: new Date(to.getTime() - Q.windowSec * 1000), to };
  }
  const eventsUrl = w => `/wells/${w.id}/quality/events?` + new URLSearchParams({
    from: new Date(Date.now() - 24 * 3600e3).toISOString(), to: new Date().toISOString() });

  /* ---------- Загрузка ---------- */
  async function refresh() {
    const w = Bridge.currentWell();
    if (!w || Q.loading) return;
    Q.loading = true;
    try {
      const r = range();
      const qs = new URLSearchParams({ from: r.from.toISOString(), to: r.to.toISOString(),
                                       channels: Q.channels.join(','), max_points: '600' });
      const [data, events] = await Promise.all([api(`/wells/${w.id}/quality/stream?${qs}`), api(eventsUrl(w))]);
      Q.data = data; Q.events = events; Q.error = null;
      Q.sig = JSON.stringify(events.map(e => [e.id, e.label, e.ended_at, e.peak_index]));
      notify(events);
    } catch (e) { Q.error = e.message; }
    Q.loading = false;
    render();
  }

  function notify(events) {                           // уведомление о новых отметках
    const marks = new Map(events.filter(e => e.label === 'confirmed' || e.label === 'false_alarm').map(e => [e.id, e.label]));
    if (Q.seen) marks.forEach((label, id) => {
      if (Q.seen.get(id) !== label) {
        const e = events.find(x => x.id === id);
        toast(`Новая отметка: ${TYPE_RU[e.type]} — ${LABEL[label].ru.toLowerCase()} (${e.marked_by || '—'})`);
      }
    });
    Q.seen = marks;
  }

  let busy = false;
  setInterval(async () => {                           // автообновление, пока открыт экран
    if (busy || st.cur !== 'quality' || !st.user || st.user.role !== 'ml_engineer' || document.hidden || !Q.data) return;
    const a = document.activeElement;
    if (a && a.matches('input,select,textarea') && document.getElementById('app').contains(a)) return;
    const w = Bridge.currentWell();
    if (!w) return;
    busy = true;
    try {
      if (Q.mode === 'live' && !Q.custom) await refresh();
      else {                                          // в архиве обновляем только список событий
        const events = await api(eventsUrl(w));
        const sig = JSON.stringify(events.map(e => [e.id, e.label, e.ended_at, e.peak_index]));
        if (sig !== Q.sig) { Q.sig = sig; Q.events = events; notify(events); render(); }
      }
    } catch (e) { /* следующий опрос повторит */ } finally { busy = false; }
  }, 2000);

  /* ---------- Действия ---------- */
  window.qRetry = () => { Q.error = null; refresh(); };
  window.qWell = id => { Bridge.current = id; Q.wellId = id; resetQ(); refresh(); };
  window.qMode = m => { Q.custom = null; Q.mode = m; Q.archiveTo = m === 'archive' ? new Date() : null; refresh(); };
  window.qWindow = sec => { Q.windowSec = Number(sec); Q.custom = null; refresh(); };
  window.qShift = k => {
    if (Q.custom) {
      const d = (Q.custom.to - Q.custom.from) * k;
      Q.custom = { from: new Date(+Q.custom.from + d), to: new Date(Math.min(Date.now(), +Q.custom.to + d)) };
    } else {
      const to = Q.mode === 'live' ? new Date() : Q.archiveTo;
      Q.archiveTo = new Date(Math.min(Date.now(), to.getTime() + k * Q.windowSec * 1000));
      Q.mode = 'archive';
    }
    refresh();
  };
  window.qSlide = f => {                              // ползунок по доступному диапазону данных
    const a = new Date(Q.data.available_from).getTime(), b = new Date(Q.data.available_to).getTime();
    const w = Q.windowSec * 1000;
    Q.custom = null; Q.mode = 'archive';
    Q.archiveTo = new Date(a + w + (Number(f) / 1000) * Math.max(0, b - a - w));
    refresh();
  };
  window.qOpen = id => {                              // перейти к событию (с запасом до и после)
    const e = Q.events.find(x => x.id === id);
    if (!e) return;
    Q.selected = id; Q.mode = 'archive';
    const start = new Date(e.started_at).getTime(), end = e.ended_at ? new Date(e.ended_at).getTime() : Date.now();
    const dur = Math.max(end - start, 30000);
    Q.custom = { from: new Date(start - Math.max(120000, dur * 0.6)),
                 to: new Date(Math.min(Date.now(), end + Math.max(60000, dur * 0.3))) };
    refresh();
  };
  function neighbor(dir) {
    const list = [...Q.events].sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
    const i = list.findIndex(x => x.id === Q.selected);
    let e;
    if (i >= 0) e = list[i + dir];
    else {
      const r = range(), c = (r.from.getTime() + r.to.getTime()) / 2;
      e = dir < 0 ? [...list].reverse().find(x => new Date(x.started_at).getTime() < c)
                  : list.find(x => new Date(x.started_at).getTime() > c);
    }
    if (e) window.qOpen(e.id); else toast(dir < 0 ? 'Более ранних событий нет' : 'Более поздних событий нет');
  }
  window.qPrev = () => neighbor(-1);
  window.qNext = () => neighbor(1);
  window.qView = v => { Q.view = v; render(); };
  window.qLabel = f => { Q.label = f; render(); };
  window.qToggle = code => {
    Q.channels = Q.channels.includes(code) ? Q.channels.filter(c => c !== code) : [...Q.channels, code];
    if (!Q.channels.length) Q.channels = [code];
    refresh();
  };
  window.qPeriodToggle = () => { Q.periodOpen = !Q.periodOpen; render(); };
  window.qPeriodReset = () => { Q.custom = null; Q.selected = null; Q.mode = 'live'; Q.archiveTo = null; refresh(); };
  window.qPeriodApply = () => {
    const a = document.getElementById('qFrom').value, b = document.getElementById('qTo').value, err = document.getElementById('qErr');
    const from = new Date(a), to = new Date(b);
    const msg = !a || !b ? 'Укажите начало и конец периода' : from >= to ? 'Начало периода позже конца'
      : to > new Date() ? 'Конец периода в будущем' : (to - from) > 24 * 3600e3 ? 'Период не более 24 часов' : '';
    if (msg) { err.textContent = msg; err.hidden = false; return; }
    Q.custom = { from, to }; Q.mode = 'archive'; Q.periodOpen = false; Q.selected = null;
    refresh();
  };

  /* ---------- Отрисовка ---------- */
  function charts(r) {
    const W = 900, H = 92, t0 = r.from.getTime(), span = r.to.getTime() - t0;
    const x = ts => (new Date(ts).getTime() - t0) / span * W;
    return Q.data.series.map(s => {
      const vals = s.points.map(p => p.value);
      let body = '<text x="10" y="50" fill="currentColor" font-size="13">Нет данных за выбранный период</text>';
      if (vals.length > 1) {
        const min = Math.min(...vals, s.nominal), max = Math.max(...vals, s.nominal), ext = (max - min) || 1;
        const y = v => (H - 8 - (v - min) / ext * (H - 16)).toFixed(1);
        const bands = Q.data.events.map(e => {
          const a = Math.max(0, x(e.started_at)), b = Math.min(W, e.ended_at ? x(e.ended_at) : W);
          if (b <= 0 || a >= W) return '';
          const lb = LABEL[e.label];
          return `<g style="cursor:pointer" onclick="qOpen('${e.id}')"><rect x="${a.toFixed(1)}" y="0" width="${Math.max(b - a, 3).toFixed(1)}" height="${H}" fill="${lb.color}" opacity="${Q.selected === e.id ? 0.38 : 0.18}"/>
            <text x="${(a + 4).toFixed(1)}" y="14" font-size="13" font-weight="700" fill="${lb.color}">${lb.icon}</text>
            <title>${esc(TYPE_RU[e.type])}: ${lb.ru}</title></g>`;
        }).join('');
        const pts = s.points.map(p => x(p.ts).toFixed(1) + ',' + y(p.value)).join(' ');
        body = `${bands}<line x1="0" x2="${W}" y1="${y(s.nominal)}" y2="${y(s.nominal)}" stroke="currentColor" stroke-dasharray="4 4" opacity="0.35"/>
          <polyline fill="none" stroke="var(--acc)" stroke-width="2" vector-effect="non-scaling-stroke" points="${pts}"/>`;
      }
      const last = vals.length ? vals[vals.length - 1].toFixed(2) : '—';
      return `<div class="card" style="padding:10px;margin-top:10px"><div class="row" style="justify-content:space-between">
        <b>${esc(s.name)}, ${esc(s.unit)}</b><span class="tag">последнее ${last} · норма ≈ ${s.nominal}</span></div>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:${H}px;display:block;color:var(--tx)">${body}</svg></div>`;
    }).join('');
  }

  function axis(r) {
    const t0 = r.from.getTime(), span = r.to.getTime() - t0;
    const ticks = Array.from({ length: 5 }, (_, i) => `<span>${new Date(t0 + span * i / 4).toLocaleTimeString('ru-RU')}</span>`).join('');
    return `<div class="row" style="justify-content:space-between;font-size:12px;color:var(--mut);margin-top:4px">${ticks}</div>`;
  }

  function labelAt(ts) {
    const t = new Date(ts).getTime();
    const e = Q.data.events.find(x => t >= new Date(x.started_at).getTime() && t <= (x.ended_at ? new Date(x.ended_at).getTime() : Infinity));
    return e ? e.label : 'norm';
  }
  function paramTable() {
    const rows = [];
    Q.data.series.forEach(s => s.points.forEach(p => rows.push({ s, p, lab: labelAt(p.ts) })));
    rows.sort((a, b) => new Date(b.p.ts) - new Date(a.p.ts));
    const f = rows.filter(x => Q.label === 'all' || x.lab === Q.label).slice(0, 300);
    return `<div class="card" style="margin-top:10px"><table class="tbl"><tr><th>Параметр</th><th>Время</th><th>Осложнение / норма</th><th>Значение</th></tr>
      ${f.map(x => `<tr><td>${esc(x.s.name)}</td><td>${fmtT(x.p.ts)}</td><td>${badge(x.lab)}</td><td>${x.p.value} ${esc(x.s.unit)}</td></tr>`).join('')
        || '<tr><td colspan="4">Нет записей по выбранному фильтру</td></tr>'}</table>
      <p class="tag">Показано до 300 последних записей окна.</p></div>`;
  }

  function eventsTable() {
    const f = Q.events.filter(e => Q.label === 'all' || Q.label === 'norm' || e.label === Q.label).slice().reverse();
    return `<div class="card" style="margin-top:14px"><h3>События за последние 24 часа</h3><table class="tbl">
      <tr><th>Начало</th><th>Тип</th><th>Пик</th><th>Отметка</th><th>Кем</th><th>Комментарий</th></tr>
      ${f.map(e => `<tr style="cursor:pointer;${Q.selected === e.id ? 'background:var(--bg)' : ''}" onclick="qOpen('${e.id}')">
        <td>${fmtT(e.started_at)}</td><td>${TYPE_RU[e.type]}</td><td>${e.peak_index} %</td><td>${badge(e.label)}</td>
        <td>${esc(e.marked_by || '—')}</td><td>${esc((e.comment || '').slice(0, 60)) || '—'}</td></tr>`).join('')
        || '<tr><td colspan="6">Событий нет</td></tr>'}</table></div>`;
  }

  function details() {
    const e = Q.events.find(x => x.id === Q.selected);
    if (!e) return '<div class="card" style="margin-top:14px"><span class="tag">Выберите событие в списке или нажмите на цветную полосу графика.</span></div>';
    const hint = { confirmed: 'Положительный пример для обучения', false_alarm: 'Отрицательный пример для обучения',
                   pending: 'Тревога активна: отметки ещё нет', unmarked: 'Отметки нет: в обучении не используется' }[e.label];
    return `<div class="card" style="margin-top:14px"><h3>${TYPE_RU[e.type]}: ${fmtDT(e.started_at)}</h3>
      <div class="row">${badge(e.label)}<span class="tag">${hint}</span></div>
      <table class="tbl" style="margin-top:8px">
        <tr><td>Окончание</td><td>${e.ended_at ? fmtDT(e.ended_at) : 'тревога ещё активна'}</td></tr>
        <tr><td>Пик индекса риска</td><td>${e.peak_index} %</td></tr>
        <tr><td>Отметил</td><td>${esc(e.marked_by || '—')}${e.marked_at ? ', ' + fmtDT(e.marked_at) : ''}</td></tr>
        <tr><td>Комментарий</td><td>${esc(e.comment || '—')}</td></tr>
        <tr><td>Результат разбора</td><td>${esc(e.review_note || '—')}</td></tr></table></div>`;
  }

  function qualityView() {
    if (!st.user || st.user.role !== 'ml_engineer')
      return origQuality ? origQuality() : '<div class="card">Сводка качества каналов для вашей роли появится в следующей версии.</div>';
    const ws = L.ensure('wells', L.loadWells);
    if (ws.state !== 'ready') return L.pending(ws);
    const w = Bridge.currentWell();
    if (!w) return '<div class="card">Нет доступных скважин.</div>';
    if (Q.wellId !== w.id) { Q.wellId = w.id; resetQ(); }
    if (!Q.data && !Q.loading && !Q.error) refresh();
    if (Q.error && !Q.data)
      return `<div class="card" role="alert"><b>Не удалось загрузить данные</b><p>${esc(Q.error)}</p><button class="btn" onclick="qRetry()">Повторить</button></div>`;
    if (!Q.data) return '<div class="card">Загрузка данных…</div>';

    const r = range();
    const c = k => Q.events.filter(e => e.label === k).length;
    const conf = c('confirmed'), fa = c('false_alarm');
    const prec = conf + fa ? Math.round(conf / (conf + fa) * 100) + ' %' : '—';
    const a = Q.data.available_from ? new Date(Q.data.available_from).getTime() : 0;
    const b = Q.data.available_to ? new Date(Q.data.available_to).getTime() : 0;
    const wms = Q.windowSec * 1000, canSlide = b - a > wms;
    const slider = canSlide ? Math.max(0, Math.min(1000, Math.round((r.to.getTime() - (a + wms)) / (b - a - wms) * 1000))) : 1000;
    const wellSel = Bridge.wells.map(x => `<option value="${x.id}" ${x.id === w.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    const winSel = WINDOWS.map(([s, t]) => `<option value="${s}" ${s === Q.windowSec ? 'selected' : ''}>${t}</option>`).join('');
    const chips = [['all', 'Все'], ['confirmed', '✔ Подтверждено'], ['false_alarm', '✖ Ложные'], ['pending', '? Ждут отметки'], ['unmarked', '○ Без отметки'], ['norm', 'Норма']]
      .map(([k, t]) => `<button class="btn ${Q.label === k ? '' : 'sec'}" onclick="qLabel('${k}')">${t}</button>`).join('');
    const live = Q.mode === 'live' && !Q.custom;

    return `
      <div class="card"><div class="row">
        <b>Размеченные события, 24 ч:</b>
        <span>${badge('confirmed')} ${conf}</span><span>${badge('false_alarm')} ${fa}</span>
        <span>${badge('pending')} ${c('pending')}</span><span>${badge('unmarked')} ${c('unmarked')}</span>
        <b style="margin-left:auto">Достоверность по отметкам: ${prec}</b></div></div>
      <div class="card" style="margin-top:14px">
        <div class="row">
          <label>Скважина<select onchange="qWell(this.value)">${wellSel}</select></label>
          <label>Окно<select onchange="qWindow(this.value)">${winSel}</select></label>
          ${live ? '<span class="badge b-g">● Поток</span>' : '<span class="badge b-y">Архив</span>'}
          <button class="btn sec" onclick="qPeriodToggle()">Период…</button>
          ${Q.custom ? '<button class="btn sec" onclick="qPeriodReset()">Сбросить период</button>' : ''}
          <span class="tag" style="margin-left:auto">${fmtDT(r.from)} — ${fmtDT(r.to)} · шаг ${Q.data.step_seconds} с</span></div>
        ${Q.periodOpen ? `<div class="row" style="margin-top:10px">
          <label>Начало<input type="datetime-local" id="qFrom" value="${localInput(r.from)}"></label>
          <label>Конец<input type="datetime-local" id="qTo" value="${localInput(r.to)}"></label>
          <button class="btn" onclick="qPeriodApply()">Показать</button>
          <span id="qErr" role="alert" hidden style="color:var(--r);font-weight:700"></span></div>` : ''}
        <div class="row" style="margin-top:10px">
          <button class="btn sec" onclick="qPrev()">⏮ Предыдущее событие</button>
          <button class="btn sec" onclick="qShift(-0.5)">◀ −½ окна</button>
          <input type="range" min="0" max="1000" value="${slider}" ${canSlide ? '' : 'disabled'} onchange="qSlide(this.value)" style="flex:1;min-width:160px">
          <button class="btn sec" onclick="qShift(0.5)">+½ окна ▶</button>
          <button class="btn sec" onclick="qNext()">Следующее событие ⏭</button>
          <button class="btn ${live ? '' : 'sec'}" onclick="qMode('live')">К текущему</button></div>
        <div class="row" style="margin-top:10px">${CH.map(([code, name]) =>
          `<label style="flex-direction:row;align-items:center;gap:4px"><input type="checkbox" ${Q.channels.includes(code) ? 'checked' : ''} onchange="qToggle('${code}')">${name}</label>`).join('')}</div>
        <div class="row" style="margin-top:10px">
          <button class="btn ${Q.view === 'charts' ? '' : 'sec'}" onclick="qView('charts')">Графики</button>
          <button class="btn ${Q.view === 'table' ? '' : 'sec'}" onclick="qView('table')">Таблица параметров</button>
          <span style="margin-left:12px" class="tag">Фильтр:</span>${chips}</div>
        <div class="tag" style="margin-top:8px">Полосы на графиках: ✔ подтверждено · ✖ ложная тревога · ? ждёт отметки · ○ без отметки. Нажмите на полосу, чтобы открыть событие.</div>
      </div>
      ${Q.view === 'charts' ? charts(r) + axis(r) : paramTable()}
      ${eventsTable()}${details()}`;
  }

  registerScreen('quality', qualityView);
})();