// src.js — интерфейс S-8 «Источники данных и паспорт скважины» (UC-10, F-1)
registerScreen('src', () => `<div class="grid g2">
  <div class="card"><h3>Подключение источника телеметрии</h3>
    <div class="row">
      <label>Протокол<select><option>WITS Level 0</option><option>WITSML</option></select></label>
      <label>Адрес<input value="10.20.0.15"></label>
      <label>Порт<input value="12000" style="width:90px"></label>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn" onclick="toast('Соединение установлено')">Проверить соединение</button>
    </div>
    <h3 class="src-map">Сопоставление каналов (пример)</h3>
    ${T(['Канал источника','Канал ПС','Пересчёт'],[
      ['HKLD','Нагрузка на крюке','klbf → кН'],
      ['SPPA','Давление на стояке','psi → МПа'],
      ['FLOWIN','Расход на входе','gpm → л/с'],
      ['PITVOL1','Объём в ёмкости 1','bbl → м³']
    ])}
  </div>
  <div class="card"><h3>Паспорт скважины</h3>
    <label>Скважина<select><option>214-Р</option><option>Новая…</option></select></label>
    <div class="drop" style="margin-top:12px">Перетащите файл паспорта (CSV, JSON, XLSX)<br>
      <button class="btn sec src-drop-btn" onclick="toast('Паспорт проверен: все поля заполнены')">Выбрать файл</button>
    </div>
  </div>
</div>`);
