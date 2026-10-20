export function getApiBaseUrl() {
  const configured = String(process.env.REACT_APP_API_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window === 'undefined') return '';

  const { protocol, hostname, port } = window.location;
  if (port === '5000') return '';
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:5000`;
  }

  // GitHub Codespaces publica cada puerto con un subdominio distinto.
  const codespacesHost = hostname.replace(/-3000(?=\.|$)/, '-5000');
  if (codespacesHost !== hostname) return `${protocol}//${codespacesHost}`;
  if (port === '3000') return `${protocol}//${hostname}:5000`;

  // En despliegues con proxy, /api se resuelve en el mismo origen.
  return '';
}

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
