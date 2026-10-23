// thr.js — интерфейс S-9 «Пороги тревог» (UC-6, F-7, F-12)

// Валидация и сохранение порогов: жёлтый < красный, диапазон 0–100
function saveThr() {
  for (let i = 0; i < 3; i++) {
    const y = +$('y' + i).value, r = +$('r' + i).value;
    if (!(y >= 0 && r <= 100 && y < r)) {
      $('thMsg').innerHTML = B('r', 'Ошибка') + ' Жёлтый порог должен быть меньше красного (0–100)';
      return;
    }
  }
  $('thMsg').textContent = '';
  toast('Пороги сохранены, изменение записано в журнал');
}

registerScreen('thr', () => `<div class="card">
  <label class="thr-well">Скважина<select><option>214-Р</option><option>218-Р</option></select></label>
  ${['Прихват','Флюидопроявление','Поглощение'].map((t, i) =>
    `<div class="row" style="margin-top:14px">
       <b class="thr-name">${t}</b>
       <label>Жёлтый ≥<input type="number" id="y${i}" value="40" min="0" max="100" class="thr-num"></label>
       <label>Красный ≥<input type="number" id="r${i}" value="70" min="0" max="100" class="thr-num"></label>
     </div>`).join('')}
  <p id="thMsg" class="tag thr-msg"></p>
  <div class="row">
    <button class="btn" onclick="saveThr()">Сохранить</button>
    <button class="btn sec" onclick="render()">Сбросить</button>
  </div>
</div>`);
