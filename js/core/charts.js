// charts.js — отрисовка SVG-графиков (линейные тренды без внешних библиотек)

// Мини-график (спарклайн). o = { h — высота, c — цвет линии, th — показывать пороги 40/70 }
function spark(v, o = {}) {
  const w = 320, h = o.h || 110, n = v.length, y = a => (h - Math.min(100, Math.max(0, a)) / 100 * h).toFixed(1);
  let s = `<svg class="ch" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="height:${h}px">`;
  if (o.th) s += `<line x1="0" x2="${w}" y1="${y(40)}" y2="${y(40)}" stroke="var(--y)" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/><line x1="0" x2="${w}" y1="${y(70)}" y2="${y(70)}" stroke="var(--r)" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`;
  return s + `<polyline fill="none" stroke="${o.c || 'var(--acc)'}" stroke-width="2.4" vector-effect="non-scaling-stroke" points="${v.map((a, i) => (i * w / (n - 1)).toFixed(1) + ',' + y(a)).join(' ')}"/></svg>`;
}

// Карточка числового индикатора риска с прогресс-баром
const pcard = (n, v) => {
  const l = lvl(v);
  return `<div class="card"><div class="tag">${n}</div><div class="idx" style="color:var(--${l})">${v} %</div>${B(l, LT[l])}<div class="bar"><i style="width:${v}%;background:var(--${l})"></i></div></div>`;
};
