/* Клиент REST API и хранилище сеанса */
const API_BASE = window.API_BASE || '/api/v1';

const Session = {
  save(token, user) { try { sessionStorage.setItem('fd_token', token); sessionStorage.setItem('fd_user', JSON.stringify(user)); } catch (e) { /* хранилище недоступно */ } },
  token() { try { return sessionStorage.getItem('fd_token'); } catch (e) { return null; } },
  clear() { try { sessionStorage.removeItem('fd_token'); sessionStorage.removeItem('fd_user'); } catch (e) { /* ignore */ } }
};

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Session.token();
  if (token) headers.Authorization = 'Bearer ' + token;

  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new ApiError(0, 'Нет соединения с сервером');
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* пустое тело */ }

  if (res.status === 401 && path !== '/auth/login') {
    toast('Сеанс истёк. Войдите снова');
    logout();
    throw new ApiError(401, 'Сеанс истёк');
  }
  if (!res.ok) {
    const err = data && data.error;
    let msg = err ? err.message : 'Ошибка сервера (' + res.status + ')';
    if (err && err.details && err.details.length) {
      msg += ': ' + err.details.map(d => d.message.replace(/^Value error, /, '')).join('; ');
    }
    throw new ApiError(res.status, msg);
  }
  return data;
}