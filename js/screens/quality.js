// quality.js — интерфейс S-7 «Качество данных» (UC-7, F-2)
// Супервайзер: сводная таблица качества каналов телеметрии.
// ML-инженер: выбирает скважину → период → журнал параметров; клик по строке показывает
// комментарий супервайзера по этой записи.

let qRows = []; // текущий журнал параметров (для обращения по индексу строки)

// Выбор скважины открывает окно с настройкой периода
function qOpenWell() {
  st.qWell = $('qWellSel').value;
  st.selRow = null; qRows = [];
  render();
}

// Построение журнала по выбранной скважине и периоду
function qBuild() {
  const a = $('qFrom').value, b = $('qTo').value;
  if (!a || !b) { toast('Укажите начало и конец периода'); return; }
  if (new Date(a) > new Date(b)) { toast('Начало периода позже конца'); return; }
  qRows = buildQJournal(st.qWell, `${a}|${b}`);
  st.selRow = null;
  render();
}

// Клик по строке журнала — показать комментарий супервайзера
function qShowRow(i) {
  st.selRow = i;
  render();
}

// Закрыть окно выбора периода / журнал
function qCloseWell() { st.qWell = ''; st.selRow = null; qRows = []; render(); }

registerScreen('quality', () => {
  const summary = `<div class="alert y quality-alert"><b>Канал «Плотность раствора» недостоверен.</b> Прогнозы, использующие этот канал, отключены (BR-7).</div>
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

  // Только супервайзер видит сводку качества каналов
  if (st.role === 'sv') return summary;

  // --- ML-инженер: выбор скважины ---
  const wellPick = `<div class="card quality-pick">
    <label>Скважина<select id="qWellSel">${WELLS.map(w => `<option value="${w[0]}">${w[0]} · ${w[1]}</option>`).join('')}</select></label>
    <button class="btn" onclick="qOpenWell()">Открыть</button>
  </div>`;

  if (!st.qWell) return summary + wellPick;

  // --- Окно выбора периода по скважине ---
  const periodForm = `<div class="card quality-modal">
    <h3>Период по скважине ${st.qWell}</h3>
    <div class="row">
      <label>Начало<input type="datetime-local" id="qFrom" value="2026-10-23T08"></label>
      <label>Конец<input type="datetime-local" id="qTo" value="2026-10-23T14"></label>
      <button class="btn" onclick="qBuild()">Показать параметры</button>
      <button class="btn sec" onclick="qCloseWell()">Закрыть</button>
    </div>
    <p class="tag">Журнал формируется с почасовой дискретизацией (демонстрационные данные)</p>
  </div>`;

  if (!qRows.length) return summary + wellPick + periodForm;

  // --- Список параметров: параметр, дата, осложнение/норма ---
  const rowsHtml = qRows.map((r, i) => `<tr class="quality-row ${i === st.selRow ? 'on' : ''}" onclick="qShowRow(${i})">
      <td>${r.param} <span class="tag">(${r.unit})</span></td>
      <td>${qFmtTime(r.time)}</td>
      <td>${r.issue === 'Норма' ? B('g','Норма') : B('r', r.issue)}</td>
      <td>${r.value}</td>
      <td>${r.comment ? B('y','Есть комментарий') : '<span class="tag">—</span>'}</td>
    </tr>`).join('');

  const sel = st.selRow != null ? qRows[st.selRow] : null;
  const detail = sel ? `<div class="card quality-detail" style="margin-top:14px">
      <h3>Комментарий супервайзера · ${sel.param}, ${qFmtTime(sel.time)}</h3>
      <p><b>Значение:</b> ${sel.value} ${sel.unit} · <b>Осложнение:</b> ${sel.issue === 'Норма' ? B('g','Норма') : B('r', sel.issue)}</p>
      <p>${sel.comment || '<span class="tag">Комментарий не оставлен.</span>'}</p>
    </div>` : '<p class="tag quality-hint">Нажмите на строку, чтобы увидеть комментарий супервайзера.</p>';

  return summary + wellPick + periodForm + `
    <div class="card" style="margin-top:14px"><h3>Параметры: скв. ${st.qWell}</h3>
      <table class="tbl"><tr><th>Параметр</th><th>Дата</th><th>Осложнение</th><th>Значение</th><th>Отметка</th></tr>${rowsHtml}</table>
    </div>${detail}`;
});
