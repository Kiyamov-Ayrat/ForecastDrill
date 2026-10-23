// rep.js — интерфейс S-6 «Отчёты» (UC-9, F-11)
// Супервайзер: загружает файл отчёта и сохраняет его с комментарием.
// ML-инженер и технический директор: просматривают отчёты, оставленные супервайзером.

let repFileData = null; // dataURL выбранного файла (до нажатия «Сохранить»)

// Файл выбран через input[type=file] — читаем его в dataURL
function repPickFile(inp) {
  const f = inp.files[0];
  if (!f) { repFileData = null; $('repFileName').textContent = ''; return; }
  const r = new FileReader();
  r.onload = () => { repFileData = { name: f.name, size: f.size, data: r.result };
    $('repFileName').textContent = `Выбрано: ${f.name} (${Math.max(1, Math.round(f.size / 1024))} КБ)`; };
  r.readAsDataURL(f);
}

// Сохранить загруженный файл + комментарий в список отчётов
function repSave() {
  if (!repFileData) { toast('Сначала выберите файл для загрузки'); return; }
  st.savedReports.push({
    file: repFileData.name, data: repFileData.data,
    comment: $('repComment').value.trim() || 'Без комментария',
    author: ROLES[st.role].n, time: new Date().toLocaleString('ru-RU')
  });
  repFileData = null;
  render(); toast('Файл сохранён среди отчётов');
}

// Открыть сохранённый файл отчёта в новой вкладке
function repOpen(i) {
  const w = window.open(st.savedReports[i].data, '_blank');
  if (!w) toast('Браузер заблокировал открытие файла');
}

registerScreen('rep', () => {
  // Режим просмотра: ML-инженер и технический директор видят отчёты супервайзера
  if (st.role === 'ml' || st.role === 'td') {
    const list = st.savedReports.map((r, i) =>
      `<div class="card rep-view-item">
         <div class="row" style="justify-content:space-between">
           <b>${r.file}</b>
           <span><button class="btn sec" onclick="repOpen(${i})">Просмотр</button>
           <a class="btn sec" href="${r.data}" download="${r.file}">Скачать</a></span>
         </div>
         <p class="tag">Оставлен: ${r.author}, ${r.time}</p>
         <p>${r.comment}</p>
       </div>`).join('');
    return `<div class="card"><h3>Отчёты супервайзера</h3>
      ${list || '<p class="tag">Сохранённых отчётов пока нет.</p>'}</div>`;
  }
  // Режим супервайзера: форма загрузки файла и сохранения + список сохранённых
  return `<div class="grid g2">
    <div class="card"><h3>Загрузить и сохранить отчёт</h3>
      <div class="drop">Перетащите файл отчёта или выберите его<br>
        <input type="file" id="repFile" class="rep-file" accept=".pdf,.xlsx,.csv,.docx,.txt" onchange="repPickFile(this)">
        <div id="repFileName" class="tag rep-filename"></div>
      </div>
      <label style="margin-top:12px">Комментарий<textarea id="repComment" rows="3"
        placeholder="Например: разбор поглощения на скв. 214-Р за смену"></textarea></label>
      <div class="row rep-form"><button class="btn" onclick="repSave()">Сохранить</button></div>
    </div>
    <div class="card"><h3>Мои сохранённые отчёты</h3>
      ${st.savedReports.length
        ? T(['Файл','Комментарий','Сохранён'], st.savedReports.map(r => [r.file, r.comment, r.time]))
        : '<p class="tag">Пока нет сохранённых отчётов.</p>'}
    </div>
  </div>`;
});
