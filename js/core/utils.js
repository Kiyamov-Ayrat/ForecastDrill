// utils.js — общие утилиты DOM и форматирования
const $ = id => document.getElementById(id);

// Уровень риска по числовому индексу: <40 — зелёный, 40..69 — жёлтый, >=70 — красный
const lvl = v => v >= 70 ? 'r' : v >= 40 ? 'y' : 'g';
const LT = { g: 'Норма', y: 'Внимание', r: 'Высокий риск' };

// Бейдж уровня: B('g','Норма') -> <span class="badge b-g">Норма</span>
const B = (c, t) => `<span class="badge b-${c}">${t}</span>`;

// Простая таблица из массива заголовков и строк
const T = (h, r) => `<table class="tbl"><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>${r.map(x => `<tr>${x.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

// Всплывающее уведомление
function toast(m) {
  const t = $('toast');
  t.textContent = m;
  t.style.display = 'block';
  clearTimeout(t._h);
  t._h = setTimeout(() => t.style.display = 'none', 2600);
}
