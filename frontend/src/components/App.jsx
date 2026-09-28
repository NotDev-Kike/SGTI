import React, { useState, useEffect } from 'react';
import Login from './Login';
import ApiReference from './ApiReference';
import { apiFetch } from '../api';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

const parseLocalDate = value => {
  if (typeof value === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.\d{3})?Z)?$/.exec(value);
    if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
};

const formatLocalDateTime = value => {
  if (!value) return '';
  const parts = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = hasTimezone
    ? new Date(value)
    : parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), Number(parts[4]), Number(parts[5]), Number(parts[6]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es', { dateStyle: 'short', timeStyle: 'medium', hour12: false });
};

const etiquetaEstadoTicket = estado => ({
  nuevo: 'Nuevo', abierto: 'Abierto', en_proceso: 'En proceso', resuelto: 'Resuelto', vencido: 'Vencido'
}[estado] || estado || 'Sin estado');

const etiquetaTipoTicket = tipo => ({
  incidencia: 'Incidencia', problema: 'Problema', peticion_servicio: 'Petición de servicio',
  peticion_cambio: 'Petición de cambio', chat: 'Comunicación por chat'
}[tipo] || tipo || 'Ticket');

export default function App() {
  // Cargar usuario desde localStorage para evitar que se regrese al login al recargar
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('sgti_user');
    const user = saved ? JSON.parse(saved) : null;
    return user?.token ? user : null;
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [busqueda, setBusqueda] = useState('');
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
  const [mensajesTicket, setMensajesTicket] = useState([]);
  const [nuevoMensajeTicket, setNuevoMensajeTicket] = useState('');

  const [tickets, setTickets] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [ticketsResueltos, setTicketsResueltos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [eficienciaAdmins, setEficienciaAdmins] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [chatMensajes, setChatMensajes] = useState([]);
  const [conversaciones, setConversaciones] = useState([]);
  const [adminsChat, setAdminsChat] = useState([]);
  const [chatDestinatario, setChatDestinatario] = useState('');
  const [chatError, setChatError] = useState('');
  const [ticketEnEdicion, setTicketEnEdicion] = useState(null);
  const [areaAsignacion, setAreaAsignacion] = useState({});
  const [formSeguimientos, setFormSeguimientos] = useState({});
  const [mesCalendario, setMesCalendario] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  // Estados de formularios
  const [formTicket, setFormTicket] = useState({
    tipo_solicitud: 'incidencia',
    titulo: '',
    descripcion: '',
    categoria: 'hardware',
    departamento_destino_id: '',
    prioridad: 'media'
  });

  const [resolucionTextos, setResolucionTextos] = useState({});
  const [nuevoChat, setNuevoChat] = useState('');
  const [formUsuario, setFormUsuario] = useState({ id: null, nombre: '', email: '', password: '', rol: 'usuario_final', departamento_id: null, activo: true });
  const [formTarea, setFormTarea] = useState({ id: null, titulo: '', descripcion: '', asignado_a_id: '', fecha_limite: '', estado: 'pendiente' });
  const [formProyecto, setFormProyecto] = useState({ id: null, titulo: '', descripcion: '', estado: 'planificacion' });
  const [formEncuesta, setFormEncuesta] = useState({ ticket_id: '', calificacion: 5, comentario: '' });
  const [configuracionSistema, setConfiguracionSistema] = useState({ modo_mantenimiento: false, alertas_email: true });

  useEffect(() => {
    if (!currentUser) return undefined;
    let active = true;
    fetch(`${API_BASE_URL}/api/auth/departamentos`)
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error('No se pudieron cargar las áreas.');
        if (active) setDepartamentos(data.data);
      })
      .catch(() => {
        if (active) setDepartamentos([]);
      });
    return () => { active = false; };
  }, [currentUser]);

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
        if (chatDestinatario) {
          apiFetch(API_BASE_URL, `/api/chat/directo?usuario_id=${encodeURIComponent(chatDestinatario)}`).then(res => res.json()).then(data => {
            if (data.success) setChatMensajes(data.data);
          }).catch(() => {});
        } else {
          setChatMensajes([]);
        }
        return undefined;
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

  useEffect(() => {
    if (!currentUser?.isAdmin) return undefined;

    const cargarAvisosAdmin = () => {
      apiFetch(API_BASE_URL, '/api/admin/tickets/todos').then(res => res.json()).then(data => {
        if (data.success) setTickets(data.data);
      }).catch(() => {});
      apiFetch(API_BASE_URL, '/api/chat/directo').then(res => res.json()).then(data => {
        if (data.success) setConversaciones(data.data);
      }).catch(() => {});
      apiFetch(API_BASE_URL, '/api/admin/tickets/eficiencia').then(res => res.json()).then(data => {
        if (data.success) setEficienciaAdmins(data.data);
      }).catch(() => {});
    };

    cargarAvisosAdmin();
    const refresh = window.setInterval(cargarAvisosAdmin, 10000);
    return () => window.clearInterval(refresh);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.isAdmin) return undefined;
    const refresh = window.setInterval(cargarDatosGlobales, 10000);
    return () => window.clearInterval(refresh);
  }, [currentUser]);

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

  const cargarCalendario = () => {
    apiFetch(API_BASE_URL, '/api/admin/calendario').then(res => res.json()).then(data => {
      if (data.success) setCalendario(data.data);
    }).catch(() => {});
  };

  const cargarDatosAdministrativos = () => {
    const endpoints = [
      ['/api/admin/tareas', setTareas],
      ['/api/admin/proyectos-ti', setProyectos]
    ];
    if (currentUser?.rol === 'gerente_it') endpoints.push(['/api/admin/usuarios', setUsuarios]);
    endpoints.forEach(([path, setter]) => {
      apiFetch(API_BASE_URL, path).then(res => res.json()).then(data => {
        if (data.success) setter(data.data);
      }).catch(() => {});
    });
    cargarCalendario();
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

  const moverTicketAdmin = (ticket, nuevo_estado, nuevo_departamento_id, asignado_a_id, auto_asignar = false) => {
    const payload = {
      nuevo_estado,
      nuevo_departamento_id,
      auto_asignar,
      accion_historial: auto_asignar
        ? `Asignó automáticamente al responsable del área ${nuevo_departamento_id}`
        : asignado_a_id
        ? `Asignó el ticket al administrador ID: ${asignado_a_id}`
        : `Actualizó estado a ${nuevo_estado} y área a ${nuevo_departamento_id}`
    };
    if (asignado_a_id !== undefined) payload.asignado_a_id = asignado_a_id;
    apiFetch(API_BASE_URL, `/api/admin/tickets/${ticket.id}/modificar`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }).then(res => res.json()).then(data => {
      if (!data.success) throw new Error(data.message || 'No se pudo actualizar el ticket.');
      cargarDatosGlobales();
    }).catch(error => alert(error.message));
  };

  const moverTicketPorArea = (ticket, departamentoId) => {
    moverTicketAdmin(ticket, ticket.estado, departamentoId, undefined, true);
  };

  const abrirDetalleTicket = ticket => {
    setTicketSeleccionado(ticket);
    setMensajesTicket([]);
    setNuevoMensajeTicket('');
    apiFetch(API_BASE_URL, `/api/chat/${ticket.id}/mensajes`).then(res => res.json()).then(data => {
      if (Array.isArray(data)) setMensajesTicket(data);
    }).catch(() => {});
  };

  const enviarMensajeTicket = event => {
    event.preventDefault();
    if (!ticketSeleccionado || !nuevoMensajeTicket.trim()) return;
    apiFetch(API_BASE_URL, `/api/chat/${ticketSeleccionado.id}/mensajes`, {
      method: 'POST',
      body: JSON.stringify({ mensaje: nuevoMensajeTicket.trim() })
    }).then(res => res.json()).then(data => {
      if (data.error) throw new Error(data.error);
      setNuevoMensajeTicket('');
      return apiFetch(API_BASE_URL, `/api/chat/${ticketSeleccionado.id}/mensajes`).then(res => res.json());
    }).then(data => {
      if (Array.isArray(data)) setMensajesTicket(data);
    }).catch(error => alert(error.message || 'No se pudo enviar el mensaje.'));
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
      setTicketSeleccionado(current => current ? { ...current, ...ticketEnEdicion } : current);
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
        setFormTicket({ tipo_solicitud: 'incidencia', titulo: '', descripcion: '', categoria: 'hardware', departamento_destino_id: '', prioridad: 'media' });
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
        cargarCalendario();
        alert('Ticket resuelto y archivado en el historial.');
      })
      .catch(error => alert(error.message));
  };

  const actualizarFormularioSeguimiento = (ticketId, cambios) => {
    setFormSeguimientos(actual => ({
      ...actual,
      [ticketId]: { ...actual[ticketId], ...cambios }
    }));
  };

  const guardarSeguimientoTicket = ticket => {
    const formulario = formSeguimientos[ticket.id] || {};
    if (!formulario.mensaje?.trim()) {
      alert('Escriba una actualización para el solicitante.');
      return;
    }
    apiFetch(API_BASE_URL, `/api/admin/tickets/${ticket.id}/seguimiento`, {
      method: 'PUT',
      body: JSON.stringify({
        resuelto: Boolean(formulario.resuelto),
        fecha_estimada_resolucion: formulario.resuelto ? null : formulario.fecha_estimada_resolucion || null,
        causa_externa: formulario.resuelto ? false : Boolean(formulario.causa_externa),
        mensaje: formulario.mensaje.trim()
      })
    }).then(res => res.json()).then(data => {
      if (!data.success) throw new Error(data.message || 'No se pudo guardar la actualización.');
      setFormSeguimientos(actual => ({ ...actual, [ticket.id]: {} }));
      setTicketSeleccionado(actual => actual?.id === ticket.id ? {
        ...actual,
        estado: formulario.resuelto ? 'resuelto' : 'en_proceso',
        actualizacion_publica: formulario.mensaje.trim()
      } : actual);
      cargarDatosGlobales();
      if (formulario.resuelto) cargarCalendario();
      alert(data.message);
    }).catch(error => alert(error.message));
  };

  const misTickets = currentUser && !currentUser.isAdmin
    ? [...tickets, ...ticketsResueltos].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    : [];
  const filtrarTickets = lista => {
    const termino = busqueda.trim().toLocaleLowerCase();
    if (!termino) return lista;
    return lista.filter(ticket => [ticket.id, ticket.titulo, ticket.descripcion, ticket.estado, ticket.creador_nombre, ticket.departamento_nombre, ticket.departamento_destino_nombre]
      .some(valor => String(valor || '').toLocaleLowerCase().includes(termino)));
  };
  const etiquetasSeccion = {
    dashboard: 'Inicio', crear_ticket: 'Crear ticket', todos_tickets: 'Tickets de todos', asignaciones: 'Asignación de tickets',
    historial: 'Historial', usuarios: 'Gestión de usuarios', calendario: 'Calendario', tareas: 'Tareas', proyectos: 'Proyectos',
    configuracion: 'Configuración', chat: 'Mensajes con IT', encuesta: 'Encuesta de satisfacción', apis: 'Referencia de API', mis_tickets: 'Mis tickets'
  };
  const ticketsAsignados = currentUser?.isAdmin
    ? tickets.filter(ticket => Number(ticket.asignado_a_id) === Number(currentUser.id))
    : [];
  const mensajesPendientes = currentUser?.isAdmin
    ? conversaciones.reduce((total, conversacion) => total + Number(conversacion.pendientes || 0), 0)
    : 0;
  if (!currentUser) {
    return <Login onLogin={handleLoginSuccess} apiBaseUrl={API_BASE_URL} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-800">
      
      {/* BARRA LATERAL DINÁMICA */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'md:-translate-x-full' : 'md:translate-x-0'} transition-transform duration-300 ease-in-out flex flex-col shadow-xl`}>
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-extrabold text-white">SGTI</h2>
            <p className="text-xs text-blue-400 font-semibold">{currentUser.area}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">✕</button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto text-sm">
          <button
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            Inicio
          </button>

          {currentUser.isAdmin ? (
            <>
              <button
                onClick={() => { setActiveTab('crear_ticket'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'crear_ticket' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Crear ticket
              </button>
              <button 
                onClick={() => { setActiveTab('todos_tickets'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'todos_tickets' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Tickets de todos ({tickets.length}){ticketsAsignados.length > 0 && <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-900">{ticketsAsignados.length}</span>}
              </button>
              {currentUser.rol === 'gerente_it' && <button
                onClick={() => { setActiveTab('asignaciones'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'asignaciones' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Asignación de tickets
              </button>}
              <button 
                onClick={() => { setActiveTab('historial'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'historial' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Historial de tickets
              </button>
              {currentUser.rol === 'gerente_it' && <button
                onClick={() => { setActiveTab('usuarios'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'usuarios' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Gestión de usuarios
              </button>}
              <button 
                onClick={() => { setActiveTab('calendario'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'calendario' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Calendario
              </button>
              <button 
                onClick={() => { setActiveTab('tareas'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'tareas' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Tareas
              </button>
              <button 
                onClick={() => { setActiveTab('proyectos'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'proyectos' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Proyectos de IT
              </button>
              <button 
                onClick={() => { setActiveTab('configuracion'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'configuracion' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Configuración
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => { setActiveTab('crear_ticket'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'crear_ticket' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Crear ticket
              </button>
              <button 
                onClick={() => { setActiveTab('mis_tickets'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'mis_tickets' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Mis tickets
              </button>
              <button 
                onClick={() => { setActiveTab('encuesta'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'encuesta' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                Encuesta de satisfacción
              </button>
            </>
          )}

          <button 
            onClick={() => { setActiveTab('chat'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'chat' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            Mensajes con IT{mensajesPendientes > 0 && <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{mensajesPendientes}</span>}
          </button>
          {currentUser.isAdmin && <button onClick={() => { setActiveTab('apis'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'apis' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>Referencia de API</button>}
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
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ${sidebarCollapsed ? '' : 'md:ml-64'}`}>
        <header className="bg-white border-b border-slate-200 min-h-16 flex flex-wrap items-center justify-between gap-3 px-6 py-3 sticky top-0 z-40 shadow-sm">
          <button onClick={() => { if (window.innerWidth < 768) setSidebarOpen(true); else setSidebarCollapsed(!sidebarCollapsed); }} className="text-sm text-slate-700 font-semibold">{sidebarCollapsed ? 'Mostrar menú' : 'Ocultar menú'}</button>
          <div className="text-sm font-bold text-slate-700">{etiquetasSeccion[activeTab] || 'Inicio'}</div>
          {(activeTab === 'todos_tickets' || activeTab === 'mis_tickets' || activeTab === 'historial' || activeTab === 'asignaciones') && <input type="search" aria-label="Buscar tickets" placeholder="Buscar ticket..." value={busqueda} onChange={event => setBusqueda(event.target.value)} className="w-full sm:w-64 px-3 py-2 border border-slate-300 rounded text-sm" />}
          <div className="text-xs bg-slate-100 px-3 py-1 rounded-full font-semibold border">{currentUser.area}</div>
        </header>

        <main className={`p-6 flex-1 w-full mx-auto space-y-6 ${sidebarCollapsed ? 'max-w-7xl' : 'max-w-5xl'}`}>
          
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
                  <div className="text-xs text-slate-500 font-bold uppercase">Tickets vencidos</div>
                  <div className="text-3xl font-extrabold text-red-600 mt-2">
                    {tickets.filter(t => t.semaforo_alerta === 'vencido').length}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border shadow-sm">
                  <div className="text-xs text-slate-500 font-bold uppercase">Historial Resueltos</div>
                  <div className="text-3xl font-extrabold text-emerald-600 mt-2">{currentUser.isAdmin ? historial.length : ticketsResueltos.length}</div>
                </div>
              </div>
              {currentUser.isAdmin && (
                <section className="bg-white border rounded-xl p-5 space-y-3">
                  <div>
                    <h2 className="font-bold text-slate-900">Resolución por responsable</h2>
                    <p className="text-xs text-slate-500 mt-1">Resumen histórico de tickets asignados; es un dato de seguimiento, no un ranking.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="border-b text-xs uppercase text-slate-500">
                        <tr><th className="py-2 pr-4">Responsable</th><th className="py-2 px-3 text-right">Resueltos</th><th className="py-2 px-3 text-right">Pendientes</th><th className="py-2 px-3 text-right">Vencidos</th><th className="py-2 pl-3 text-right">Tasa de resolución</th></tr>
                      </thead>
                      <tbody className="divide-y">
                        {eficienciaAdmins.map(admin => (
                          <tr key={admin.id}>
                            <td className="py-3 pr-4"><strong>{admin.nombre}</strong><span className="block text-xs text-slate-500">{admin.departamento_nombre || 'Sin área'} · {admin.total_asignados} asignados</span></td>
                            <td className="py-3 px-3 text-right font-semibold text-emerald-700">{admin.resueltos}</td>
                            <td className="py-3 px-3 text-right">{admin.pendientes}</td>
                            <td className="py-3 px-3 text-right text-red-700">{admin.vencidos}</td>
                            <td className="py-3 pl-3 text-right font-semibold">{admin.total_asignados ? `${admin.tasa_resolucion}%` : '—'}</td>
                          </tr>
                        ))}
                        {!eficienciaAdmins.length && <tr><td colSpan="5" className="py-4 text-center text-slate-500">No hay métricas disponibles.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {currentUser.isAdmin && (
                <section className="bg-white border rounded-xl p-5 space-y-4" aria-label="Avisos para este administrador">
                  <h2 className="font-bold text-slate-900">Avisos para usted</h2>
                  {ticketsAsignados.map(ticket => (
                    <button key={`ticket-${ticket.id}`} onClick={() => setActiveTab('todos_tickets')} className="block w-full text-left border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm">
                      <strong>Ticket asignado:</strong> {ticket.titulo}
                      <span className="block text-xs text-slate-600">De {ticket.creador_nombre || 'solicitante'} · {ticket.departamento_nombre}</span>
                    </button>
                  ))}
                  {conversaciones.filter(conversacion => Number(conversacion.pendientes) > 0).map(conversacion => (
                    <button key={`mensaje-${conversacion.usuario_id}`} onClick={() => { setChatDestinatario(String(conversacion.usuario_id)); setActiveTab('chat'); }} className="block w-full text-left border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm">
                      <strong>Mensaje nuevo de {conversacion.usuario_nombre}</strong>
                      <span className="block text-xs text-slate-600">{conversacion.ultimo_mensaje}</span>
                    </button>
                  ))}
                  {!ticketsAsignados.length && !mensajesPendientes && <p className="text-sm text-slate-500">No tiene tickets asignados ni mensajes nuevos.</p>}
                </section>
              )}
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
                      onChange={e => setFormTicket({...formTicket, departamento_destino_id: Number(e.target.value) || ''})}
                      required
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    >
                      <option value="">Seleccione un área</option>
                      {departamentos.map(departamento => <option key={departamento.id} value={departamento.id}>{departamento.nombre}</option>)}
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
              <h2 className="text-xl font-bold text-slate-900">Mis tickets</h2>
              <div className="overflow-x-auto bg-white border border-slate-200 rounded">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Ticket</th><th className="px-4 py-3">Área</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Creado</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtrarTickets(misTickets).map(ticket => <tr key={ticket.id}>
                      <td className="px-4 py-3"><span className="block text-xs text-slate-500">#{ticket.id} · {etiquetaTipoTicket(ticket.tipo_solicitud)}</span><strong className="text-slate-900">{ticket.titulo}</strong></td>
                      <td className="px-4 py-3 text-slate-600">{ticket.departamento_destino_nombre || 'Sin área'}</td>
                      <td className="px-4 py-3">{etiquetaEstadoTicket(ticket.estado)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatLocalDateTime(ticket.created_at_local || ticket.created_at)}</td>
                      <td className="px-4 py-3"><button onClick={() => abrirDetalleTicket(ticket)} className="font-semibold text-blue-700 hover:underline">Ver detalle</button></td>
                    </tr>)}
                    {!filtrarTickets(misTickets).length && <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">No hay tickets que coincidan con la búsqueda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TICKETS DE TODOS CON SEMÁFORO (ADMIN) */}
          {activeTab === 'todos_tickets' && currentUser.isAdmin && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Tickets de todos</h2>
              <div className="overflow-x-auto bg-white border border-slate-200 rounded">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Ticket</th><th className="px-4 py-3">Solicitante</th><th className="px-4 py-3">Área</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Plazo</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtrarTickets(tickets).map(ticket => <tr key={ticket.id}>
                      <td className="px-4 py-3"><span className="block text-xs text-slate-500">#{ticket.id} · {ticket.tipo_solicitud}</span><strong className="text-slate-900">{ticket.titulo}</strong></td>
                      <td className="px-4 py-3 text-slate-700">{ticket.creador_nombre || 'Solicitante'}</td>
                      <td className="px-4 py-3 text-slate-600">{ticket.departamento_nombre || 'Sin área'}</td>
                      <td className="px-4 py-3"><select aria-label={`Estado del ticket ${ticket.id}`} value={ticket.estado} onChange={event => moverTicketAdmin(ticket, event.target.value, currentUser.rol === 'gerente_it' ? ticket.departamento_destino_id : null)} className="px-2 py-1 border border-slate-300 rounded bg-white text-xs"><option value="nuevo">Nuevo</option><option value="abierto">Abierto</option><option value="en_proceso">En proceso</option></select></td>
                      <td className="px-4 py-3 text-xs text-slate-600">{ticket.semaforo_alerta === 'vencido' ? 'Vencido' : ticket.fecha_limite ? parseLocalDate(ticket.fecha_limite).toLocaleDateString() : 'Sin fecha'}</td>
                      <td className="px-4 py-3"><button onClick={() => abrirDetalleTicket(ticket)} className="font-semibold text-blue-700 hover:underline">Ver detalle</button></td>
                    </tr>)}
                    {!filtrarTickets(tickets).length && <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No hay tickets que coincidan con la búsqueda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'asignaciones' && currentUser.rol === 'gerente_it' && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Asignación de tickets</h2>
                <p className="text-sm text-slate-500 mt-1">Elige el área; el sistema asignará al administrador responsable de esa sección.</p>
              </div>
              <div className="overflow-x-auto bg-white border border-slate-200 rounded">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Ticket</th><th className="px-4 py-3">Solicitante</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Área de atención</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtrarTickets(tickets.filter(ticket => ticket.estado !== 'resuelto')).map(ticket => <tr key={ticket.id}>
                      <td className="px-4 py-3"><button onClick={() => abrirDetalleTicket(ticket)} className="text-left"><span className="block text-xs text-slate-500">#{ticket.id}</span><strong className="text-blue-800">{ticket.titulo}</strong></button></td>
                      <td className="px-4 py-3">{ticket.creador_nombre || 'Solicitante'}</td>
                      <td className="px-4 py-3 text-slate-600">{ticket.asignado_nombre || 'Sin asignar'}</td>
                      <td className="px-4 py-3"><select aria-label={`Área para ${ticket.titulo}`} value={areaAsignacion[ticket.id] ?? ticket.departamento_destino_id} onChange={event => setAreaAsignacion(actual => ({ ...actual, [ticket.id]: Number(event.target.value) }))} className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">{departamentos.map(departamento => <option key={departamento.id} value={departamento.id}>{departamento.nombre}</option>)}</select></td>
                      <td className="px-4 py-3"><button onClick={() => moverTicketPorArea(ticket, Number(areaAsignacion[ticket.id] ?? ticket.departamento_destino_id))} className="whitespace-nowrap rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white">{ticket.asignado_a_id ? 'Reasignar' : 'Asignar'}</button></td>
                    </tr>)}
                    {!filtrarTickets(tickets.filter(ticket => ticket.estado !== 'resuelto')).length && <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">No hay tickets pendientes para asignar.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* HISTORIAL DE TICKETS (AUDITORÍA) */}
          {activeTab === 'historial' && currentUser.isAdmin && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Historial de Tickets Resueltos</h2>
              <p className="text-xs text-slate-500">Los tickets resueltos se almacenan aquí para auditoría y evitar saturar el panel general de activos.</p>
              <div className="overflow-x-auto bg-white border border-slate-200 rounded">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Ticket</th><th className="px-4 py-3">Solicitante</th><th className="px-4 py-3">Área</th><th className="px-4 py-3">Resolución</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtrarTickets(historial).map(ticket => <tr key={ticket.id}>
                      <td className="px-4 py-3"><span className="block text-xs text-slate-500">#{ticket.id}</span><strong>{ticket.titulo}</strong></td>
                      <td className="px-4 py-3">{ticket.creador_nombre || ticket.nombre_solicitante}</td>
                      <td className="px-4 py-3">{ticket.departamento_destino_nombre || 'Sin área'}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-600">{String(ticket.detalles_resolucion || '').replace(/^Resolución: /, '')}</td>
                      <td className="px-4 py-3"><button onClick={() => abrirDetalleTicket(ticket)} className="font-semibold text-blue-700 hover:underline">Ver detalle</button></td>
                    </tr>)}
                    {!filtrarTickets(historial).length && <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">El historial está vacío o no coincide con la búsqueda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GESTIÓN DE USUARIOS (RECTIFICACIÓN ADMIN) */}
          {activeTab === 'usuarios' && currentUser.rol === 'gerente_it' && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Gestión y Rectificación de Usuarios</h2>
              <form onSubmit={event => {
                event.preventDefault();
                apiFetch(API_BASE_URL, '/api/admin/usuarios', { method: 'POST', body: JSON.stringify(formUsuario) })
                  .then(res => res.json()).then(data => {
                    if (!data.success) throw new Error(data.message || 'No se pudo guardar el usuario.');
                    setFormUsuario({ id: null, nombre: '', email: '', password: '', rol: 'usuario_final', departamento_id: null, activo: true });
                    cargarDatosAdministrativos();
                  }).catch(error => alert(error.message));
              }} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b pb-5">
                <input aria-label="Nombre" placeholder="Nombre completo" required value={formUsuario.nombre} onChange={e => setFormUsuario({ ...formUsuario, nombre: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <input aria-label="Correo" type="email" placeholder="Correo" required value={formUsuario.email} onChange={e => setFormUsuario({ ...formUsuario, email: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                {!formUsuario.id && <input aria-label="Contraseña" type="password" minLength="8" placeholder="Contraseña inicial (8 caracteres mínimo)" required value={formUsuario.password} onChange={e => setFormUsuario({ ...formUsuario, password: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />}
                <label className="block space-y-1 text-xs font-semibold text-slate-600">
                  <span>Rol de la cuenta</span>
                  <select aria-label="Rol del usuario" value={formUsuario.rol} onChange={e => setFormUsuario({ ...formUsuario, rol: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white font-normal text-slate-800">
                    <option value="usuario_final">Usuario normal</option>
                    <option value="admin_infra">Administrador de Infraestructura</option>
                    <option value="admin_desarrollo">Administrador de Desarrollo</option>
                    <option value="admin_gps">Administrador de GPS</option>
                    <option value="gerente_it">Gerente de IT</option>
                  </select>
                </label>
                <label className="block space-y-1 text-xs font-semibold text-slate-600">
                  <span>Área</span>
                  <select aria-label="Área" required={formUsuario.rol !== 'usuario_final'} value={formUsuario.departamento_id || ''} onChange={e => setFormUsuario({ ...formUsuario, departamento_id: Number(e.target.value) || null })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white font-normal text-slate-800">
                    <option value="">{formUsuario.rol === 'usuario_final' ? 'Sin área' : 'Seleccione un área'}</option>
                    {departamentos.map(departamento => <option key={departamento.id} value={departamento.id}>{departamento.nombre}</option>)}
                  </select>
                </label>
                {formUsuario.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formUsuario.activo} onChange={e => setFormUsuario({ ...formUsuario, activo: e.target.checked })} /> Cuenta activa</label>}
                <div className="flex gap-2">
                  <button className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">{formUsuario.id ? 'Guardar cambios' : 'Crear usuario'}</button>
                  {formUsuario.id && <button type="button" onClick={() => setFormUsuario({ id: null, nombre: '', email: '', password: '', rol: 'usuario_final', departamento_id: null, activo: true })} className="border px-4 py-2 rounded-lg text-sm">Cancelar</button>}
                </div>
              </form>
              <div className="divide-y">
                {usuarios.map(usuario => <div key={usuario.id} className="py-3 flex flex-wrap gap-3 items-center justify-between text-sm">
                  <div><strong>{usuario.nombre}</strong><div className="text-xs text-slate-500">{usuario.email} · {usuario.departamento_nombre || 'Sin área'} · {usuario.rol}{usuario.activo ? '' : ' · Inactivo'}</div></div>
                  <div className="flex gap-2">
                    <button onClick={() => setFormUsuario({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, password: '', rol: usuario.rol, departamento_id: usuario.departamento_id, activo: usuario.activo })} className="border px-3 py-1.5 rounded text-xs">Editar</button>
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
                      const date = parseLocalDate(evento.fecha);
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
                  setFormTarea({ id: null, titulo: '', descripcion: '', asignado_a_id: currentUser.id, fecha_limite: '', estado: 'pendiente' });
                  cargarDatosAdministrativos();
                }).catch(error => alert(error.message));
              }} className="grid sm:grid-cols-2 gap-3 border-b pb-5">
                <input placeholder="Título de tarea" required value={formTarea.titulo} onChange={e => setFormTarea({ ...formTarea, titulo: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <input type="date" required value={formTarea.fecha_limite} onChange={e => setFormTarea({ ...formTarea, fecha_limite: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <input placeholder="Descripción" value={formTarea.descripcion} onChange={e => setFormTarea({ ...formTarea, descripcion: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <label className="text-xs font-semibold text-slate-600">Responsable
                  <select required value={formTarea.asignado_a_id || currentUser.id} onChange={e => setFormTarea({ ...formTarea, asignado_a_id: Number(e.target.value) })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white text-sm font-normal text-slate-800">
                    {currentUser.rol !== 'gerente_it' && <option value={currentUser.id}>{currentUser.nombre}</option>}
                    {usuarios.filter(usuario => usuario.activo && ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'].includes(usuario.rol)).map(usuario => <option key={usuario.id} value={usuario.id}>{usuario.nombre}</option>)}
                  </select>
                </label>
                <button className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">{formTarea.id ? 'Guardar cambios' : 'Agregar tarea'}</button>
              </form>
              <div className="divide-y">{tareas.map(tarea => <div key={tarea.id} className="py-3 flex justify-between gap-3 text-sm">
                <div><strong>{tarea.titulo}</strong><div className="text-xs text-slate-500">{tarea.descripcion} · {tarea.asignado_nombre} · {parseLocalDate(tarea.fecha_limite).toLocaleDateString()}</div></div>
                <div className="flex gap-3"><button onClick={() => setFormTarea({ id: tarea.id, titulo: tarea.titulo, descripcion: tarea.descripcion || '', asignado_a_id: tarea.asignado_a_id, fecha_limite: String(tarea.fecha_limite).slice(0, 10), estado: tarea.estado })} className="text-blue-700 text-xs">Editar</button><button onClick={() => apiFetch(API_BASE_URL, `/api/admin/tareas/${tarea.id}`, { method: 'DELETE' }).then(res => res.json()).then(() => cargarDatosAdministrativos())} className="text-red-700 text-xs">Eliminar</button></div>
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

          {activeTab === 'apis' && currentUser.isAdmin && <ApiReference />}

        </main>
        {ticketSeleccionado && <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/60 p-3 sm:p-8" onClick={() => { setTicketSeleccionado(null); setTicketEnEdicion(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="ticket-detail-title" className="mx-auto my-4 max-h-[92vh] max-w-3xl overflow-y-auto rounded bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">Ticket #{ticketSeleccionado.id} · {etiquetaTipoTicket(ticketSeleccionado.tipo_solicitud)}</p>
                <h2 id="ticket-detail-title" className="mt-1 text-xl font-bold text-slate-900">{ticketSeleccionado.titulo}</h2>
              </div>
              <button onClick={() => { setTicketSeleccionado(null); setTicketEnEdicion(null); }} className="shrink-0 px-3 py-1.5 border border-slate-300 rounded text-sm">Cerrar</button>
            </header>
            <div className="space-y-6 p-5">
              <dl className="grid gap-3 border-b pb-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-slate-500">Solicitante</dt><dd className="font-medium">{ticketSeleccionado.creador_nombre || currentUser.nombre || currentUser.email}</dd></div>
                <div><dt className="text-xs text-slate-500">Estado</dt><dd className="font-medium">{etiquetaEstadoTicket(ticketSeleccionado.estado)}</dd></div>
                <div><dt className="text-xs text-slate-500">Área asignada</dt><dd className="font-medium">{ticketSeleccionado.departamento_nombre || ticketSeleccionado.departamento_destino_nombre || 'Sin área'}</dd></div>
                <div><dt className="text-xs text-slate-500">Responsable</dt><dd className="font-medium">{ticketSeleccionado.asignado_nombre || 'Sin asignar'}</dd></div>
                <div><dt className="text-xs text-slate-500">Categoría</dt><dd className="font-medium">{ticketSeleccionado.categoria || 'Sin categoría'}</dd></div>
                <div><dt className="text-xs text-slate-500">Fecha de creación</dt><dd className="font-medium">{formatLocalDateTime(ticketSeleccionado.created_at_local || ticketSeleccionado.created_at) || 'Sin fecha'}</dd></div>
                <div><dt className="text-xs text-slate-500">Fecha límite</dt><dd className="font-medium">{ticketSeleccionado.fecha_limite ? parseLocalDate(ticketSeleccionado.fecha_limite).toLocaleDateString() : 'Sin fecha límite'}</dd></div>
              </dl>

              <section className="space-y-2">
                <h3 className="font-semibold text-slate-900">Indicaciones del ticket</h3>
                {ticketEnEdicion?.id === ticketSeleccionado.id
                  ? <textarea aria-label="Descripción del ticket" rows="5" value={ticketEnEdicion.descripcion} onChange={event => setTicketEnEdicion({ ...ticketEnEdicion, descripcion: event.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                  : <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticketSeleccionado.descripcion}</p>}
                {ticketEnEdicion?.id === ticketSeleccionado.id
                  ? <input aria-label="Título del ticket" value={ticketEnEdicion.titulo} onChange={event => setTicketEnEdicion({ ...ticketEnEdicion, titulo: event.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                  : null}
                {currentUser.isAdmin && <div className="flex flex-wrap gap-2">
                  {ticketEnEdicion?.id === ticketSeleccionado.id ? <>
                    <button onClick={editarTicketAdmin} className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Guardar cambios</button>
                    <button onClick={() => setTicketEnEdicion(null)} className="rounded border px-3 py-2 text-sm">Cancelar</button>
                  </> : <button onClick={() => setTicketEnEdicion({ id: ticketSeleccionado.id, titulo: ticketSeleccionado.titulo, descripcion: ticketSeleccionado.descripcion })} className="rounded border border-slate-300 px-3 py-2 text-sm">Editar indicaciones</button>}
                </div>}
              </section>

              {(ticketSeleccionado.actualizaciones?.length > 0 || ticketSeleccionado.actualizacion_publica || ticketSeleccionado.detalles_resolucion) && <section className="space-y-2 border-t pt-4">
                <h3 className="font-semibold text-slate-900">Historial de atención</h3>
                {ticketSeleccionado.actualizaciones?.length ? <ol className="space-y-2">{ticketSeleccionado.actualizaciones.map((actualizacion, index) => <li key={`${ticketSeleccionado.id}-${index}`} className="border-l-2 border-blue-300 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex flex-wrap justify-between gap-2"><strong>{actualizacion.tipo}</strong><time className="text-xs text-slate-500">{formatLocalDateTime(actualizacion.fecha_hora)}</time></div>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{actualizacion.mensaje}</p>
                </li>)}</ol> : <p className="whitespace-pre-wrap text-sm text-slate-700">{ticketSeleccionado.detalles_resolucion || ticketSeleccionado.actualizacion_publica}</p>}
              </section>}

              {currentUser.isAdmin && (Number(ticketSeleccionado.asignado_a_id) === Number(currentUser.id) || currentUser.rol === 'gerente_it') && ticketSeleccionado.estado !== 'resuelto' && <section className="space-y-3 border-t pt-4">
                <h3 className="font-semibold text-slate-900">Enviar avance al solicitante</h3>
                <textarea rows="3" placeholder="Describa el avance, impedimento o solución..." value={formSeguimientos[ticketSeleccionado.id]?.mensaje || ''} onChange={event => actualizarFormularioSeguimiento(ticketSeleccionado.id, { mensaje: event.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                {!formSeguimientos[ticketSeleccionado.id]?.resuelto && <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-600">Fecha estimada de solución<input type="date" value={formSeguimientos[ticketSeleccionado.id]?.fecha_estimada_resolucion || ''} onChange={event => actualizarFormularioSeguimiento(ticketSeleccionado.id, { fecha_estimada_resolucion: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
                  <label className="flex items-center gap-2 self-end text-sm text-slate-700"><input type="checkbox" checked={Boolean(formSeguimientos[ticketSeleccionado.id]?.causa_externa)} onChange={event => actualizarFormularioSeguimiento(ticketSeleccionado.id, { causa_externa: event.target.checked })} />En espera de proveedor o servicio externo</label>
                </div>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={Boolean(formSeguimientos[ticketSeleccionado.id]?.resuelto)} onChange={event => actualizarFormularioSeguimiento(ticketSeleccionado.id, { resuelto: event.target.checked })} />Marcar como resuelto</label>
                  <button onClick={() => guardarSeguimientoTicket(ticketSeleccionado)} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Enviar actualización</button>
                </div>
              </section>}

              {(!currentUser.isAdmin || currentUser.rol === 'gerente_it' || Number(ticketSeleccionado.asignado_a_id) === Number(currentUser.id)) && <section className="space-y-3 border-t pt-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Mensajes del ticket #{ticketSeleccionado.id}</h3>
                  <p className="text-xs text-slate-500">Las aclaraciones y respuestas quedan vinculadas a este ticket.</p>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto bg-slate-50 p-3">
                  {mensajesTicket.map(mensaje => <article key={mensaje.id} className="border-b border-slate-200 pb-2 last:border-0">
                    <div className="flex flex-wrap justify-between gap-2 text-xs"><strong>{mensaje.remitente_nombre || 'Usuario'}</strong><time className="text-slate-500">{formatLocalDateTime(mensaje.created_at_iso || mensaje.created_at)}</time></div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{mensaje.mensaje}</p>
                  </article>)}
                  {!mensajesTicket.length && <p className="text-sm text-slate-500">Todavía no hay mensajes en este ticket.</p>}
                </div>
                <form onSubmit={enviarMensajeTicket} className="flex flex-col gap-2 sm:flex-row">
                  <input value={nuevoMensajeTicket} onChange={event => setNuevoMensajeTicket(event.target.value)} placeholder={currentUser.isAdmin ? 'Escriba una respuesta para este ticket...' : 'Agregue un dato que faltó al crear el ticket...'} className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm" />
                  <button disabled={!nuevoMensajeTicket.trim()} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">Enviar mensaje</button>
                </form>
              </section>}
            </div>
          </section>
        </div>}
      </div>
    </div>
  );
}