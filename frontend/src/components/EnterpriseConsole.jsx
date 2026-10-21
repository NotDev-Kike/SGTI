import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

const emptySla = { nombre: '', prioridad: 'media', categoria: '', horas_respuesta: 8, horas_resolucion: 32 };
const panel = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
const leerRespuesta = async response => {
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('El servidor no respondió como API. Reinicie el backend y verifique el proxy del frontend.'); }
  if (!response.ok || data.success === false) throw new Error(data.message || `La operación falló (${response.status}).`);
  return data;
};

const formatearDuracion = segundos => {
  const total = Math.max(0, Number(segundos || 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundosRestantes = total % 60;
  return horas ? `${horas} h ${minutos} min` : `${minutos} min ${segundosRestantes} s`;
};

const nombresDetalle = {
  motivo: 'Motivo', metodo: 'Método', ruta: 'Ruta', estado_http: 'Resultado',
  datos: 'Datos', estado: 'Estado', titulo: 'Título', categoria: 'Categoría'
};

const formatearValor = valor => {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'object') return Object.entries(valor).map(([clave, dato]) => `${nombresDetalle[clave] || clave}: ${formatearValor(dato)}`).join(' · ');
  return String(valor);
};

const detalleLegible = detalle => {
  if (!detalle || typeof detalle !== 'object') return detalle || '—';
  return Object.entries(detalle).map(([clave, valor]) => `${nombresDetalle[clave] || clave}: ${formatearValor(valor)}`).join(' · ');
};

const eventoLegible = item => {
  const detalle = item.detalle || {};
  const ruta = String(detalle.ruta || '').toLowerCase();
  const metodo = String(detalle.metodo || '').toUpperCase();
  if (item.evento === 'sesion.inicio') return 'Inició sesión';
  if (item.evento === 'sesion.cierre') return 'Cerró sesión';
  if (item.evento === 'movimiento.http' && ruta.includes('ticket')) {
    if (ruta.includes('asign')) return 'Asignó un ticket';
    if (metodo === 'POST') return 'Creó un ticket';
    if (['PUT', 'PATCH'].includes(metodo)) return 'Actualizó un ticket';
  }
  const nombres = {
    'sla.actualizado': 'Actualizó una política SLA', 'activo.creado': 'Registró un activo',
    'activo.actualizado': 'Actualizó un activo', 'microsoft.solicitud_creada': 'Creó una solicitud Microsoft',
    'microsoft.evento_creado': 'Creó un evento Microsoft', 'microsoft.correo_enviado': 'Envió un correo Microsoft'
  };
  return nombres[item.evento] || item.evento;
};

export default function EnterpriseConsole({ apiBaseUrl, currentUser, departamentos, mode = 'admin' }) {
  const [tab, setTab] = useState(mode === 'infra' ? 'activos' : mode === 'request' ? 'microsoft' : 'sla');
  const [sla, setSla] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [activos, setActivos] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [formSla, setFormSla] = useState(emptySla);
  const [formActivo, setFormActivo] = useState({ codigo: '', nombre: '', tipo: 'Equipo', departamento_id: '', estado: 'disponible', vida_util_anios: 5, orden_compra: '', garantia_hasta: '', motivo_baja: '', notas: '' });
  const [formMicrosoft, setFormMicrosoft] = useState({ nombre: '', correo_solicitado: '', departamento: '', detalle: '' });
  const [archivo, setArchivo] = useState(null);
  const [destinatario, setDestinatario] = useState('');
  const [activoSeleccionado, setActivoSeleccionado] = useState('');
  const [garantia, setGarantia] = useState(null);
  const [transferencia, setTransferencia] = useState({ departamento_id: '', responsable_id: '', nota: '' });
  const [eventos, setEventos] = useState([]);
  const [personalStatus, setPersonalStatus] = useState({ conectado: false, email: null });
  const [personalMessages, setPersonalMessages] = useState([]);
  const [evento, setEvento] = useState({ titulo: '', inicio: '', fin: '', descripcion: '' });
  const [mensaje, setMensaje] = useState('');

  const cargarSesiones = () => apiFetch(apiBaseUrl, '/api/admin/sesiones').then(leerRespuesta).then(d => setSesiones(d.data)).catch(() => {});

  const cargar = () => {
    if (currentUser.rol === 'gerente_it') {
      apiFetch(apiBaseUrl, '/api/admin/sla').then(leerRespuesta).then(d => setSla(d.data)).catch(() => {});
      apiFetch(apiBaseUrl, '/api/admin/auditoria').then(leerRespuesta).then(d => setAuditoria(d.data)).catch(() => {});
      cargarSesiones();
      apiFetch(apiBaseUrl, '/api/admin/microsoft/solicitudes').then(leerRespuesta).then(d => setSolicitudes(d.data)).catch(() => {});
    }
    if (currentUser.isAdmin) apiFetch(apiBaseUrl, '/api/admin/microsoft/eventos').then(leerRespuesta).then(d => setEventos(d.data)).catch(() => {});
    if (mode === 'request') {
      apiFetch(apiBaseUrl, '/api/microsoft/status').then(leerRespuesta).then(d => setPersonalStatus(d.data)).catch(() => {});
      apiFetch(apiBaseUrl, '/api/microsoft/events').then(leerRespuesta).then(d => setEventos(d.data)).catch(() => {});
      apiFetch(apiBaseUrl, '/api/microsoft/messages').then(leerRespuesta).then(d => setPersonalMessages(d.data)).catch(() => {});
    }
    if (currentUser.isAdmin) apiFetch(apiBaseUrl, '/api/admin/archivos').then(leerRespuesta).then(d => setArchivos(d.data)).catch(() => {});
    if (currentUser.isAdmin) apiFetch(apiBaseUrl, '/api/chat/directo/admins').then(leerRespuesta).then(d => setAdmins(d.data.filter(item => Number(item.id) !== Number(currentUser.id)))).catch(() => {});
    if (currentUser.rol === 'admin_infra') {
      apiFetch(apiBaseUrl, '/api/admin/activos').then(leerRespuesta).then(d => setActivos(d.data)).catch(() => {});
      apiFetch(apiBaseUrl, '/api/admin/infraestructura/entregas').then(leerRespuesta).then(d => setEntregas(d.data)).catch(() => {});
    }
  };
  useEffect(() => { cargar(); }, [currentUser]);
  useEffect(() => {
    if (currentUser.rol !== 'gerente_it' || tab !== 'sesiones') return undefined;
    const intervalo = setInterval(cargarSesiones, 10000);
    return () => clearInterval(intervalo);
  }, [currentUser, tab]);

  const guardarSla = e => { e.preventDefault(); apiFetch(apiBaseUrl, '/api/admin/sla', { method: 'POST', body: JSON.stringify(formSla) }).then(leerRespuesta).then(() => { setFormSla(emptySla); cargar(); setMensaje('Política SLA guardada.'); }).catch(e => setMensaje(e.message)); };
  const guardarActivo = e => { e.preventDefault(); apiFetch(apiBaseUrl, '/api/admin/activos', { method: 'POST', body: JSON.stringify(formActivo) }).then(leerRespuesta).then(() => { setFormActivo({ ...formActivo, codigo: '', nombre: '' }); cargar(); setMensaje('Activo registrado.'); }).catch(e => setMensaje(e.message)); };
  const solicitarMicrosoft = e => { e.preventDefault(); apiFetch(apiBaseUrl, '/api/admin/microsoft/solicitudes', { method: 'POST', body: JSON.stringify(formMicrosoft) }).then(leerRespuesta).then(() => { setFormMicrosoft({ nombre: '', correo_solicitado: '', departamento: '', detalle: '' }); setMensaje('Solicitud enviada a IT.'); }).catch(e => setMensaje(e.message)); };
  const actualizarSolicitud = (id, estado) => apiFetch(apiBaseUrl, `/api/admin/microsoft/solicitudes/${id}`, { method: 'PATCH', body: JSON.stringify({ estado }) }).then(leerRespuesta).then(() => { setMensaje(`Solicitud ${estado}.`); cargar(); }).catch(e => setMensaje(e.message));
  const enviarArchivo = e => { e.preventDefault(); if (!archivo || !destinatario) { setMensaje('Seleccione un destinatario y un archivo antes de enviar.'); return; } const body = new FormData(); body.append('archivo', archivo); body.append('destinatario_id', destinatario); apiFetch(apiBaseUrl, '/api/admin/archivos', { method: 'POST', body }).then(leerRespuesta).then(() => { setArchivo(null); setMensaje('Archivo enviado.'); cargar(); }).catch(e => setMensaje(e.message)); };
  const transferirActivo = e => { e.preventDefault(); if (!activoSeleccionado) return; apiFetch(apiBaseUrl, `/api/admin/activos/${activoSeleccionado}/transferir`, { method: 'POST', body: JSON.stringify(transferencia) }).then(leerRespuesta).then(() => { setMensaje('Transferencia registrada en el historial.'); cargar(); }).catch(e => setMensaje(e.message)); };
  const subirGarantia = e => { e.preventDefault(); if (!activoSeleccionado || !garantia) return; const body = new FormData(); body.append('garantia', garantia); apiFetch(apiBaseUrl, `/api/admin/activos/${activoSeleccionado}/garantia`, { method: 'POST', body }).then(leerRespuesta).then(() => setMensaje('Garantía adjuntada al activo.')).catch(e => setMensaje(e.message)); };
  const crearEvento = e => { e.preventDefault(); apiFetch(apiBaseUrl, mode === 'request' ? '/api/microsoft/events' : '/api/admin/microsoft/eventos', { method: 'POST', body: JSON.stringify(evento) }).then(leerRespuesta).then(() => { setEvento({ titulo: '', inicio: '', fin: '', descripcion: '' }); setMensaje('Evento enviado a Outlook.'); cargar(); }).catch(e => setMensaje(e.message)); };
  const conectarMicrosoft = () => {
    let token = '';
    try { token = JSON.parse(localStorage.getItem('sgti_user') || 'null')?.token || ''; } catch { token = ''; }
    if (!token) { setMensaje('La sesión del SGTI expiró. Inicie sesión nuevamente.'); return; }
    window.location.assign(`${apiBaseUrl}/api/microsoft/connect?token=${encodeURIComponent(token)}`);
  };

  const tabs = mode === 'request' ? [['solicitud_acceso', 'Solicitar acceso Microsoft']] : currentUser.rol === 'gerente_it'
    ? [['sla', 'SLA'], ['auditoria', 'Auditoría'], ['sesiones', 'Usuarios conectados'], ['solicitudes', 'Solicitudes de acceso'], ['archivos', 'Archivos']]
    : currentUser.rol === 'admin_infra'
      ? [['activos', 'Activos e infraestructura'], ['archivos', 'Archivos']]
    : [['archivos', 'Archivos']];

  return <section className="space-y-5">
    <div className="flex flex-wrap gap-2">{tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}</div>
    {mensaje && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{mensaje}</div>}

    {tab === 'sla' && currentUser.rol === 'gerente_it' && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><div className={panel}><h2 className="mb-4 text-lg font-bold">Políticas de tiempo</h2><div className="space-y-2">{sla.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3"><div><strong>{item.nombre}</strong><p className="text-xs text-slate-500">{item.prioridad} · {item.categoria || 'Todas las categorías'}</p></div><div className="text-right text-sm"><strong>{item.horas_resolucion} h</strong><p className="text-xs text-slate-500">respuesta: {item.horas_respuesta} h</p></div></div>)}{!sla.length && <p className="text-sm text-slate-500">No hay políticas configuradas.</p>}</div></div><form onSubmit={guardarSla} className={`${panel} space-y-3`}><h2 className="text-lg font-bold">Nueva política</h2><input required placeholder="Nombre" value={formSla.nombre} onChange={e => setFormSla({ ...formSla, nombre: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><select value={formSla.prioridad} onChange={e => setFormSla({ ...formSla, prioridad: e.target.value })} className="w-full rounded border px-3 py-2 text-sm"><option value="critica">Crítica</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select><div className="grid grid-cols-2 gap-2"><input type="number" min="1" placeholder="Respuesta (h)" value={formSla.horas_respuesta} onChange={e => setFormSla({ ...formSla, horas_respuesta: e.target.value })} className="rounded border px-3 py-2 text-sm" /><input required type="number" min="1" placeholder="Resolución (h)" value={formSla.horas_resolucion} onChange={e => setFormSla({ ...formSla, horas_resolucion: e.target.value })} className="rounded border px-3 py-2 text-sm" /></div><button className="w-full rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Guardar SLA</button></form></div>}

    {tab === 'auditoria' && <div className={panel}><h2 className="mb-4 text-lg font-bold">Registro de actividad</h2><p className="mb-3 text-xs text-slate-500">Cada movimiento conserva usuario, fecha, IP, operación y datos de la solicitud sin guardar contraseñas ni tokens. Los duplicados exactos del mismo segundo se muestran una sola vez.</p><div className="overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="px-3 py-2">Fecha y hora</th><th className="px-3 py-2">Usuario</th><th className="px-3 py-2">Acción</th><th className="px-3 py-2">IP</th><th className="px-3 py-2">Detalle</th></tr></thead><tbody>{auditoria.map(item => <tr key={item.id} className="border-b align-top"><td className="whitespace-nowrap px-3 py-2">{new Date(item.created_at).toLocaleString()}</td><td className="px-3 py-2">{item.usuario_nombre || item.email || 'Sistema'}</td><td className="px-3 py-2 font-medium">{eventoLegible(item)}</td><td className="px-3 py-2">{item.ip || '—'}</td><td className="max-w-[420px] break-words px-3 py-2 text-xs text-slate-600">{detalleLegible(item.detalle)}</td></tr>)}</tbody></table></div></div>}
    {tab === 'sesiones' && <div className={panel}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Registro de sesiones</h2><p className="mt-1 text-xs text-slate-500">Una fila por inicio de sesión con entrada, última actividad, salida y duración.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">{sesiones.filter(item => item.conectado).length} conectados</span></div><div className="grid gap-3 md:grid-cols-2">{sesiones.map(item => <div key={item.id} className={`rounded-lg border p-4 ${item.conectado ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}><div className="flex items-start justify-between gap-3"><div><strong>{item.nombre}</strong><p className="text-xs text-slate-600">{item.email}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${item.conectado ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>{item.conectado ? 'Activo' : 'Desconectado'}</span></div><dl className="mt-3 space-y-1 text-xs"><div><dt className="inline font-semibold text-slate-600">Entrada:</dt> <dd className="inline">{new Date(item.entrada_en).toLocaleString()}</dd></div><div><dt className="inline font-semibold text-slate-600">Última actividad:</dt> <dd className="inline">{new Date(item.ultima_actividad).toLocaleString()}</dd></div>{item.salida_en && <div><dt className="inline font-semibold text-red-800">Salida:</dt> <dd className="inline text-red-800">{new Date(item.salida_en).toLocaleString()}</dd></div>}<div><dt className="inline font-semibold text-slate-600">Tiempo de uso:</dt> <dd className="inline font-semibold">{formatearDuracion(item.duracion_segundos)}</dd></div><div><dt className="inline font-semibold text-slate-600">IP:</dt> <dd className="inline">{item.ip || 'No disponible'}</dd></div></dl></div>)}{!sesiones.length && <p className="text-sm text-slate-500">No hay registros de sesiones.</p>}</div></div>}
    {tab === 'solicitud_acceso' && mode === 'request' && <div className={`${panel} max-w-2xl space-y-4`}><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Acceso al sistema</p><h2 className="mt-1 text-xl font-bold">Solicitar acceso con Microsoft</h2><p className="mt-1 text-sm text-slate-500">Escriba el correo Microsoft que desea utilizar. El gerente de IT validará la solicitud antes de habilitar el ingreso.</p></div><form onSubmit={solicitarMicrosoft} className="space-y-3"><input required type="email" placeholder="Correo Microsoft" value={formMicrosoft.correo_solicitado} onChange={e => setFormMicrosoft({ ...formMicrosoft, correo_solicitado: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><input required placeholder="Nombre completo" value={formMicrosoft.nombre} onChange={e => setFormMicrosoft({ ...formMicrosoft, nombre: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><textarea placeholder="Motivo o información adicional" value={formMicrosoft.detalle} onChange={e => setFormMicrosoft({ ...formMicrosoft, detalle: e.target.value })} className="min-h-24 w-full rounded border px-3 py-2 text-sm" /><button className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Enviar solicitud al gerente de IT</button></form></div>}

    {tab === 'solicitudes' && currentUser.rol === 'gerente_it' && <div className={panel}><h2 className="mb-2 text-lg font-bold">Solicitudes de acceso Microsoft</h2><p className="mb-4 text-sm text-slate-500">Valide el correo antes de permitir que el usuario ingrese al sistema.</p><div className="space-y-3">{solicitudes.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"><div><strong>{item.nombre}</strong><p className="text-sm text-slate-600">{item.correo_solicitado || 'Sin correo'}</p><p className="text-xs text-slate-500">Solicitó: {item.solicitante_nombre || '—'} · {new Date(item.created_at).toLocaleString()} · Estado: {item.estado}</p>{item.detalle && <p className="mt-1 text-xs text-slate-600">{item.detalle}</p>}</div>{item.estado === 'pendiente' && <div className="flex gap-2"><button type="button" onClick={() => actualizarSolicitud(item.id, 'aprobada')} className="rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Aprobar</button><button type="button" onClick={() => actualizarSolicitud(item.id, 'rechazada')} className="rounded bg-red-600 px-3 py-2 text-xs font-semibold text-white">Rechazar</button></div>}</div>)}{!solicitudes.length && <p className="text-sm text-slate-500">No hay solicitudes de acceso.</p>}</div></div>}
    {tab === 'microsoft' && mode !== 'request' && <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]"><form onSubmit={solicitarMicrosoft} className={`${panel} space-y-3`}><h2 className="text-lg font-bold">Solicitar usuario Microsoft</h2><input required placeholder="Nombre del usuario" value={formMicrosoft.nombre} onChange={e => setFormMicrosoft({ ...formMicrosoft, nombre: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><input type="email" placeholder="Correo solicitado" value={formMicrosoft.correo_solicitado} onChange={e => setFormMicrosoft({ ...formMicrosoft, correo_solicitado: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><input placeholder="Departamento" value={formMicrosoft.departamento} onChange={e => setFormMicrosoft({ ...formMicrosoft, departamento: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><textarea placeholder="Detalle o permisos requeridos" value={formMicrosoft.detalle} onChange={e => setFormMicrosoft({ ...formMicrosoft, detalle: e.target.value })} className="min-h-24 w-full rounded border px-3 py-2 text-sm" /><button className="w-full rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Enviar solicitud</button></form><div className={panel}><h2 className="mb-4 text-lg font-bold">Solicitudes recibidas</h2><div className="space-y-2">{solicitudes.map(item => <div key={item.id} className="rounded border border-slate-200 px-4 py-3 text-sm"><strong>{item.nombre}</strong><p className="text-xs text-slate-500">{item.correo_solicitado || 'Sin correo'} · {item.estado}</p><p className="mt-1 text-xs">Solicitó: {item.solicitante_nombre || '—'}</p></div>)}</div></div></div><div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]"><form onSubmit={crearEvento} className={`${panel} space-y-3`}><h2 className="text-lg font-bold">Crear evento en Outlook</h2><input required placeholder="Título" value={evento.titulo} onChange={e => setEvento({ ...evento, titulo: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><input required type="datetime-local" value={evento.inicio} onChange={e => setEvento({ ...evento, inicio: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><input required type="datetime-local" value={evento.fin} onChange={e => setEvento({ ...evento, fin: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><textarea placeholder="Descripción" value={evento.descripcion} onChange={e => setEvento({ ...evento, descripcion: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><button className="w-full rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Crear evento</button></form><div className={panel}><h2 className="mb-4 text-lg font-bold">Eventos sincronizados</h2><div className="space-y-2">{eventos.map(item => <div key={item.id || item.microsoft_id} className="rounded border border-slate-200 px-4 py-3 text-sm"><strong>{item.subject || item.titulo}</strong><p className="text-xs text-slate-500">{item.start?.dateTime || item.inicio}</p></div>)}{!eventos.length && <p className="text-sm text-slate-500">No hay eventos sincronizados o Microsoft Graph no está configurado.</p>}</div></div></div></div>}
    {tab === 'activos' && currentUser.rol === 'admin_infra' && <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]"><div className={panel}><h2 className="mb-4 text-lg font-bold">Activos y ciclo de vida</h2><div className="space-y-2">{activos.map(item => <button type="button" key={item.id} onClick={() => setActivoSeleccionado(String(item.id))} className={`block w-full rounded-lg border px-4 py-3 text-left ${activoSeleccionado === String(item.id) ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}><div className="flex justify-between gap-3"><strong>{item.codigo} · {item.nombre}</strong><span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-900">{item.estado}</span></div><p className="mt-1 text-xs text-slate-500">{item.tipo} · {item.departamento_nombre || 'Sin departamento'} · {item.responsable_nombre || 'Sin responsable'}</p><p className="mt-1 text-xs text-slate-500">Compra: {item.orden_compra || '—'} · Vida útil: {item.vida_util_anios || '—'} años · Baja: {item.motivo_baja || '—'}</p></button>)}{!activos.length && <p className="text-sm text-slate-500">No hay activos registrados.</p>}</div></div><form onSubmit={guardarActivo} className={`${panel} space-y-3`}><h2 className="text-lg font-bold">Registrar activo</h2><div className="grid grid-cols-2 gap-2"><input required placeholder="Código" value={formActivo.codigo} onChange={e => setFormActivo({ ...formActivo, codigo: e.target.value })} className="rounded border px-3 py-2 text-sm" /><input required placeholder="Nombre" value={formActivo.nombre} onChange={e => setFormActivo({ ...formActivo, nombre: e.target.value })} className="rounded border px-3 py-2 text-sm" /></div><input placeholder="Tipo" value={formActivo.tipo} onChange={e => setFormActivo({ ...formActivo, tipo: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><select value={formActivo.departamento_id} onChange={e => setFormActivo({ ...formActivo, departamento_id: e.target.value })} className="w-full rounded border px-3 py-2 text-sm"><option value="">Sin departamento</option>{departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select><div className="grid grid-cols-2 gap-2"><input placeholder="Orden de compra" value={formActivo.orden_compra} onChange={e => setFormActivo({ ...formActivo, orden_compra: e.target.value })} className="rounded border px-3 py-2 text-sm" /><input type="number" min="1" placeholder="Vida útil (años)" value={formActivo.vida_util_anios} onChange={e => setFormActivo({ ...formActivo, vida_util_anios: e.target.value })} className="rounded border px-3 py-2 text-sm" /></div><select value={formActivo.estado} onChange={e => setFormActivo({ ...formActivo, estado: e.target.value })} className="w-full rounded border px-3 py-2 text-sm"><option value="disponible">Disponible</option><option value="asignado">Asignado</option><option value="mantenimiento">Mantenimiento</option><option value="baja">Baja</option></select>{formActivo.estado === 'baja' && <input required placeholder="Motivo de baja" value={formActivo.motivo_baja} onChange={e => setFormActivo({ ...formActivo, motivo_baja: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />}<button className="w-full rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Guardar activo</button></form></div><div className={panel}><h2 className="mb-4 text-lg font-bold">Transferencia y garantía</h2><p className="mb-3 text-xs text-slate-500">Seleccione un activo de la lista para registrar su movimiento o adjuntar documentación.</p><form onSubmit={transferirActivo} className="space-y-2"><select required value={activoSeleccionado} onChange={e => setActivoSeleccionado(e.target.value)} className="w-full rounded border px-3 py-2 text-sm"><option value="">Activo</option>{activos.map(a => <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>)}</select><select value={transferencia.departamento_id} onChange={e => setTransferencia({ ...transferencia, departamento_id: e.target.value })} className="w-full rounded border px-3 py-2 text-sm"><option value="">Nuevo departamento</option>{departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select><textarea placeholder="Nota de entrega / transferencia" value={transferencia.nota} onChange={e => setTransferencia({ ...transferencia, nota: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><button className="w-full rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Registrar transferencia</button></form><form onSubmit={subirGarantia} className="mt-4 space-y-2 border-t border-slate-200 pt-4"><input required type="file" onChange={e => setGarantia(e.target.files[0])} className="w-full rounded border px-3 py-2 text-sm" /><button className="w-full rounded border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700">Subir garantía del activo</button></form></div><div className={panel}><h2 className="mb-4 text-lg font-bold">Entregas registradas</h2><div className="grid gap-3 md:grid-cols-2">{entregas.map(item => <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm"><strong>{item.destinatario}</strong><p className="text-xs text-slate-500">{item.departamento_nombre} · {item.fecha_entrega}</p><p className="mt-1 text-xs">{(item.articulos || []).map(a => `${a.articulo} (${a.cantidad})`).join(', ')}</p></div>)}{!entregas.length && <p className="text-sm text-slate-500">No hay entregas registradas.</p>}</div></div></div>}
    {tab === 'archivos' && currentUser.isAdmin && <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]"><form onSubmit={enviarArchivo} className={`${panel} space-y-3`}><h2 className="text-lg font-bold">Enviar archivo a otro administrador</h2><select required value={destinatario} onChange={e => setDestinatario(e.target.value)} className="w-full rounded border px-3 py-2 text-sm"><option value="">Seleccione destinatario</option>{admins.map(item => <option key={item.id} value={item.id}>{item.nombre} · {item.area || item.rol}</option>)}</select><input required type="file" onChange={e => setArchivo(e.target.files[0])} className="w-full rounded border px-3 py-2 text-sm" /><button className="w-full rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Enviar archivo</button></form><div className={panel}><h2 className="mb-4 text-lg font-bold">Archivos compartidos</h2><div className="space-y-2">{archivos.map(item => <a key={item.id} href={`${apiBaseUrl}/api/admin/archivos/${item.id}`} className="block rounded border border-slate-200 px-4 py-3 text-sm hover:bg-slate-50">{item.nombre}<span className="ml-2 text-xs text-slate-500">{item.remitente_nombre || 'Administrador'} · {new Date(item.created_at).toLocaleString()}</span></a>)}</div></div></div>}
    {archivo && <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Archivo listo para enviar: <strong>{archivo.name}</strong></p>}
  </section>;
}
