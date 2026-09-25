import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'https://friendly-capybara-q74gqxwxr46xfx9vg-4000.app.github.dev';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [tickets, setTickets] = useState([]);
  const [historial, setHistorial] = useState([]);
  
  const [form, setForm] = useState({
    nombre_solicitante: '', 
    departamento: '', 
    ubicacion: 'Presencial',
    titulo: '', 
    descripcion: '', 
    categoria: 'hardware',
    tipo_solicitud: 'incidente', 
    prioridad: 'media', 
    urgencia: 'media',
    asignado_a: 'infraestructura',
    evidencia: null
  });
  
  const [resolucionTextos, setResolucionTextos] = useState({});

  const cargarDatos = () => {
    fetch(`${API_BASE_URL}/api/tickets/listar`)
      .then(res => res.json())
      .then(data => { if (data.success) setTickets(data.data); })
      .catch(err => console.error("Error al listar tickets:", err));

    fetch(`${API_BASE_URL}/api/tickets/historial`)
      .then(res => res.json())
      .then(data => { if (data.success) setHistorial(data.data); })
      .catch(err => console.error("Error al cargar historial:", err));
  };

  useEffect(() => { 
    if (currentUser) {
      cargarDatos(); 
    }
  }, [currentUser]);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoginError('');

    const email = loginForm.email.toLowerCase().trim();
    let roleName = 'Usuario Final / Solicitante';
    let area = 'General';

    if (email === 'arnold@sgti.com') {
      roleName = 'Gerencia de IT (Arnold)';
      area = 'Gerencia';
    } else if (email === 'infra@sgti.com') {
      roleName = 'Infraestructura IT';
      area = 'Infraestructura';
    } else if (email === 'luis@sgti.com') {
      roleName = 'Desarrollo (Luis)';
      area = 'Desarrollo';
    } else if (email === 'erick@sgti.com') {
      roleName = 'GPS / Rutas (Erick)';
      area = 'GPS';
    }

    if (loginForm.password.trim() !== '') {
      setCurrentUser({ email, role: roleName, area });
    } else {
      setLoginError('Por favor ingrese su contraseña.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginForm({ email: '', password: '' });
  };

  const handleSubmitTicket = (e) => {
    e.preventDefault();
    fetch(`${API_BASE_URL}/api/tickets/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Ticket creado y clasificado exitosamente');
        setForm({
          nombre_solicitante: currentUser?.email || '', 
          departamento: '', 
          ubicacion: 'Presencial',
          titulo: '', 
          descripcion: '', 
          categoria: 'hardware',
          tipo_solicitud: 'incidente', 
          prioridad: 'media', 
          urgencia: 'media',
          asignado_a: 'infraestructura',
          evidencia: null
        });
        cargarDatos();
        setActiveTab('dashboard');
      }
    })
    .catch(err => console.error("Error al crear ticket:", err));
  };

  const resolverTicket = (id) => {
    const textoResolucion = resolucionTextos[id] || 'Incidencia resuelta satisfactoriamente';
    
    fetch(`${API_BASE_URL}/api/tickets/resolver/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ detalles_resolucion: textoResolucion })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Ticket resuelto y movido al historial');
        cargarDatos();
      }
    })
    .catch(err => console.error("Error al resolver ticket:", err));
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-slate-800">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">SGTI</h1>
            <p className="text-sm text-slate-500 mt-1">Gestión de Infraestructura y Tickets IT</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 text-xs bg-red-50 text-red-600 rounded-lg border border-red-200 text-center font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Correo Electrónico</label>
              <input 
                type="email"
                placeholder="ej. arnold@sgti.com"
                value={loginForm.email}
                onChange={e => setLoginForm({...loginForm, email: e.target.value})}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Contraseña</label>
              <input 
                type="password"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 text-sm shadow-md"
            >
              Iniciar Sesión en el Sistema
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-600">Accesos IT Principales:</p>
            <p>Gerencia: arnold@sgti.com | Infra: infra@sgti.com</p>
            <p>Desarrollo: luis@sgti.com | GPS: erick@sgti.com</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-800">
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col shadow-xl`}>
        
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wider">SGTI</h2>
            <p className="text-xs text-slate-400">Área de Soporte e Infraestructura</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white text-lg font-bold">
            ✕
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto text-sm">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            📊 Dashboard General
          </button>
          <button 
            onClick={() => { setActiveTab('crear'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition ${activeTab === 'crear' ? 'bg-blue-600 text-white shadow' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            📝 Nuevo Ticket
          </button>
          <button 
            onClick={() => { setActiveTab('activos'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition ${activeTab === 'activos' ? 'bg-blue-600 text-white shadow' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            📋 Todos los Tickets ({tickets.length})
          </button>
          <button 
            onClick={() => { setActiveTab('criticos'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition ${activeTab === 'criticos' ? 'bg-blue-600 text-white shadow' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            🚨 Tickets Críticos (Semáforo)
          </button>
          <button 
            onClick={() => { setActiveTab('historial'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition ${activeTab === 'historial' ? 'bg-blue-600 text-white shadow' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            📁 Historial Resueltos ({historial.length})
          </button>
          {currentUser.area === 'Gerencia' && (
            <button 
              onClick={() => { setActiveTab('usuarios'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition ${activeTab === 'usuarios' ? 'bg-blue-600 text-white shadow' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              👥 Gestión de Usuarios
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="text-xs text-slate-400 mb-0.5">Sesión Activa:</div>
          <div className="font-bold text-white truncate text-xs">{currentUser.email}</div>
          <div className="text-xs text-blue-400 font-semibold mb-3">{currentUser.role}</div>
          <button 
            onClick={handleLogout}
            className="w-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 text-xs font-semibold py-2 rounded-lg transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-slate-700 hover:text-slate-900 focus:outline-none p-1 rounded-lg border border-slate-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-sm font-bold text-slate-700">
            SGTI | Módulo: <span className="text-blue-600 uppercase">{activeTab}</span>
          </div>
          <div className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold border border-blue-100">
            {currentUser.area}
          </div>
        </header>

        <main className="p-6 flex-1 max-w-5xl w-full mx-auto space-y-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">Bienvenido, {currentUser.email}</h1>
                  <p className="text-sm text-slate-500 mt-1">Panel de control y métricas en tiempo real del departamento de IT.</p>
                </div>
                <button 
                  onClick={() => setActiveTab('crear')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow transition"
                >
                  + Nuevo Ticket Rápido
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500 font-bold uppercase">Tickets Activos</div>
                  <div className="text-3xl font-extrabold text-blue-600 mt-2">{tickets.length}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500 font-bold uppercase">Tickets Críticos (Semáforo)</div>
                  <div className="text-3xl font-extrabold text-red-600 mt-2">
                    {tickets.filter(t => t.prioridad === 'critica' || t.urgencia === 'alta').length}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500 font-bold uppercase">Historial Resueltos</div>
                  <div className="text-3xl font-extrabold text-emerald-600 mt-2">{historial.length}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'crear' && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Crear Nueva Solicitud de IT</h2>
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre del Solicitante</label>
                    <input 
                      type="text" 
                      value={form.nombre_solicitante}
                      onChange={e => setForm({...form, nombre_solicitante: e.target.value})}
                      placeholder="Su nombre completo" 
                      required 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Departamento / Área</label>
                    <input 
                      type="text" 
                      value={form.departamento}
                      onChange={e => setForm({...form, departamento: e.target.value})}
                      placeholder="Ej. Logística, Ventas" 
                      required 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Título del Problema</label>
                  <input 
                    type="text" 
                    value={form.titulo}
                    onChange={e => setForm({...form, titulo: e.target.value})}
                    placeholder="Breve resumen" 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50" 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
                    <select 
                      value={form.categoria}
                      onChange={e => setForm({...form, categoria: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="hardware">Hardware (Infraestructura)</option>
                      <option value="software">Software</option>
                      <option value="redes">Redes</option>
                      <option value="gps">GPS / Rutas (Erick)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Asignar a</label>
                    <select 
                      value={form.asignado_a}
                      onChange={e => setForm({...form, asignado_a: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="infraestructura">Infraestructura General</option>
                      <option value="luis">Luis (Desarrollo)</option>
                      <option value="erick">Erick (GPS / Rutas)</option>
                      <option value="arnold">Arnold (Gerencia IT)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Prioridad y Semáforo</label>
                  <select 
                    value={form.prioridad}
                    onChange={e => setForm({...form, prioridad: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="baja">Baja (Verde)</option>
                    <option value="media">Media (Amarillo)</option>
                    <option value="alta">Alta (Naranja)</option>
                    <option value="critica">Crítica (Rojo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción</label>
                  <textarea 
                    rows="3" 
                    value={form.descripcion}
                    onChange={e => setForm({...form, descripcion: e.target.value})}
                    placeholder="Detalles..." 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 resize-none"
                  ></textarea>
                </div>

                <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Adjuntar Evidencia (Foto o Archivo)</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setForm({...form, evidencia: e.target.files[0]})}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white" 
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm shadow transition"
                >
                  Registrar y Enviar Ticket
                </button>
              </form>
            </div>
          )}

          {activeTab === 'activos' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Tickets Activos en Vivo</h2>
              {tickets.length === 0 ? (
                <p className="text-slate-500 italic bg-white p-6 rounded-xl border text-center text-sm">No hay tickets activos.</p>
              ) : (
                <div className="space-y-4">
                  {tickets.map(t => (
                    <div key={t.id} className="bg-white border rounded-2xl p-5 shadow-sm space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-900">{t.titulo}</h3>
                        <span className="text-xs px-3 py-1 rounded-full font-bold uppercase bg-amber-100 text-amber-800">
                          {t.prioridad}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm">{t.descripcion}</p>
                      <div className="flex gap-2 pt-2 border-t">
                        <input 
                          type="text"
                          placeholder="Notas de resolución..." 
                          value={resolucionTextos[t.id] || ''}
                          onChange={e => setResolucionTextos({...resolucionTextos, [t.id]: e.target.value})} 
                          className="flex-1 px-3 py-2 border rounded-lg text-sm" 
                        />
                        <button 
                          onClick={() => resolverTicket(t.id)} 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm"
                        >
                          Resolver
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'criticos' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Monitor de Tickets Críticos (Semáforo)</h2>
              {tickets.filter(t => t.prioridad === 'critica').length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center text-emerald-800 text-sm">
                  🟢 No hay tickets críticos o vencidos.
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.filter(t => t.prioridad === 'critica').map(t => (
                    <div key={t.id} className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full bg-red-600 animate-ping"></span>
                        <h4 className="font-bold text-red-900">{t.titulo}</h4>
                      </div>
                      <p className="text-xs text-red-700">{t.descripcion}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Historial Resueltos</h2>
              {historial.length === 0 ? (
                <p className="text-slate-500 italic bg-white p-6 rounded-xl border text-center text-sm">Historial vacío.</p>
              ) : (
                <div className="bg-white border rounded-2xl p-4 space-y-3">
                  {historial.map(h => (
                    <div key={h.log_id || h.id} className="text-sm text-slate-600 p-4 bg-slate-50 rounded-xl border flex justify-between items-center">
                      <div>
                        <strong className="text-slate-900">{h.titulo}</strong>
                        <div className="text-xs text-slate-500">Solicitante: {h.nombre_solicitante}</div>
                      </div>
                      <div className="text-xs text-slate-700 bg-white px-3 py-2 rounded-lg border italic">
                        Solución: {h.detalles_resolucion}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'usuarios' && currentUser.area === 'Gerencia' && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Gestión de Usuarios</h2>
              <p className="text-xs text-slate-500">Control de cuentas de acceso del personal de IT y gerencia.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}