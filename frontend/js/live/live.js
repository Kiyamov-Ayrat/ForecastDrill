/* js/live/live.js — подключение интерфейса к REST API БурПрогноз */
(function () {
  'use strict';

  /* ---------- Проверка окружения ---------- */
  const present = { st: typeof st, ROLES: typeof ROLES, render: typeof render,
                    registerScreen: typeof registerScreen, toast: typeof toast, go: typeof go };
  const missing = Object.keys(present).filter(k => present[k] === 'undefined');
  if (missing.length) {
    console.error('[БурПрогноз] Не найдено: ' + missing.join(', ') +
                  '. Проверьте порядок <script>: live.js должен идти после main.js');
    return;
  }

  /* ---------- Справочники ---------- */
  const TYPE_RU = { sticking: 'Прихват', kick: 'Флюидопроявление', loss: 'Поглощение' };
  const LEVEL_CLS = { green: 'g', yellow: 'y', red: 'r' };
  const LEVEL_RU = { green: 'Норма', yellow: 'Внимание', red: 'Высокий риск' };
  const STATUS_RU = { active: 'Активно', confirmed: 'Подтверждено', false_alarm: 'Ложная тревога', closed: 'Закрыто' };
  const ROLE_MAP = { operator: 'op', supervisor: 'sv', ml_engineer: 'ml', director: 'td', admin: 'ad' };
  const ROLE_NAME = { operator: 'Оператор буровой', supervisor: 'Супервайзер', ml_engineer: 'ML-инженер',
                      director: 'Технический директор', admin: 'Администратор' };

  function roleKey(apiRole) {                         // ключ роли в вашем ROLES
    if (ROLES[ROLE_MAP[apiRole]]) return ROLE_MAP[apiRole];
    return Object.keys(ROLES).find(k => ROLES[k].n === ROLE_NAME[apiRole]) || null;
  }

  /* ---------- Вспомогательное ---------- */
  const FD = {
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    msg(id, text) { const e = document.getElementById(id); if (e) { e.hidden = !text; e.textContent = text || ''; } },
    time: iso => iso ? new Date(iso).toLocaleTimeString('ru-RU') : '—',
    badge: (lvl, text) => `<span class="badge b-${LEVEL_CLS[lvl]}">${text}</span>`,
    top(s) {
      const sev = { green: 0, yellow: 1, red: 2 };
      return [...s.items].sort((a, b) => sev[b.level] - sev[a.level] || b.probability - a.probability)[0];
    },
    spark(values, { h = 110, th = false } = {}) {
      const v = values.length > 1 ? values : [values[0] || 0, values[0] || 0];
      const w = 320, y = a => (h - Math.min(100, Math.max(0, a)) / 100 * h).toFixed(1);
      const pts = v.map((a, i) => (i * w / (v.length - 1)).toFixed(1) + ',' + y(a)).join(' ');
      const ln = (val, c) => `<line x1="0" x2="${w}" y1="${y(val)}" y2="${y(val)}" stroke="var(--${c})" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`;
      return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block">${th ? ln(40, 'y') + ln(70, 'r') : ''}<polyline fill="none" stroke="var(--acc)" stroke-width="2.4" vector-effect="non-scaling-stroke" points="${pts}"/></svg>`;
    }
  };

  /* ---------- Сеанс и клиент API ---------- */
  const API_BASE = window.API_BASE || '/api/v1';
  const Session = {
    save(t) { try { sessionStorage.setItem('fd_token', t); } catch (e) { /* хранилище недоступно */ } },
    token() { try { return sessionStorage.getItem('fd_token'); } catch (e) { return null; } },
    clear() { try { sessionStorage.removeItem('fd_token'); } catch (e) { /* ignore */ } }
  };
  class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }

  async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Session.token();
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try {
      res = await fetch(API_BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) { throw new ApiError(0, 'Нет соединения с сервером'); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* пустое тело */ }
    if (res.status === 401 && path !== '/auth/login') {
      toast('Сеанс истёк. Войдите снова');
      window.logout();
      throw new ApiError(401, 'Сеанс истёк');
    }
    if (!res.ok) {
      const err = data && data.error;
      let msg = err ? err.message : 'Ошибка сервера (' + res.status + ')';
      if (err && err.details && err.details.length)
        msg += ': ' + err.details.map(d => d.message.replace(/^Value error, /, '')).join('; ');
      throw new ApiError(res.status, msg);
    }
    return data;
  }

  /* ---------- Данные с сервера ---------- */
  const Bridge = {
    wells: [], current: null, snapshot: null, history: [], alerts: [], thresholds: [],
    filter: 'all', cache: {}, timer: null, busy: false, failed: false,
    reset() { Object.assign(this, { wells: [], current: null, snapshot: null, history: [], alerts: [], thresholds: [], cache: {}, filter: 'all', failed: false }); },
    currentWell() { return this.wells.find(w => w.id === this.current) || null; },
    start() {
      this.stop();
      this.timer = setInterval(() => this.tick(), 2000);
    },
    stop() { clearInterval(this.timer); this.timer = null; },
    async tick() {                                   // периодическое обновление открытого экрана
      if (this.busy || !st.role || document.hidden) return;
      const view = st.cur;
      if (!['dash', 'risk', 'well'].includes(view)) return;
      const slot = this.cache[view === 'dash' ? 'wells' : 'risk:' + this.current];
      if (!slot || slot.state !== 'ready') return;
      this.busy = true;
      try {
        if (view === 'dash') await loadWells(); else await loadRisk();
        this.failed = false;
        render();
      } catch (e) {
        if (!this.failed) { this.failed = true; toast(e.message); }
      } finally { this.busy = false; }
    }
  };

  async function loadWells() {
    Bridge.wells = await api('/wells');
    if (!Bridge.wells.some(w => w.id === Bridge.current)) Bridge.current = Bridge.wells.length ? Bridge.wells[0].id : null;
  }
  async function loadRisk() {
    const w = Bridge.currentWell();
    if (!w) return;
    const [snap, hist, alerts] = await Promise.all([
      api(`/wells/${w.id}/risk`), api(`/wells/${w.id}/risk/history?minutes=30`), api(`/alerts?well_id=${w.id}&limit=20`)]);
    Bridge.snapshot = snap; Bridge.history = hist.map(p => p.index); Bridge.alerts = alerts;
    if (typeof Alerts !== 'undefined' && Alerts.check) Alerts.check(snap.index);   // звук из лабораторной 3, если подключён
  }
  async function loadThresholds() {
    const w = Bridge.currentWell();
    if (w) Bridge.thresholds = await api(`/wells/${w.id}/thresholds`);
  }

  /* Загрузка «по требованию»: экран показывает «Загрузка…», затем перерисовывается с данными */
  function ensure(key, loader) {
    let slot = Bridge.cache[key];
    if (!slot) {
      slot = Bridge.cache[key] = { state: 'loading' };
      loader().then(() => { slot.state = 'ready'; render(); })
              .catch(e => { slot.state = 'error'; slot.error = e.message; render(); });
    }
    return slot;
  }
  function pending(slot) {
    if (slot.state === 'error')
      return `<div class="card" role="alert"><b>Не удалось загрузить данные</b><p>${FD.esc(slot.error)}</p>
              <button class="btn" onclick="retryLoad()">Повторить</button></div>`;
    return '<div class="card">Загрузка данных…</div>';
  }
  window.retryLoad = function () { Bridge.cache = {}; render(); };
  window.setFilter = function (f) { Bridge.filter = f; render(); };
  window.openWell = function (id) { Bridge.current = id; go('well'); };

  /* ---------- Общие блоки экранов ---------- */
  const levelCard = it => `<div class="card"><div class="tag">${TYPE_RU[it.type]}</div>
    <div class="idx" style="color:var(--${LEVEL_CLS[it.level]})">${it.probability} %</div>${FD.badge(it.level, LEVEL_RU[it.level])}
    <div class="bar"><i style="width:${it.probability}%;background:var(--${LEVEL_CLS[it.level]})"></i></div></div>`;

  function wellBar() {
    const w = Bridge.currentWell(), s = Bridge.snapshot;
    const stale = s && s.ts && Date.now() - new Date(s.ts) > 10000;
    return `<div class="card row" style="margin-bottom:14px"><b>Скважина ${FD.esc(w.name)}</b><span>${FD.esc(w.field)}</span>
      ${stale ? FD.badge('yellow', 'Данные устарели') : FD.badge('green', 'Данные: норма')}
      <span class="tag">обновлено ${FD.time(s && s.ts)}</span></div>`;
  }

  function alertBanner(s) {
    if (s.level === 'green')
      return `<div class="alert" style="border-color:var(--g);background:var(--gbg)"><b style="font-size:20px">✔ Риск в норме</b></div>`;
    const t = FD.top(s);
    const why = s.reasons.slice(0, 2).map(r => `${FD.esc(r.feature)} (${r.contribution} %)`).join(', ');
    return `<div class="alert ${s.level === 'red' ? 'r' : 'y'}" role="alert"><div class="row">
      <b style="font-size:22px">⚠ ${LEVEL_RU[s.level]}: ${TYPE_RU[t.type].toLowerCase()}</b>
      ${FD.badge(s.level, s.level === 'red' ? 'красный уровень' : 'жёлтый уровень')}</div>
      <p style="font-size:18px;margin:8px 0 0"><b>Основной вклад:</b> ${why}.<br>
      <b>Рекомендация:</b> ${FD.esc(s.recommendation || '')} <span class="tag">(демо-текст)</span></p></div>`;
  }

  /* Контекст «скважина + риск» для экранов S-2 и S-4 */
  function riskContext() {
    const ws = ensure('wells', loadWells);
    if (ws.state !== 'ready') return { html: pending(ws) };
    const w = Bridge.currentWell();
    if (!w) return { html: '<div class="card">Вам не назначены скважины. Обратитесь к администратору.</div>' };
    const rs = ensure('risk:' + w.id, loadRisk);
    if (rs.state !== 'ready') return { html: pending(rs) };
    const s = Bridge.snapshot;
    if (!s || s.data_status === 'no_data')
      return { html: `<div class="card">Для скважины ${FD.esc(w.name)} прогноз ещё не рассчитан. Данные появятся через несколько секунд.</div>` };
    return { s };
  }

  /* ---------- S-1. Вход ---------- */
  function loginView() {
    return `<div class="login"><div class="card">
      <h2 style="margin:0">Вход в систему</h2>
      <label>Логин<input id="lg" autocomplete="username"></label>
      <label>Пароль<input id="pw" type="password" autocomplete="current-password"
             onkeydown="if(event.key==='Enter')login()"></label>
      <div id="err" role="alert" hidden style="color:var(--r);font-weight:700"></div>
      <button class="btn" id="loginBtn" onclick="login()">Войти</button>
      <span class="tag">S-1 · UC-1 · F-12</span></div></div>`;
  }

  window.login = async function () {
    const l = document.getElementById('lg').value.trim();
    const p = document.getElementById('pw').value;
    if (!l || !p) return FD.msg('err', 'Введите логин и пароль');
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(l)) return FD.msg('err', 'Логин: 3–32 символа (латиница, цифры, _ . -)');
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    try {
      const r = await api('/auth/login', { method: 'POST', body: { login: l, password: p } });
      Session.save(r.access_token);
      await startSession(r.user);
    } catch (e) {
      FD.msg('err', e.message);                      // неверный пароль, блокировка, отключённая запись, нет связи
      const b = document.getElementById('loginBtn');
      if (b) b.disabled = false;
    }
  };

  async function startSession(user) {
    const key = roleKey(user.role);
    if (!key) {
      Session.clear();
      throw new Error('Роль «' + user.role + '» не найдена в ROLES интерфейса (ключи: ' + Object.keys(ROLES).join(', ') + ')');
    }
    st.user = user; st.role = key;
    st.cur = ROLES[key].home || (ROLES[key].nav && ROLES[key].nav[0]);
    Bridge.reset(); Bridge.start();
    render();
  }

  const origLogout = window.logout;
  window.logout = function () {
    Session.clear(); Bridge.stop(); Bridge.reset(); st.user = null;
    if (typeof origLogout === 'function') origLogout(); else { st.role = null; render(); }
  };

  /* ---------- S-2. Экран оператора ---------- */
  function riskView() {
    const c = riskContext();
    if (!c.s) return c.html;
    const s = c.s;
    const open = Bridge.alerts.find(a => a.status === 'active');
    const actions = open
      ? `<div class="row"><button data-fb class="btn ok big" onclick="sendFeedback('${open.id}','confirmed')">✔ Подтвердить</button>
         <button data-fb class="btn no big" onclick="sendFeedback('${open.id}','false_alarm')">✖ Ложная тревога</button></div>`
      : '<p class="tag">Нет предупреждений, ожидающих отметки.</p>';
    return wellBar() + alertBanner(s) +
      `<div class="grid g3" style="margin-top:14px">${s.items.map(levelCard).join('')}</div>
       <div class="grid g2" style="margin-top:14px">
         <div class="card"><h3>Индекс риска, последние 30 мин</h3>${FD.spark(Bridge.history, { th: true })}
           <div class="tag">пунктир: пороги 40 и 70 (по умолчанию)</div></div>
         <div class="card"><h3>Ваше действие</h3>${actions}</div></div>`;
  }

  window.sendFeedback = async function (id, verdict) {
    document.querySelectorAll('[data-fb]').forEach(b => { b.disabled = true; });      // защита от двойного нажатия
    try {
      await api(`/alerts/${id}/feedback`, { method: 'POST', body: { verdict } });
      toast(verdict === 'confirmed' ? 'Отметка сохранена: подтверждено' : 'Отметка сохранена: ложная тревога');
      if (typeof Alerts !== 'undefined' && Alerts.mark) Alerts.mark(verdict === 'confirmed' ? 'ok' : 'false');
      await loadRisk();
    } catch (e) { toast(e.message); }
    render();
  };

  /* ---------- S-3. Дашборд скважин ---------- */
  function dashView() {
    const ws = ensure('wells', loadWells);
    if (ws.state !== 'ready') return pending(ws);
    const att = Bridge.filter === 'att';
    const rows = Bridge.wells.filter(w => !att || w.level !== 'green' || w.data_status !== 'ok');
    const canOpen = !!(ROLES[st.role] && (ROLES[st.role].nav || []).includes('well'));
    const cards = rows.map(w => {
      const body = w.data_status !== 'ok'
        ? `<div style="margin:14px 0">${FD.badge('yellow', 'Нет данных')}</div><div class="tag">Прогноз ещё не рассчитан</div>`
        : `<div class="idx" style="color:var(--${LEVEL_CLS[w.level]})">${w.risk_index}</div>${FD.badge(w.level, LEVEL_RU[w.level])}`;
      return `<div class="card" ${canOpen ? `style="cursor:pointer" onclick="openWell('${w.id}')"` : ''}>
        <div class="row"><b>Скв. ${FD.esc(w.name)}</b><span class="tag">${FD.esc(w.field)}</span></div>${body}</div>`;
    }).join('');
    return `<div class="row"><button class="btn ${att ? 'sec' : ''}" onclick="setFilter('all')">Все скважины</button>
      <button class="btn ${att ? '' : 'sec'}" onclick="setFilter('att')">Требуют внимания</button>
      ${canOpen ? '<span class="tag">Нажмите на карточку, чтобы открыть скважину</span>' : ''}</div>
      <div class="grid g3" style="margin-top:14px">${cards || '<div class="card">Нет скважин, соответствующих фильтру</div>'}</div>`;
  }

  /* ---------- S-4. Скважина: риск и предупреждения ---------- */
  function wellView() {
    const c = riskContext();
    if (!c.s) return c.html;
    const s = c.s;
    const reasons = s.reasons.map(r => `<div class="row" style="justify-content:space-between"><span>${FD.esc(r.feature)}</span><b>${r.contribution} %</b></div>
      <div class="bar"><i style="width:${r.contribution}%;background:var(--acc)"></i></div>`).join('');
    const rows = Bridge.alerts.map(a => `<tr><td>${FD.time(a.created_at)}</td><td>${TYPE_RU[a.type]}</td>
      <td>${FD.badge(a.level, LEVEL_RU[a.level])}</td><td>${STATUS_RU[a.status]}</td><td>${a.status === 'active'
        ? `<button data-fb class="btn ok" onclick="sendFeedback('${a.id}','confirmed')">Подтвердить</button>
           <button data-fb class="btn sec" onclick="sendFeedback('${a.id}','false_alarm')">Ложная</button>`
        : (a.verdict ? STATUS_RU[a.verdict] : '—')}</td></tr>`).join('');
    return wellBar() + alertBanner(s) +
      `<div class="grid g2" style="margin-top:14px">
         <div class="card"><h3>Индекс риска</h3>${FD.spark(Bridge.history, { th: true })}</div>
         <div class="card"><h3>Почему тревога: вклад параметров</h3>${reasons || '<span class="tag">Нет данных</span>'}</div></div>
       <div class="card" style="margin-top:14px"><h3>Предупреждения по скважине</h3>
         <table class="tbl"><tr><th>Время</th><th>Тип</th><th>Уровень</th><th>Статус</th><th>Отметка</th></tr>
         ${rows || '<tr><td colspan="5">Предупреждений нет</td></tr>'}</table></div>
       <p class="tag">Графики параметров (уровень, расход, давление) появятся после подключения модуля телеметрии.</p>`;
  }

  /* ---------- S-9. Пороги тревог ---------- */
  function thrView() {
    const ws = ensure('wells', loadWells);
    if (ws.state !== 'ready') return pending(ws);
    const w = Bridge.currentWell();
    if (!w) return '<div class="card">Нет доступных скважин.</div>';
    const ts = ensure('thr:' + w.id, loadThresholds);
    if (ts.state !== 'ready') return pending(ts);
    const opts = Bridge.wells.map(x => `<option value="${x.id}" ${x.id === w.id ? 'selected' : ''}>${FD.esc(x.name)}</option>`).join('');
    const rows = Bridge.thresholds.map((t, i) => `<div class="row" style="margin-top:14px"><b style="width:170px">${TYPE_RU[t.type]}</b>
      <label>Жёлтый ≥<input type="number" id="y${i}" value="${t.yellow}" min="0" max="100" style="width:90px"></label>
      <label>Красный ≥<input type="number" id="r${i}" value="${t.red}" min="0" max="100" style="width:90px"></label></div>`).join('');
    return `<div class="card"><label style="max-width:240px">Скважина
      <select onchange="Bridge_select(this.value)">${opts}</select></label>${rows}
      <p id="thMsg" class="tag" role="alert" style="min-height:22px"></p>
      <div class="row"><button class="btn" id="saveThr" onclick="saveThr()">Сохранить</button>
      <button class="btn sec" onclick="retryLoad()">Сбросить</button></div></div>`;
  }
  window.Bridge_select = function (id) { Bridge.current = id; render(); };

  window.saveThr = async function () {
    const items = Bridge.thresholds.map((t, i) => ({
      type: t.type, yellow: Number(document.getElementById('y' + i).value), red: Number(document.getElementById('r' + i).value) }));
    if (items.some(i => !(i.yellow >= 0 && i.red <= 100 && i.yellow < i.red)))
      return FD.msg('thMsg', 'Жёлтый порог должен быть меньше красного (0–100)');
    const btn = document.getElementById('saveThr');
    btn.disabled = true;
    try {
      Bridge.thresholds = await api(`/wells/${Bridge.current}/thresholds`, { method: 'PUT', body: { items } });
      FD.msg('thMsg', '');
      toast('Пороги сохранены, изменение записано в журнал');
    } catch (e) { FD.msg('thMsg', e.message); }
    finally { btn.disabled = false; }
  };

  /* ---------- Подключение экранов и запуск ---------- */
  registerScreen('login', loginView);
  registerScreen('risk', riskView);
  registerScreen('dash', dashView);
  registerScreen('well', wellView);
  registerScreen('thr', thrView);

  (async function boot() {                           // восстановление сеанса после обновления страницы
    if (!Session.token()) return render();
    try { await startSession(await api('/auth/me')); }
    catch (e) { Session.clear(); render(); }
  })();

  console.info('[БурПрогноз] Клиент API подключён, адрес:', API_BASE);
})();