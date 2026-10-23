// quality.js — интерфейс S-7 «Качество данных» (UC-7, F-2)
// Супервайзер: сводная таблица качества каналов телеметрии.
// ML-инженер: выбирает скважину → открывается окно с журналом параметров
// (столбцы: Параметр, Дата, Тип риска — «Норма», «Риск» или «Отклонено») и фильтром по дате;
// клик по строке показывает комментарий, оставленный супервайзером по этой записи.

let qRows = [];        // полный журнал параметров выбранной скважины (для обращения по индексу)
let qFrom = '', qTo = ''; // значения фильтра по дате над таблицей

// Фильтр по дате меняет тип риска: до начала периода записи считаются «Отклонено»,
// после конца — «Риск»; внутри периода сохраняется исходный статус («Норма» / «Риск»).
// Метки журнала нормализуем к целому часу, чтобы сравнение с фильтром (datetime-local
// без минут) было корректным во всех браузерах.
function qType(r) {
  const t = new Date(r.time); t.setMinutes(0, 0, 0);
  if (qFrom && t < new Date(qFrom)) return 'Отклонено';
  if (qTo && t > new Date(qTo)) return 'Риск';
  return r.issue === 'Норма' ? 'Норма' : 'Риск';
}

const QT_BADGE = { 'Норма': B('g', 'Норма'), 'Риск': B('y', 'Риск'), 'Отклонено': B('r', 'Отклонено') };

// Выбор скважины — открыть окно с журналом параметров
function qOpenWell() {
  st.qWell = $('qWellSel').value;
  st.selRow = null;
  qRows = buildQJournal(st.qWell, '2026-10-22T00|2026-10-23T23');
  qFrom = '2026-10-23T00'; qTo = '2026-10-23T23'; // фильтр по умолчанию: последние сутки
  render();
}

// Применить фильтр по дате
function qFilter() {
  const a = $('qFrom').value, b = $('qTo').value;
  if (!a || !b) { toast('Укажите начало и конец периода'); return; }
  if (new Date(a) > new Date(b)) { toast('Начало периода позже конца'); return; }
  qFrom = a; qTo = b; st.selRow = null;
  render();
}

// Сброс фильтра (показывает все записи журнала со исходным статусом)
function qReset() { qFrom = ''; qTo = ''; st.selRow = null; render(); }

// Клик по строке журнала — показать комментарий супервайзера
function qShowRow(i) { st.selRow = (st.selRow === i ? null : i); render(); }

// Закрыть окно скважины
function qCloseWell() { st.qWell = ''; st.selRow = null; qRows = []; render(); }

registerScreen('quality', () => {
  // Только супервайзер видит прежнюю сводку качества каналов
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

  // --- ML-инженер: выбор скважины ---
  const wellPick = `<div class="card quality-pick">
    <label>Скважина<select id="qWellSel">${WELLS.map(w => `<option value="${w[0]}" ${w[0] === st.qWell ? 'selected' : ''}>${w[0]} · ${w[1]}</option>`).join('')}</select></label>
    <button class="btn" onclick="qOpenWell()">Открыть</button>
    ${st.qWell ? '<button class="btn sec" onclick="qCloseWell()">Закрыть</button>' : ''}
  </div>`;

  if (!st.qWell) return wellPick;

  // --- Окно: фильтр по дате (над таблицей) + журнал параметров ---
  const norm = s => s ? new Date(s) : null;
  const fA = norm(qFrom), fB = norm(qTo);
  if (fA) fA.setMinutes(0, 0, 0);
  if (fB) { fB.setHours(23, 59, 59); } // «Дата по» включает выбранный день целиком
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
          <td>${QT_BADGE[t]}</td>
          <td>${r.comment ? B('y','Есть комментарий') : '<span class="tag">—</span>'}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="4" class="tag">Нет записей в выбранном периоде</td></tr>';

  const sel = st.selRow != null ? qRows[st.selRow] : null;
  const detail = sel ? `<div class="card quality-detail" style="margin-top:14px">
      <h3>Комментарий супервайзера · ${sel.param}, ${qFmtTime(sel.time)}</h3>
      <p><b>Значение:</b> ${sel.value} ${sel.unit} · <b>Тип риска:</b> ${QT_BADGE[qType(sel)]}</p>
      <p>${sel.comment || '<span class="tag">Комментарий не оставлен.</span>'}</p>
    </div>` : '<p class="tag quality-hint">Нажмите на строку таблицы, чтобы увидеть комментарий супервайзера.</p>';

  return wellPick + filterBar + `
    <div class="card" style="margin-top:14px"><h3>Параметры: скв. ${st.qWell}</h3>
      <table class="tbl"><tr><th>Параметр</th><th>Дата</th><th>Тип риска</th><th>Отметка</th></tr>${rowsHtml}</table>
    </div>${detail}`;
});
