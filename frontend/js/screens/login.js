// login.js — интерфейс S-1 «Вход в систему» (UC-1, F-12)
registerScreen('login', () => <!-- разметка формы входа: уберите поле «Демо-роль» -->
<div class="login"><div class="card">
  <h2 style="margin:0">Вход в систему</h2>
  <label>Логин<input id="lg" autocomplete="username"></label>
  <label>Пароль<input id="pw" type="password" autocomplete="current-password"
                      onkeydown="if(event.key==='Enter')login()"></label>
  <div id="err" role="alert" hidden></div>
  <button class="btn" id="loginBtn" onclick="login()">Войти</button>
  <span class="tag">S-1 · UC-1 · F-12</span>
</div></div>


async function login() {
  const l = document.getElementById('lg').value.trim();
  const p = document.getElementById('pw').value;
  if (!l || !p) return FD.msg('err', 'Введите логин и пароль');
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(l)) return FD.msg('err', 'Логин: 3–32 символа (латиница, цифры, _ . -)');
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  try {
    const r = await api('/auth/login', { method: 'POST', body: { login: l, password: p } });
    Session.save(r.access_token, r.user);
    await startSession(r.user);
  } catch (e) {
    FD.msg('err', e.message);          // «Неверный логин или пароль», блокировка, отключённая запись
    btn.disabled = false;
  }
}

async function startSession(user) {
  const role = ROLE_MAP[user.role];
  if (!role || !ROLES[role]) { Session.clear(); throw new Error('Роль «' + user.role + '» не поддерживается интерфейсом'); }
  st.user = user; st.role = role; st.cur = ROLES[role].home;
  Bridge.reset();
  try { await Bridge.prepare(st.cur); }
  catch (e) { Session.clear(); st.role = null; throw e; }
  Bridge.start();
  render();
}

function logout() {
  Session.clear(); Bridge.stop(); Bridge.reset();
  st.role = null; st.user = null;
  render();
}

async function boot() {                     // восстановление сеанса после обновления страницы
  if (!Session.token()) return render();
  try { await startSession(await api('/auth/me')); }
  catch (e) { Session.clear(); render(); }
}