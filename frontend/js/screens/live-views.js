const FD = {
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  msg(id, text) { const e = document.getElementById(id); if (e) { e.hidden = !text; e.textContent = text || ''; } },
  time: iso => iso ? new Date(iso).toLocaleTimeString('ru-RU') : '—',
  badge: (lvl, text) => `<span class="badge b-${LEVEL_CLS[lvl]}">${text}</span>`,
  top(s) {
    const sev = { green: 0, yellow: 1, red: 2 };
    return [...s.items].sort((a, b) => sev[b.level] - sev[a.level] || b.probability - a.probability)[0];
  },
  spark(v, { h = 110, th = false } = {}) {
    const w = 320, y = a => (h - Math.min(100, Math.max(0, a)) / 100 * h).toFixed(1);
    const pts = v.map((a, i) => (i * w / (v.length - 1)).toFixed(1) + ',' + y(a)).join(' ');
    const ln = (val, c) => `<line x1="0" x2="${w}" y1="${y(val)}" y2="${y(val)}" stroke="var(--${c})" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`;
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block">${th ? ln(40, 'y') + ln(70, 'r') : ''}<polyline fill="none" stroke="var(--acc)" stroke-width="2.4" vector-effect="non-scaling-stroke" points="${pts}"/></svg>`;
  }
};

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
  if (s.level === 'green') return `<div class="alert" style="border-color:var(--g);background:var(--gbg)"><b style="font-size:20px">✔ Риск в норме</b></div>`;
  const t = FD.top(s);
  const why = s.reasons.slice(0, 2).map(r => `${FD.esc(r.feature)} (${r.contribution} %)`).join(', ');
  return `<div class="alert ${s.level === 'red' ? 'r' : 'y'}" role="alert"><div class="row">
    <b style="font-size:22px">⚠ ${LEVEL_RU[s.level]}: ${TYPE_RU[t.type].toLowerCase()}</b>${FD.badge(s.level, s.level === 'red' ? 'красный уровень' : 'жёлтый уровень')}</div>
    <p style="font-size:18px;margin:8px 0 0"><b>Основной вклад:</b> ${why}.<br><b>Рекомендация:</b> ${FD.esc(s.recommendation || '')}</p></div>`;
}

/* S-2. Экран оператора (UC-2, UC-3, UC-4) */
function riskView() {
  const w = Bridge.currentWell(), s = Bridge.snapshot;
  if (!w) return '<div class="card">Вам не назначены скважины. Обратитесь к администратору.</div>';
  if (!s || s.data_status === 'no_data') return `<div class="card">Для скважины ${FD.esc(w.name)} прогноз ещё не рассчитан. Данные появятся через несколько секунд.</div>`;
  const open = Bridge.alerts.find(a => a.status === 'active');
  const actions = open
    ? `<div class="row"><button data-fb class="btn ok big" onclick="sendFeedback('${open.id}','confirmed')">✔ Подтвердить</button>
       <button data-fb class="btn no big" onclick="sendFeedback('${open.id}','false_alarm')">✖ Ложная тревога</button></div>`
    : '<p class="tag">Нет предупреждений, ожидающих отметки.</p>';
  return wellBar() + alertBanner(s) +
    `<div class="grid g3" style="margin-top:14px">${s.items.map(levelCard).join('')}</div>
     <div class="grid g2" style="margin-top:14px">
       <div class="card"><h3>Индекс риска, последние 30 мин</h3>${FD.spark(RISK, { th: true })}<div class="tag">пунктир: пороги 40 и 70 (по умолчанию)</div></div>
       <div class="card"><h3>Ваше действие</h3>${actions}</div></div>`;
}

/* S-4. Скважина: риск и предупреждения (супервайзер) */
function wellView() {
  const w = Bridge.currentWell(), s = Bridge.snapshot;
  if (!w || !s || s.data_status === 'no_data') return '<div class="card">Прогноз по скважине ещё не рассчитан.</div>';
  const reasons = s.reasons.map(r => `<div class="row" style="justify-content:space-between"><span>${FD.esc(r.feature)}</span><b>${r.contribution} %</b></div>
    <div class="bar"><i style="width:${r.contribution}%;background:var(--acc)"></i></div>`).join('');
  const rows = Bridge.alerts.map(a => `<tr><td>${FD.time(a.created_at)}</td><td>${TYPE_RU[a.type]}</td><td>${FD.badge(a.level, LEVEL_RU[a.level])}</td>
    <td>${STATUS_RU[a.status]}</td><td>${a.status === 'active'
      ? `<button data-fb class="btn ok" onclick="sendFeedback('${a.id}','confirmed')">Подтвердить</button> <button data-fb class="btn sec" onclick="sendFeedback('${a.id}','false_alarm')">Ложная</button>`
      : (a.verdict ? STATUS_RU[a.verdict] : '—')}</td></tr>`).join('');
  const demo = (typeof PIT !== 'undefined' && PIT.length > 1)      // графики параметров: только если телеметрия ещё не подключена
    ? `<div class="grid g3" style="margin-top:14px"><div class="card"><h3>Уровень в ёмкостях</h3>${FD.spark(PIT, { h: 80 })}</div>
       <div class="card"><h3>Расход на выходе</h3>${FD.spark(FLOW, { h: 80 })}</div><div class="card"><h3>Давление на стояке</h3>${FD.spark(SPP, { h: 80 })}</div></div>
       <p class="tag">Графики параметров: демо-данные до подключения модуля телеметрии.</p>` : '';
  return wellBar() + alertBanner(s) +
    `<div class="grid g2" style="margin-top:14px"><div class="card"><h3>Индекс риска</h3>${FD.spark(RISK, { th: true })}</div>
     <div class="card"><h3>Почему тревога: вклад параметров</h3>${reasons || '<span class="tag">Нет данных</span>'}</div></div>${demo}
     <div class="card" style="margin-top:14px"><h3>Предупреждения по скважине</h3>
       <table class="tbl"><tr><th>Время</th><th>Тип</th><th>Уровень</th><th>Статус</th><th>Отметка</th></tr>${rows || '<tr><td colspan="5">Предупреждений нет</td></tr>'}</table></div>`;
}

async function sendFeedback(id, verdict) {
  document.querySelectorAll('[data-fb]').forEach(b => { b.disabled = true; });     // защита от двойного нажатия
  try {
    await api(`/alerts/${id}/feedback`, { method: 'POST', body: { verdict } });
    toast(verdict === 'confirmed' ? 'Отметка сохранена: подтверждено' : 'Отметка сохранена: ложная тревога');
    if (typeof Alerts !== 'undefined') Alerts.mark(verdict === 'confirmed' ? 'ok' : 'false');
    await Bridge.loadRisk();
  } catch (e) { toast(e.message); render(); }                                      // при ошибке кнопки вернутся активными (новый рендер)
}

/* S-9. Пороги тревог (UC-6) */
function thrView() {
  if (!Bridge.wells.length) return '<div class="card">Нет доступных скважин.</div>';
  const opts = Bridge.wells.map(x => `<option value="${x.id}" ${x.id === Bridge.current ? 'selected' : ''}>${FD.esc(x.name)}</option>`).join('');
  const rows = Bridge.thresholds.map((t, i) => `<div class="row" style="margin-top:14px"><b style="width:170px">${TYPE_RU[t.type]}</b>
    <label>Жёлтый ≥<input type="number" id="y${i}" value="${t.yellow}" min="0" max="100" style="width:90px"></label>
    <label>Красный ≥<input type="number" id="r${i}" value="${t.red}" min="0" max="100" style="width:90px"></label></div>`).join('');
  return `<div class="card"><label style="max-width:240px">Скважина
    <select onchange="Bridge.current=this.value;go('thr')">${opts}</select></label>${rows}
    <p id="thMsg" class="tag" role="alert" style="min-height:22px"></p>
    <div class="row"><button class="btn" id="saveThr" onclick="saveThr()">Сохранить</button><button class="btn sec" onclick="go('thr')">Сбросить</button></div></div>`;
}

async function saveThr() {
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
}