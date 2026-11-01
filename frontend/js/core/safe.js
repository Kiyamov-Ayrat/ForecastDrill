/* ===== Экранирование (защита от XSS): использовать при выводе любого пользовательского текста ===== */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ===== Валидаторы: возвращают текст ошибки или null ===== */
const V = {
  required: (v, name) => String(v ?? '').trim() ? null : `Поле «${name}» обязательно`,
  login: v => /^[A-Za-z0-9_.-]{3,32}$/.test(v) ? null : 'Логин: 3–32 символа (латиница, цифры, _ . -)',
  password: v => String(v).length >= 8 ? null : 'Пароль не короче 8 символов',
  range: (v, min, max, name) => {
    const n = Number(v);
    return (String(v).trim() !== '' && Number.isFinite(n) && n >= min && n <= max) ? null : `«${name}»: число от ${min} до ${max}`;
  },
  thresholds: (y, r) => V.range(y, 0, 100, 'Жёлтый порог') || V.range(r, 0, 100, 'Красный порог') ||
    (Number(y) < Number(r) ? null : 'Жёлтый порог должен быть меньше красного'),
  host: v => (String(v).length <= 253 && /^(\d{1,3}(\.\d{1,3}){3}|[A-Za-z0-9.-]+)$/.test(v)) ? null : 'Некорректный адрес источника',
  port: v => (/^\d+$/.test(v) && +v >= 1 && +v <= 65535) ? null : 'Порт: число от 1 до 65535',
  period: (a, b) => {
    if (!a || !b) return 'Укажите начало и конец периода';
    const A = new Date(a), E = new Date(b);
    if (A > E) return 'Начало периода позже конца';
    if (E > new Date()) return 'Конец периода в будущем';
    if ((E - A) / 864e5 > 31) return 'Период не более 31 суток';
    return null;
  },
  text: (v, max = 500) => String(v).length <= max ? null : `Текст не длиннее ${max} символов`,
  file: (f, ext = /\.(pdf|docx|xlsx|csv)$/i, maxMb = 5) => {
    if (!f) return 'Файл не выбран';
    if (!ext.test(f.name)) return 'Допустимые форматы: PDF, DOCX, XLSX, CSV';
    if (f.size === 0) return 'Файл пустой';
    if (f.size > maxMb * 1024 * 1024) return `Файл больше ${maxMb} МБ`;
    return null;
  }
};
const showMsg = (id, text) => { const e = document.getElementById(id); if (!e) return;
  e.hidden = !text; e.textContent = text || ''; e.setAttribute('role', 'alert'); };

/* ===== Журнал и перехват необработанных ошибок ===== */
const ERR_LOG = [];
function logClientError(e) {
  ERR_LOG.push({ t: new Date().toISOString(), m: String((e && e.message) || e) });
  if (ERR_LOG.length > 50) ERR_LOG.shift();
  console.error(e);
}
addEventListener('error', e => { logClientError(e.error || e.message); toast('Ошибка интерфейса. Повторите действие'); });
addEventListener('unhandledrejection', e => { logClientError(e.reason); toast('Операция не выполнена. Повторите попытку'); });

/* ===== Безопасная отрисовка экрана ===== */
(function () {
  const base = window.render;
  if (typeof base !== 'function') return;
  window.render = function () {
    try { base(); }
    catch (e) {
      logClientError(e);
      document.getElementById('app').innerHTML =
        `<div class="card" role="alert" style="max-width:520px;margin:40px auto"><h3>Не удалось отобразить экран</h3>
         <p>${esc(e.message)}</p><button class="btn" onclick="render()">Повторить</button>
         <button class="btn sec" onclick="logout()">Выйти</button></div>`;
    }
  };
})();

/* ===== Ограничение доступа по роли (403) ===== */
(function () {
  const base = window.go;
  if (typeof base !== 'function') return;
  window.go = function (k) {
    const R = st.role && ROLES[st.role];
    if (!R) return window.render();
    if (!R.nav.includes(k)) { toast('Нет доступа к экрану для вашей роли'); return; }
    return base(k);
  };
})();

/* ===== Сеанс: предупреждение через 28 мин, выход через 30 мин бездействия ===== */
(function () {
  const SESSION = 30 * 60e3, WARN = 28 * 60e3;
  let last = Date.now(), warned = false;
  ['click', 'keydown', 'touchstart', 'mousemove'].forEach(ev =>
    document.addEventListener(ev, () => { last = Date.now(); warned = false; }, { passive: true }));
  setInterval(() => {
    if (!st.role) return;
    const idle = Date.now() - last;
    if (idle >= SESSION) { logout(); toast('Сеанс завершён из-за неактивности'); }
    else if (idle >= WARN && !warned) { warned = true; toast('Сеанс завершится через 2 минуты'); }
  }, 10000);
})();

/* ===== Блокировка входа: 5 неудачных попыток -> 15 минут ===== */
const Auth = {
  MAX: 5, LOCK: 15 * 60e3,
  _get() { try { return JSON.parse(localStorage.getItem('authLock') || '{}'); } catch { return {}; } },
  _set(o) { try { localStorage.setItem('authLock', JSON.stringify(o)); } catch { /* хранилище недоступно */ } },
  check() { const s = this._get();
    return (s.until && Date.now() < s.until) ? `Вход заблокирован. Повторите через ${Math.ceil((s.until - Date.now()) / 60000)} мин.` : null; },
  fail() { const s = this._get(); s.n = (s.n || 0) + 1;
    if (s.n >= this.MAX) { s.until = Date.now() + this.LOCK; s.n = 0; this._set(s); return 'Превышено число попыток. Вход заблокирован на 15 минут'; }
    this._set(s); return `Неверный логин или пароль. Осталось попыток: ${this.MAX - s.n}`; },
  ok() { this._set({}); }
};
const DEMO_USERS = {   // демонстрационные учётные записи (в промышленной версии проверка на сервере)
  operator1: { pass: 'Operator#2026', role: 'op', active: true },
  super1:    { pass: 'Super#2026',    role: 'sv', active: true },
  ml1:       { pass: 'MlEng#2026',    role: 'ml', active: true },
  director1: { pass: 'Director#2026', role: 'td', active: false },
  admin1:    { pass: 'Admin#2026',    role: 'ad', active: true }
};