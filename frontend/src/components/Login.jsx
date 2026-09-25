import React, { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isRegister ? 'registro' : 'login';

    try {
      const res = await fetch(`http://localhost:5000/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (res.ok) {
        if (isRegister) {
          alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
          setIsRegister(false);
        } else {
          onLoginSuccess(data.usuario); // Pasamos el usuario autenticado a la app principal
        }
      } else {
        setError(data.error || 'Ocurrió un error');
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar con el servidor');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">SGTI - IT Management</h2>
        <p className="text-center text-gray-500 mb-6">{isRegister ? 'Crear nueva cuenta' : 'Iniciar sesión en tu cuenta'}</p>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded-md">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
              <input 
                type="text" 
                required
                className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                onChange={(e) => setFormData({...formData, nombre: e.target.value})}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
            <input 
              type="email" 
              required
              className="w-full mt-1 p-2 border border-gray-300 rounded-md"
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input 
              type="password" 
              required
              className="w-full mt-1 p-2 border border-gray-300 rounded-md"
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white p-2 rounded-md font-semibold hover:bg-blue-700 transition"
          >
            {isRegister ? 'Registrarse' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>

        {/* Credenciales rápidas de prueba para desarrollo */}
        <div className="mt-8 border-t pt-4 text-xs text-gray-500">
          <p className="font-semibold mb-1">Credenciales de Administrador para Probar:</p>
          <p>• Gerente IT: <code>arnold@sgti.com</code> / <code>admin123</code></p>
          <p>• Infraestructura: <code>infra@sgti.com</code> / <code>admin123</code></p>
        </div>
      </div>
    </div>
  );
}