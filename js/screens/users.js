// users.js — интерфейс S-11 «Пользователи и роли» (UC-13, F-12)
// Администратор: создание, редактирование (роль, логин, пароль, скважины) и удаление пользователей.

// Назначение скважин: '*' = все; список кодов — конкретные
const WELL_CODES = WELLS.map(w => w[0]);
const ROLE_KEYS = Object.keys(ROLES); // op, sv, ml, td, ad

const wellsText = u => u.wells.includes('*') ? 'Все' : u.wells.join(', ') || '—';

// Открыть форму: без idx — создание, с idx — редактирование пользователя
function uAdd()  { st.uForm = { login: '', role: 'sv', wells: [], pwd: '', active: true }; render(); }
function uEdit(id){ const u = st.users.find(x => x.id === id); if (!u) return;
  st.uForm = { id: u.id, login: u.login, role: u.role, wells: u.wells.slice(), pwd: '', active: u.active }; render(); }
function uCancel(){ st.uForm = null; render(); }
function uRole(v){ st.uForm.role = v; render(); }
function uWell(code, on){ const w = st.uForm.wells;
  if (on) { if (!w.includes(code)) w.push(code); } else { const i = w.indexOf(code); if (i >= 0) w.splice(i, 1); }
  render(); }
function uAll(on){ st.uForm.wells = on ? ['*'] : []; render(); }
function uActive(on){ st.uForm.active = !!on; render(); }

function uSave(){
  const f = st.uForm;
  if ($('uLogin')) f.login = $('uLogin').value;   // актуальные значения полей формы
  if ($('uPwd'))   f.pwd   = $('uPwd').value;
  f.login = (f.login || '').trim();
  if (!f.login)        { $('uMsg').innerHTML = B('r','Ошибка') + ' Укажите логин'; return; }
  if (!ROLE_KEYS.includes(f.role)) { $('uMsg').innerHTML = B('r','Ошибка') + ' Выберите роль'; return; }
  if (!f.wells.length) { $('uMsg').innerHTML = B('r','Ошибка') + ' Назначьте хотя бы одну скважину (или «Все»)'; return; }
  if (f.id == null && !f.pwd) { $('uMsg').innerHTML = B('r','Ошибка') + ' Для нового пользователя задайте пароль'; return; }
  if (f.pwd && f.pwd.length < 4) { $('uMsg').innerHTML = B('r','Ошибка') + ' Пароль не короче 4 символов'; return; }
  if (st.users.some(u => u.login.toLowerCase() === f.login.toLowerCase() && u.id !== f.id)) {
    $('uMsg').innerHTML = B('r','Ошибка') + ' Логин уже занят'; return;
  }
  if (f.id == null) {
    st.users.push({ id: st.uSeq++, login: f.login, role: f.role, wells: f.wells.slice(), active: f.active });
    toast('Пользователь «' + f.login + '» создан, изменение записано в журнал аудита');
  } else {
    const u = st.users.find(x => x.id === f.id);
    u.login = f.login; u.role = f.role; u.wells = f.wells.slice(); u.active = f.active;
    toast('Данные пользователя «' + u.login + '» сохранены, изменение записано в журнал аудита');
  }
  st.uForm = null; render();
}

function uDelete(id){
  const u = st.users.find(x => x.id === id); if (!u) return;
  if (!confirm('Удалить пользователя «' + u.login + '»?')) return;
  st.users = st.users.filter(x => x.id !== id);
  if (st.uForm && st.uForm.id === id) st.uForm = null;
  toast('Пользователь «' + u.login + '» удалён, изменение записано в журнал аудита');
  render();
}

// Форма создания/редактирования над списком пользователей
function userForm(){
  const f = st.uForm, isNew = f.id == null;
  const all = f.wells.includes('*');
  return `<div class="card users-form" style="margin-bottom:14px">
    <h3>${isNew ? 'Новый пользователь' : 'Редактирование: ' + f.login}</h3>
    <div class="row">
      <label>Логин<input id="uLogin" value="${f.login}" placeholder="например, operator2"></label>
      <label>Роль<select id="uRoleSel" onchange="uRole(this.value)">
        ${ROLE_KEYS.map(k => `<option value="${k}" ${k === f.role ? 'selected' : ''}>${ROLES[k].n}</option>`).join('')}
      </select></label>
      <label>${isNew ? 'Пароль' : 'Новый пароль (пусто — не менять)'}
        <input id="uPwd" type="password" placeholder="минимум 4 символа"></label>
      <label>Активен<input type="checkbox" id="uAct" ${f.active ? 'checked' : ''} onchange="uActive(this.checked)" style="width:20px;height:20px;margin-top:6px"></label>
    </div>
    <div class="users-wells">
      <b class="tag">Скважины</b>
      <label class="users-all"><input type="checkbox" ${all ? 'checked' : ''} onchange="uAll(this.checked)"> Все скважины</label>
      ${!all ? `<div class="row">${WELL_CODES.map(c =>
        `<label class="users-chk"><input type="checkbox" ${f.wells.includes(c) ? 'checked' : ''}
          onchange="uWell('${c}',this.checked)"> ${c}</label>`).join('')}</div>` : ''}
    </div>
    <p id="uMsg" class="tag" style="min-height:22px"></p>
    <div class="row">
      <button class="btn" onclick="uSave()">Сохранить</button>
      <button class="btn sec" onclick="uCancel()">Отмена</button>
    </div>
  </div>`;
}

registerScreen('users', () => (st.uForm ? userForm() : '') + `<div class="card">
  <div class="row users-head">
    <h3>Пользователи (${st.users.length})</h3>
    <button class="btn" onclick="uAdd()">+ Добавить</button>
  </div>
  ${T(['Логин','Роль','Скважины','Активен','Действия'],
    st.users.map(u => [
      `<b>${u.login}</b>`,
      ROLES[u.role] ? ROLES[u.role].n : u.role,
      wellsText(u),
      u.active ? B('g','Да') : B('y','Нет'),
      `<button class="btn sec" onclick="uEdit(${u.id})">Изменить</button>
       <button class="btn no-del" onclick="uDelete(${u.id})">Удалить</button>`
    ]))}
  <p class="tag" style="margin-top:10px">Все изменения записываются в журнал аудита (F-12). Данные демонстрационные.</p>
</div>`);
