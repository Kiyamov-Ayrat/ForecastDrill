// users.js — интерфейс S-11 «Пользователи и роли» (UC-13, F-12)
registerScreen('users', () => `<div class="card">
  <div class="row users-head">
    <h3>Пользователи</h3>
    <button class="btn" onclick="toast('Форма создания пользователя')">+ Добавить</button>
  </div>
  ${T(['Логин','Роль','Скважины','Активен'],[
    ['operator1',`<select><option>Оператор</option><option>Супервайзер</option></select>`,'214-Р','<input type="checkbox" checked>'],
    ['super1',`<select><option>Супервайзер</option><option>Оператор</option></select>`,'214-Р, 218-Р, 305-Н','<input type="checkbox" checked>'],
    ['ml1',`<select><option>ML-инженер</option></select>`,'Все','<input type="checkbox" checked>'],
    ['director1',`<select><option>Технический директор</option></select>`,'Все','<input type="checkbox">']
  ])}
  <div class="row" style="margin-top:12px">
    <button class="btn" onclick="toast('Права сохранены, изменение записано в журнал аудита')">Сохранить</button>
  </div>
</div>`);
