import React, { useEffect, useState } from 'react';

export default function Login({ onLogin, apiBaseUrl }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [conectandoMicrosoft, setConectandoMicrosoft] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('microsoft_code');
    const microsoftError = params.get('microsoft_error');
    if (microsoftError) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setError(microsoftError);
    }
    if (!code) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    setConectandoMicrosoft(true);
    fetch(`${apiBaseUrl}/api/microsoft/login/exchange?code=${encodeURIComponent(code)}`)
      .then(response => response.json())
      .then(data => {
        if (!data.success) throw new Error(data.message || 'No se pudo iniciar sesión con Microsoft.');
        onLogin({ ...data.user, token: data.token });
      })
      .catch(error => setError(error.message || 'No se pudo iniciar sesión con Microsoft.'))
      .finally(() => setConectandoMicrosoft(false));
  }, [apiBaseUrl, onLogin]);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // data.user incluye { id, email, rol, departamento_id, nombre }
        onLogin({ ...data.user, token: data.token });
      } else {
        setError(data.message || 'Credenciales incorrectas.');
      }
    })
    .catch(() => {
      setError('No se pudo conectar con el servidor. Inténtelo de nuevo más tarde.');
    });
  };

  const iniciarSesionMicrosoft = async () => {
    setError('');
    setConectandoMicrosoft(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/microsoft/login`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Microsoft no está configurado.');
      window.location.assign(result.url);
    } catch (requestError) {
      const mensaje = requestError instanceof TypeError && /fetch/i.test(requestError.message)
        ? 'No se pudo conectar con el backend. Verifique que el servidor esté activo en el puerto 5000 y que ese puerto esté publicado.'
        : requestError.message || 'No se pudo iniciar sesión con Microsoft.';
      setError(mensaje);
      setConectandoMicrosoft(false);
    } finally {
      // La navegación a Microsoft mantiene el estado de carga hasta que vuelva al login.
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-slate-800">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">SGTI-Baprosa</h1>
          <p className="text-sm text-slate-500 mt-1">Plataforma Servicios de IT</p>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs bg-red-50 text-red-600 rounded-lg border border-red-200 text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Correo electrónico</label>
            <input 
              type="email"
              placeholder="Ingrese su correo electrónico"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Contraseña</label>
            <input 
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm shadow-md transition"
          >
            Iniciar sesión
          </button>
        </form>
        <div className="my-5 flex items-center gap-3 text-[11px] text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          <span>o continúe con su cuenta corporativa</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <button
          type="button"
          onClick={iniciarSesionMicrosoft}
          disabled={conectandoMicrosoft}
          className="w-full rounded-lg border border-blue-200 bg-blue-50 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
        >
          {conectandoMicrosoft ? 'Conectando con Microsoft...' : 'Ingresar con Microsoft 365'}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">Se reconocerán automáticamente su perfil, área y permisos en SGTI.</p>
      </div>
    </div>
  );
}
