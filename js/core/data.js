// data.js — демонстрационные данные (в реальном проекте заменяется на запросы к API)
const N = 30;

// Синтез временных рядов телеметрии за последние 30 минут
const RISK = Array.from({ length: N }, (_, i) => i < 15 ? 12 + Math.sin(i * 1.3) * 3 : 12 + (i - 15) * 4.7 + Math.sin(i) * 1.5);
const PIT  = Array.from({ length: N }, (_, i) => 62 - (i < 15 ? 0 : (i - 15) * 2.2) + Math.sin(i * .9) * 1.5);
const FLOW = Array.from({ length: N }, (_, i) => 55 - (i < 15 ? 0 : (i - 15) * 1.9) + Math.cos(i * 1.1) * 2);
const SPP  = Array.from({ length: N }, (_, i) => 48 + (i < 15 ? 0 : (i - 15) * .9) + Math.sin(i * .7) * 2);

// Скважины: [номер, куст, индекс риска, статус данных]
const WELLS = [
  ['214-Р', 'Куст 7', 78, 'ok'],
  ['218-Р', 'Куст 7', 46, 'ok'],
  ['305-Н', 'Куст 3', 22, 'ok'],
  ['112-С', 'Куст 1', 9,  'ok'],
  ['407-Н', 'Куст 4', 0,  'bad'],
  ['509-Р', 'Куст 9', 33, 'warn']
];

// Параметры телеметрии для журнала по скважине (модуль S-7 «Качество данных»):
// [название параметра, единицы измерения]
const QPARAMS = [
  ['Нагрузка на крюке', 'кН'],
  ['Момент на роторе', 'кН·м'],
  ['Давление на стояке', 'МПа'],
  ['Расход на входе', 'л/с'],
  ['Расход на выходе', 'л/с'],
  ['Уровень в ёмкости 1', 'м³'],
  ['Плотность раствора', 'г/см³'],
  ['Обороты ротора', 'об/мин'],
  ['Скорость проходки', 'м/ч'],
  ['Температура раствора на выходе', '°C']
];

// Диапазоны реалистичных значений для параметров журнала (фейковые данные, мин/макс)
const QRANGE = {
  'Нагрузка на крюке': [120, 260],
  'Момент на роторе': [8, 34],
  'Давление на стояке': [12, 30],
  'Расход на входе': [30, 55],
  'Расход на выходе': [28, 52],
  'Уровень в ёмкости 1': [2, 14],
  'Плотность раствора': [1.08, 1.45],
  'Обороты ротора': [60, 140],
  'Скорость проходки': [4, 28],
  'Температура раствора на выходе': [28, 62]
};

// Осложнения, которые могут быть зафиксированы по строке журнала
const QISSUES = ['Прихват', 'Флюидопроявление', 'Поглощение'];

// Детерминированный псевдослучайный генератор (одинаковые данные при каждом открытии)
function qseed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  // смешивание (finalizer MurmurHash3), чтобы первые значения не были одинаковыми
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d3a); h ^= h >>> 15;
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
}

// Часовые метки начала и конца выбранного периода ("YYYY-MM-DDTHH" из datetime-local).
// Разбираем вручную, чтобы метка трактовалась как локальное время одинаково везде.
function qParseLocal(s) { return new Date(+s.slice(0,4), +s.slice(5,7)-1, +s.slice(8,10), +(s.slice(11,13)||0)); }
function qPeriodHours(p) {
  const [a, b] = p.split('|');
  const s = qParseLocal(a), e = qParseLocal(b);
  const hrs = [];
  for (let t = new Date(s); t <= e; t.setHours(t.getHours() + 1)) hrs.push(new Date(t));
  return hrs;
}

// Форматирование метки "14 окт, 08:00"
function qFmtTime(d) {
  const MON = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  const pad = n => String(n).padStart(2, '0');
  return `${d.getDate()} ${MON[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Журнал параметров по скважине за период:
// [{param, unit, time, value, issue ('Норма' или название осложнения), comment (комментарий супервайзера)}]
function buildQJournal(well, periodKey) {
  const hrs = qPeriodHours(periodKey);
  const rows = [];
  QPARAMS.forEach(([param, unit], pi) => {
    hrs.forEach((d, hi) => {
      const rnd = qseed(well + param + qFmtTime(d));
      // значение — в реалистичном диапазоне параметра (QRANGE)
      const [lo, hi2] = QRANGE[param] || [0, 100];
      const dec = (hi2 - lo) < 20 ? 2 : 0;
      const v = (lo + rnd() * (hi2 - lo)).toFixed(dec).replace('.', ',');
      // около 12 % строк — записи с осложнением, остальные — норма
      const isIssue = rnd() < 0.12;
      const issue = isIssue ? QISSUES[(pi + hi) % 3] : 'Норма';
      let comment = '';
      if (isIssue && rnd() < 0.75) {
        comment = [
          `Подтверждено: ${issue.toLowerCase()} на глубине ${2800 + Math.round(rnd() * 90)} м, принято решение снизить подачу.`,
          `Выезд бригады, ${issue.toLowerCase()} подтверждён. Факт внесён в журнал бурения.`,
          `Осложнение не подтвердилось — ложная тревога, канал телеметрии проверен.`
        ][Math.floor(rnd() * 3)];
      }
      rows.push({ param, unit, time: d, value: v, issue, comment });
    });
  });
  return rows;
}

// Карточка «шапки скважины» (общая для экранов risk и well)
const WB = () => `<div class="card row" style="margin-bottom:14px"><b>Скважина 214-Р</b><span>Куст 7</span><span>Режим: бурение</span><span>Глубина: 2 845 м</span>${B('g','Данные: норма')}<span class="tag">обновлено 14:32:08</span></div>`;
