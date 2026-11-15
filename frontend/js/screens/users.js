// users.js — интерфейс S-11 «Пользователи и роли» (UC-13, F-12)
// Администратор: создание, редактирование и удаление через /api/v1/users (PostgreSQL).

const ROLE_TO_API = { op: 'operator', sv: 'supervisor', ml: 'ml_engineer', td: 'director', ad: 'admin' };
const ROLE_FROM_API = { operator: 'op', supervisor: 'sv', ml_engineer: 'ml', director: 'td', admin: 'ad' };
const PRIVILEGED_ROLES = new Set(['ml', 'td', 'ad']); // на сервере видят все скважины без назначения
const LOGIN_RE = /^[A-Za-z0-9_.-]{3,32}$/;

const Users = { list: [], wells: [], slot: null };

const uEsc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function ensureUsers() {
  if (!Users.slot) {
    Users.slot = { state: 'loading' };
    Promise.all([api('/users'), api('/wells')])
      .then(([users, wells]) => {
        Users.list = users;
        Users.wells = wells;
        Users.slot.state = 'ready';
        render();
      })
      .catch(e => {
        Users.slot = { state: 'error', error: e.message || 'Не удалось загрузить пользователей' };
        render();
      });
  }
  return Users.slot;
}

function retryUsers() { Users.slot = null; st.uForm = null; render(); }

function wellName(id) {
  const w = Users.wells.find(x => x.id === id);
  return w ? w.name : 'скважина';
}

function coversAll(ids) {
  return Users.wells.length > 0 && Users.wells.every(w => ids.includes(w.id));
}

function wellsText(u) {
  const key = ROLE_FROM_API[u.role];
  if (!u.well_ids.length) return PRIVILEGED_ROLES.has(key) ? 'Все' : '—';
  if (coversAll(u.well_ids)) return 'Все';
  return u.well_ids.map(wellName).join(', ');
}

function syncForm() {
  const f = st.uForm;
  if (!f) return;
  if ($('uLogin')) f.login = $('uLogin').value;
  if ($('uPwd')) f.pwd = $('uPwd').value;
}

function uMsg(text) {
  const e = $('uMsg');
  if (e) e.textContent = text || '';
}

function uAdd() {
  st.uForm = { id: null, login: '', role: 'sv', wellIds: [], all: false, pwd: '', active: true };
  render();
}

function uEdit(id) {
  const u = Users.list.find(x => x.id === id);
  if (!u) return;
  const role = ROLE_FROM_API[u.role] || 'sv';
  const all = (!u.well_ids.length && PRIVILEGED_ROLES.has(role)) || coversAll(u.well_ids);
  st.uForm = {
    id: u.id, login: u.login, role, wellIds: all ? [] : u.well_ids.slice(),
    all, pwd: '', active: u.is_active
  };
  render();
}

function uCancel() { st.uForm = null; render(); }
function uRole(v) { syncForm(); st.uForm.role = v; render(); }
function uActive(on) { syncForm(); st.uForm.active = !!on; render(); }

function uAll(on) {
  syncForm();
  st.uForm.all = !!on;
  if (!on) st.uForm.wellIds = [];
  render();
}

function uWell(id, on) {
  syncForm();
  const f = st.uForm;
  if (f.all) {
    f.all = false;
    f.wellIds = Users.wells.map(w => w.id);
  }
  if (on) { if (!f.wellIds.includes(id)) f.wellIds.push(id); }
  else f.wellIds = f.wellIds.filter(x => x !== id);
  render();
}

function wellIdsPayload(f) {
  if (f.all) return PRIVILEGED_ROLES.has(f.role) ? [] : Users.wells.map(w => w.id);
  return f.wellIds.slice();
}

function upsertUser(u) {
  const i = Users.list.findIndex(x => x.id === u.id);
  if (i >= 0) Users.list[i] = u;
  else Users.list.push(u);
  Users.list.sort((a, b) => a.login.localeCompare(b.login, 'en'));
}

async function uSave() {
  const f = st.uForm;
  if (!f) return;
  syncForm();
  f.login = (f.login || '').trim();
  const pwd = f.pwd || '';
  if (!LOGIN_RE.test(f.login)) { uMsg('Логин: 3–32 символа (латиница, цифры, _ . -)'); return; }
  if (!ROLE_TO_API[f.role]) { uMsg('Выберите роль'); return; }
  const wellIds = wellIdsPayload(f);
  if (!PRIVILEGED_ROLES.has(f.role) && !wellIds.length) {
    uMsg('Назначьте хотя бы одну скважину (или «Все»)'); return;
  }
  if (f.id == null && pwd.length < 8) { uMsg('Пароль не короче 8 символов'); return; }
  if (pwd && pwd.length < 8) { uMsg('Пароль не короче 8 символов'); return; }
  if (Users.list.some(u => u.login === f.login && u.id !== f.id)) { uMsg('Логин уже занят'); return; }

  const body = { login: f.login, role: ROLE_TO_API[f.role], is_active: f.active, well_ids: wellIds };
  if (pwd) body.password = pwd;
  const btn = $('uSaveBtn');
  if (btn) btn.disabled = true;
  try {
    const saved = f.id == null
      ? await api('/users', { method: 'POST', body })
      : await api('/users/' + f.id, { method: 'PATCH', body });
    upsertUser(saved);
    st.uForm = null;
    toast(f.id == null
      ? 'Пользователь «' + saved.login + '» создан'
      : 'Данные пользователя «' + saved.login + '» сохранены');
    render();
  } catch (e) {
    uMsg(e.message || 'Не удалось сохранить');
    if (btn) btn.disabled = false;
  }
}

async function uDelete(id) {
  const u = Users.list.find(x => x.id === id);
  if (!u) return;
  if (st.user && st.user.id === id) { toast('Нельзя удалить собственную учётную запись'); return; }
  if (!confirm('Удалить пользователя «' + u.login + '»?')) return;
  try {
    await api('/users/' + id, { method: 'DELETE' });
    Users.list = Users.list.filter(x => x.id !== id);
    if (st.uForm && st.uForm.id === id) st.uForm = null;
    toast('Пользователь «' + u.login + '» удалён');
    render();
  } catch (e) { toast(e.message || 'Не удалось удалить'); }
}

function userForm() {
  const f = st.uForm, isNew = f.id == null;
  return `<div class="card users-form" style="margin-bottom:14px">
    <h3>${isNew ? 'Новый пользователь' : 'Редактирование: ' + uEsc(f.login)}</h3>
    <div class="row">
      <label>Логин<input id="uLogin" value="${uEsc(f.login)}" autocomplete="off" placeholder="например, operator2"></label>
      <label>Роль<select id="uRoleSel" onchange="uRole(this.value)">
        ${Object.keys(ROLES).map(k => `<option value="${k}" ${k === f.role ? 'selected' : ''}>${uEsc(ROLES[k].n)}</option>`).join('')}
      </select></label>
      <label>${isNew ? 'Пароль' : 'Новый пароль (пусто — не менять)'}
        <input id="uPwd" type="password" autocomplete="new-password" value="${uEsc(f.pwd)}" placeholder="минимум 8 символов"></label>
      <label>Активен<input type="checkbox" id="uAct" ${f.active ? 'checked' : ''} onchange="uActive(this.checked)" style="width:20px;height:20px;margin-top:6px"></label>
    </div>
    <div class="users-wells">
      <b class="tag">Скважины</b>
      <label class="users-all"><input type="checkbox" ${f.all ? 'checked' : ''} onchange="uAll(this.checked)"> Все скважины</label>
      ${!f.all ? `<div class="row">${Users.wells.map(w =>
        `<label class="users-chk"><input type="checkbox" ${f.wellIds.includes(w.id) ? 'checked' : ''}
          onchange="uWell('${w.id}',this.checked)"> ${uEsc(w.name)}</label>`).join('')}</div>` : ''}
    </div>
    <p class="tag">Пароль хранится в базе только как хеш, поэтому при редактировании поле пустое. Для оператора и супервайзера «Все» назначает скважины, которые есть сейчас. Администратор, ML-инженер и директор без списка видят все скважины.</p>
    <p id="uMsg" class="tag" style="min-height:22px;color:var(--r)"></p>
    <div class="row">
      <button class="btn" id="uSaveBtn" onclick="uSave()">Сохранить</button>
      <button class="btn sec" onclick="uCancel()">Отмена</button>
    </div>
  </div>`;
}

function usersPending(slot) {
  if (slot.state === 'error')
    return `<div class="card" role="alert"><b>Не удалось загрузить пользователей</b><p>${uEsc(slot.error)}</p>
            <button class="btn" onclick="retryUsers()">Повторить</button></div>`;
  return '<div class="card">Загрузка пользователей…</div>';
}

registerScreen('users', () => {
  const slot = ensureUsers();
  if (slot.state !== 'ready') return usersPending(slot);
  const me = st.user && st.user.id;
  return (st.uForm ? userForm() : '') + `<div class="card">
    <div class="row users-head">
      <h3>Пользователи (${Users.list.length})</h3>
      <button class="btn" onclick="uAdd()">+ Добавить</button>
    </div>
    ${T(['Логин','Роль','Скважины','Активен','Действия'],
      Users.list.map(u => {
        const key = ROLE_FROM_API[u.role];
        const del = u.id === me ? '' : `<button class="btn no-del" onclick="uDelete('${u.id}')">Удалить</button>`;
        return [
          `<b>${uEsc(u.login)}</b>`,
          uEsc(key && ROLES[key] ? ROLES[key].n : u.role),
          uEsc(wellsText(u)),
          u.is_active ? B('g','Да') : B('y','Нет'),
          `<button class="btn sec" onclick="uEdit('${u.id}')">Изменить</button> ${del}`
        ];
      }))}
    <p class="tag" style="margin-top:10px">Изменения записываются в PostgreSQL и в журнал аудита.</p>
  </div>`;
});
