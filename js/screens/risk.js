// risk.js — интерфейс S-2 «Риск по скважине» (UC-2, UC-3, UC-4; F-3…F-9)
registerScreen('risk', () => WB() +
  `<div class="alert r risk-alert" role="alert">
     <div class="row"><b>⚠ Высокий риск поглощения бурового раствора</b>${B('r','красный уровень')}</div>
     <p><b>Причина:</b> падение уровня в ёмкостях и снижение расхода на выходе.<br>
     <b>Рекомендация:</b> проверить баланс объёмов, снизить подачу насосов, сообщить супервайзеру. <span class="tag">(демо-текст)</span></p>
   </div>
   <div class="grid g3" style="margin-top:14px">${pcard('Прихват колонны',12)}${pcard('Флюидопроявление',46)}${pcard('Поглощение раствора',78)}</div>
   <div class="grid g2" style="margin-top:14px">
     <div class="card"><h3>Индекс риска, последние 30 мин</h3>${spark(RISK,{th:1})}<div class="tag">пунктир: жёлтый порог 40, красный порог 70</div></div>
     <div class="card"><h3>Ваше действие</h3><p>Предупреждение получено в 14:32. Подтвердите или отметьте как ложное.</p>
       <div class="row">
         <button class="btn ok big" onclick="toast('Отметка сохранена: подтверждено')">✔ Подтвердить</button>
         <button class="btn no big" onclick="toast('Отметка сохранена: ложная тревога')">✖ Ложная тревога</button>
       </div>
     </div>
   </div>`);
