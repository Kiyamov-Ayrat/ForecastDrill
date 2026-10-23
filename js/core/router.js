// router.js — маршрутизация между интерфейсами и общий рендер каркаса

// Реестр экранов: пополняется каждым файлом js/screens/*.js через registerScreen()
const SCREENS = {};
function registerScreen(key, renderFn) { SCREENS[key] = renderFn; }

// Перейти на экран по ключу
function go(k) { st.cur = k; render(); }

// Полный перерисовываемый контент приложения
function render() {
  const app = $('app');
  // Не авторизован — показываем только форму входа
  if (!st.role) {
    $('who').textContent = '';
    app.innerHTML = SCREENS.login();
    return;
  }
  const R = ROLES[st.role], m = META[st.cur];
  $('who').innerHTML = `<b>${R.n}</b> <button class="btn sec" onclick="logout()">Выйти</button>`;
  app.innerHTML = `<div class="app"><nav class="side">${R.nav.map(k =>
    `<a href="#" class="${k === st.cur ? 'on' : ''}" onclick="go('${k}');return false">${META[k][0]} · ${META[k][1]}</a>`
  ).join('')}</nav><main><h2>${m[1]}</h2>${SCREENS[st.cur]()}<p class="tag" style="margin-top:16px">${m[0]} · ${m[2]} · ${m[3]} · данные демонстрационные</p></main></div>`;
}

// Вход в систему (вызывается из экрана login)
function login() {
  if (!$('lg').value.trim() || !$('pw').value) { $('err').hidden = false; return; }
  st.role = $('rl').value;
  st.cur = ROLES[st.role].home;
  render();
}

// Выход из системы
function logout() { st.role = null; render(); }
