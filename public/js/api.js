// ── API Client ──────────────────────────────────────────────────
const API = (() => {
  const BASE = '/api';

  const getToken = () => localStorage.getItem('accessToken');
  const getRefresh = () => localStorage.getItem('refreshToken');

  const headers = () => ({
    'Content-Type': 'application/json',
    ...(getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {})
  });

  const refreshToken = async () => {
    const rt = getRefresh();
    if (!rt) throw new Error('No refresh token');
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return data.accessToken;
    }
    throw new Error('Refresh failed');
  };

  const request = async (method, path, body = null, retry = true) => {
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    let res = await fetch(`${BASE}${path}`, opts);

    if (res.status === 401 && retry) {
      try {
        await refreshToken();
        return request(method, path, body, false);
      } catch {
        Auth.logout();
        return { success: false, message: 'Session expired. Please login again.' };
      }
    }
    return res.json();
  };

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
    postNoAuth: (path, body) => fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json())
  };
})();
