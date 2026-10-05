export function apiFetch(apiBaseUrl, path, options = {}) {
  let token;
  try {
    token = JSON.parse(localStorage.getItem('sgti_user') || 'null')?.token;
  } catch {
    token = null;
  }

  const isMultipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
  return fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(!isMultipart ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
}