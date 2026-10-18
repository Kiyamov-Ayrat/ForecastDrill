// login.js — интерфейс S-1 «Вход в систему» (UC-1, F-12)
registerScreen('login', () => `<div class="login"><div class="card">
  <h2 style="margin:0">Вход в систему</h2>
  <label>Логин<input id="lg" value="demo"></label>
  <label>Пароль<input id="pw" type="password" value="demo"></label>
  <label>Демо-роль<select id="rl">${Object.keys(ROLES).map(k => `<option value="${k}">${ROLES[k].n}</option>`).join('')}</select></label>
  <div id="err" hidden>${B('r','Ошибка')} Неверный логин или пароль</div>
  <button class="btn" onclick="login()">Войти</button>
  <span class="tag">S-1 · UC-1 · F-12</span>
</div></div>`);
