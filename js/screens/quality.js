// quality.js — интерфейс S-7 «Качество данных» (UC-7, F-2)
// Супервайзер: сводная таблица качества каналов телеметрии.
// ML-инженер: выбирает скважину → открывается окно с журналом параметров
// (столбцы: Параметр, Дата, Тип риска — «Норма», «Риск» или «Отклонено») и фильтром по дате;
// клик по строке показывает комментарий, оставленный супервайзером по этой записи.

// Журнал кэшируется в st.qCache по ключу «скважина|период», чтобы данные
// не терялись при переходах между экранами (qRows/qFrom/qTo живут только в st).
function qLoad() {
  if (!st.qWell) return;
  const key = '2026-10-22T00|2026-10-23T23';
  if (!st.qCache) st.qCache = {};
  if (!st.qCache[key]) st.qCache[key] = buildQJournal(st.qWell, key);
  qRows = st.qCache[key];
  qFrom = st.qFrom || ''; qTo = st.qTo || '';
}

let qRows = [];        // полный журнал параметров выбранной скважины (для обращения по индексу)
let qFrom = '', qTo = ''; // значения фильтра по дате над таблицей (синхронизируются со st)

// Фильтр по дате меняет тип риска: до начала периода записи считаются «Отклонено»,
// после конца — «Риск»; внутри периода сохраняется исходный статус («Норма» / «Риск»).
// Значения фильтра разбираем через qParseLocal (локальное время), как и метки журнала.
function qType(r) {
  if (qFrom && r.time < qParseLocal(qFrom)) return 'Отклонено';
  if (qTo && r.time > qParseLocal(qTo)) return 'Риск';
  return r.issue === 'Норма' ? 'Норма' : 'Риск';
}

const QT_BADGE = { 'Норма': B('g', 'Норма'), 'Риск': B('y', 'Риск'), 'Отклонено': B('r', 'Отклонено') };

// Выбор скважины — открыть окно с журналом параметров (фейковые демо-данные)
function qOpenWell() {
  st.qWell = $('qWellSel').value;
  st.selRow = null;
  st.qFrom = '2026-10-23T00'; st.qTo = '2026-10-23T23'; // фильтр по умолчанию: последние сутки
  qLoad();
  render();
}

// Применить фильтр по дате
function qFilter() {
  const a = $('qFrom').value, b = $('qTo').value;
  if (!a || !b) { toast('Укажите начало и конец периода'); return; }
  if (new Date(a) > new Date(b)) { toast('Начало периода позже конца'); return; }
  st.qFrom = a; st.qTo = b; st.selRow = null;
  qLoad();
  render();
}

// Сброс фильтра (показывает все записи журнала со исходным статусом)
function qReset() { st.qFrom = ''; st.qTo = ''; st.selRow = null; qLoad(); render(); }

// Клик по строке журнала — показать комментарий супервайзера
function qShowRow(i) { st.selRow = (st.selRow === i ? null : i); render(); }

// Закрыть окно скважины
function qCloseWell() { st.qWell = ''; st.selRow = null; qRows = []; render(); }

registerScreen('quality', () => {
  // Восстанавливаем журнал и фильтр из состояния (данные не теряются при переходах между экранами)
  if (st.qWell && !qRows.length) qLoad();

  // --- ML-инженер: выбор скважины ---
  const wellPick = `<div class="card quality-pick">
    <label>Скважина<select id="qWellSel">${WELLS.map(w => `<option value="${w[0]}" ${w[0] === st.qWell ? 'selected' : ''}>${w[0]} · ${w[1]}</option>`).join('')}</select></label>
    <button class="btn" onclick="qOpenWell()">Открыть</button>
    ${st.qWell ? '<button class="btn sec" onclick="qCloseWell()">Закрыть</button>' : ''}
  </div>`;

  // Только супервайзер видит прежнюю сводку качества каналов телеметрии
  if (st.role === 'sv') return `<div class="alert y quality-alert"><b>Канал «Плотность раствора» недостоверен.</b> Прогнозы, использующие этот канал, отключены (BR-7).</div>
  <div class="card">
    ${T(['Канал','Ед.','Пропуски, %','Задержка, с','Выбросы','Статус'],[
      ['Нагрузка на крюке','кН','0,2','1','0',B('g','Норма')],
      ['Момент на роторе','кН·м','0,5','1','2',B('g','Норма')],
      ['Давление на стояке','МПа','0,1','1','0',B('g','Норма')],
      ['Расход на входе','л/с','0,0','1','0',B('g','Норма')],
      ['Расход на выходе','л/с','6,8','3','5',B('y','Внимание')],
      ['Уровень в ёмкости 1','м³','0,3','1','1',B('g','Норма')],
      ['Плотность раствора','г/см³','32','12','0',B('r','Недостоверно')]
    ])}
  </div>`;

  if (!st.qWell) return wellPick;

  // --- Окно: фильтр по дате (над таблицей) + журнал параметров ---
  // Значения datetime-local («2026-10-23T00») разбираем как локальное время,
  // иначе Date("...T00") в некоторых браузерах даёт Invalid Date и фильтр не работает.
  const fA = qFrom ? qParseLocal(qFrom) : null;
  const fB = qTo ? qParseLocal(qTo) : null;
  if (fB) fB.setHours(23, 59, 59); // «Дата по» включает выбранный час целиком
  const filtered = qRows.filter(r => (!fA || r.time >= fA) && (!fB || r.time <= fB));

  const filterBar = `<div class="card quality-filter">
    <h3>Фильтр по дате · скв. ${st.qWell}</h3>
    <div class="row">
      <label>Дата с<input type="datetime-local" id="qFrom" value="${qFrom}"></label>
      <label>Дата по<input type="datetime-local" id="qTo" value="${qTo}"></label>
      <button class="btn" onclick="qFilter()">Применить</button>
      <button class="btn sec" onclick="qReset()">Сбросить</button>
      <span class="tag">записей: ${filtered.length} из ${qRows.length}</span>
    </div>
  </div>`;

  const rowsHtml = filtered.length
    ? filtered.map(r => {
        const i = qRows.indexOf(r), t = qType(r);
        return `<tr class="quality-row ${i === st.selRow ? 'on' : ''}" onclick="qShowRow(${i})">
          <td>${r.param} <span class="tag">(${r.unit})</span></td>
          <td>${qFmtTime(r.time)}</td>
          <td><b>${r.value}</b> <span class="tag">${r.unit}</span></td>
          <td>${QT_BADGE[t]}</td>
          <td>${r.comment ? B('y','Есть комментарий') : '<span class="tag">—</span>'}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" class="tag">Нет записей в выбранном периоде</td></tr>';

  const sel = st.selRow != null ? qRows[st.selRow] : null;
  const detail = sel ? `<div class="card quality-detail" style="margin-top:14px">
      <h3>Комментарий супервайзера · ${sel.param}, ${qFmtTime(sel.time)}</h3>
      <p><b>Значение:</b> ${sel.value} ${sel.unit} · <b>Тип риска:</b> ${QT_BADGE[qType(sel)]}</p>
      <p>${sel.comment || '<span class="tag">Комментарий не оставлен.</span>'}</p>
    </div>` : '<p class="tag quality-hint">Нажмите на строку таблицы, чтобы увидеть комментарий супервайзера.</p>';

  return wellPick + filterBar + `
    <div class="card" style="margin-top:14px"><h3>Параметры: скв. ${st.qWell}</h3>
      <table class="tbl"><tr><th>Параметр</th><th>Дата</th><th>Значение</th><th>Тип риска</th><th>Отметка</th></tr>${rowsHtml}</table>
    </div>${detail}`;
});
