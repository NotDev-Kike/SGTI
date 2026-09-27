import React, { useState, useEffect } from 'react';
import Login from './Login';
import { apiFetch } from '../api';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

export default function App() {
  // Cargar usuario desde localStorage para evitar que se regrese al login al recargar
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('sgti_user');
    const user = saved ? JSON.parse(saved) : null;
    return user?.token ? user : null;
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [tickets, setTickets] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [ticketsResueltos, setTicketsResueltos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [chatMensajes, setChatMensajes] = useState([]);
  const [conversaciones, setConversaciones] = useState([]);
  const [adminsChat, setAdminsChat] = useState([]);
  const [chatDestinatario, setChatDestinatario] = useState('');
  const [chatError, setChatError] = useState('');
  const [ticketEnEdicion, setTicketEnEdicion] = useState(null);
  const [mesCalendario, setMesCalendario] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

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
  const [nuevoChat, setNuevoChat] = useState('');
  const [formUsuario, setFormUsuario] = useState({ id: null, nombre: '', email: '', password: '', departamento_id: 1, activo: true });
  const [formTarea, setFormTarea] = useState({ id: null, titulo: '', descripcion: '', fecha_limite: '', estado: 'pendiente' });
  const [formProyecto, setFormProyecto] = useState({ id: null, titulo: '', descripcion: '', estado: 'planificacion' });
  const [formEncuesta, setFormEncuesta] = useState({ ticket_id: '', calificacion: 5, comentario: '' });
  const [configuracionSistema, setConfiguracionSistema] = useState({ modo_mantenimiento: false, alertas_email: true });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sgti_user', JSON.stringify(currentUser));
      cargarDatosGlobales();
      if (currentUser.isAdmin) cargarDatosAdministrativos();
    } else {
      localStorage.removeItem('sgti_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || activeTab !== 'chat') return undefined;

    const cargarConversacion = () => {
      if (currentUser.isAdmin) {
        const inbox = apiFetch(API_BASE_URL, '/api/chat/directo').then(res => res.json()).then(data => {
          if (!data.success) throw new Error(data.message);
          setConversaciones(data.data);
          setChatError('');
        }).catch(error => setChatError(error.message || 'Chat no disponible.'));
        if (chatDestinatario) {
          apiFetch(API_BASE_URL, `/api/chat/directo?usuario_id=${encodeURIComponent(chatDestinatario)}`).then(res => res.json()).then(data => {
            if (data.success) setChatMensajes(data.data);
          }).catch(() => {});
        } else {
          setChatMensajes([]);
        }
        return inbox;
      }

      apiFetch(API_BASE_URL, '/api/chat/directo/admins').then(res => res.json()).then(data => {
        if (!data.success) throw new Error(data.message);
        setAdminsChat(data.data);
        setChatError('');
        if (!chatDestinatario && data.data.length) setChatDestinatario(String(data.data[0].id));
      }).catch(error => setChatError(error.message || 'Chat no disponible.'));
      if (chatDestinatario) {
        return apiFetch(API_BASE_URL, `/api/chat/directo?admin_id=${encodeURIComponent(chatDestinatario)}`).then(res => res.json()).then(data => {
          if (data.success) setChatMensajes(data.data);
        }).catch(() => {});
      }
      return undefined;
    };

    cargarConversacion();
    const refresh = window.setInterval(cargarConversacion, 5000);
    return () => window.clearInterval(refresh);
  }, [activeTab, currentUser, chatDestinatario]);

  const cargarDatosGlobales = () => {
    apiFetch(API_BASE_URL, currentUser?.isAdmin ? '/api/admin/tickets/todos' : '/api/tickets')
      .then(res => res.json())
      .then(data => { if (data.success) setTickets(data.data); })
      .catch(() => {});

    if (currentUser?.isAdmin) {
      apiFetch(API_BASE_URL, '/api/tickets/historial')
        .then(res => res.json())
        .then(data => { if (data.success) setHistorial(data.data); })
        .catch(() => {});
    } else if (currentUser) {
      apiFetch(API_BASE_URL, '/api/tickets/resueltos')
        .then(res => res.json())
        .then(data => { if (data.success) setTicketsResueltos(data.data); })
        .catch(() => {});
    }
  };

  const cargarDatosAdministrativos = () => {
    const endpoints = [
      ['/api/admin/usuarios', setUsuarios],
      ['/api/admin/tareas', setTareas],
      ['/api/admin/proyectos-ti', setProyectos],
      ['/api/admin/calendario', setCalendario]
    ];
    endpoints.forEach(([path, setter]) => {
      apiFetch(API_BASE_URL, path).then(res => res.json()).then(data => {
        if (data.success) setter(data.data);
      }).catch(() => {});
    });
    apiFetch(API_BASE_URL, '/api/admin/configuraciones').then(res => res.json()).then(data => {
      if (data.success) {
        const stored = Object.fromEntries(data.data.map(item => [item.clave, item.valor === 'true']));
        setConfiguracionSistema({ modo_mantenimiento: false, alertas_email: true, ...stored });
      }
    }).catch(() => {});
  };

  const enviarConfiguracion = () => {
    apiFetch(API_BASE_URL, '/api/admin/configuraciones', {
      method: 'PUT',
      body: JSON.stringify(configuracionSistema)
    }).then(res => res.json()).then(data => {
      if (!data.success) throw new Error(data.message || 'No se guardó la configuración.');
      alert('Configuración guardada.');
    }).catch(error => alert(error.message));
  };

  const moverTicketAdmin = (ticket, nuevo_estado, nuevo_departamento_id) => {
    apiFetch(API_BASE_URL, `/api/admin/tickets/${ticket.id}/modificar`, {
      method: 'PUT',
      body: JSON.stringify({
        nuevo_estado,
        nuevo_departamento_id,
        accion_historial: `Actualizó estado a ${nuevo_estado} y área a ${nuevo_departamento_id}`
      })
    }).then(res => res.json()).then(data => {
      if (!data.success) throw new Error(data.message || 'No se pudo actualizar el ticket.');
      cargarDatosGlobales();
    }).catch(error => alert(error.message));
  };

  const editarTicketAdmin = () => {
    apiFetch(API_BASE_URL, `/api/admin/tickets/${ticketEnEdicion.id}/modificar`, {
      method: 'PUT',
      body: JSON.stringify({
        ...ticketEnEdicion,
        accion_historial: 'Actualizó los detalles del ticket'
      })
    }).then(res => res.json()).then(data => {
      if (!data.success) throw new Error(data.message || 'No se pudo editar el ticket.');
      setTicketEnEdicion(null);
      cargarDatosGlobales();
    }).catch(error => alert(error.message));
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
    apiFetch(API_BASE_URL, '/api/tickets', {
      method: 'POST',
      body: JSON.stringify({
        ...formTicket,
        fecha_limite: new Date(Date.now() + 86400000 * 2).toISOString()
      })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.message || 'No se pudo crear el ticket.');
        cargarDatosGlobales();
        alert(`Ticket clasificado como [${formTicket.tipo_solicitud.toUpperCase()}] creado con éxito.`);
        setFormTicket({ tipo_solicitud: 'incidencia', titulo: '', descripcion: '', categoria: 'hardware', departamento_destino_id: 1, prioridad: 'media' });
        setActiveTab(currentUser.isAdmin ? 'todos_tickets' : 'mis_tickets');
      })
      .catch(error => alert(error.message));
  };

  // Resolver Ticket (Admin)
  const resolverTicketAdmin = (id) => {
    const texto = resolucionTextos[id] || 'Resuelto por personal autorizado';
    apiFetch(API_BASE_URL, `/api/tickets/${id}/resolver`, {
      method: 'PUT',
      body: JSON.stringify({ detalles_resolucion: texto })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.message || 'No se pudo resolver el ticket.');
        cargarDatosGlobales();
        alert('Ticket resuelto y archivado en el historial.');
      })
      .catch(error => alert(error.message));
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
                onClick={() => { setActiveTab('crear_ticket'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'crear_ticket' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                ➕ Crear Ticket
              </button>
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
          {activeTab === 'crear_ticket' && (
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
                    <option value="chat">Comunicación por chat</option>
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
              {tickets.filter(t => t.creador_email === currentUser.email || t.nombre_solicitante === currentUser.email).length === 0 ? (
                <p className="text-slate-500 italic bg-white p-6 rounded-xl border text-center">No has registrado tickets.</p>
              ) : (
                tickets.filter(t => t.creador_email === currentUser.email || t.nombre_solicitante === currentUser.email).map(t => (
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
                  const editando = ticketEnEdicion?.id === t.id;
                  return (
                    <div key={t.id} className={`border rounded-2xl p-5 shadow-sm space-y-3 ${esCritico ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-xs uppercase font-extrabold px-2 py-1 rounded bg-slate-200 text-slate-700 mr-2">{t.tipo_solicitud}</span>
                          {editando ? <input aria-label="Título del ticket" value={ticketEnEdicion.titulo} onChange={e => setTicketEnEdicion({ ...ticketEnEdicion, titulo: e.target.value })} className="mt-1 w-full px-2 py-1 border rounded text-sm" /> : <h3 className="font-bold text-slate-900 inline">{t.titulo}</h3>}
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${esCritico ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-100 text-amber-800'}`}>
                          {esCritico ? '🔴 CRÍTICO / VENCIDO' : '🟡 En Plazo'}
                        </span>
                      </div>
                      {editando ? <textarea aria-label="Descripción del ticket" value={ticketEnEdicion.descripcion} onChange={e => setTicketEnEdicion({ ...ticketEnEdicion, descripcion: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" /> : <p className="text-slate-600 text-sm">{t.descripcion}</p>}
                      <div className="text-xs text-slate-500">Solicitante: <strong>{t.creador_nombre || t.nombre_solicitante}</strong> | Creado: {new Date(t.created_at).toLocaleDateString()} | Fecha Límite: {t.fecha_limite ? new Date(t.fecha_limite).toLocaleDateString() : 'Sin fecha'}</div>
                      
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        <select aria-label="Estado del ticket" value={t.estado} onChange={e => moverTicketAdmin(t, e.target.value, t.departamento_destino_id)} className="px-3 py-2 border rounded-lg text-sm bg-white">
                          <option value="nuevo">Nuevo</option><option value="en_proceso">En proceso</option><option value="pendiente">Pendiente</option>
                        </select>
                        <select aria-label="Área asignada" value={t.departamento_destino_id} onChange={e => moverTicketAdmin(t, t.estado, Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm bg-white">
                          <option value="1">Infraestructura</option><option value="2">Desarrollo</option><option value="3">GPS</option><option value="4">Gerencia</option>
                        </select>
                        {editando ? <>
                          <select aria-label="Prioridad" value={ticketEnEdicion.prioridad} onChange={e => setTicketEnEdicion({ ...ticketEnEdicion, prioridad: e.target.value })} className="px-3 py-2 border rounded-lg text-sm bg-white"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Crítica</option></select>
                          <button onClick={editarTicketAdmin} className="bg-blue-700 text-white px-3 py-2 rounded-lg text-sm">Guardar edición</button>
                          <button onClick={() => setTicketEnEdicion(null)} className="border px-3 py-2 rounded-lg text-sm">Cancelar</button>
                        </> : <button onClick={() => setTicketEnEdicion({ id: t.id, titulo: t.titulo, descripcion: t.descripcion, prioridad: t.prioridad || 'media' })} className="border px-3 py-2 rounded-lg text-sm">Editar ticket</button>}
                      </div>
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
                      <div className="text-xs text-slate-500">Creador: {h.creador_nombre || h.nombre_solicitante}</div>
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
              <form onSubmit={event => {
                event.preventDefault();
                apiFetch(API_BASE_URL, '/api/admin/usuarios', { method: 'POST', body: JSON.stringify(formUsuario) })
                  .then(res => res.json()).then(data => {
                    if (!data.success) throw new Error(data.message || 'No se pudo guardar el usuario.');
                    setFormUsuario({ id: null, nombre: '', email: '', password: '', departamento_id: 1, activo: true });
                    cargarDatosAdministrativos();
                  }).catch(error => alert(error.message));
              }} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b pb-5">
                <input aria-label="Nombre" placeholder="Nombre completo" required value={formUsuario.nombre} onChange={e => setFormUsuario({ ...formUsuario, nombre: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <input aria-label="Correo" type="email" placeholder="Correo" required value={formUsuario.email} onChange={e => setFormUsuario({ ...formUsuario, email: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                {!formUsuario.id && <input aria-label="Contraseña" type="password" minLength="8" placeholder="Contraseña inicial (8 caracteres mínimo)" required value={formUsuario.password} onChange={e => setFormUsuario({ ...formUsuario, password: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />}
                <select aria-label="Área" value={formUsuario.departamento_id || ''} onChange={e => setFormUsuario({ ...formUsuario, departamento_id: Number(e.target.value) || null })} className="px-3 py-2 border rounded-lg text-sm bg-white">
                  <option value="">Sin área</option><option value="1">Infraestructura</option><option value="2">Desarrollo</option><option value="3">GPS</option><option value="4">Gerencia</option>
                </select>
                {formUsuario.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formUsuario.activo} onChange={e => setFormUsuario({ ...formUsuario, activo: e.target.checked })} /> Cuenta activa</label>}
                <div className="flex gap-2">
                  <button className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">{formUsuario.id ? 'Guardar cambios' : 'Crear usuario'}</button>
                  {formUsuario.id && <button type="button" onClick={() => setFormUsuario({ id: null, nombre: '', email: '', password: '', departamento_id: 1, activo: true })} className="border px-4 py-2 rounded-lg text-sm">Cancelar</button>}
                </div>
              </form>
              <div className="divide-y">
                {usuarios.map(usuario => <div key={usuario.id} className="py-3 flex flex-wrap gap-3 items-center justify-between text-sm">
                  <div><strong>{usuario.nombre}</strong><div className="text-xs text-slate-500">{usuario.email} · {usuario.departamento_nombre || 'Sin área'} · {usuario.rol}{usuario.activo ? '' : ' · Inactivo'}</div></div>
                  <div className="flex gap-2">
                    <button onClick={() => setFormUsuario({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, password: '', departamento_id: usuario.departamento_id, activo: usuario.activo })} className="border px-3 py-1.5 rounded text-xs">Editar</button>
                    <button onClick={() => {
                      if (!window.confirm(`¿Eliminar a ${usuario.nombre}?`)) return;
                      apiFetch(API_BASE_URL, `/api/admin/usuarios/${usuario.id}`, { method: 'DELETE' }).then(res => res.json()).then(data => {
                        if (!data.success) throw new Error(data.message || 'No se pudo eliminar el usuario.');
                        cargarDatosAdministrativos();
                      }).catch(error => alert(error.message));
                    }} className="border border-red-200 text-red-700 px-3 py-1.5 rounded text-xs">Eliminar</button>
                  </div>
                </div>)}
              </div>
            </div>
          )}

          {/* CALENDARIO INTERACTIVO */}
          {activeTab === 'calendario' && currentUser.isAdmin && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Calendario IT</h2>
                <div className="flex items-center gap-3">
                  <button aria-label="Mes anterior" onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1, 1))} className="border rounded px-3 py-1">‹</button>
                  <strong className="min-w-36 text-center">{mesCalendario.toLocaleDateString('es', { month: 'long', year: 'numeric' })}</strong>
                  <button aria-label="Mes siguiente" onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1))} className="border rounded px-3 py-1">›</button>
                </div>
              </div>
              <div className="grid grid-cols-7 border-l border-t text-xs">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => <div key={day} className="border-r border-b p-2 text-center font-bold text-slate-500">{day}</div>)}
                {(() => {
                  const firstWeekday = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), 1).getDay();
                  const daysInMonth = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 0).getDate();
                  const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
                  return Array.from({ length: cells }, (_, index) => {
                    const day = index - firstWeekday + 1;
                    const inMonth = day > 0 && day <= daysInMonth;
                    const events = inMonth ? calendario.filter(evento => {
                      const date = new Date(evento.fecha);
                      return date.getFullYear() === mesCalendario.getFullYear() && date.getMonth() === mesCalendario.getMonth() && date.getDate() === day;
                    }) : [];
                    return <div key={index} className={`min-h-20 border-r border-b p-1.5 ${inMonth ? 'bg-white' : 'bg-slate-50 text-slate-300'}`}>
                      {inMonth && <><div className="font-semibold">{day}</div><div className="mt-1 space-y-1">{events.slice(0, 2).map(evento => <div key={`${evento.tipo}-${evento.id}`} title={`${evento.tipo}: ${evento.titulo}`} className={`truncate rounded px-1 py-0.5 ${evento.tipo === 'ticket' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>{evento.titulo}</div>)}{events.length > 2 && <div className="text-slate-500">+{events.length - 2} más</div>}</div></>}
                    </div>;
                  });
                })()}
              </div>
            </div>
          )}

          {/* TAREAS PENDIENTES */}
          {activeTab === 'tareas' && currentUser.isAdmin && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Organización de Tareas Internas</h2>
              <form onSubmit={event => {
                event.preventDefault();
                apiFetch(API_BASE_URL, '/api/admin/tareas', { method: 'POST', body: JSON.stringify(formTarea) }).then(res => res.json()).then(data => {
                  if (!data.success) throw new Error(data.message || 'No se pudo guardar la tarea.');
                  setFormTarea({ id: null, titulo: '', descripcion: '', fecha_limite: '', estado: 'pendiente' });
                  cargarDatosAdministrativos();
                }).catch(error => alert(error.message));
              }} className="grid sm:grid-cols-2 gap-3 border-b pb-5">
                <input placeholder="Título de tarea" required value={formTarea.titulo} onChange={e => setFormTarea({ ...formTarea, titulo: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <input type="datetime-local" required value={formTarea.fecha_limite} onChange={e => setFormTarea({ ...formTarea, fecha_limite: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <input placeholder="Descripción" value={formTarea.descripcion} onChange={e => setFormTarea({ ...formTarea, descripcion: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <button className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">{formTarea.id ? 'Guardar cambios' : 'Agregar tarea'}</button>
              </form>
              <div className="divide-y">{tareas.map(tarea => <div key={tarea.id} className="py-3 flex justify-between gap-3 text-sm">
                <div><strong>{tarea.titulo}</strong><div className="text-xs text-slate-500">{tarea.descripcion} · {tarea.asignado_nombre} · {new Date(tarea.fecha_limite).toLocaleString()}</div></div>
                <div className="flex gap-3"><button onClick={() => setFormTarea({ id: tarea.id, titulo: tarea.titulo, descripcion: tarea.descripcion || '', fecha_limite: new Date(tarea.fecha_limite).toISOString().slice(0, 16), estado: tarea.estado })} className="text-blue-700 text-xs">Editar</button><button onClick={() => apiFetch(API_BASE_URL, `/api/admin/tareas/${tarea.id}`, { method: 'DELETE' }).then(res => res.json()).then(() => cargarDatosAdministrativos())} className="text-red-700 text-xs">Eliminar</button></div>
              </div>)}</div>
            </div>
          )}

          {/* PROYECTOS DE TI */}
          {activeTab === 'proyectos' && currentUser.isAdmin && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Proyectos de TI a Gran Escala</h2>
              <p className="text-xs text-slate-500">Las solicitudes complejas que exceden el soporte convencional se gestionan aquí de forma informativa sin consumir tiempo de tickets regulares.</p>
              <form onSubmit={event => {
                event.preventDefault();
                apiFetch(API_BASE_URL, '/api/admin/proyectos-ti', { method: 'POST', body: JSON.stringify(formProyecto) }).then(res => res.json()).then(data => {
                  if (!data.success) throw new Error(data.message || 'No se pudo guardar el proyecto.');
                  setFormProyecto({ id: null, titulo: '', descripcion: '', estado: 'planificacion' });
                  cargarDatosAdministrativos();
                }).catch(error => alert(error.message));
              }} className="grid sm:grid-cols-2 gap-3 border-b pb-5">
                <input placeholder="Nombre del proyecto" required value={formProyecto.titulo} onChange={e => setFormProyecto({ ...formProyecto, titulo: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <select value={formProyecto.estado} onChange={e => setFormProyecto({ ...formProyecto, estado: e.target.value })} className="px-3 py-2 border rounded-lg bg-white text-sm"><option value="planificacion">Planificación</option><option value="en_curso">En curso</option><option value="pausado">Pausado</option><option value="completado">Completado</option></select>
                <textarea placeholder="Alcance y notas" value={formProyecto.descripcion} onChange={e => setFormProyecto({ ...formProyecto, descripcion: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <button className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">{formProyecto.id ? 'Guardar proyecto' : 'Registrar proyecto'}</button>
              </form>
              <div className="divide-y">{proyectos.map(proyecto => <div key={proyecto.id} className="py-3"><div className="flex justify-between"><strong>{proyecto.titulo}</strong><span className="text-xs uppercase text-blue-700">{proyecto.estado}</span></div><p className="text-sm text-slate-600">{proyecto.descripcion}</p><p className="text-xs text-slate-500">Responsable: {proyecto.creador_nombre}</p><div className="mt-2 flex gap-3"><button onClick={() => setFormProyecto({ id: proyecto.id, titulo: proyecto.titulo, descripcion: proyecto.descripcion || '', estado: proyecto.estado })} className="text-blue-700 text-xs">Editar</button><button onClick={() => apiFetch(API_BASE_URL, `/api/admin/proyectos-ti/${proyecto.id}`, { method: 'DELETE' }).then(res => res.json()).then(() => cargarDatosAdministrativos())} className="text-red-700 text-xs">Eliminar</button></div></div>)}</div>
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
                    checked={Boolean(configuracionSistema.modo_mantenimiento)}
                    onChange={e => setConfiguracionSistema({...configuracionSistema, modo_mantenimiento: e.target.checked})}
                  />
                  <span>Activar Modo Mantenimiento Global</span>
                </label>
                <label className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={Boolean(configuracionSistema.alertas_email)}
                    onChange={e => setConfiguracionSistema({...configuracionSistema, alertas_email: e.target.checked})}
                  />
                  <span>Habilitar alertas por correo (requiere SMTP configurado)</span>
                </label>
              </div>
              <button onClick={enviarConfiguracion} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">Guardar configuración</button>
            </div>
          )}

          {/* CHAT INMEDIATO */}
          {activeTab === 'chat' && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Comunicación Inmediata con IT</h2>
              {chatError && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">{chatError}</p>}
              <div className="flex gap-2 mb-2">
                <select 
                  value={chatDestinatario}
                  onChange={e => setChatDestinatario(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-xs bg-white font-bold"
                >
                  <option value="">{currentUser.isAdmin ? 'Bandeja de conversaciones' : 'Seleccione administrador'}</option>
                  {currentUser.isAdmin
                    ? conversaciones.map(conversacion => <option key={conversacion.usuario_id} value={conversacion.usuario_id}>{conversacion.usuario_nombre}{conversacion.pendientes ? ` (${conversacion.pendientes} pendientes)` : ''}</option>)
                    : adminsChat.map(admin => <option key={admin.id} value={admin.id}>{admin.area || admin.rol} · {admin.nombre}</option>)}
                </select>
              </div>
              <div className="h-48 border rounded-xl p-4 bg-slate-50 overflow-y-auto space-y-2 text-sm">
                {chatMensajes.map(m => (
                  <div key={m.id} className={`p-3 border rounded-lg shadow-sm ${Number(m.remitente_id) === Number(currentUser.id) ? 'bg-blue-50 border-blue-100 ml-8' : 'bg-white mr-8'}`}>
                    <div className="text-xs text-blue-700 font-bold">{m.remitente_nombre || (Number(m.remitente_id) === Number(currentUser.id) ? 'Usted' : 'Soporte')} · {new Date(m.created_at).toLocaleString()}</div>
                    <p className="text-slate-700 text-sm mt-1">{m.mensaje}</p>
                  </div>
                ))}
                {currentUser.isAdmin && !chatDestinatario && conversaciones.length > 0 && <p className="text-xs text-slate-500">Seleccione una conversación para responder.</p>}
                {!chatMensajes.length && (!currentUser.isAdmin || chatDestinatario) && !chatError && <p className="text-sm text-slate-500">Sin mensajes todavía.</p>}
              </div>
              <form onSubmit={event => {
                event.preventDefault();
                const recipient = Number(chatDestinatario);
                if (!recipient || !nuevoChat.trim()) return;
                const payload = currentUser.isAdmin ? { usuario_id: recipient, mensaje: nuevoChat } : { admin_id: recipient, mensaje: nuevoChat };
                apiFetch(API_BASE_URL, '/api/chat/directo', { method: 'POST', body: JSON.stringify(payload) }).then(res => res.json()).then(data => {
                  if (!data.success) throw new Error(data.message || 'No se pudo enviar el mensaje.');
                  setNuevoChat('');
                  if (currentUser.isAdmin) apiFetch(API_BASE_URL, `/api/chat/directo?usuario_id=${recipient}`).then(res => res.json()).then(result => { if (result.success) setChatMensajes(result.data); });
                  else apiFetch(API_BASE_URL, `/api/chat/directo?admin_id=${recipient}`).then(res => res.json()).then(result => { if (result.success) setChatMensajes(result.data); });
                }).catch(error => setChatError(error.message));
              }} className="flex gap-2">
                <input 
                  type="text"
                  placeholder={currentUser.isAdmin ? 'Responder al usuario...' : 'Escriba su mensaje a IT...'}
                  value={nuevoChat}
                  onChange={e => setNuevoChat(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <button disabled={!chatDestinatario || !nuevoChat.trim()} className="bg-blue-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-sm font-semibold">Enviar</button>
              </form>
            </div>
          )}

          {/* ENCUESTA DE SATISFACCIÓN */}
          {activeTab === 'encuesta' && !currentUser.isAdmin && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4 text-center max-w-md mx-auto">
              <h2 className="text-xl font-bold text-slate-900">Encuesta de Satisfacción IT</h2>
              <form onSubmit={event => {
                event.preventDefault();
                apiFetch(API_BASE_URL, `/api/tickets/${formEncuesta.ticket_id}/encuesta`, { method: 'POST', body: JSON.stringify(formEncuesta) }).then(res => res.json()).then(data => {
                  if (!data.success) throw new Error(data.message || 'No se pudo guardar la encuesta.');
                  setFormEncuesta({ ticket_id: '', calificacion: 5, comentario: '' });
                  cargarDatosGlobales();
                  alert('Gracias por compartir su opinión.');
                }).catch(error => alert(error.message));
              }} className="space-y-3 text-left">
                <label className="block text-sm font-medium">Ticket resuelto
                  <select required value={formEncuesta.ticket_id} onChange={e => setFormEncuesta({ ...formEncuesta, ticket_id: e.target.value })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white">
                    <option value="">Seleccione un ticket</option>
                    {ticketsResueltos.filter(ticket => !ticket.encuesta_enviada).map(ticket => <option key={ticket.id} value={ticket.id}>{ticket.titulo}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">Calificación
                  <select value={formEncuesta.calificacion} onChange={e => setFormEncuesta({ ...formEncuesta, calificacion: Number(e.target.value) })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white">
                    <option value="5">5 · Excelente</option><option value="4">4 · Muy buena</option><option value="3">3 · Buena</option><option value="2">2 · Regular</option><option value="1">1 · Mala</option>
                  </select>
                </label>
                <textarea value={formEncuesta.comentario} onChange={e => setFormEncuesta({ ...formEncuesta, comentario: e.target.value })} placeholder="Comentario" className="w-full p-2 border rounded-lg text-sm" />
                <button disabled={!ticketsResueltos.some(ticket => !ticket.encuesta_enviada)} className="w-full bg-blue-700 disabled:bg-slate-300 text-white py-2 rounded-lg text-sm font-semibold">Enviar calificación</button>
              </form>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}