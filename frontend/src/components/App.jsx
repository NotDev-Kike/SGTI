import React, { useState, useEffect } from 'react';
import Login from './Login';

const API_BASE_URL = 'https://friendly-capybara-q74gqxwxr46xfx9vg-4000.app.github.dev';

export default function App() {
  // Cargar usuario desde localStorage para evitar que se regrese al login al recargar
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('sgti_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [tickets, setTickets] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [chatMensajes, setChatMensajes] = useState([]);

  // Estados de formularios
  const [formTicket, setFormTicket] = useState({
    tipo_solicitud: 'incidencia',
    titulo: '',
    descripcion: '',
    categoria: 'hardware',
    departamento_destino_id: 1,
    prioridad: 'media'
  });

  const [resolucionTextos, setResolucionTextos] = useState({});
  const [nuevoChat, setNuevoChat] = useState({ para: 'infra@sgti.com', texto: '' });
  const [configuracionSistema, setConfiguracionSistema] = useState({ modoMantenimiento: false, notalesEmail: true });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sgti_user', JSON.stringify(currentUser));
      cargarDatosGlobales();
    } else {
      localStorage.removeItem('sgti_user');
    }
  }, [currentUser]);

  const cargarDatosGlobales = () => {
    // Simulación de carga desde backend o estados locales seguros
    fetch(`${API_BASE_URL}/api/tickets/listar`)
      .then(res => res.json())
      .then(data => { if (data.success) setTickets(data.data); })
      .catch(() => {});
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sgti_user');
  };

  // Crear Ticket (Usuarios Básicos)
  const handleCrearTicket = (e) => {
    e.preventDefault();
    const nuevo = {
      id: Date.now(),
      ...formTicket,
      nombre_solicitante: currentUser.email,
      estado: 'nuevo',
      fecha_limite: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 días límite
      created_at: new Date().toISOString()
    };
    setTickets([nuevo, ...tickets]);
    alert(`Ticket clasificado como [${formTicket.tipo_solicitud.toUpperCase()}] creado con éxito.`);
    setFormTicket({ tipo_solicitud: 'incidencia', titulo: '', descripcion: '', categoria: 'hardware', departamento_destino_id: 1, prioridad: 'media' });
    setActiveTab('mis_tickets');
  };

  // Resolver Ticket (Admin)
  const resolverTicketAdmin = (id) => {
    const texto = resolucionTextos[id] || 'Resuelto por personal autorizado';
    const ticketAResolver = tickets.find(t => t.id === id);
    if (ticketAResolver) {
      setTickets(tickets.filter(t => t.id !== id));
      setHistorial([{ ...ticketAResolver, estado: 'resuelto', detalles_resolucion: texto }, ...historial]);
      alert('Ticket resuelto y movido al historial de auditoría (desaparece de Todos para evitar saturación).');
    }
  };

  if (!currentUser) {
    return <Login onLogin={handleLoginSuccess} apiBaseUrl={API_BASE_URL} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-800">
      
      {/* BARRA LATERAL DINÁMICA */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col shadow-xl`}>
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wider">SGTI</h2>
            <p className="text-xs text-blue-400 font-semibold">{currentUser.area}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">✕</button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto text-sm">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            📊 Dashboard General
          </button>

          {currentUser.isAdmin ? (
            <>
              <button 
                onClick={() => { setActiveTab('todos_tickets'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'todos_tickets' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                📋 Tickets de Todos ({tickets.length})
              </button>
              <button 
                onClick={() => { setActiveTab('historial'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'historial' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                📁 Historial de Tickets
              </button>
              <button 
                onClick={() => { setActiveTab('usuarios'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'usuarios' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                👥 Gestión de Usuarios
              </button>
              <button 
                onClick={() => { setActiveTab('calendario'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'calendario' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                📅 Calendario Interactivo
              </button>
              <button 
                onClick={() => { setActiveTab('tareas'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'tareas' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                📝 Tareas Pendientes
              </button>
              <button 
                onClick={() => { setActiveTab('proyectos'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'proyectos' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                🏗️ Proyectos de TI
              </button>
              <button 
                onClick={() => { setActiveTab('configuracion'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'configuracion' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                ⚙️ Configuraciones
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => { setActiveTab('crear_ticket'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'crear_ticket' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                ➕ Crear Ticket
              </button>
              <button 
                onClick={() => { setActiveTab('mis_tickets'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'mis_tickets' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                📂 Mis Tickets
              </button>
              <button 
                onClick={() => { setActiveTab('encuesta'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'encuesta' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                ⭐ Encuesta de Satisfacción
              </button>
            </>
          )}

          <button 
            onClick={() => { setActiveTab('chat'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'chat' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            💬 Chat Inmediato IT
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="text-xs text-slate-400">Usuario Conectado:</div>
          <div className="font-bold text-white truncate text-xs mb-2">{currentUser.email}</div>
          <button 
            onClick={handleLogout}
            className="w-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 text-xs font-semibold py-2 rounded-lg transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-slate-700 font-bold">☰ Menú</button>
          <div className="text-sm font-bold text-slate-700">Módulo Actual: <span className="text-blue-600 uppercase">{activeTab}</span></div>
          <div className="text-xs bg-slate-100 px-3 py-1 rounded-full font-semibold border">{currentUser.area}</div>
        </header>

        <main className="p-6 flex-1 max-w-5xl w-full mx-auto space-y-6">
          
          {/* DASHBOARD GENERAL */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h1 className="text-2xl font-extrabold text-slate-900">Bienvenido al Panel SGTI, {currentUser.email}</h1>
                <p className="text-sm text-slate-500 mt-1">Gestión centralizada para áreas de Gerencia, Infraestructura, GPS y Desarrollo.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border shadow-sm">
                  <div className="text-xs text-slate-500 font-bold uppercase">Tickets Activos</div>
                  <div className="text-3xl font-extrabold text-blue-600 mt-2">{tickets.length}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border shadow-sm">
                  <div className="text-xs text-slate-500 font-bold uppercase">Estado Crítico / Semáforo</div>
                  <div className="text-3xl font-extrabold text-red-600 mt-2">
                    {tickets.filter(t => t.prioridad === 'critica').length}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border shadow-sm">
                  <div className="text-xs text-slate-500 font-bold uppercase">Historial Resueltos</div>
                  <div className="text-3xl font-extrabold text-emerald-600 mt-2">{historial.length}</div>
                </div>
              </div>
            </div>
          )}

          {/* CREAR TICKET (USUARIO BÁSICO) */}
          {activeTab === 'crear_ticket' && !currentUser.isAdmin && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-xl mx-auto">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Clasificación y Creación de Solicitud</h2>
              <form onSubmit={handleCrearTicket} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Solicitud</label>
                  <select 
                    value={formTicket.tipo_solicitud}
                    onChange={e => setFormTicket({...formTicket, tipo_solicitud: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white font-bold text-blue-600"
                  >
                    <option value="incidencia">Incidencia</option>
                    <option value="problema">Problema</option>
                    <option value="peticion_servicio">Petición de Servicio</option>
                    <option value="peticion_cambio">Petición de Cambio</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
                    <select 
                      value={formTicket.categoria}
                      onChange={e => setFormTicket({...formTicket, categoria: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    >
                      <option value="hardware">Hardware</option>
                      <option value="software">Software</option>
                      <option value="redes">Redes</option>
                      <option value="gps">GPS / Rutas</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Área Destino</label>
                    <select 
                      value={formTicket.departamento_destino_id}
                      onChange={e => setFormTicket({...formTicket, departamento_destino_id: Number(e.target.value)})}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    >
                      <option value={1}>Infraestructura</option>
                      <option value={2}>Desarrollo</option>
                      <option value={3}>GPS / Rutas</option>
                      <option value={4}>Gerencia IT</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Título</label>
                  <input 
                    type="text" 
                    value={formTicket.titulo}
                    onChange={e => setFormTicket({...formTicket, titulo: e.target.value})}
                    required 
                    className="w-full px-3 py-2 border rounded-lg text-sm" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción detallada</label>
                  <textarea 
                    rows="3" 
                    value={formTicket.descripcion}
                    onChange={e => setFormTicket({...formTicket, descripcion: e.target.value})}
                    required 
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  ></textarea>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg text-sm shadow">
                  Enviar Ticket Oficial
                </button>
              </form>
            </div>
          )}

          {/* MIS TICKETS (USUARIO BÁSICO) */}
          {activeTab === 'mis_tickets' && !currentUser.isAdmin && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Mis Tickets Creados</h2>
              {tickets.filter(t => t.nombre_solicitante === currentUser.email).length === 0 ? (
                <p className="text-slate-500 italic bg-white p-6 rounded-xl border text-center">No has registrado tickets.</p>
              ) : (
                tickets.filter(t => t.nombre_solicitante === currentUser.email).map(t => (
                  <div key={t.id} className="bg-white border rounded-xl p-4 shadow-sm flex justify-between items-center">
                    <div>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold uppercase">{t.tipo_solicitud}</span>
                      <h3 className="font-bold text-slate-900 mt-1">{t.titulo}</h3>
                      <p className="text-xs text-slate-500">{t.descripcion}</p>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">Activo</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TICKETS DE TODOS CON SEMÁFORO (ADMIN) */}
          {activeTab === 'todos_tickets' && currentUser.isAdmin && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Tickets de Todos (Semáforo de Criticidad y Fecha)</h2>
              {tickets.length === 0 ? (
                <p className="text-slate-500 italic bg-white p-6 rounded-xl border text-center">No hay tickets activos pendientes.</p>
              ) : (
                tickets.map(t => {
                  const esCritico = t.prioridad === 'critica' || new Date(t.fecha_limite) < new Date();
                  return (
                    <div key={t.id} className={`border rounded-2xl p-5 shadow-sm space-y-3 ${esCritico ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-xs uppercase font-extrabold px-2 py-1 rounded bg-slate-200 text-slate-700 mr-2">{t.tipo_solicitud}</span>
                          <h3 className="font-bold text-slate-900 inline">{t.titulo}</h3>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${esCritico ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-100 text-amber-800'}`}>
                          {esCritico ? '🔴 CRÍTICO / VENCIDO' : '🟡 En Plazo'}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm">{t.descripcion}</p>
                      <div className="text-xs text-slate-500">Solicitante: <strong>{t.nombre_solicitante}</strong> | Fecha Límite: {new Date(t.fecha_limite).toLocaleDateString()}</div>
                      
                      <div className="flex gap-2 pt-2 border-t">
                        <input 
                          type="text"
                          placeholder="Nota de resolución del admin..." 
                          value={resolucionTextos[t.id] || ''}
                          onChange={e => setResolucionTextos({...resolucionTextos, [t.id]: e.target.value})} 
                          className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white" 
                        />
                        <button 
                          onClick={() => resolverTicketAdmin(t.id)} 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm"
                        >
                          Resolver y Archivar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* HISTORIAL DE TICKETS (AUDITORÍA) */}
          {activeTab === 'historial' && currentUser.isAdmin && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Historial de Tickets Resueltos</h2>
              <p className="text-xs text-slate-500">Los tickets resueltos se almacenan aquí para auditoría y evitar saturar el panel general de activos.</p>
              {historial.length === 0 ? (
                <p className="text-slate-500 italic bg-white p-6 rounded-xl border text-center">El historial está vacío.</p>
              ) : (
                historial.map(h => (
                  <div key={h.id} className="bg-white border rounded-xl p-4 shadow-sm flex justify-between items-center text-sm">
                    <div>
                      <strong className="text-slate-900">{h.titulo}</strong>
                      <div className="text-xs text-slate-500">Creador: {h.nombre_solicitante}</div>
                    </div>
                    <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-lg">
                      Solución: {h.detalles_resolucion}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* GESTIÓN DE USUARIOS (RECTIFICACIÓN ADMIN) */}
          {activeTab === 'usuarios' && currentUser.isAdmin && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Gestión y Rectificación de Usuarios</h2>
              <p className="text-xs text-slate-500">Cree, modifique o elimine cuentas de usuario en caso de errores de registro.</p>
              <div className="p-4 bg-slate-50 border rounded-xl space-y-3">
                <h3 className="font-bold text-sm text-slate-700">Usuarios Registrados en el Sistema:</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-white p-3 rounded border text-xs">
                    <span>Arnold (Gerente IT) - arnold@sgti.com</span>
                    <span className="text-blue-600 font-bold">Gerencia</span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-3 rounded border text-xs">
                    <span>Encargado Infraestructura - infra@sgti.com</span>
                    <span className="text-blue-600 font-bold">Infraestructura</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CALENDARIO INTERACTIVO */}
          {activeTab === 'calendario' && currentUser.isAdmin && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Calendario Interactivo de Plazos IT</h2>
              <div className="p-8 bg-slate-50 border rounded-xl text-center text-sm text-slate-600">
                📅 Vista de calendario sincronizada con las fechas límite de tickets y tareas pendientes. (Activo para control de tiempos).
              </div>
            </div>
          )}

          {/* TAREAS PENDIENTES */}
          {activeTab === 'tareas' && currentUser.isAdmin && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Organización de Tareas Internas</h2>
              <p className="text-xs text-slate-500">Cree notas o actividades específicas para el personal administrativo.</p>
              <button onClick={() => alert('Nueva tarea interna agregada.')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-semibold">
                + Agregar Tarea Admin
              </button>
            </div>
          )}

          {/* PROYECTOS DE TI */}
          {activeTab === 'proyectos' && currentUser.isAdmin && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Proyectos de TI a Gran Escala</h2>
              <p className="text-xs text-slate-500">Las solicitudes complejas que exceden el soporte convencional se gestionan aquí de forma informativa sin consumir tiempo de tickets regulares.</p>
              <div className="p-4 border rounded-xl bg-blue-50/50 text-xs text-blue-900 font-medium">
                🏗️ Ningún proyecto activo en este momento. Puede registrar nuevos proyectos desde el panel de gerencia.
              </div>
            </div>
          )}

          {/* CONFIGURACIONES */}
          {activeTab === 'configuracion' && currentUser.isAdmin && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4 max-w-xl">
              <h2 className="text-xl font-bold text-slate-900">Configuraciones del Sistema SGTI</h2>
              <div className="space-y-3 text-sm">
                <label className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={configuracionSistema.modoMantenimiento}
                    onChange={e => setConfiguracionSistema({...configuracionSistema, modoMantenimiento: e.target.checked})}
                  />
                  <span>Activar Modo Mantenimiento Global</span>
                </label>
                <label className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={configuracionSistema.notalesEmail}
                    onChange={e => setConfiguracionSistema({...configuracionSistema, notalesEmail: e.target.checked})}
                  />
                  <span>Habilitar Alertas Automáticas por Correo</span>
                </label>
              </div>
            </div>
          )}

          {/* CHAT INMEDIATO */}
          {activeTab === 'chat' && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Comunicación Inmediata con IT</h2>
              <div className="flex gap-2 mb-2">
                <select 
                  value={nuevoChat.para}
                  onChange={e => setNuevoChat({...nuevoChat, para: e.target.value})}
                  className="px-3 py-2 border rounded-lg text-xs bg-white font-bold"
                >
                  <option value="infra@sgti.com">Infraestructura</option>
                  <option value="arnold@sgti.com">Gerencia IT</option>
                  <option value="erick@sgti.com">GPS / Rutas</option>
                  <option value="luis@sgti.com">Desarrollo</option>
                </select>
              </div>
              <div className="h-48 border rounded-xl p-4 bg-slate-50 overflow-y-auto space-y-2 text-sm">
                {chatMensajes.map((m, idx) => (
                  <div key={idx} className="p-3 bg-white border rounded-lg shadow-sm">
                    <div className="text-xs text-blue-600 font-bold">Para: {m.para}</div>
                    <p className="text-slate-700 text-xs mt-1">{m.texto}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Escriba su mensaje inmediato a soporte..."
                  value={nuevoChat.texto}
                  onChange={e => setNuevoChat({...nuevoChat, texto: e.target.value})}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <button 
                  onClick={() => {
                    if(!nuevoChat.texto) return;
                    setChatMensajes([...chatMensajes, nuevoChat]);
                    setNuevoChat({...nuevoChat, texto: ''});
                    alert('Mensaje enviado al administrador seleccionado. Quedará pendiente de respuesta en su bandeja.');
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* ENCUESTA DE SATISFACCIÓN */}
          {activeTab === 'encuesta' && !currentUser.isAdmin && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4 text-center max-w-md mx-auto">
              <h2 className="text-xl font-bold text-slate-900">Encuesta de Satisfacción IT</h2>
              <p className="text-xs text-slate-500">Califique la atención recibida en su último ticket resuelto.</p>
              <div className="flex justify-center gap-2 text-3xl py-2 cursor-pointer">⭐ ⭐ ⭐ ⭐ ⭐</div>
              <textarea placeholder="Comentarios adicionales..." className="w-full p-2 border rounded-lg text-xs"></textarea>
              <button onClick={() => alert('¡Gracias por enviar su calificación!')} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">
                Enviar Calificación
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}