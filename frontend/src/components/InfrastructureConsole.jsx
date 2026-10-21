import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api';

const panel = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
const emptyAsset = { codigo: '', nombre: '', tipo: 'Equipo', departamento_id: '', responsable_id: '', estado: 'disponible', vida_util_anios: 5, fecha_compra: '', orden_compra: '', garantia_hasta: '', motivo_baja: '', notas: '' };
const emptyDelivery = { departamento_id: '', responsable_id: '', destinatario: '', fecha_entrega: new Date().toISOString().slice(0, 10), observaciones: '', articulos: [{ activo_id: '', articulo: '', cantidad: 1, detalles: '' }] };

const read = async response => {
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`La API respondió con una página HTML en lugar de JSON (HTTP ${response.status}). Reinicie el backend y verifique la URL de la API.`);
  }
  if (!response.ok || data.success === false) throw new Error(data.message || 'La operación no se pudo completar.');
  return data;
};

export default function InfrastructureConsole({ apiBaseUrl, departamentos, currentUser }) {
  const [tab, setTab] = useState('activos');
  const [activos, setActivos] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [formActivo, setFormActivo] = useState(emptyAsset);
  const [formEntrega, setFormEntrega] = useState(emptyDelivery);
  const [garantia, setGarantia] = useState(null);
  const [fotografia, setFotografia] = useState(null);
  const [evidencias, setEvidencias] = useState([]);
  const [entregaEditando, setEntregaEditando] = useState(null);
  const [mensaje, setMensaje] = useState('');

  const cargar = () => {
    apiFetch(apiBaseUrl, '/api/admin/activos').then(read).then(data => setActivos(data.data)).catch(error => setMensaje(error.message));
    apiFetch(apiBaseUrl, '/api/admin/infraestructura/entregas').then(read).then(data => setEntregas(data.data)).catch(() => {});
    apiFetch(apiBaseUrl, '/api/chat/directo/admins').then(read).then(data => setAdmins(data.data.filter(item => Number(item.id) !== Number(currentUser.id)))).catch(() => {});
    apiFetch(apiBaseUrl, '/api/admin/infraestructura/usuarios').then(read).then(data => setUsuarios(data.data)).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);

  const activo = useMemo(() => activos.find(item => String(item.id) === String(seleccionado)) || null, [activos, seleccionado]);
  const seleccionar = id => {
    setSeleccionado(String(id));
    setTab('historial');
    apiFetch(apiBaseUrl, `/api/admin/activos/${id}/historial`).then(read).then(data => setHistorial(data.data)).catch(error => setMensaje(error.message));
  };
  const guardarActivo = event => {
    event.preventDefault();
    if (formActivo.estado === 'asignado' && (!formActivo.departamento_id || !formActivo.responsable_id)) {
      setMensaje('Para asignar un activo debe seleccionar departamento y responsable.');
      return;
    }
    apiFetch(apiBaseUrl, '/api/admin/activos', { method: 'POST', body: JSON.stringify({ ...formActivo, id: formActivo.id || undefined, departamento_id: formActivo.departamento_id ? Number(formActivo.departamento_id) : null, responsable_id: formActivo.responsable_id ? Number(formActivo.responsable_id) : null }) }).then(read).then(() => { setMensaje('Activo guardado.'); setFormActivo(emptyAsset); cargar(); }).catch(error => setMensaje(error.message));
  };
  const editarActivo = item => {
    setFormActivo({ id: item.id, codigo: item.codigo || '', nombre: item.nombre || '', tipo: item.tipo || 'Equipo', departamento_id: item.departamento_id ? String(item.departamento_id) : '', responsable_id: item.responsable_id ? String(item.responsable_id) : '', estado: item.estado || 'disponible', vida_util_anios: item.vida_util_anios || 5, fecha_compra: item.fecha_compra ? String(item.fecha_compra).slice(0, 10) : '', orden_compra: item.orden_compra || '', garantia_hasta: item.garantia_hasta ? String(item.garantia_hasta).slice(0, 10) : '', motivo_baja: item.motivo_baja || '', notas: item.notas || '' });
    setMensaje(`Editando activo ${item.codigo}.`);
  };
  const transferir = event => {
    event.preventDefault();
    if (!seleccionado) return setMensaje('Seleccione un activo primero.');
    apiFetch(apiBaseUrl, `/api/admin/activos/${seleccionado}/transferir`, { method: 'POST', body: JSON.stringify(formActivo.transferencia || {}) }).then(read).then(() => { setMensaje('Movimiento registrado.'); cargar(); seleccionar(seleccionado); }).catch(error => setMensaje(error.message));
  };
  const subir = (event, tipo) => {
    event.preventDefault();
    if (!seleccionado) return setMensaje('Seleccione un activo primero.');
    const file = tipo === 'garantia' ? garantia : fotografia;
    if (!file) return setMensaje('Seleccione un archivo.');
    const body = new FormData(); body.append(tipo, file);
    apiFetch(apiBaseUrl, `/api/admin/activos/${seleccionado}/${tipo === 'garantia' ? 'garantia' : 'fotografias'}`, { method: 'POST', body }).then(read).then(() => { setMensaje(tipo === 'garantia' ? 'Garantía adjuntada.' : 'Fotografía agregada.'); tipo === 'garantia' ? setGarantia(null) : setFotografia(null); cargar(); }).catch(error => setMensaje(error.message));
  };
  const editarEntrega = entrega => {
    setEntregaEditando(entrega.id);
    setFormEntrega({ ...emptyDelivery, departamento_id: String(entrega.departamento_id || ''), responsable_id: entrega.responsable_id ? String(entrega.responsable_id) : '', destinatario: entrega.destinatario || '', fecha_entrega: entrega.fecha_entrega || emptyDelivery.fecha_entrega, observaciones: entrega.observaciones || '', articulos: (entrega.articulos || []).map(item => ({ activo_id: item.activo_id ? String(item.activo_id) : '', articulo: item.articulo || '', cantidad: item.cantidad || 1, detalles: item.detalles || '' })) });
    setEvidencias([]);
    setMensaje('Editando la entrega seleccionada.');
  };
  const cancelarEdicionEntrega = () => { setEntregaEditando(null); setFormEntrega(emptyDelivery); setEvidencias([]); setMensaje('Edición cancelada.'); };
  const guardarEntrega = event => {
    event.preventDefault();
    const editando = Boolean(entregaEditando);
    apiFetch(apiBaseUrl, editando ? `/api/admin/infraestructura/entregas/${entregaEditando}` : '/api/admin/infraestructura/entregas', { method: editando ? 'PUT' : 'POST', body: JSON.stringify({ ...formEntrega, departamento_id: Number(formEntrega.departamento_id), articulos: formEntrega.articulos.map(item => ({ ...item, cantidad: Number(item.cantidad) })) }) })
      .then(read)
      .then(async result => {
        const entregaId = result.data?.id;
        if (entregaId && evidencias.length) {
          for (const file of evidencias) {
            const body = new FormData();
            body.append('evidencia', file);
            await read(await apiFetch(apiBaseUrl, `/api/admin/infraestructura/entregas/${entregaId}/evidencias`, { method: 'POST', body }));
          }
        }
        setMensaje(editando ? 'Entrega corregida correctamente.' : (evidencias.length ? 'Entrega y evidencias registradas.' : 'Entrega registrada.'));
        setFormEntrega(emptyDelivery);
        setEvidencias([]);
        setEntregaEditando(null);
        cargar();
      })
      .catch(error => setMensaje(error.message));
  };
  const abrirGarantia = async () => {
    if (!seleccionado || !activo?.garantia_nombre) return;
    try {
      const response = await apiFetch(apiBaseUrl, `/api/admin/activos/${seleccionado}/garantia?inline=true`);
      if (!response.ok) throw new Error('No se pudo abrir la garantía.');
      const url = URL.createObjectURL(await response.blob());
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setMensaje(error.message); }
  };
  const actualizarArticulo = (index, value) => setFormEntrega(current => ({ ...current, articulos: current.articulos.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) }));
  const seleccionarActivoEntrega = (index, activoId) => {
    const activoSeleccionado = activos.find(item => String(item.id) === String(activoId));
    actualizarArticulo(index, { activo_id: activoId, articulo: activoSeleccionado ? `${activoSeleccionado.codigo} · ${activoSeleccionado.nombre}` : '', cantidad: 1 });
  };
  const activosSeleccionadosEnEntrega = formEntrega.articulos.map(item => String(item.activo_id || '')).filter(Boolean);
  const fotos = Array.isArray(activo?.fotografias) ? activo.fotografias : [];
  const tabs = [['activos', 'Activos'], ['entregas', 'Entregas'], ['documentos', 'Garantías y fotos'], ['historial', 'Vida útil e historial']];

  return <section className="space-y-5">
    {tab === 'entregas' && entregaEditando && <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">Editando la entrega seleccionada. Los cambios se guardarán desde el formulario.</div>}
    {tab === 'activos' && <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-3"><label className="text-sm font-semibold text-slate-700" htmlFor="activo-editar">Editar activo existente</label><select id="activo-editar" value={formActivo.id || ''} onChange={e => { const item = activos.find(asset => String(asset.id) === e.target.value); if (item) editarActivo(item); }} className="min-w-[280px] rounded border bg-white px-3 py-2 text-sm"><option value="">Seleccione un activo</option>{activos.map(item => <option key={item.id} value={item.id}>{item.codigo} · {item.nombre}</option>)}</select></div></div>}
    <div><p className="text-xs font-bold uppercase tracking-wide text-teal-700">Infraestructura</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Control de activos</h1><p className="mt-1 text-sm text-slate-500">Inventario, asignaciones, entregas, garantías y vida útil en un solo lugar.</p></div>
    <div className="flex flex-wrap gap-2">{tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-teal-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}</div>
    {mensaje && <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">{mensaje}</div>}
    {tab === 'entregas' && <div className="grid gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm md:grid-cols-2"><div><label className="text-xs font-semibold text-slate-600" htmlFor="responsable-entrega">Responsable de los activos</label><select id="responsable-entrega" required value={formEntrega.responsable_id || ''} onChange={e => { const user = usuarios.find(item => String(item.id) === e.target.value); setFormEntrega({ ...formEntrega, responsable_id: e.target.value, destinatario: user?.nombre || formEntrega.destinatario }); }} className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm"><option value="">Seleccione a quién se asignarán</option>{usuarios.map(user => <option key={user.id} value={user.id}>{user.nombre} · {user.email}</option>)}</select></div><div><label className="text-xs font-semibold text-slate-600" htmlFor="entrega-editar">Corregir entrega existente</label><select id="entrega-editar" value={entregaEditando || ''} onChange={e => { const entrega = entregas.find(item => String(item.id) === e.target.value); if (entrega) editarEntrega(entrega); }} className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm"><option value="">Seleccione una entrega</option>{entregas.map(item => <option key={item.id} value={item.id}>{item.destinatario} · {item.fecha_entrega}</option>)}</select></div>{entregaEditando && <button type="button" onClick={cancelarEdicionEntrega} className="justify-self-start rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Cancelar edición</button>}</div>}

    {tab === 'activos' && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className={panel}><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Inventario de activos</h2><span className="text-sm text-slate-500">{activos.length} registros</span></div><div className="space-y-2">{activos.map(item => <button key={item.id} type="button" onClick={() => seleccionar(item.id)} className={`block w-full rounded-lg border p-4 text-left ${String(seleccionado) === String(item.id) ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}><div className="flex flex-wrap justify-between gap-2"><strong>{item.codigo} · {item.nombre}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{item.estado}</span></div><p className="mt-1 text-xs text-slate-500">{item.tipo} · {item.departamento_nombre || 'Sin departamento'} · {item.responsable_nombre || 'Sin responsable'}</p><p className="mt-1 text-xs text-slate-500">Vida útil: {item.vida_util_anios || '—'} años · Compra: {item.orden_compra || '—'}</p></button>)}{!activos.length && <p className="text-sm text-slate-500">No hay activos registrados.</p>}</div></div>
      <form onSubmit={guardarActivo} className={`${panel} space-y-3`}><h2 className="text-lg font-bold">Registrar o editar activo</h2><div className="grid grid-cols-2 gap-2"><input required placeholder="Código" value={formActivo.codigo} onChange={e => setFormActivo({ ...formActivo, codigo: e.target.value })} className="rounded border px-3 py-2 text-sm" /><input required placeholder="Nombre" value={formActivo.nombre} onChange={e => setFormActivo({ ...formActivo, nombre: e.target.value })} className="rounded border px-3 py-2 text-sm" /></div><input placeholder="Tipo de activo" value={formActivo.tipo} onChange={e => setFormActivo({ ...formActivo, tipo: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><div className="grid grid-cols-2 gap-2"><select value={formActivo.departamento_id} onChange={e => setFormActivo({ ...formActivo, departamento_id: e.target.value })} className="rounded border bg-white px-3 py-2 text-sm"><option value="">Departamento</option>{departamentos.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><select value={formActivo.responsable_id} onChange={e => setFormActivo({ ...formActivo, responsable_id: e.target.value })} className="rounded border bg-white px-3 py-2 text-sm"><option value="">Responsable</option>{admins.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></div><div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">Fecha de compra<input type="date" value={formActivo.fecha_compra} onChange={e => setFormActivo({ ...formActivo, fecha_compra: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-800" /></label><label className="text-xs text-slate-500">Vida útil (años)<input type="number" min="1" value={formActivo.vida_util_anios} onChange={e => setFormActivo({ ...formActivo, vida_util_anios: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-800" /></label></div><div className="grid grid-cols-2 gap-2"><input placeholder="Orden de compra" value={formActivo.orden_compra} onChange={e => setFormActivo({ ...formActivo, orden_compra: e.target.value })} className="rounded border px-3 py-2 text-sm" /><label className="text-xs text-slate-500">Garantía hasta<input type="date" value={formActivo.garantia_hasta} onChange={e => setFormActivo({ ...formActivo, garantia_hasta: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-800" /></label></div><select value={formActivo.estado} onChange={e => setFormActivo({ ...formActivo, estado: e.target.value })} className="w-full rounded border bg-white px-3 py-2 text-sm"><option value="disponible">Disponible</option><option value="asignado">Asignado</option><option value="mantenimiento">Mantenimiento</option><option value="baja">Baja</option></select>{formActivo.estado === 'baja' && <input required placeholder="Motivo de baja" value={formActivo.motivo_baja} onChange={e => setFormActivo({ ...formActivo, motivo_baja: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />}<textarea placeholder="Notas y mantenimiento realizado" value={formActivo.notas} onChange={e => setFormActivo({ ...formActivo, notas: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><button className="w-full rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Guardar activo</button></form>
    </div>}

    {tab === 'historial' && <div className={panel}><h2 className="text-lg font-bold">Vida útil e historial</h2>{activo ? <><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Activo', `${activo.codigo} · ${activo.nombre}`], ['Estado', activo.estado], ['Departamento', activo.departamento_nombre || 'Sin departamento'], ['Responsable', activo.responsable_nombre || 'Sin responsable'], ['Compra', activo.fecha_compra || 'Sin fecha'], ['Orden', activo.orden_compra || 'Sin orden'], ['Vida útil', activo.vida_util_anios ? `${activo.vida_util_anios} años` : 'Sin definir'], ['Garantía', activo.garantia_hasta || 'Sin fecha']].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd></div>)}</div><form onSubmit={transferir} className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-3"><select required value={formActivo.transferencia?.departamento_id || ''} onChange={e => setFormActivo({ ...formActivo, transferencia: { ...(formActivo.transferencia || {}), departamento_id: e.target.value } })} className="rounded border bg-white px-3 py-2 text-sm"><option value="">Nuevo departamento</option>{departamentos.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><select value={formActivo.transferencia?.responsable_id || ''} onChange={e => setFormActivo({ ...formActivo, transferencia: { ...(formActivo.transferencia || {}), responsable_id: e.target.value } })} className="rounded border bg-white px-3 py-2 text-sm"><option value="">Nuevo responsable</option>{admins.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><input placeholder="Nota del movimiento" value={formActivo.transferencia?.nota || ''} onChange={e => setFormActivo({ ...formActivo, transferencia: { ...(formActivo.transferencia || {}), nota: e.target.value } })} className="rounded border px-3 py-2 text-sm" /><button className="rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white sm:col-span-3">Registrar transferencia</button></form><div className="mt-5 space-y-2 border-t border-slate-200 pt-5">{historial.map(item => <article key={item.id} className="rounded-lg border border-slate-200 px-4 py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{item.accion}</strong><time className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</time></div><p className="mt-1 text-xs text-slate-600">Registró: {item.usuario_nombre || 'Sistema'}{item.nota ? ` · ${item.nota}` : ''}</p></article>)}{!historial.length && <p className="text-sm text-slate-500">No hay movimientos registrados.</p>}</div></> : <p className="mt-3 text-sm text-slate-500">Seleccione un activo en la pestaña Activos.</p>}</div>}

    {tab === 'documentos' && <div className="grid gap-5 lg:grid-cols-2"><div className={panel}><h2 className="text-lg font-bold">Garantía y documentos</h2><p className="mt-1 text-sm text-slate-500">Seleccione un activo y adjunte su garantía o comprobantes.</p><select value={seleccionado || ''} onChange={e => { setSeleccionado(e.target.value); setMensaje(''); }} className="mt-4 w-full rounded border bg-white px-3 py-2 text-sm"><option value="">Seleccione activo</option>{activos.map(item => <option key={item.id} value={item.id}>{item.codigo} · {item.nombre}</option>)}</select>{activo?.garantia_nombre && <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"><div><p className="text-xs text-slate-500">Garantía adjunta</p><p className="text-sm font-semibold text-slate-800">{activo.garantia_nombre}</p></div><button type="button" onClick={abrirGarantia} className="rounded border border-teal-600 px-3 py-2 text-xs font-semibold text-teal-700">Ver garantía</button></div>}<form onSubmit={e => subir(e, 'garantia')} className="mt-4 space-y-2"><input required type="file" onChange={e => setGarantia(e.target.files[0])} className="w-full rounded border px-3 py-2 text-sm" /><button className="w-full rounded border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700">Subir garantía</button></form></div><div className={panel}><h2 className="text-lg font-bold">Fotografías del activo</h2><p className="mt-1 text-sm text-slate-500">Las fotografías son opcionales y quedan disponibles como evidencia.</p><form onSubmit={e => subir(e, 'fotografia')} className="mt-4 space-y-2"><input required accept="image/*" type="file" onChange={e => setFotografia(e.target.files[0])} className="w-full rounded border px-3 py-2 text-sm" /><button className="w-full rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Agregar fotografía</button></form><div className="mt-4 grid grid-cols-3 gap-2">{fotos.map(photo => <figure key={photo.id} className="overflow-hidden rounded border border-slate-200"><img src={`data:${photo.mime_type};base64,${photo.contenido}`} alt={photo.nombre} className="aspect-square w-full object-cover" /><figcaption className="truncate px-2 py-1 text-[11px] text-slate-500">{photo.nombre}</figcaption></figure>)}{!fotos.length && <p className="col-span-3 text-sm text-slate-500">No hay fotografías para este activo.</p>}</div></div></div>}

    {tab === 'entregas' && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><form onSubmit={guardarEntrega} className={`${panel} space-y-3`}><h2 className="text-lg font-bold">Registrar entrega</h2><select required value={formEntrega.departamento_id} onChange={e => setFormEntrega({ ...formEntrega, departamento_id: e.target.value })} className="w-full rounded border bg-white px-3 py-2 text-sm"><option value="">Departamento destino</option>{departamentos.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><input required placeholder="Persona que recibe" value={formEntrega.destinatario} onChange={e => setFormEntrega({ ...formEntrega, destinatario: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><input required type="date" value={formEntrega.fecha_entrega} onChange={e => setFormEntrega({ ...formEntrega, fecha_entrega: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><textarea placeholder="Nota de entrega" value={formEntrega.observaciones} onChange={e => setFormEntrega({ ...formEntrega, observaciones: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" /><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="mb-2 text-xs font-semibold text-slate-600">Activos y artículos entregados</p>{formEntrega.articulos.map((item, index) => <div key={index} className="mb-2 grid grid-cols-[minmax(0,1fr)_80px_auto] items-center gap-2"><select required value={item.activo_id || ''} onChange={e => seleccionarActivoEntrega(index, e.target.value)} className="rounded border bg-white px-3 py-2 text-sm"><option value="">Seleccionar activo disponible</option>{activos.filter(activoItem => (activoItem.estado === 'disponible' || String(activoItem.id) === String(item.activo_id)) && (!activosSeleccionadosEnEntrega.includes(String(activoItem.id)) || String(activoItem.id) === String(item.activo_id))).map(activoItem => <option key={activoItem.id} value={activoItem.id}>{activoItem.codigo} · {activoItem.nombre} · {activoItem.estado}</option>)}</select><input required type="number" min="1" max="1" value={item.cantidad} disabled={Boolean(item.activo_id)} onChange={e => actualizarArticulo(index, { cantidad: e.target.value })} className="rounded border px-3 py-2 text-sm disabled:bg-slate-100" /><button type="button" disabled={formEntrega.articulos.length === 1} onClick={() => setFormEntrega(current => ({ ...current, articulos: current.articulos.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Quitar artículo ${index + 1}`}>Quitar</button></div>)}<button type="button" onClick={() => setFormEntrega({ ...formEntrega, articulos: [...formEntrega.articulos, { activo_id: '', articulo: '', cantidad: 1, detalles: '' }] })} className="rounded border bg-white px-3 py-2 text-sm">Agregar activo</button></div><label className="block text-xs font-semibold text-slate-600">Evidencias fotográficas (opcional)<input type="file" accept="image/*" multiple onChange={e => setEvidencias(Array.from(e.target.files || []))} className="mt-1 w-full rounded border px-3 py-2 text-sm font-normal" /></label>{evidencias.length > 0 && <p className="text-xs text-slate-500">{evidencias.length} archivo(s) seleccionado(s).</p>}<button className="w-full rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Guardar entrega</button></form><div className={panel}><h2 className="text-lg font-bold">Entregas registradas</h2><div className="mt-3 space-y-2">{entregas.map(item => <article key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm"><strong>{item.destinatario}</strong><p className="text-xs text-slate-500">{item.departamento_nombre} · {item.fecha_entrega} · Entregó: {item.entregado_por_nombre || currentUser.nombre}</p><p className="mt-1 text-xs">{(item.articulos || []).map(article => `${article.articulo} (${article.cantidad})`).join(', ')}</p>{Array.isArray(item.evidencias) && item.evidencias.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2">{item.evidencias.map(evidence => <figure key={evidence.id} className="overflow-hidden rounded border"><img src={`data:${evidence.mime_type};base64,${evidence.contenido}`} alt={evidence.nombre_archivo} className="aspect-square w-full object-cover" /><figcaption className="truncate px-1 text-[10px] text-slate-500">{evidence.nombre_archivo}</figcaption></figure>)}</div>}</article>)}{!entregas.length && <p className="text-sm text-slate-500">No hay entregas registradas.</p>}</div></div></div>}
  </section>;
}
