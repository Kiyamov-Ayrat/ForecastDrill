// rep.js — интерфейс S-6 «Отчёты» (UC-9, F-11)
registerScreen('rep', () => `<div class="grid g2">
  <div class="card"><h3>Параметры отчёта</h3>
    <div class="row">
      <label>Тип<select><option>Отчёт по скважине</option><option>Журнал предупреждений</option><option>Сводка по скважинам</option></select></label>
      <label>Период<select><option>Последние 7 дней</option><option>Месяц</option></select></label>
      <label>Скважины<select><option>Все назначенные</option><option>214-Р</option></select></label>
      <label>Формат<select><option>PDF</option><option>XLSX</option></select></label>
    </div>
    <div class="row rep-form">
      <button class="btn" onclick="toast('Отчёт сформирован')">Сформировать</button>
      <button class="btn sec" onclick="toast('Файл загружен')">Скачать</button>
    </div>
  </div>
  <div class="card"><h3>Предпросмотр: сводка по скважинам</h3>
    ${T(['Скважина','Предупреждений','Подтверждено','Ложных'],[
      ['214-Р','5','4','1'],
      ['218-Р','3','2','1'],
      ['305-Н','1','0','1']
    ])}
    <p class="tag">Демонстрационные данные</p>
  </div>
</div>`);
