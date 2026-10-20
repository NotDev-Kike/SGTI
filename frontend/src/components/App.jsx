import React, { useState, useEffect } from 'react';
import Login from './Login';
import ApiReference from './ApiReference';
import ArchivedUsers from './ArchivedUsers';
import { EvidenceGallery, EvidencePicker } from './EvidenceImages';
import RemoteAssistance from './RemoteAssistance';
import EnterpriseConsole from './EnterpriseConsole';
import { apiFetch, getApiBaseUrl } from '../api';

const API_BASE_URL = getApiBaseUrl();

const parseLocalDate = value => {
  if (typeof value === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.\d{3})?Z)?$/.exec(value);
    if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
};

const esFechaAnteriorAHoy = value => {
  const date = parseLocalDate(value);
  const today = new Date();
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return date < today;
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

const crearFormularioEntrega = () => {
  const date = new Date();
  const fecha = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  return { departamento_id: '', destinatario: '', fecha_entrega: fecha, observaciones: '', articulos: [{ articulo: '', cantidad: 1, detalles: '' }] };
};

const departamentoPorRol = {
  gerente_it: 'Gerencia de IT',
  admin_infra: 'Infraestructura',
  admin_gps: 'GPS/rutas',
  admin_desarrollo: 'Desarrollo'
};

const normalizarNombre = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();

const escaparHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const crearDocumentoEntrega = entrega => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Constancia de entrega ${escaparHtml(entrega.id)}</title>
  <style>
    body { color: #17212b; font: 14px Arial, sans-serif; margin: 40px auto; max-width: 800px; padding: 0 28px; }
    header { border-bottom: 3px solid #087e73; margin-bottom: 28px; padding-bottom: 16px; }
    h1 { font-size: 24px; margin: 4px 0; }
    .brand { color: #087e73; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .meta { display: grid; gap: 12px 24px; grid-template-columns: 1fr 1fr; margin: 24px 0; }
    .label { color: #536170; display: block; font-size: 11px; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; }
    table { border-collapse: collapse; margin-top: 24px; width: 100%; }
    th, td { border-bottom: 1px solid #ccd4da; padding: 10px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f5; font-size: 11px; text-transform: uppercase; }
    .notes { border-top: 1px solid #ccd4da; margin-top: 24px; padding-top: 12px; }
    .signatures { display: grid; gap: 48px; grid-template-columns: 1fr 1fr; margin-top: 88px; }
    .signature { border-top: 1px solid #536170; padding-top: 8px; text-align: center; }
    @media print { body { margin: 0; max-width: none; padding: 0; } }
  </style>
</head>
<body>
  <header><div class="brand">SGTI · Infraestructura</div><h1>Constancia de entrega</h1><div>Folio #${escaparHtml(entrega.id)}</div></header>
  <div class="meta">
    <div><span class="label">Fecha de entrega</span>${escaparHtml(entrega.fecha_entrega)}</div>
    <div><span class="label">Departamento</span>${escaparHtml(entrega.departamento_nombre)}</div>
    <div><span class="label">Recibe</span>${escaparHtml(entrega.destinatario)}</div>
    <div><span class="label">Entrega</span>${escaparHtml(entrega.entregado_por_nombre)}</div>
  </div>
  <table><thead><tr><th>Artículo</th><th>Cantidad</th><th>Detalles</th></tr></thead><tbody>
    ${(entrega.articulos || []).map(item => `<tr><td>${escaparHtml(item.articulo)}</td><td>${escaparHtml(item.cantidad)}</td><td>${escaparHtml(item.detalles || '—')}</td></tr>`).join('')}
  </tbody></table>
  ${entrega.observaciones ? `<div class="notes"><span class="label">Observaciones</span>${escaparHtml(entrega.observaciones)}</div>` : ''}
  <div class="signatures"><div class="signature">Recibí conforme · ${escaparHtml(entrega.destinatario)}</div><div class="signature">Entregó · ${escaparHtml(entrega.entregado_por_nombre)}</div></div>
</body>
</html>`;

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
  const [modoOscuro, setModoOscuro] = useState(() => localStorage.getItem('sgti_modo_oscuro') !== 'false');

  useEffect(() => {
    localStorage.setItem('sgti_modo_oscuro', String(modoOscuro));
    document.documentElement.classList.toggle('dark', modoOscuro);
  }, [modoOscuro]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({
    principal: true,
    tickets: true,
    administracion: true,
    planificacion: true,
    infraestructura: true,
    referencia: true
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardBandeja, setDashboardBandeja] = useState('asignados');
  const [busqueda, setBusqueda] = useState('');
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
  const [mensajesTicket, setMensajesTicket] = useState([]);
  const [nuevoMensajeTicket, setNuevoMensajeTicket] = useState('');
  const [imagenesTicket, setImagenesTicket] = useState([]);
  const [archivosTicket, setArchivosTicket] = useState([]);
  const [archivosMensajeTicket, setArchivosMensajeTicket] = useState([]);

  const [tickets, setTickets] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [ticketsResueltos, setTicketsResueltos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [categorias, setCategorias] = useState([
    { id: 'hardware', nombre: 'Hardware' }, { id: 'software', nombre: 'Software' },
    { id: 'redes', nombre: 'Redes' }, { id: 'gps', nombre: 'GPS / Rutas' }
  ]);
  const [inventario, setInventario] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [formEntrega, setFormEntrega] = useState(crearFormularioEntrega);
  const [guardandoEntrega, setGuardandoEntrega] = useState(false);
  const [eficienciaAdmins, setEficienciaAdmins] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [chatMensajes, setChatMensajes] = useState([]);
  const [conversaciones, setConversaciones] = useState([]);
  const [solicitudesAsistenciaRemota, setSolicitudesAsistenciaRemota] = useState([]);
  const [errorAsistenciaRemotaDashboard, setErrorAsistenciaRemotaDashboard] = useState('');
  const [adminsChat, setAdminsChat] = useState([]);
  const [chatDestinatario, setChatDestinatario] = useState('');
  const [usuarioHelpdeskSeleccionado, setUsuarioHelpdeskSeleccionado] = useState('');
  const [chatError, setChatError] = useState('');
  const [seccionSoporte, setSeccionSoporte] = useState('mensajes');
  const [ticketEnEdicion, setTicketEnEdicion] = useState(null);
  const [areaAsignacion, setAreaAsignacion] = useState({});
  const [formSeguimientos, setFormSeguimientos] = useState({});
  const [mesCalendario, setMesCalendario] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [dialogo, setDialogo] = useState(null);

  const mostrarAviso = (mensaje, tipo = 'success') => setDialogo({ tipo, mensaje });
  const confirmarAccion = (mensaje, accion) => setDialogo({ tipo: 'confirm', mensaje, accion });

  useEffect(() => {
    if (!dialogo) return undefined;
    const cerrarConEscape = event => {
      if (event.key === 'Escape' && dialogo.tipo !== 'confirm') setDialogo(null);
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [dialogo]);

  // Estados de formularios
  const [formTicket, setFormTicket] = useState({
    tipo_solicitud: 'incidencia',
    titulo: '',
    descripcion: '',
    categoria: 'Hardware',
    departamento_destino_id: '',
    prioridad: 'media'
  });

  const [resolucionTextos, setResolucionTextos] = useState({});
  const [nuevoChat, setNuevoChat] = useState('');
  const [archivosChat, setArchivosChat] = useState([]);
  const [formUsuario, setFormUsuario] = useState({ id: null, nombre: '', email: '', password: '', rol: 'usuario_final', departamento_id: null, activo: true });
  const [formCategoria, setFormCategoria] = useState({ id: null, nombre: '' });
  const [formActivo, setFormActivo] = useState({ id: null, departamento_id: '', nombre: '', tipo: 'Impresora', cantidad: 1, ubicacion: '', notas: '' });
  const [formTarea, setFormTarea] = useState({ id: null, titulo: '', descripcion: '', asignado_a_id: '', fecha_limite: '', estado: 'pendiente' });
  const [formProyecto, setFormProyecto] = useState({ id: null, titulo: '', descripcion: '', estado: 'planificacion' });
  const [formEncuesta, setFormEncuesta] = useState({ ticket_id: '', calificacion: 5, comentario: '' });
  const [configuracionSistema, setConfiguracionSistema] = useState({ modo_mantenimiento: false, alertas_email: false });
  const [emailDestinatarios, setEmailDestinatarios] = useState('');
  const [estadoCorreo, setEstadoCorreo] = useState({ smtp_configurado: false, alertas_habilitadas: false, destinatarios: 0, hora_resumen: 8 });
  const [enviandoPruebaCorreo, setEnviandoPruebaCorreo] = useState(false);

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
    if (!currentUser) return undefined;
    let active = true;
    apiFetch(API_BASE_URL, '/api/tickets/categorias').then(res => res.json()).then(data => {
      if (active && data.success && data.data.length) setCategorias(data.data);
    }).catch(() => {});
    return () => { active = false; };
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sgti_user', JSON.stringify(currentUser));
      cargarDatosGlobales();
      if (currentUser.isAdmin) cargarDatosAdministrativos();
      else cargarDatosPlanificacion();
    } else {
      localStorage.removeItem('sgti_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || (activeTab !== 'chat' && !(currentUser.isAdmin && activeTab === 'dashboard'))) return undefined;

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
      apiFetch(API_BASE_URL, '/api/asistencia-remota').then(res => res.json()).then(data => {
        if (!data.success) throw new Error(data.message || 'No se pudo cargar la cola de asistencia remota.');
        setSolicitudesAsistenciaRemota(data.data);
        setErrorAsistenciaRemotaDashboard('');
      }).catch(error => setErrorAsistenciaRemotaDashboard(error.message || 'No se pudo cargar la cola de asistencia remota.'));
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
    const refresh = window.setInterval(() => {
      cargarDatosGlobales();
      cargarDatosPlanificacion();
    }, 10000);
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

  const cargarDatosPlanificacion = () => {
    apiFetch(API_BASE_URL, '/api/admin/tareas').then(res => res.json()).then(data => {
      if (data.success) setTareas(data.data);
    }).catch(() => {});
    cargarCalendario();
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
    if (currentUser?.rol === 'gerente_it') {
      apiFetch(API_BASE_URL, '/api/admin/configuraciones').then(res => res.json()).then(data => {
        if (data.success) {
          const stored = Object.fromEntries(data.data.map(item => [item.clave, item.valor]));
          setConfiguracionSistema({
            modo_mantenimiento: stored.modo_mantenimiento === 'true',
            alertas_email: stored.alertas_email === 'true'
          });
          setEmailDestinatarios(stored.alertas_destinatarios || '');
        }
      }).catch(() => {});
      apiFetch(API_BASE_URL, '/api/admin/configuraciones/correo/estado').then(res => res.json()).then(data => {
        if (data.success) setEstadoCorreo(data.data);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.rol !== 'admin_infra' || !['inventario', 'entregas'].includes(activeTab)) return undefined;
    apiFetch(API_BASE_URL, '/api/admin/infraestructura/inventario')
      .then(res => res.json()).then(data => { if (data.success) setInventario(data.data); }).catch(() => {});
    apiFetch(API_BASE_URL, '/api/admin/infraestructura/entregas')
      .then(res => res.json()).then(data => { if (data.success) setEntregas(data.data); }).catch(() => {});
    return undefined;
  }, [currentUser, activeTab]);

  const enviarConfiguracion = () => {
    apiFetch(API_BASE_URL, '/api/admin/configuraciones', {
      method: 'PUT',
      body: JSON.stringify({ ...configuracionSistema, alertas_destinatarios: emailDestinatarios })
    }).then(res => res.json()).then(data => {
      if (!data.success) throw new Error(data.message || 'No se guardó la configuración.');
      cargarDatosAdministrativos();
      mostrarAviso('Configuración guardada.');
    }).catch(error => mostrarAviso(error.message, 'error'));
  };

  const enviarCorreoPrueba = () => {
    setEnviandoPruebaCorreo(true);
    apiFetch(API_BASE_URL, '/api/admin/configuraciones/correo/prueba', {
      method: 'POST',
      body: JSON.stringify({})
    }).then(res => res.json()).then(data => {
      if (!data.success) throw new Error(data.message || 'No se pudo enviar el correo de prueba.');
      mostrarAviso(data.message);
    }).catch(error => mostrarAviso(error.message, 'error')).finally(() => setEnviandoPruebaCorreo(false));
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
    }).catch(error => mostrarAviso(error.message, 'error'));
  };

  const moverTicketPorArea = (ticket, departamentoId) => {
    moverTicketAdmin(ticket, ticket.estado, departamentoId, undefined, true);
  };

  const abrirDetalleTicket = ticket => {
    setTicketSeleccionado(ticket);
    setMensajesTicket([]);
    setImagenesTicket([]);
    setNuevoMensajeTicket('');
    apiFetch(API_BASE_URL, `/api/chat/${ticket.id}/mensajes`).then(res => res.json()).then(data => {
      if (Array.isArray(data)) setMensajesTicket(data);
    }).catch(() => {});
    apiFetch(API_BASE_URL, `/api/chat/${ticket.id}/imagenes`).then(res => res.json()).then(data => {
      if (data.success) setImagenesTicket(data.data);
    }).catch(() => {});
  };

  const enviarMensajeTicket = event => {
    event.preventDefault();
    if (!ticketSeleccionado || (!nuevoMensajeTicket.trim() && !archivosMensajeTicket.length)) return;
    const formData = new FormData();
    formData.append('mensaje', nuevoMensajeTicket.trim());
    archivosMensajeTicket.forEach(file => formData.append('imagenes', file));
    apiFetch(API_BASE_URL, `/api/chat/${ticketSeleccionado.id}/mensajes`, {
      method: 'POST',
      body: formData
    }).then(res => res.json()).then(data => {
      if (data.error) throw new Error(data.error);
      setNuevoMensajeTicket('');
      setArchivosMensajeTicket([]);
      return apiFetch(API_BASE_URL, `/api/chat/${ticketSeleccionado.id}/mensajes`).then(res => res.json());
    }).then(data => {
      if (Array.isArray(data)) setMensajesTicket(data);
    }).catch(error => mostrarAviso(error.message || 'No se pudo enviar el mensaje.', 'error'));
  };

  const crearPayloadChat = payload => {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => formData.append(key, String(value ?? '')));
    archivosChat.forEach(file => formData.append('imagenes', file));
    return formData;
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
    }).catch(error => mostrarAviso(error.message, 'error'));
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    setSeccionesAbiertas({ principal: true, tickets: true, administracion: true, planificacion: true, infraestructura: true, referencia: true });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sgti_user');
  };

  const irAMicrosoft = event => {
    event.preventDefault();
    setSidebarOpen(false);
    setActiveTab('solicitud_microsoft');
  };

  const guardarListaEntrega = event => {
    event.preventDefault();
    setGuardandoEntrega(true);
    apiFetch(API_BASE_URL, '/api/admin/infraestructura/entregas', {
      method: 'POST',
      body: JSON.stringify({
        ...formEntrega,
        departamento_id: Number(formEntrega.departamento_id),
        articulos: formEntrega.articulos.map(item => ({ ...item, cantidad: Number(item.cantidad) }))
      })
    }).then(res => res.json()).then(data => {
      if (!data.success) throw new Error(data.message || 'No se pudo guardar la entrega.');
      setEntregas(actual => [data.data, ...actual]);
      setFormEntrega(crearFormularioEntrega());
      mostrarAviso('Entrega guardada.');
    }).catch(error => mostrarAviso(error.message, 'error')).finally(() => setGuardandoEntrega(false));
  };

  const descargarReporteEntrega = entrega => {
    const archivo = new Blob([crearDocumentoEntrega(entrega)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `constancia-entrega-${entrega.id}.html`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const imprimirReporteEntrega = entrega => {
    const ventana = window.open('', '_blank');
    if (!ventana) {
      mostrarAviso('El navegador bloqueó la ventana de impresión.', 'error');
      return;
    }
    ventana.document.open();
    ventana.document.write(crearDocumentoEntrega(entrega));
    ventana.document.close();
    ventana.focus();
    ventana.print();
  };

  // Crear Ticket (Usuarios Básicos)
  const handleCrearTicket = (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.entries({
      ...formTicket,
      fecha_limite: new Date(Date.now() + 86400000 * 2).toISOString()
    }).forEach(([key, value]) => formData.append(key, value == null ? '' : String(value)));
    archivosTicket.forEach(file => formData.append('imagenes', file));
    apiFetch(API_BASE_URL, '/api/tickets', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.message || data.error || 'No se pudo crear el ticket.');
        cargarDatosGlobales();
        mostrarAviso(`Ticket clasificado como [${formTicket.tipo_solicitud.toUpperCase()}] creado con éxito.`);
        setArchivosTicket([]);
        setFormTicket({ tipo_solicitud: 'incidencia', titulo: '', descripcion: '', categoria: 'Hardware', departamento_destino_id: '', prioridad: 'media' });
        setActiveTab(currentUser.isAdmin ? 'todos_tickets' : 'mis_tickets');
      })
      .catch(error => mostrarAviso(error.message, 'error'));
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
        mostrarAviso('Ticket resuelto y archivado en el historial.');
      })
      .catch(error => mostrarAviso(error.message, 'error'));
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
      mostrarAviso('Escriba una actualización para el solicitante.', 'error');
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
      mostrarAviso(data.message);
    }).catch(error => mostrarAviso(error.message, 'error'));
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
    dashboard: 'Inicio', crear_ticket: 'Crear solicitud', todos_tickets: 'Bandeja de tickets', asignaciones: 'Asignación de tickets',
    historial: 'Historial', usuarios: 'Gestión de usuarios', usuarios_archivo: 'Archivo de usuarios', categorias: 'Gestión de categorías', calendario: 'Calendario', tareas: 'Tareas', proyectos: 'Proyectos',
    configuracion: 'Configuración', chat: 'Mensajes con IT', encuesta: 'Encuesta de satisfacción', apis: 'Referencia de API', mis_tickets: 'Mis solicitudes', inventario: 'Inventario por departamento', entregas: 'Entrega de artículos', empresa: 'Operación empresarial', solicitud_microsoft: 'Mi Microsoft'
  };
  const estilosGrupoNav = {
    principal: { fondo: 'bg-slate-50', titulo: 'text-slate-700', activo: 'border-slate-500 bg-slate-100 text-slate-900' },
    tickets: { fondo: 'bg-sky-50', titulo: 'text-sky-800', activo: 'border-sky-600 bg-sky-50 text-sky-900' },
    administracion: { fondo: 'bg-emerald-50', titulo: 'text-emerald-800', activo: 'border-emerald-600 bg-emerald-50 text-emerald-900' },
    planificacion: { fondo: 'bg-amber-50', titulo: 'text-amber-800', activo: 'border-amber-600 bg-amber-50 text-amber-900' },
    infraestructura: { fondo: 'bg-teal-50', titulo: 'text-teal-800', activo: 'border-teal-600 bg-teal-50 text-teal-900' },
    referencia: { fondo: 'bg-slate-50', titulo: 'text-slate-700', activo: 'border-slate-500 bg-slate-100 text-slate-900' },
    microsoft: { fondo: 'bg-violet-50', titulo: 'text-violet-800', activo: 'border-violet-600 bg-violet-50 text-violet-900' }
  };
  const claseNav = (tab, grupo) => `w-full flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 font-medium transition ${activeTab === tab ? estilosGrupoNav[grupo].activo : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;
  const tituloNav = (texto, grupo) => <div
    id={`nav-heading-${grupo}`}
    className={`sgti-nav-group sgti-nav-${grupo} mx-1 mb-1 flex w-[calc(100%-0.5rem)] items-center px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider ${estilosGrupoNav[grupo].titulo}`}
  >
    <span>{texto}</span>
  </div>;
  const ticketsAsignados = currentUser?.isAdmin
    ? tickets.filter(ticket => Number(ticket.asignado_a_id) === Number(currentUser.id))
    : [];
  const ticketsSinAsignar = currentUser?.rol === 'gerente_it'
    ? tickets.filter(ticket => !ticket.asignado_a_id)
    : [];
  const tareasAsignadas = currentUser?.isAdmin
    ? tareas.filter(tarea => Number(tarea.asignado_a_id) === Number(currentUser.id) && !['completada', 'cancelada'].includes(tarea.estado))
    : [];
  const ticketsPorUsuario = lista => {
    const grupos = new Map();
    lista.forEach(ticket => {
      const key = String(ticket.usuario_creador_id || ticket.creador_nombre || ticket.nombre_solicitante || 'sin-solicitante');
      if (!grupos.has(key)) {
        grupos.set(key, {
          key,
          nombre: ticket.creador_nombre || ticket.nombre_solicitante || 'Solicitante',
          tickets: []
        });
      }
      grupos.get(key).tickets.push(ticket);
    });
    return Array.from(grupos.values()).sort((a, b) => b.tickets.length - a.tickets.length || a.nombre.localeCompare(b.nombre, 'es'));
  };
  const mensajesPendientes = currentUser?.isAdmin
    ? conversaciones.reduce((total, conversacion) => total + Number(conversacion.pendientes || 0), 0)
    : 0;
  const usuariosHelpdeskMap = new Map();
  conversaciones.forEach(conversacion => usuariosHelpdeskMap.set(String(conversacion.usuario_id), {
    id: String(conversacion.usuario_id), nombre: conversacion.usuario_nombre, conversacion
  }));
  ticketsAsignados.forEach(ticket => {
    const id = String(ticket.usuario_creador_id);
    if (!usuariosHelpdeskMap.has(id)) usuariosHelpdeskMap.set(id, { id, nombre: ticket.creador_nombre || ticket.nombre_solicitante, conversacion: null });
  });
  const usuariosHelpdesk = Array.from(usuariosHelpdeskMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const usuarioHelpdeskActivo = usuariosHelpdesk.find(usuario => usuario.id === usuarioHelpdeskSeleccionado);
  const ticketsUsuarioHelpdesk = usuarioHelpdeskActivo
    ? ticketsAsignados.filter(ticket => String(ticket.usuario_creador_id) === usuarioHelpdeskActivo.id)
    : [];
  const ticketsEsperandoAtencion = ticketsAsignados.filter(ticket => ['nuevo', 'abierto'].includes(ticket.estado));
  const tareasPendientesUsuario = tareasAsignadas;
  const ticketsPorVencer = tickets.filter(ticket => ['vencido', 'por_vencer'].includes(ticket.semaforo_alerta));
  const tareasPorVencer = tareas.filter(tarea => {
    if (currentUser?.rol !== 'gerente_it' && Number(tarea.asignado_a_id) !== Number(currentUser?.id)) return false;
    if (['completada', 'cancelada'].includes(tarea.estado) || !tarea.fecha_limite) return false;
    const diasRestantes = (parseLocalDate(tarea.fecha_limite).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000;
    return diasRestantes <= 3;
  });
  const dashboardSecciones = [
    { id: 'esperando', titulo: 'Esperando atención', cantidad: ticketsEsperandoAtencion.length, tipo: 'tickets', datos: ticketsEsperandoAtencion },
    { id: 'asignados', titulo: 'Asignados a mí', cantidad: ticketsAsignados.length, tipo: 'tickets', datos: ticketsAsignados },
    { id: 'aprobados', titulo: 'Aprobados por Gerencia', cantidad: 0, tipo: 'pendiente' },
    { id: 'tareas', titulo: 'Mis tareas', cantidad: tareasPendientesUsuario.length, tipo: 'tareas', datos: tareasPendientesUsuario },
    ...(currentUser?.rol === 'gerente_it' ? [{ id: 'sin_asignar', titulo: 'Sin asignar', cantidad: ticketsSinAsignar.length, tipo: 'tickets', datos: ticketsSinAsignar }] : []),
    { id: 'colaboraciones', titulo: 'Colaboraciones', cantidad: 0, tipo: 'pendiente' }
  ];
  const seccionDashboardActiva = dashboardSecciones.find(seccion => seccion.id === dashboardBandeja) || dashboardSecciones[0];
  const accionesPendientes = [
    ...ticketsEsperandoAtencion.map(ticket => ({ tipo: 'ticket', id: ticket.id, titulo: ticket.titulo, detalle: `Ticket #${ticket.id} · ${ticket.creador_nombre || 'Solicitante'}` })),
    ...tareasPendientesUsuario.map(tarea => ({ tipo: 'tarea', id: tarea.id, titulo: tarea.titulo, detalle: `Tarea · ${tarea.fecha_limite || 'Sin fecha límite'}` })),
    ...conversaciones.filter(conversacion => Number(conversacion.pendientes) > 0).map(conversacion => ({
      tipo: 'mensaje',
      id: conversacion.usuario_id,
      titulo: `Mensaje nuevo de ${conversacion.usuario_nombre}`,
      detalle: conversacion.ultimo_mensaje || 'Conversación pendiente de revisar'
    }))
  ];
  const solicitudesRemotasPendientes = solicitudesAsistenciaRemota.filter(solicitud => solicitud.estado === 'pendiente');
  const solicitudesRemotasEnCurso = solicitudesAsistenciaRemota.filter(solicitud => solicitud.estado === 'atendiendo');
  const abrirBandejaAsistenciaRemota = () => {
    setSeccionSoporte('remota');
    setActiveTab('chat');
  };

  useEffect(() => {
    if (activeTab !== 'dashboard' || !currentUser?.isAdmin || usuarioHelpdeskSeleccionado || !usuariosHelpdesk.length) return;
    setUsuarioHelpdeskSeleccionado(usuariosHelpdesk[0].id);
    setChatDestinatario(usuariosHelpdesk[0].id);
  }, [activeTab, currentUser, usuarioHelpdeskSeleccionado, usuariosHelpdesk]);

  if (!currentUser) {
    return <Login onLogin={handleLoginSuccess} apiBaseUrl={API_BASE_URL} />;
  }

  return (
    <div className={`sgti-app min-h-screen bg-slate-50 flex font-sans text-slate-800 ${modoOscuro ? 'sgti-dark' : ''}`}>
      
      {/* BARRA LATERAL DINÁMICA */}
      <aside id="sgti-sidebar" className={`fixed inset-y-0 left-0 z-50 w-64 bg-white text-slate-600 border-r border-slate-200 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col`}>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">SGTI</h2>
            <p className="text-xs text-blue-700 font-semibold">{currentUser.area}</p>
          </div>
          <div className="flex items-center gap-2">
            {currentUser.isAdmin && <button
              type="button"
              onClick={() => { setActiveTab('apis'); setSidebarOpen(false); }}
              className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${activeTab === 'apis' ? 'border-blue-700 bg-blue-700 text-white' : 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'}`}
            >
              Referencia de API
            </button>}
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-slate-900">✕</button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto text-sm">
          <section className="sgti-nav-card mb-3 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {tituloNav('Principal', 'principal')}
            <div id="nav-section-principal" aria-labelledby="nav-heading-principal">
            <button
              onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
              className={claseNav('dashboard', 'principal')}
            >
              Dashboard
            </button>
            <button
              onClick={() => { setActiveTab('chat'); setSidebarOpen(false); }}
              className={claseNav('chat', 'principal')}
            >
              Mensajes con IT{mensajesPendientes > 0 && <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{mensajesPendientes}</span>}
            </button>
            </div>
          </section>

          <section className="sgti-nav-card mb-3 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {tituloNav('Atención de tickets', 'tickets')}
            <div id="nav-section-tickets" aria-labelledby="nav-heading-tickets">
            {currentUser.isAdmin ? (
              <>
              <button
                onClick={() => { setActiveTab('crear_ticket'); setSidebarOpen(false); }}
                className={claseNav('crear_ticket', 'tickets')}
              >
                Crear ticket
              </button>
              <button 
                onClick={() => { setActiveTab('todos_tickets'); setSidebarOpen(false); }}
                className={claseNav('todos_tickets', 'tickets')}
              >
                Bandeja de tickets ({tickets.length}){ticketsAsignados.length > 0 && <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-900">{ticketsAsignados.length}</span>}
              </button>
                    {currentUser.rol === 'gerente_it' && <button
                onClick={() => { setActiveTab('asignaciones'); setSidebarOpen(false); }}
                className={claseNav('asignaciones', 'tickets')}
              >
                Asignación de tickets
              </button>}
              <button 
                onClick={() => { setActiveTab('historial'); setSidebarOpen(false); }}
                className={claseNav('historial', 'tickets')}
              >
                Historial de tickets
              </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setActiveTab('crear_ticket'); setSidebarOpen(false); }}
                  className={claseNav('crear_ticket', 'tickets')}
                >
                  Crear ticket
                </button>
                <button
                  onClick={() => { setActiveTab('mis_tickets'); setSidebarOpen(false); }}
                  className={claseNav('mis_tickets', 'tickets')}
                >
                  Mis solicitudes
                </button>
                <button
                  onClick={() => { setActiveTab('encuesta'); setSidebarOpen(false); }}
                  className={claseNav('encuesta', 'tickets')}
                >
                  Encuesta de satisfacción
                </button>
              </>
            )}
            </div>
          </section>

          {currentUser.rol === 'gerente_it' && <section className="sgti-nav-card mb-3 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {tituloNav('Administración', 'administracion')}
            <div id="nav-section-administracion" aria-labelledby="nav-heading-administracion">
              <button
                onClick={() => { setActiveTab('usuarios'); setSidebarOpen(false); }}
                className={claseNav('usuarios', 'administracion')}
              >
                Gestión de usuarios
              </button>
              <button
                onClick={() => { setActiveTab('usuarios_archivo'); setSidebarOpen(false); }}
                className={claseNav('usuarios_archivo', 'administracion')}
              >
                Archivo de usuarios
              </button>
              <button
                onClick={() => { setActiveTab('categorias'); setSidebarOpen(false); }}
                className={claseNav('categorias', 'administracion')}
              >
                Gestión de categorías
              </button>
              <button
                onClick={() => { setActiveTab('configuracion'); setSidebarOpen(false); }}
                className={claseNav('configuracion', 'administracion')}
              >Configuración</button>
              <button onClick={() => { setActiveTab('empresa'); setSidebarOpen(false); }} className={claseNav('empresa', 'administracion')}>SLA, auditoría y archivos</button>
            </div>
          </section>}

          <section className="sgti-nav-card mb-3 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {tituloNav('Planificación', 'planificacion')}
            <div id="nav-section-planificacion" aria-labelledby="nav-heading-planificacion">
              <button 
                onClick={() => { setActiveTab('calendario'); setSidebarOpen(false); }}
                className={claseNav('calendario', 'planificacion')}
              >
                Calendario
              </button>
              <button 
                onClick={() => { setActiveTab('tareas'); setSidebarOpen(false); }}
                className={claseNav('tareas', 'planificacion')}
              >
                Tareas
              </button>
              {currentUser.isAdmin && <button
                onClick={() => { setActiveTab('proyectos'); setSidebarOpen(false); }}
                className={claseNav('proyectos', 'planificacion')}
              >Proyectos de IT</button>}
            </div>
          </section>

          {currentUser.rol === 'admin_infra' && <section className="sgti-nav-card mb-3 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {tituloNav('Infraestructura', 'infraestructura')}
            <div id="nav-section-infraestructura" aria-labelledby="nav-heading-infraestructura">
              <button
                onClick={() => { setActiveTab('inventario'); setSidebarOpen(false); }}
                className={claseNav('inventario', 'infraestructura')}
              >Inventario por departamento</button>
              <button
                onClick={() => { setActiveTab('entregas'); setSidebarOpen(false); }}
                className={claseNav('entregas', 'infraestructura')}
              >Entrega de artículos</button>
              <button onClick={() => { setActiveTab('empresa'); setSidebarOpen(false); }} className={claseNav('empresa', 'infraestructura')}>Activos y ciclo de vida</button>
            </div>
          </section>}

        </nav>

        <div className="p-4 border-t border-slate-100 bg-white">
          <div className="text-xs text-slate-400">Usuario Conectado:</div>
          <div className="font-bold text-slate-800 truncate text-xs mb-2">{currentUser.email}</div>
          <button 
            onClick={handleLogout}
            className="w-full bg-white hover:bg-red-50 text-red-700 border border-slate-200 hover:border-red-200 text-xs font-semibold py-2 rounded-md transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex min-w-0 flex-1 flex-col md:ml-64">
        <header className="bg-white border-b border-slate-200 min-h-16 flex items-center gap-3 px-4 sm:px-6 py-3 sticky top-0 z-40">
          <button
            type="button"
            aria-label="Alternar menú de navegación"
            aria-controls="sgti-sidebar"
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded text-xl text-slate-700 hover:bg-slate-100 md:hidden"
          >
            <span className="md:hidden" aria-hidden="true">{sidebarOpen ? '←' : '→'}</span>
          </button>
          <div className="min-w-0 flex-1 text-sm font-bold text-slate-700">{etiquetasSeccion[activeTab] || 'Inicio'}</div>
          {(activeTab === 'todos_tickets' || activeTab === 'mis_tickets' || activeTab === 'historial' || activeTab === 'asignaciones') && <input type="search" aria-label="Buscar tickets" placeholder="Buscar ticket..." value={busqueda} onChange={event => setBusqueda(event.target.value)} className="hidden w-64 px-3 py-2 border border-slate-300 rounded text-sm lg:block" />}
          {!currentUser.isAdmin && <button type="button" onClick={irAMicrosoft} className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition ${activeTab === 'solicitud_microsoft' ? 'border-violet-700 bg-violet-700 text-white' : 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'}`}>Mi Microsoft</button>}
          <div className="hidden shrink-0 text-xs bg-slate-100 px-3 py-1 rounded-full font-semibold border sm:block">{currentUser.area}</div>
          <button type="button" onClick={() => setModoOscuro(value => !value)} className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100" aria-label="Cambiar modo de color">
            {modoOscuro ? '☀️ Claro' : '🌙 Oscuro'}
          </button>
        </header>

        <main className={`p-6 flex-1 w-full mx-auto space-y-6 ${currentUser.isAdmin ? 'max-w-screen-2xl' : sidebarCollapsed ? 'max-w-7xl' : 'max-w-5xl'}`}>
          
          {/* DASHBOARD GENERAL */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              <div className="bg-white p-5 sm:p-6 rounded-lg border border-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">ESPACIO DE TRABAJO · SGTI</p>
                    <h1 className="mt-1 text-2xl font-bold text-slate-900">Hola, {currentUser.nombre || currentUser.email}</h1>
                    <p className="mt-1 text-sm text-slate-500">Resumen de solicitudes y atención de IT.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setActiveTab('crear_ticket')} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Crear solicitud</button>
                    <button onClick={() => setActiveTab(currentUser.isAdmin ? 'todos_tickets' : 'chat')} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{currentUser.isAdmin ? 'Ver tickets' : 'Mensajes con IT'}</button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white px-4 py-3 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Tickets activos</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{tickets.length}</div>
                </div>
                <div className="bg-white px-4 py-3 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Tickets vencidos</div>
                  <div className="text-2xl font-bold text-red-700 mt-1">
                    {tickets.filter(t => t.semaforo_alerta === 'vencido').length}
                  </div>
                </div>
                <div className="bg-white px-4 py-3 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Solicitudes resueltas</div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">{currentUser.isAdmin ? historial.length : ticketsResueltos.length}</div>
                </div>
              </div>
              {currentUser.isAdmin ? (
                <>
                <section className="space-y-4">
                  <section className={`overflow-hidden rounded-lg border ${solicitudesRemotasPendientes.length ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-bold text-slate-900">Asistencia remota · AnyDesk</h2>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${solicitudesRemotasPendientes.length ? 'bg-amber-200 text-amber-950' : 'bg-slate-100 text-slate-700'}`}>
                            {solicitudesRemotasPendientes.length} pendiente{solicitudesRemotasPendientes.length === 1 ? '' : 's'}
                          </span>
                          {solicitudesRemotasEnCurso.length > 0 && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-900">
                            {solicitudesRemotasEnCurso.length} en atención
                          </span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {solicitudesRemotasPendientes.length
                            ? 'Hay solicitudes que esperan a que un administrador las atienda.'
                            : 'Se actualizará automáticamente cuando llegue una nueva solicitud.'}
                        </p>
                      </div>
                      <button type="button" onClick={abrirBandejaAsistenciaRemota} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                        Abrir cola de asistencia
                      </button>
                    </div>
                    {errorAsistenciaRemotaDashboard && <p role="alert" className="border-t border-amber-200 bg-amber-100 px-4 py-2 text-xs text-amber-950">{errorAsistenciaRemotaDashboard}</p>}
                    {!!solicitudesAsistenciaRemota.length && <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-3">
                      {solicitudesAsistenciaRemota.map(solicitud => {
                        const pendiente = solicitud.estado === 'pendiente';
                        return <button
                          key={solicitud.id}
                          type="button"
                          onClick={abrirBandejaAsistenciaRemota}
                          className={`rounded-lg border-l-4 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${pendiente ? 'border-amber-500 border-y border-r border-y-amber-200 border-r-amber-200 hover:border-y-amber-400 hover:border-r-amber-400' : 'border-blue-500 border-y border-r border-y-blue-200 border-r-blue-200 hover:border-y-blue-400 hover:border-r-blue-400'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Solicitante · #{solicitud.id}</span>
                              <strong className="mt-1 block truncate text-base text-slate-900">{solicitud.solicitante_nombre}</strong>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${pendiente ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}>
                              {pendiente ? 'Pendiente' : 'En atención'}
                            </span>
                          </div>
                          <span className="mt-2 block truncate text-xs text-slate-500">{solicitud.solicitante_email}</span>
                          <span className="mt-3 block rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            AnyDesk <strong className="text-slate-900">{solicitud.anydesk_id}</strong>
                          </span>
                          {solicitud.descripcion
                            ? <span className="mt-3 block line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-slate-700">{solicitud.descripcion}</span>
                            : <span className="mt-3 block min-h-[3.75rem] text-sm italic text-slate-400">Sin descripción adicional.</span>}
                          <span className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                            <span>Solicitó: {new Date(solicitud.creada_en).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            {solicitud.atendido_por_nombre && <span>Atiende: {solicitud.atendido_por_nombre}</span>}
                          </span>
                          <span className="mt-3 block text-xs font-bold text-blue-700">Ver y atender solicitud →</span>
                        </button>;
                      })}
                    </div>}
                  </section>
                  <div className="flex flex-wrap gap-2" aria-label="Bandejas del administrador">
                    {dashboardSecciones.map(seccion => <button key={seccion.id} type="button" aria-pressed={dashboardBandeja === seccion.id} onClick={() => setDashboardBandeja(seccion.id)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${dashboardBandeja === seccion.id ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}>
                      {seccion.titulo} <span className={`ml-1 rounded-full px-1.5 py-0.5 ${dashboardBandeja === seccion.id ? 'bg-white/20' : 'bg-slate-100'}`}>{seccion.cantidad}</span>
                    </button>)}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-4 py-3">
                        <h2 className="font-bold text-slate-900">{seccionDashboardActiva.titulo}</h2>
                        <p className="mt-1 text-xs text-slate-500">Vista personal de la carga de trabajo y solicitudes pendientes.</p>
                      </div>
                      {seccionDashboardActiva.tipo === 'tickets' && <div className="divide-y divide-slate-100">
                        {seccionDashboardActiva.datos.map(ticket => <button key={ticket.id} onClick={() => abrirDetalleTicket(ticket)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                          <span className="min-w-0"><span className="block text-xs text-slate-500">#{ticket.id} · {ticket.creador_nombre || 'Solicitante'} · {ticket.departamento_nombre || 'Sin área'}</span><strong className="block truncate text-sm text-slate-800">{ticket.titulo}</strong></span>
                          <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{etiquetaEstadoTicket(ticket.estado)}</span>
                        </button>)}
                        {!seccionDashboardActiva.datos.length && <p className="px-4 py-8 text-center text-sm text-slate-500">No hay tickets en esta bandeja.</p>}
                      </div>}
                      {seccionDashboardActiva.tipo === 'tareas' && <div className="divide-y divide-slate-100">
                        {seccionDashboardActiva.datos.map(tarea => <button key={tarea.id} onClick={() => setActiveTab('tareas')} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                          <span className="min-w-0"><strong className="block truncate text-sm text-slate-800">{tarea.titulo}</strong><span className="text-xs text-slate-500">{tarea.ticket_titulo ? `Ticket: ${tarea.ticket_titulo} · ` : ''}Vence: {tarea.fecha_limite || 'Sin fecha límite'}</span></span>
                          <span className="shrink-0 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">{tarea.estado}</span>
                        </button>)}
                        {!seccionDashboardActiva.datos.length && <p className="px-4 py-8 text-center text-sm text-slate-500">No tiene tareas pendientes.</p>}
                      </div>}
                      {seccionDashboardActiva.tipo === 'pendiente' && <p className="px-4 py-8 text-sm leading-6 text-slate-600">
                        {seccionDashboardActiva.id === 'aprobados'
                          ? 'El flujo de aprobación por Gerencia aún no está configurado. Esta bandeja queda identificada para cuando se habilite.'
                          : 'El flujo de colaboraciones entre áreas aún no está configurado. Esta bandeja queda identificada para cuando se habilite.'}
                      </p>}
                    </section>
                    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-4 py-3">
                        <h2 className="font-bold text-slate-900">Acciones pendientes</h2>
                        <p className="mt-1 text-xs text-slate-500">{accionesPendientes.length} elementos requieren atención.</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {accionesPendientes.slice(0, 8).map(accion => <button key={`${accion.tipo}-${accion.id}`} onClick={() => {
                          if (accion.tipo === 'ticket') setActiveTab('todos_tickets');
                          else if (accion.tipo === 'mensaje') {
                            setChatDestinatario(String(accion.id));
                            setActiveTab('chat');
                          } else setActiveTab('tareas');
                        }} className="block w-full px-4 py-3 text-left hover:bg-slate-50">
                          <strong className="block truncate text-sm text-slate-800">{accion.titulo}</strong><span className="text-xs text-slate-500">{accion.detalle}</span>
                        </button>)}
                        {!accionesPendientes.length && <p className="px-4 py-8 text-center text-sm text-slate-500">No tiene acciones pendientes.</p>}
                      </div>
                    </section>
                  </div>
                </section>
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="font-bold text-slate-900">Próximos vencimientos</h2>
                    <p className="mt-1 text-xs text-slate-500">Tickets por vencer o vencidos y tareas con fecha límite en los próximos tres días.</p>
                  </div>
                  <div className="grid gap-4 p-4 md:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Tickets ({ticketsPorVencer.length})</h3>
                      <div className="divide-y rounded-lg border border-slate-200">
                        {ticketsPorVencer.slice(0, 8).map(ticket => <button key={ticket.id} onClick={() => abrirDetalleTicket(ticket)} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                          <strong className="block truncate text-sm">{ticket.titulo}</strong><span className={`text-xs ${ticket.semaforo_alerta === 'vencido' ? 'font-semibold text-red-700' : 'text-amber-700'}`}>#{ticket.id} · {ticket.semaforo_alerta === 'vencido' ? 'Vencido' : 'Por vencer'}</span>
                        </button>)}
                        {!ticketsPorVencer.length && <p className="px-3 py-5 text-center text-xs text-slate-500">Sin tickets próximos a vencer.</p>}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Tareas ({tareasPorVencer.length})</h3>
                      <div className="divide-y rounded-lg border border-slate-200">
                        {tareasPorVencer.slice(0, 8).map(tarea => <button key={tarea.id} onClick={() => setActiveTab('tareas')} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                          <strong className="block truncate text-sm">{tarea.titulo}</strong><span className={`text-xs ${esFechaAnteriorAHoy(tarea.fecha_limite) ? 'font-semibold text-red-700' : 'text-amber-700'}`}>{esFechaAnteriorAHoy(tarea.fecha_limite) ? 'Vencida' : 'Vence'}: {tarea.fecha_limite}</span>
                        </button>)}
                        {!tareasPorVencer.length && <p className="px-3 py-5 text-center text-xs text-slate-500">Sin tareas próximas a vencer.</p>}
                      </div>
                    </div>
                  </div>
                </section>
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label="Bandeja de atención por usuario">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="font-bold text-slate-900">Bandeja de atención</h2>
                      <p className="mt-1 text-xs text-slate-500">Conversaciones y tickets asignados a usted, agrupados por solicitante.</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{usuariosHelpdesk.length} usuarios</span>
                  </div>
                  <div className="grid min-h-[360px] md:grid-cols-[240px_minmax(0,1fr)]">
                    <div className="border-b border-slate-200 md:max-h-[680px] md:overflow-y-auto md:border-b-0 md:border-r">
                      {usuariosHelpdesk.map(usuario => {
                        const mensajesNuevos = Number(usuario.conversacion?.pendientes || 0);
                        const cuentaTickets = ticketsAsignados.filter(ticket => String(ticket.usuario_creador_id) === usuario.id).length;
                        return <button key={usuario.id} onClick={() => {
                          setUsuarioHelpdeskSeleccionado(usuario.id);
                          setChatDestinatario(usuario.id);
                          setArchivosChat([]);
                        }} className={`w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${usuarioHelpdeskSeleccionado === usuario.id ? 'border-l-4 border-l-blue-700 bg-blue-50' : 'border-l-4 border-l-transparent'}`}>
                          <span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
                            <span className="truncate">{usuario.nombre}</span>
                            {mensajesNuevos > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] text-white">{mensajesNuevos}</span>}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">{cuentaTickets} tickets asignados</span>
                          {usuario.conversacion?.ultimo_mensaje && <span className="mt-1 block truncate text-xs text-slate-500">{usuario.conversacion.ultimo_mensaje}</span>}
                        </button>;
                      })}
                      {!usuariosHelpdesk.length && <p className="px-4 py-8 text-center text-sm text-slate-500">No hay usuarios con tickets asignados ni conversaciones.</p>}
                    </div>
                    <div className="min-w-0 p-4 sm:p-5">
                      {usuarioHelpdeskActivo ? <div className="grid gap-5 lg:grid-cols-2">
                        <section className="min-w-0 lg:order-2">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div><h3 className="font-bold text-slate-900">{usuarioHelpdeskActivo.nombre}</h3><p className="text-xs text-slate-500">Conversación con el usuario</p></div>
                            <span className="text-xs text-slate-500">{chatMensajes.length} mensajes</span>
                          </div>
                          <div className="flex h-64 flex-col gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3" aria-live="polite">
                            {chatMensajes.map(mensaje => <div key={mensaje.id} className={`max-w-[90%] rounded-lg border p-3 text-sm ${Number(mensaje.remitente_id) === Number(currentUser.id) ? 'ml-auto border-blue-100 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                              <div className="mb-1 text-[11px] font-semibold text-slate-500">{mensaje.remitente_nombre || 'Usuario'} · {new Date(mensaje.created_at).toLocaleString()}</div>
                              <p className="whitespace-pre-wrap break-words text-slate-700">{mensaje.mensaje}</p>
                              <EvidenceGallery images={mensaje.imagenes || []} imagePathPrefix="/api/chat/imagenes/" />
                            </div>)}
                            {!chatMensajes.length && <p className="m-auto text-sm text-slate-500">Inicie la conversación con {usuarioHelpdeskActivo.nombre}.</p>}
                          </div>
                          <form onSubmit={event => {
                            event.preventDefault();
                            if (!nuevoChat.trim() && !archivosChat.length) return;
                            apiFetch(API_BASE_URL, '/api/chat/directo', { method: 'POST', body: crearPayloadChat({ usuario_id: Number(usuarioHelpdeskActivo.id), mensaje: nuevoChat.trim() }) })
                              .then(res => res.json()).then(data => {
                                if (!data.success) throw new Error(data.message || data.error || 'No se pudo enviar el mensaje.');
                                setNuevoChat('');
                                setArchivosChat([]);
                                return apiFetch(API_BASE_URL, `/api/chat/directo?usuario_id=${encodeURIComponent(usuarioHelpdeskActivo.id)}`).then(res => res.json());
                              }).then(data => { if (data?.success) setChatMensajes(data.data); }).catch(error => setChatError(error.message));
                          }} className="mt-2 space-y-2">
                            <div className="flex gap-2">
                              <input aria-label="Mensaje para el usuario" value={nuevoChat} onChange={event => setNuevoChat(event.target.value)} placeholder="Escriba una respuesta..." className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                              <button disabled={!nuevoChat.trim() && !archivosChat.length} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300">Enviar</button>
                            </div>
                            <EvidencePicker files={archivosChat} onChange={setArchivosChat} />
                          </form>
                          {chatError && <p role="alert" className="mt-2 text-xs text-red-700">{chatError}</p>}
                        </section>
                        <section className="min-w-0 lg:order-1">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div><h3 className="font-bold text-slate-900">Tickets del usuario</h3><p className="text-xs text-slate-500">Solicitudes asignadas a su cuenta</p></div>
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{ticketsUsuarioHelpdesk.length} activos</span>
                          </div>
                          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                            {ticketsUsuarioHelpdesk.map(ticket => <button key={ticket.id} onClick={() => abrirDetalleTicket(ticket)} className="block w-full p-3 text-left hover:bg-slate-50">
                              <span className="flex items-start justify-between gap-2"><strong className="text-sm text-slate-800">{ticket.titulo}</strong><span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{etiquetaEstadoTicket(ticket.estado)}</span></span>
                              <span className="mt-1 block text-xs text-slate-500">#{ticket.id} · {ticket.categoria || 'Sin categoría'} · {ticket.prioridad || 'Prioridad media'}</span>
                            </button>)}
                            {!ticketsUsuarioHelpdesk.length && <p className="px-3 py-8 text-center text-sm text-slate-500">No tiene tickets activos asignados a usted.</p>}
                          </div>
                        </section>
                      </div> : <div className="flex h-full min-h-72 items-center justify-center text-center text-sm text-slate-500">Seleccione un usuario para ver su conversación y sus tickets.</div>}
                    </div>
                  </div>
                </section>
                </>
              ) : (
                <section>
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Mis solicitudes</h2><p className="mt-1 text-xs text-slate-500">Consulte el estado de sus solicitudes recientes.</p></div><button onClick={() => setActiveTab('mis_tickets')} className="text-xs font-semibold text-blue-700 hover:underline">Ver todas</button></div>
                    <div className="divide-y divide-slate-200">
                      {misTickets.slice(0, 4).map(ticket => <button key={ticket.id} onClick={() => abrirDetalleTicket(ticket)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                        <span className="min-w-0"><strong className="block truncate text-sm text-slate-800">{ticket.titulo}</strong><span className="text-xs text-slate-500">#{ticket.id} · {ticket.departamento_destino_nombre || 'En atención'}</span></span>
                        <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{etiquetaEstadoTicket(ticket.estado)}</span>
                      </button>)}
                      {!misTickets.length && <p className="py-8 text-center text-sm text-slate-500">Aún no tiene solicitudes. Cree una para comenzar.</p>}
                    </div>
                  </div>
                </section>
              )}
              {currentUser.isAdmin && (
                <details className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <summary className="cursor-pointer px-5 py-4 font-bold text-slate-900">Métricas de resolución por responsable <span className="ml-2 text-xs font-normal text-slate-500">Seguimiento histórico, no un ranking</span></summary>
                  <section className="space-y-3 border-t border-slate-200 p-5">
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
                </details>
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
                      {categorias.map(categoria => <option key={categoria.id} value={categoria.nombre}>{categoria.nombre}</option>)}
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

                <EvidencePicker files={archivosTicket} onChange={setArchivosTicket} />
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
              <div>
                <h2 className="text-xl font-bold text-slate-900">Tickets de todos</h2>
                <p className="mt-1 text-sm text-slate-500">Agrupados por solicitante para consultar rápidamente su carga de tickets activos.</p>
              </div>
              <div className="space-y-3">
                {ticketsPorUsuario(filtrarTickets(tickets)).map(grupo => <details key={grupo.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                    <span><strong className="text-sm text-slate-900">{grupo.nombre}</strong><span className="ml-2 text-xs text-slate-500">Solicitante</span></span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{grupo.tickets.length} {grupo.tickets.length === 1 ? 'ticket activo' : 'tickets activos'}</span>
                  </summary>
                  <div className="divide-y border-t border-slate-200">
                    {grupo.tickets.map(ticket => <article key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <button onClick={() => abrirDetalleTicket(ticket)} className="min-w-0 text-left">
                        <span className="block text-xs text-slate-500">#{ticket.id} · {etiquetaTipoTicket(ticket.tipo_solicitud)}</span>
                        <strong className="block truncate text-sm text-slate-900">{ticket.titulo}</strong>
                        <span className="mt-1 block text-xs text-slate-500">{ticket.departamento_nombre || 'Sin área'} · {ticket.semaforo_alerta === 'vencido' ? 'Vencido' : ticket.fecha_limite ? parseLocalDate(ticket.fecha_limite).toLocaleDateString() : 'Sin fecha límite'}</span>
                      </button>
                      <div className="flex items-center gap-3">
                        <select aria-label={`Estado del ticket ${ticket.id}`} value={ticket.estado} onChange={event => moverTicketAdmin(ticket, event.target.value, currentUser.rol === 'gerente_it' ? ticket.departamento_destino_id : null)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs">
                          <option value="nuevo">Nuevo</option><option value="abierto">Abierto</option><option value="en_proceso">En proceso</option>
                        </select>
                        <button onClick={() => abrirDetalleTicket(ticket)} className="whitespace-nowrap text-xs font-semibold text-blue-700 hover:underline">Ver detalle</button>
                      </div>
                    </article>)}
                  </div>
                </details>)}
                {!filtrarTickets(tickets).length && <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">No hay tickets que coincidan con la búsqueda.</p>}
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
              <p className="text-sm text-slate-500">Los tickets resueltos se agrupan por solicitante para localizar antes los antecedentes de cada usuario.</p>
              <div className="space-y-3">
                {ticketsPorUsuario(filtrarTickets(historial)).map(grupo => <details key={grupo.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                    <span className="font-semibold text-slate-900">{grupo.nombre}</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{grupo.tickets.length} {grupo.tickets.length === 1 ? 'ticket resuelto' : 'tickets resueltos'}</span>
                  </summary>
                  <div className="divide-y border-t border-slate-200">
                    {grupo.tickets.map(ticket => <article key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <span className="block text-xs text-slate-500">#{ticket.id} · {ticket.departamento_destino_nombre || 'Sin área'} · {formatLocalDateTime(ticket.fecha_resolucion)}</span>
                        <strong className="block truncate text-sm text-slate-900">{ticket.titulo}</strong>
                        {ticket.detalles_resolucion && <p className="mt-1 max-w-3xl truncate text-xs text-slate-600">{String(ticket.detalles_resolucion).replace(/^Resolución: /, '')}</p>}
                      </div>
                      <button onClick={() => abrirDetalleTicket(ticket)} className="whitespace-nowrap text-xs font-semibold text-blue-700 hover:underline">Ver ticket</button>
                    </article>)}
                  </div>
                </details>)}
                {!filtrarTickets(historial).length && <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">El historial está vacío o no coincide con la búsqueda.</p>}
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
                  }).catch(error => mostrarAviso(error.message, 'error'));
              }} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b pb-5">
                <input aria-label="Nombre" placeholder="Nombre completo" required value={formUsuario.nombre} onChange={e => setFormUsuario({ ...formUsuario, nombre: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <input aria-label="Correo" type="email" placeholder="Correo" required value={formUsuario.email} onChange={e => setFormUsuario({ ...formUsuario, email: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                {!formUsuario.id && <input aria-label="Contraseña" type="password" minLength="8" placeholder="Contraseña inicial (8 caracteres mínimo)" required value={formUsuario.password} onChange={e => setFormUsuario({ ...formUsuario, password: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />}
                <label className="block space-y-1 text-xs font-semibold text-slate-600">
                  <span>Rol de la cuenta</span>
                  <select aria-label="Rol del usuario" value={formUsuario.rol} onChange={e => {
                    const rol = e.target.value;
                    const areaEsperada = departamentoPorRol[rol];
                    const departamento = areaEsperada && departamentos.find(item => normalizarNombre(item.nombre) === normalizarNombre(areaEsperada));
                    setFormUsuario({ ...formUsuario, rol, departamento_id: departamento?.id || null });
                  }} className="w-full px-3 py-2 border rounded-lg text-sm bg-white font-normal text-slate-800">
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
                  {departamentoPorRol[formUsuario.rol] && !departamentos.find(item => normalizarNombre(item.nombre) === normalizarNombre(departamentoPorRol[formUsuario.rol])) && <span role="alert" className="block text-xs font-normal text-amber-700">No se encontró el área correspondiente al rol en el catálogo.</span>}
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
                    {usuario.activo && <button onClick={() => confirmarAccion(`¿Desactivar la cuenta de ${usuario.nombre}?`, () => {
                      apiFetch(API_BASE_URL, `/api/admin/usuarios/${usuario.id}/desactivar`, { method: 'PATCH' }).then(res => res.json()).then(data => {
                        if (!data.success) throw new Error(data.message || 'No se pudo desactivar el usuario.');
                        cargarDatosAdministrativos();
                        mostrarAviso('Usuario desactivado.');
                      }).catch(error => mostrarAviso(error.message, 'error'));
                    })} className="border border-amber-200 text-amber-800 px-3 py-1.5 rounded text-xs">Desactivar</button>}
                    <button onClick={() => confirmarAccion(`¿Eliminar permanentemente a ${usuario.nombre}? Su perfil e historial relacionado se archivarán en Archivo de usuarios; las contraseñas no se conservan.`, () => {
                      apiFetch(API_BASE_URL, `/api/admin/usuarios/${usuario.id}`, { method: 'DELETE' }).then(res => res.json()).then(data => {
                        if (!data.success) throw new Error(data.message || 'No se pudo eliminar el usuario.');
                        cargarDatosAdministrativos();
                        mostrarAviso('Usuario eliminado. Su perfil e historial están disponibles en Archivo de usuarios.');
                      }).catch(error => mostrarAviso(error.message, 'error'));
                    })} className="border border-red-200 text-red-700 px-3 py-1.5 rounded text-xs">Eliminar</button>
                  </div>
                </div>)}
              </div>
            </div>
          )}

          {activeTab === 'usuarios_archivo' && currentUser.rol === 'gerente_it' && <ArchivedUsers />}

          {/* CALENDARIO INTERACTIVO */}
          {activeTab === 'calendario' && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">{currentUser.isAdmin ? 'Calendario IT' : 'Mi calendario'}</h2>
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
          {activeTab === 'tareas' && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">{currentUser.isAdmin ? 'Organización de Tareas Internas' : 'Mis tareas'}</h2>
              <form onSubmit={event => {
                event.preventDefault();
                apiFetch(API_BASE_URL, '/api/admin/tareas', { method: 'POST', body: JSON.stringify(formTarea) }).then(res => res.json()).then(data => {
                  if (!data.success) throw new Error(data.message || 'No se pudo guardar la tarea.');
                  setFormTarea({ id: null, titulo: '', descripcion: '', asignado_a_id: currentUser.id, fecha_limite: '', estado: 'pendiente' });
                  if (currentUser.isAdmin) cargarDatosAdministrativos();
                  else cargarDatosPlanificacion();
                }).catch(error => mostrarAviso(error.message, 'error'));
              }} className="grid sm:grid-cols-2 gap-3 border-b pb-5">
                <input placeholder="Título de tarea" required value={formTarea.titulo} onChange={e => setFormTarea({ ...formTarea, titulo: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <input type="date" required value={formTarea.fecha_limite} onChange={e => setFormTarea({ ...formTarea, fecha_limite: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <input placeholder="Descripción" value={formTarea.descripcion} onChange={e => setFormTarea({ ...formTarea, descripcion: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                {currentUser.isAdmin && <label className="text-xs font-semibold text-slate-600">Responsable
                  <select required value={formTarea.asignado_a_id || currentUser.id} onChange={e => setFormTarea({ ...formTarea, asignado_a_id: Number(e.target.value) })} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white text-sm font-normal text-slate-800">
                    {currentUser.rol !== 'gerente_it' && <option value={currentUser.id}>{currentUser.nombre}</option>}
                    {usuarios.filter(usuario => usuario.activo && ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'].includes(usuario.rol)).map(usuario => <option key={usuario.id} value={usuario.id}>{usuario.nombre}</option>)}
                  </select>
                </label>}
                <button className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">{formTarea.id ? 'Guardar cambios' : 'Agregar tarea'}</button>
              </form>
              <div className="divide-y">{tareas.map(tarea => <div key={tarea.id} className="py-3 flex justify-between gap-3 text-sm">
                <div><strong>{tarea.titulo}</strong><div className="text-xs text-slate-500">{tarea.descripcion}{currentUser.isAdmin ? ` · ${tarea.asignado_nombre}` : ''} · {parseLocalDate(tarea.fecha_limite).toLocaleDateString()}</div></div>
                <div className="flex gap-3"><button onClick={() => setFormTarea({ id: tarea.id, titulo: tarea.titulo, descripcion: tarea.descripcion || '', asignado_a_id: tarea.asignado_a_id, fecha_limite: String(tarea.fecha_limite).slice(0, 10), estado: tarea.estado })} className="text-blue-700 text-xs">Editar</button><button onClick={() => apiFetch(API_BASE_URL, `/api/admin/tareas/${tarea.id}`, { method: 'DELETE' }).then(res => res.json()).then(data => {
                  if (!data.success) throw new Error(data.message || 'No se pudo eliminar la tarea.');
                  if (currentUser.isAdmin) cargarDatosAdministrativos();
                  else cargarDatosPlanificacion();
                }).catch(error => mostrarAviso(error.message, 'error'))} className="text-red-700 text-xs">Eliminar</button></div>
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
                }).catch(error => mostrarAviso(error.message, 'error'));
              }} className="grid sm:grid-cols-2 gap-3 border-b pb-5">
                <input placeholder="Nombre del proyecto" required value={formProyecto.titulo} onChange={e => setFormProyecto({ ...formProyecto, titulo: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <select value={formProyecto.estado} onChange={e => setFormProyecto({ ...formProyecto, estado: e.target.value })} className="px-3 py-2 border rounded-lg bg-white text-sm"><option value="planificacion">Planificación</option><option value="en_curso">En curso</option><option value="pausado">Pausado</option><option value="completado">Completado</option></select>
                <textarea placeholder="Alcance y notas" value={formProyecto.descripcion} onChange={e => setFormProyecto({ ...formProyecto, descripcion: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                <button className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">{formProyecto.id ? 'Guardar proyecto' : 'Registrar proyecto'}</button>
              </form>
              <div className="divide-y">{proyectos.map(proyecto => <div key={proyecto.id} className="py-3"><div className="flex justify-between"><strong>{proyecto.titulo}</strong><span className="text-xs uppercase text-blue-700">{proyecto.estado}</span></div><p className="text-sm text-slate-600">{proyecto.descripcion}</p><p className="text-xs text-slate-500">Responsable: {proyecto.creador_nombre}</p><div className="mt-2 flex gap-3"><button onClick={() => setFormProyecto({ id: proyecto.id, titulo: proyecto.titulo, descripcion: proyecto.descripcion || '', estado: proyecto.estado })} className="text-blue-700 text-xs">Editar</button><button onClick={() => apiFetch(API_BASE_URL, `/api/admin/proyectos-ti/${proyecto.id}`, { method: 'DELETE' }).then(res => res.json()).then(() => cargarDatosAdministrativos())} className="text-red-700 text-xs">Eliminar</button></div></div>)}</div>
            </div>
          )}

          {/* GESTIÓN DE CATEGORÍAS */}
          {activeTab === 'categorias' && currentUser.rol === 'gerente_it' && (
            <section className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Gestión de categorías</h2>
                <p className="mt-1 text-sm text-slate-500">Administre las categorías disponibles al crear tickets.</p>
              </div>
              <form onSubmit={event => {
                event.preventDefault();
                const editing = Boolean(formCategoria.id);
                apiFetch(API_BASE_URL, editing ? `/api/admin/categorias/${formCategoria.id}` : '/api/admin/categorias', {
                  method: editing ? 'PUT' : 'POST', body: JSON.stringify({ nombre: formCategoria.nombre })
                }).then(res => res.json()).then(data => {
                  if (!data.success) throw new Error(data.message || 'No se pudo guardar la categoría.');
                  setFormCategoria({ id: null, nombre: '' });
                  return apiFetch(API_BASE_URL, '/api/tickets/categorias').then(res => res.json());
                }).then(data => { if (data?.success) setCategorias(data.data); }).catch(error => mostrarAviso(error.message, 'error'));
              }} className="flex flex-wrap gap-2 border-b border-slate-200 pb-5">
                <input aria-label="Nombre de categoría" required maxLength="100" value={formCategoria.nombre} onChange={event => setFormCategoria({ ...formCategoria, nombre: event.target.value })} placeholder="Ej. Telefonía" className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                <button className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white">{formCategoria.id ? 'Guardar' : 'Agregar'}</button>
                {formCategoria.id && <button type="button" onClick={() => setFormCategoria({ id: null, nombre: '' })} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Cancelar</button>}
              </form>
              <ul className="divide-y divide-slate-100">
                {categorias.map(categoria => <li key={categoria.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-medium text-slate-800">{categoria.nombre}</span>
                  <span className="flex gap-3"><button onClick={() => setFormCategoria({ id: categoria.id, nombre: categoria.nombre })} className="font-semibold text-blue-700">Editar</button><button onClick={() => confirmarAccion(`¿Eliminar la categoría ${categoria.nombre}?`, () => {
                    apiFetch(API_BASE_URL, `/api/admin/categorias/${categoria.id}`, { method: 'DELETE' }).then(res => res.json()).then(data => {
                      if (!data.success) throw new Error(data.message || 'No se pudo eliminar la categoría.');
                      setCategorias(actual => actual.filter(item => item.id !== categoria.id));
                      mostrarAviso('Categoría eliminada.');
                    }).catch(error => mostrarAviso(error.message, 'error'));
                  })} className="font-semibold text-red-700">Eliminar</button></span>
                </li>)}
                {!categorias.length && <li className="py-8 text-center text-sm text-slate-500">No hay categorías registradas.</li>}
              </ul>
            </section>
          )}

          {/* CONFIGURACIONES */}
          {activeTab === 'configuracion' && currentUser.rol === 'gerente_it' && (
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4 max-w-xl">
              <h2 className="text-xl font-bold text-slate-900">Configuraciones del Sistema SGTI</h2>
              <section className="space-y-4 border-b border-slate-200 pb-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-900">Recordatorios por correo</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estadoCorreo.smtp_configurado ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                    {estadoCorreo.smtp_configurado ? 'SMTP configurado' : 'SMTP pendiente'}
                  </span>
                </div>
                <p className="text-xs leading-5 text-slate-500">Resumen diario de tickets activos y tareas próximas o vencidas. Se envía a las {String(estadoCorreo.hora_resumen).padStart(2, '0')}:00 según la hora del servidor.</p>
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={Boolean(configuracionSistema.alertas_email)} onChange={event => setConfiguracionSistema({ ...configuracionSistema, alertas_email: event.target.checked })} />
                  Activar resumen diario
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Correos destinatarios
                  <textarea rows="4" value={emailDestinatarios} onChange={event => setEmailDestinatarios(event.target.value)} placeholder={'gerencia@empresa.com\nsoporte@empresa.com'} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                </label>
                <p className="text-xs text-slate-500">Escriba hasta 25 correos, uno por línea. Guarde los cambios antes de enviar la prueba.</p>
                {!estadoCorreo.smtp_configurado && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">El administrador del servidor debe completar las variables SMTP en el archivo de entorno del backend. Las credenciales no se guardan en esta página.</p>}
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={enviarCorreoPrueba} disabled={!estadoCorreo.smtp_configurado || estadoCorreo.destinatarios < 1 || enviandoPruebaCorreo} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                    {enviandoPruebaCorreo ? 'Enviando prueba...' : 'Enviar correo de prueba'}
                  </button>
                  <span className="text-xs text-slate-500" aria-live="polite">{estadoCorreo.destinatarios} destinatarios guardados</span>
                </div>
              </section>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={Boolean(configuracionSistema.modo_mantenimiento)} onChange={event => setConfiguracionSistema({ ...configuracionSistema, modo_mantenimiento: event.target.checked })} />
                Activar Modo Mantenimiento Global
              </label>
              <button onClick={enviarConfiguracion} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">Guardar configuración</button>
            </div>
          )}

          {activeTab === 'inventario' && currentUser.rol === 'admin_infra' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-xs font-bold uppercase text-emerald-700">Infraestructura</p><h2 className="mt-1 text-xl font-bold text-slate-900">Inventario por departamento</h2><p className="mt-1 text-sm text-slate-500">Equipos, cantidades y ubicaciones registrados por área.</p></div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">{inventario.length} registros</span>
              </div>
              <form onSubmit={event => {
                event.preventDefault();
                const editing = Boolean(formActivo.id);
                apiFetch(API_BASE_URL, editing ? `/api/admin/infraestructura/inventario/${formActivo.id}` : '/api/admin/infraestructura/inventario', {
                  method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...formActivo, departamento_id: Number(formActivo.departamento_id), cantidad: Number(formActivo.cantidad) })
                }).then(res => res.json()).then(data => {
                  if (!data.success) throw new Error(data.message || 'No se pudo guardar el activo.');
                  setFormActivo({ id: null, departamento_id: '', nombre: '', tipo: 'Impresora', cantidad: 1, ubicacion: '', notas: '' });
                  return apiFetch(API_BASE_URL, '/api/admin/infraestructura/inventario').then(res => res.json());
                }).then(data => { if (data?.success) setInventario(data.data); }).catch(error => mostrarAviso(error.message, 'error'));
              }} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs font-semibold text-slate-600">Departamento
                  <select required value={formActivo.departamento_id} onChange={event => setFormActivo({ ...formActivo, departamento_id: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800"><option value="">Seleccione departamento</option>{departamentos.map(departamento => <option key={departamento.id} value={departamento.id}>{departamento.nombre}</option>)}</select>
                </label>
                <label className="text-xs font-semibold text-slate-600">Tipo de equipo
                  <input list="tipos-inventario" required maxLength="100" value={formActivo.tipo} onChange={event => setFormActivo({ ...formActivo, tipo: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                  <datalist id="tipos-inventario"><option value="Impresora" /><option value="Punto de acceso" /><option value="Switch" /><option value="Router" /><option value="Computadora" /><option value="Servidor" /></datalist>
                </label>
                <label className="text-xs font-semibold text-slate-600">Nombre o modelo<input required maxLength="160" value={formActivo.nombre} onChange={event => setFormActivo({ ...formActivo, nombre: event.target.value })} placeholder="Ej. Impresora recepción" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" /></label>
                <label className="text-xs font-semibold text-slate-600">Cantidad<input type="number" min="0" step="1" required value={formActivo.cantidad} onChange={event => setFormActivo({ ...formActivo, cantidad: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" /></label>
                <label className="text-xs font-semibold text-slate-600">Ubicación<input maxLength="160" value={formActivo.ubicacion} onChange={event => setFormActivo({ ...formActivo, ubicacion: event.target.value })} placeholder="Ej. Piso 2, recepción" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" /></label>
                <label className="text-xs font-semibold text-slate-600">Notas<textarea value={formActivo.notas} onChange={event => setFormActivo({ ...formActivo, notas: event.target.value })} rows="1" placeholder="Marca, estado o detalles" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" /></label>
                <div className="flex gap-2 sm:col-span-2 lg:col-span-3"><button className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">{formActivo.id ? 'Guardar cambios' : 'Agregar al inventario'}</button>{formActivo.id && <button type="button" onClick={() => setFormActivo({ id: null, departamento_id: '', nombre: '', tipo: 'Impresora', cantidad: 1, ubicacion: '', notas: '' })} className="rounded-md border border-slate-300 px-4 py-2 text-sm">Cancelar</button>}</div>
              </form>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Departamento</th><th className="px-4 py-3">Equipo</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Cantidad</th><th className="px-4 py-3">Ubicación y notas</th><th className="px-4 py-3">Acciones</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{inventario.map(activo => <tr key={activo.id}>
                    <td className="px-4 py-3 font-medium">{activo.departamento_nombre}</td><td className="px-4 py-3">{activo.nombre}</td><td className="px-4 py-3">{activo.tipo}</td><td className="px-4 py-3">{activo.cantidad}</td><td className="max-w-xs px-4 py-3 text-slate-600">{[activo.ubicacion, activo.notas].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-4 py-3"><div className="flex gap-3"><button onClick={() => setFormActivo({ id: activo.id, departamento_id: String(activo.departamento_id), nombre: activo.nombre, tipo: activo.tipo, cantidad: activo.cantidad, ubicacion: activo.ubicacion || '', notas: activo.notas || '' })} className="font-semibold text-blue-700">Editar</button><button onClick={() => confirmarAccion(`¿Eliminar ${activo.nombre} del inventario?`, () => {
                      apiFetch(API_BASE_URL, `/api/admin/infraestructura/inventario/${activo.id}`, { method: 'DELETE' }).then(res => res.json()).then(data => {
                        if (!data.success) throw new Error(data.message || 'No se pudo eliminar el activo.');
                        setInventario(actual => actual.filter(item => item.id !== activo.id));
                        mostrarAviso('Activo eliminado del inventario.');
                      }).catch(error => mostrarAviso(error.message, 'error'));
                    })} className="font-semibold text-red-700">Eliminar</button></div></td>
                  </tr>)}
                    {!inventario.length && <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-500">No hay activos registrados todavía.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'entregas' && currentUser.rol === 'admin_infra' && (
            <section className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase text-teal-700">Infraestructura</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Entrega de artículos</h2>
              </div>
              <form onSubmit={guardarListaEntrega} className="space-y-5 rounded-lg border border-slate-200 bg-white p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs font-semibold text-slate-600">Departamento
                    <select required value={formEntrega.departamento_id} onChange={event => setFormEntrega({ ...formEntrega, departamento_id: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800">
                      <option value="">Seleccione departamento</option>
                      {departamentos.map(departamento => <option key={departamento.id} value={departamento.id}>{departamento.nombre}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Persona que recibe
                    <input required maxLength="160" value={formEntrega.destinatario} onChange={event => setFormEntrega({ ...formEntrega, destinatario: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Fecha de entrega
                    <input type="date" required value={formEntrega.fecha_entrega} onChange={event => setFormEntrega({ ...formEntrega, fecha_entrega: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-1">Observaciones
                    <input maxLength="3000" value={formEntrega.observaciones} onChange={event => setFormEntrega({ ...formEntrega, observaciones: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                  </label>
                </div>

                <fieldset className="space-y-3 border-t border-slate-200 pt-4">
                  <legend className="px-1 text-sm font-bold text-slate-800">Artículos</legend>
                  {formEntrega.articulos.map((item, index) => <div key={index} className="grid items-end gap-3 border-b border-slate-100 pb-3 sm:grid-cols-[minmax(0,2fr)_100px_minmax(0,2fr)_auto]">
                    <label className="text-xs font-semibold text-slate-600">Artículo o modelo
                      <input required maxLength="160" value={item.articulo} onChange={event => setFormEntrega(actual => ({ ...actual, articulos: actual.articulos.map((articulo, articuloIndex) => articuloIndex === index ? { ...articulo, articulo: event.target.value } : articulo) }))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">Cantidad
                      <input type="number" min="1" step="1" required value={item.cantidad} onChange={event => setFormEntrega(actual => ({ ...actual, articulos: actual.articulos.map((articulo, articuloIndex) => articuloIndex === index ? { ...articulo, cantidad: event.target.value } : articulo) }))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">Detalles
                      <input maxLength="1000" value={item.detalles} onChange={event => setFormEntrega(actual => ({ ...actual, articulos: actual.articulos.map((articulo, articuloIndex) => articuloIndex === index ? { ...articulo, detalles: event.target.value } : articulo) }))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                    </label>
                    <button type="button" disabled={formEntrega.articulos.length === 1} onClick={() => setFormEntrega(actual => ({ ...actual, articulos: actual.articulos.filter((_, articuloIndex) => articuloIndex !== index) }))} className="rounded-md px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">Quitar</button>
                  </div>)}
                  <button type="button" onClick={() => setFormEntrega(actual => ({ ...actual, articulos: [...actual.articulos, { articulo: '', cantidad: 1, detalles: '' }] }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Agregar artículo</button>
                </fieldset>
                <button type="submit" disabled={guardandoEntrega} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60">
                  {guardandoEntrega ? 'Guardando...' : 'Guardar entrega'}
                </button>
              </form>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-slate-900">Entregas registradas</h3>
                  <span className="text-sm text-slate-500">{entregas.length} registros</span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Recibe</th><th className="px-4 py-3">Departamento</th><th className="px-4 py-3">Artículos</th><th className="px-4 py-3">Reporte</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {entregas.map(entrega => <tr key={entrega.id}>
                        <td className="whitespace-nowrap px-4 py-3">{entrega.fecha_entrega}</td>
                        <td className="px-4 py-3 font-medium">{entrega.destinatario}</td>
                        <td className="px-4 py-3">{entrega.departamento_nombre}</td>
                        <td className="px-4 py-3">{entrega.articulos.length}</td>
                        <td className="px-4 py-3"><div className="flex gap-3">
                          <button type="button" onClick={() => descargarReporteEntrega(entrega)} className="font-semibold text-teal-800 hover:underline">Descargar</button>
                          <button type="button" onClick={() => imprimirReporteEntrega(entrega)} className="font-semibold text-slate-700 hover:underline">Imprimir</button>
                        </div></td>
                      </tr>)}
                      {!entregas.length && <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">Todavía no hay entregas registradas.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          )}

          {/* CHAT INMEDIATO */}
          {activeTab === 'chat' && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="sgti-chat-header border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Centro de soporte</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{seccionSoporte === 'remota' ? 'Asistencia remota' : 'Mensajes con IT'}</h2>
                <p className="mt-1 text-sm text-slate-600">{currentUser.isAdmin ? 'Revise las conversaciones de usuarios y responda desde una sola bandeja.' : 'Elija el equipo de soporte para consultar o enviar un mensaje.'}</p>
              </div>
              <div className="flex gap-2 border-b border-slate-200 px-4 py-3 sm:px-5" role="group" aria-label="Opciones del centro de soporte">
                <button type="button" aria-pressed={seccionSoporte === 'mensajes'} onClick={() => setSeccionSoporte('mensajes')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${seccionSoporte === 'mensajes' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  Mensajes
                </button>
                <button type="button" aria-pressed={seccionSoporte === 'remota'} onClick={() => setSeccionSoporte('remota')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${seccionSoporte === 'remota' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  Asistencia remota
                </button>
              </div>
              {seccionSoporte === 'remota'
                ? <RemoteAssistance currentUser={currentUser} />
                : <>
              {chatError && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">{chatError}</p>}
              <div className="grid min-h-[420px] lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
                  <h3 className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">{currentUser.isAdmin ? 'Conversaciones' : 'Personal de soporte'}</h3>
                  <div className="max-h-[520px] overflow-y-auto">
                    {(currentUser.isAdmin ? conversaciones : adminsChat).map(contacto => {
                      const id = String(currentUser.isAdmin ? contacto.usuario_id : contacto.id);
                      const nombre = currentUser.isAdmin ? contacto.usuario_nombre : contacto.nombre;
                      const pendientes = Number(contacto.pendientes || 0);
                      return <button key={id} type="button" onClick={() => {
                        setChatDestinatario(id);
                        setChatError('');
                        setArchivosChat([]);
                      }} aria-pressed={chatDestinatario === id} className={`block w-full border-b border-slate-200 px-4 py-3 text-left transition ${chatDestinatario === id ? 'border-l-4 border-l-blue-700 bg-blue-50' : 'border-l-4 border-l-transparent hover:bg-white'}`}>
                        <span className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-slate-900">{nombre}</strong>{pendientes > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">{pendientes}</span>}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500">{currentUser.isAdmin ? contacto.ultimo_mensaje || 'Iniciar conversación' : `${contacto.area || contacto.rol} · Equipo IT`}</span>
                      </button>;
                    })}
                    {!(currentUser.isAdmin ? conversaciones : adminsChat).length && <p className="px-4 py-8 text-center text-xs text-slate-500">{currentUser.isAdmin ? 'No hay conversaciones todavía.' : 'No hay administradores disponibles.'}</p>}
                  </div>
                </aside>
                <section className="flex min-w-0 flex-col p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {currentUser.isAdmin
                          ? conversaciones.find(item => String(item.usuario_id) === chatDestinatario)?.usuario_nombre || 'Seleccione una conversación'
                          : adminsChat.find(item => String(item.id) === chatDestinatario)?.nombre || 'Seleccione soporte'}
                      </h3>
                      <p className="text-xs text-slate-500">{chatDestinatario ? `${chatMensajes.length} mensajes · conversación directa` : 'Seleccione una persona de la lista para ver sus mensajes.'}</p>
                    </div>
                    {chatDestinatario && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Directo</span>}
                  </div>
                  <div className="flex min-h-64 flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4" aria-live="polite">
                    {chatMensajes.map(m => {
                      const enviadoPorMi = Number(m.remitente_id) === Number(currentUser.id);
                      return <article key={m.id} className={`max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm ${enviadoPorMi ? 'ml-auto border-blue-200 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-800'}`}>
                        <p className={`mb-1 text-[11px] font-semibold ${enviadoPorMi ? 'text-blue-100' : 'text-slate-500'}`}>{enviadoPorMi ? 'Usted' : m.remitente_nombre || (currentUser.isAdmin ? 'Usuario' : 'Soporte')} · {new Date(m.created_at).toLocaleString()}</p>
                        <p className="whitespace-pre-wrap break-words text-sm">{m.mensaje}</p>
                        <EvidenceGallery images={m.imagenes || []} imagePathPrefix="/api/chat/imagenes/" />
                      </article>;
                    })}
                    {!chatMensajes.length && chatDestinatario && <p className="m-auto text-center text-sm text-slate-500">Todavía no hay mensajes. Envíe el primero para iniciar la conversación.</p>}
                    {!chatDestinatario && <p className="m-auto text-center text-sm text-slate-500">Sus mensajes aparecerán aquí al seleccionar una conversación.</p>}
                  </div>
                  <form onSubmit={event => {
                event.preventDefault();
                const recipient = Number(chatDestinatario);
                if (!recipient || (!nuevoChat.trim() && !archivosChat.length)) return;
                const payload = currentUser.isAdmin ? { usuario_id: recipient, mensaje: nuevoChat } : { admin_id: recipient, mensaje: nuevoChat };
                apiFetch(API_BASE_URL, '/api/chat/directo', { method: 'POST', body: crearPayloadChat(payload) }).then(res => res.json()).then(data => {
                  if (!data.success) throw new Error(data.message || 'No se pudo enviar el mensaje.');
                  setNuevoChat('');
                  setArchivosChat([]);
                  if (currentUser.isAdmin) apiFetch(API_BASE_URL, `/api/chat/directo?usuario_id=${recipient}`).then(res => res.json()).then(result => { if (result.success) setChatMensajes(result.data); });
                  else apiFetch(API_BASE_URL, `/api/chat/directo?admin_id=${recipient}`).then(res => res.json()).then(result => { if (result.success) setChatMensajes(result.data); });
                }).catch(error => setChatError(error.message));
              }} className="mt-3 space-y-2">
                    <div className="flex gap-2">
                    <input type="text" aria-label="Escriba un mensaje" placeholder={currentUser.isAdmin ? 'Responder al usuario...' : 'Escriba su mensaje a IT...'} value={nuevoChat} onChange={e => setNuevoChat(e.target.value)} disabled={!chatDestinatario} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" />
                    <button disabled={!chatDestinatario || (!nuevoChat.trim() && !archivosChat.length)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">Enviar</button>
                    </div>
                    <EvidencePicker files={archivosChat} onChange={setArchivosChat} disabled={!chatDestinatario} />
                  </form>
                </section>
              </div>
                </>}
            </section>
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
                  mostrarAviso('Gracias por compartir su opinión.');
                }).catch(error => mostrarAviso(error.message, 'error'));
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
          {activeTab === 'empresa' && currentUser.isAdmin && <EnterpriseConsole apiBaseUrl={API_BASE_URL} currentUser={currentUser} departamentos={departamentos} mode={currentUser.rol === 'admin_infra' ? 'infra' : 'admin'} />}
          {activeTab === 'solicitud_microsoft' && !currentUser.isAdmin && <EnterpriseConsole apiBaseUrl={API_BASE_URL} currentUser={currentUser} departamentos={departamentos} mode="request" />}

        </main>
        {dialogo && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" onClick={() => dialogo.tipo !== 'confirm' && setDialogo(null)}>
          <section role={dialogo.tipo === 'confirm' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="app-dialog-title" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${dialogo.tipo === 'error' ? 'bg-red-100 text-red-700' : dialogo.tipo === 'confirm' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`} aria-hidden="true">{dialogo.tipo === 'error' ? '!' : dialogo.tipo === 'confirm' ? '?' : '✓'}</span>
              <div className="min-w-0 flex-1">
                <h2 id="app-dialog-title" className="font-bold text-slate-900">{dialogo.tipo === 'error' ? 'No se pudo completar' : dialogo.tipo === 'confirm' ? 'Confirmar acción' : 'Acción completada'}</h2>
                <p className="mt-1 break-words text-sm leading-5 text-slate-600">{dialogo.mensaje}</p>
              </div>
              <button autoFocus aria-label="Cerrar ventana" onClick={() => setDialogo(null)} className="rounded px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              {dialogo.tipo === 'confirm' && <button onClick={() => setDialogo(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>}
              <button onClick={() => {
                const accion = dialogo.accion;
                setDialogo(null);
                if (accion) accion();
              }} className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${dialogo.tipo === 'confirm' ? 'bg-red-700 hover:bg-red-800' : 'bg-slate-800 hover:bg-slate-900'}`}>{dialogo.tipo === 'confirm' ? 'Eliminar' : 'Entendido'}</button>
            </div>
          </section>
        </div>}
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

              {imagenesTicket.length > 0 && <section className="space-y-2 border-t pt-4">
                <h3 className="font-semibold text-slate-900">Evidencia del ticket</h3>
                <EvidenceGallery images={imagenesTicket} imagePathPrefix="/api/chat/imagenes/" />
              </section>}

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
                    <EvidenceGallery images={mensaje.imagenes || []} imagePathPrefix="/api/chat/imagenes/" />
                  </article>)}
                  {!mensajesTicket.length && <p className="text-sm text-slate-500">Todavía no hay mensajes en este ticket.</p>}
                </div>
                <form onSubmit={enviarMensajeTicket} className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input value={nuevoMensajeTicket} onChange={event => setNuevoMensajeTicket(event.target.value)} placeholder={currentUser.isAdmin ? 'Escriba una respuesta para este ticket...' : 'Agregue un dato que faltó al crear el ticket...'} className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm" />
                    <button disabled={!nuevoMensajeTicket.trim() && !archivosMensajeTicket.length} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">Enviar mensaje</button>
                  </div>
                  <EvidencePicker files={archivosMensajeTicket} onChange={setArchivosMensajeTicket} />
                </form>
              </section>}
            </div>
          </section>
        </div>}
      </div>
    </div>
  );
}
