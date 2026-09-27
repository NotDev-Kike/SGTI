export function apiFetch(apiBaseUrl, path, options = {}) {
  let token;
  try {
    token = JSON.parse(localStorage.getItem('sgti_user') || 'null')?.token;
  } catch {
    token = null;
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
}