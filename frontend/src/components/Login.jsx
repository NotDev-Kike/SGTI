import React, { useState } from 'react';

export default function Login({ onLogin, apiBaseUrl }) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    fetch(`${apiBaseUrl}/api/auth/${isRegistering ? 'registro' : 'login'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nombre })
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

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-slate-800">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">SGTI</h1>
          <p className="text-sm text-slate-500 mt-1">Plataforma Inteligente de Servicios de IT</p>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs bg-red-50 text-red-600 rounded-lg border border-red-200 text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {isRegistering && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Nombre completo</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Correo Institucional / Personal</label>
            <input 
              type="email"
              placeholder="ej. infra@sgti.com o usuario@sgti.com"
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
              minLength={isRegistering ? 8 : undefined}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm shadow-md transition"
          >
            {isRegistering ? 'Crear cuenta' : 'Iniciar Sesión Unificada'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
          className="mt-4 w-full text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          {isRegistering ? 'Ya tengo cuenta' : 'Crear una cuenta de usuario'}
        </button>

        {!isRegistering && <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-600">Accesos por correo:</p>
          <p>• Gerencia: arnold@sgti.com</p>
          <p>• Infraestructura: infra@sgti.com</p>
          <p>• GPS: erick@sgti.com | Desarrollo: luis@sgti.com</p>
        </div>}
      </div>
    </div>
  );
}