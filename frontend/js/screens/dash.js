// dash.js — интерфейс S-3 «Состояние скважин» (UC-5, F-10)

// Тренд для карточки скважины: рост от низких значений к текущему индексу
const trend = v => Array.from({ length: 20 }, (_, i) => Math.max(2, v * Math.pow(i / 19, 1.4) + Math.sin(i) * 2));

// Карточка одной скважины на дашборде
const wcard = w => {
  if (w[3] === 'bad') return `<div class="card dash-well-card" onclick="go('well')"><b>Скв. ${w[0]}</b> <span class="tag">${w[1]}</span><div style="margin:14px 0">${B('y','Данные недостоверны')}</div><div class="tag">Прогноз не строится (BR-7)</div></div>`;
  const l = lvl(w[2]);
  return `<div class="card dash-well-card" onclick="go('well')"><div class="row"><b>Скв. ${w[0]}</b><span class="tag">${w[1]}</span></div><div class="idx" style="color:var(--${l})">${w[2]}</div>${B(l,LT[l])} ${w[3]==='warn'?B('y','Есть пропуски'):''}${spark(trend(w[2]),{h:60,c:'var(--'+l+')'})}</div>`;
};

registerScreen('dash', () => {
  const f = st.f, rows = WELLS.filter(w => f === 'all' || w[2] >= 40 || w[3] !== 'ok');
  return `<div class="row">
      <button class="btn ${f==='all'?'':'sec'}" onclick="st.f='all';render()">Все скважины</button>
      <button class="btn ${f==='att'?'':'sec'}" onclick="st.f='att';render()">Требуют внимания</button>
      <span class="tag">Нажмите на карточку, чтобы открыть скважину</span>
    </div>
    <div class="grid g3" style="margin-top:14px">${rows.map(wcard).join('')}</div>`;
});
