// well.js — интерфейс S-4 «Скважина 214-Р: риск и предупреждения» (UC-2, UC-3, UC-4; F-3…F-9)
registerScreen('well', () => WB() +
  `<div class="alert r"><b>⚠ Поглощение: 78 %</b> · красный уровень · 14:32 · ${B('r','активно')}</div>
   <div class="grid g2" style="margin-top:14px">
     <div class="card"><h3>Индекс риска</h3>${spark(RISK,{th:1})}</div>
     <div class="card"><h3>Почему тревога: вклад параметров</h3>
       ${[['Разница расходов (выход – вход)',42],['Уровень в ёмкостях',31],['Давление на стояке',14],['Скорость проходки',8],['Прочее',5]]
         .map(a => `<div class="row" style="justify-content:space-between"><span>${a[0]}</span><b>${a[1]} %</b></div><div class="bar"><i style="width:${a[1]}%;background:var(--acc)"></i></div>`).join('')}
     </div>
   </div>
   <div class="grid g3" style="margin-top:14px">
     <div class="card"><h3>Уровень в ёмкостях</h3>${spark(PIT,{h:80})}</div>
     <div class="card"><h3>Расход на выходе</h3>${spark(FLOW,{h:80})}</div>
     <div class="card"><h3>Давление на стояке</h3>${spark(SPP,{h:80})}</div>
   </div>
   <div class="card" style="margin-top:14px"><h3>Предупреждения по скважине</h3>
     ${T(['Время','Тип','Уровень','Статус','Отметка'],[
       ['14:32','Поглощение',B('r','Красный'),B('r','Активно'),`<button class="btn ok" onclick="toast('Подтверждено')">Подтвердить</button> <button class="btn sec" onclick="toast('Ложная тревога')">Ложная</button>`],
       ['13:05','Флюидопроявление',B('y','Жёлтый'),B('g','Закрыто'),'Подтверждено']
     ])}
   </div>`);
