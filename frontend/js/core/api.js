/* Клиент REST API и хранилище сеанса */
const API_BASE = window.API_BASE || '/api/v1';

const Session = {
  save(token, user, expiresIn) { try {
    sessionStorage.setItem('fd_token', token);
    sessionStorage.setItem('fd_user', JSON.stringify(user));
    if (expiresIn) sessionStorage.setItem('fd_exp', String(Date.now() + expiresIn * 1000));
  } catch (e) { /* хранилище недоступно */ } },
  token() { try { return sessionStorage.getItem('fd_token'); } catch (e) { return null; } },
  expiresAt() { try { return Number(sessionStorage.getItem('fd_exp')) || 0; } catch (e) { return 0; } },
  touch(expMs) { try { sessionStorage.setItem('fd_exp', String(expMs)); } catch (e) { /* ignore */ } },
  clear() { try { sessionStorage.removeItem('fd_token'); sessionStorage.removeItem('fd_user'); sessionStorage.removeItem('fd_exp'); } catch (e) { /* ignore */ } }
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
    throw new ApiError(401, (data && (data.error && data.error.message || data.detail)) || 'Сеанс истёк');
  }
  if (!res.ok) {
    const err = data && (data.error || (data.detail ? { message: typeof data.detail === 'string' ? data.detail : '' } : null));
    let msg = (err && err.message) || (typeof data === 'string' && data) || 'Ошибка сервера (' + res.status + ')';
    if (err && err.details && err.details.length) {
      msg += ': ' + err.details.map(d => d.message.replace(/^Value error, /, '')).join('; ');
    }
    // Ошибки доступа FastAPI (HTTPException) приходят как {"detail": "..."}
    if (msg === 'Ошибка сервера (' + res.status + ')' && typeof data?.detail === 'string' && data.detail) msg = data.detail;
    throw new ApiError(res.status, msg);
  }
  return data;
}