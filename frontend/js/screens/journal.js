// journal.js — интерфейс S-5 «Журнал и разбор инцидента» (UC-8, F-11)
registerScreen('journal', () =>
  `<div class="card">
     <div class="row" style="margin-bottom:10px">
       <label>Период<select><option>Последние 24 часа</option><option>7 дней</option></select></label>
       <label>Тип<select><option>Все</option><option>Прихват</option><option>Флюидопроявление</option><option>Поглощение</option></select></label>
     </div>
     ${T(['Время','Скважина','Тип','Уровень','Статус','Отметка'],[
       ['14:32','214-Р','Поглощение',B('r','Красный'),B('r','Активно'),'—'],
       ['13:05','214-Р','Флюидопроявление',B('y','Жёлтый'),B('g','Закрыто'),'Подтверждено'],
       ['09:47','305-Н','Прихват',B('y','Жёлтый'),B('g','Закрыто'),'Ложная тревога'],
       ['02:10','218-Р','Поглощение',B('r','Красный'),B('g','Закрыто'),'Подтверждено']
     ])}
   </div>
   <div class="card" style="margin-top:14px"><h3>Воспроизведение: 214-Р, поглощение, 14:32</h3>
     <div class="journal-replay">${spark(RISK,{th:1,h:130})}<div id="mk" class="journal-marker"></div></div>
     <div class="row" style="margin-top:8px">
       <input type="range" min="0" max="100" value="50" class="journal-slider"
              oninput="$('mk').style.left=this.value+'%';$('rt').textContent=Math.round((this.value-50)*.3)+' мин от события'">
       <b id="rt">0 мин от события</b>
     </div>
     <div class="row" style="margin-top:10px">
       <label style="flex:1">Результат разбора<input placeholder="Например: подтверждено, потеря циркуляции на 2 840 м"></label>
       <button class="btn" onclick="toast('Результат разбора сохранён')">Сохранить</button>
     </div>
   </div>`);
