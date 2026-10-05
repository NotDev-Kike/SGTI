import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

const formatDate = value => value
  ? new Date(value).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
  : '—';

const statusLabel = {
  pendiente: 'En espera',
  atendiendo: 'En atención',
  completada: 'Completada',
  cancelada: 'Cancelada'
};

const statusStyle = {
  pendiente: 'bg-amber-100 text-amber-900',
  atendiendo: 'bg-blue-100 text-blue-900',
  completada: 'bg-emerald-100 text-emerald-900',
  cancelada: 'bg-slate-100 text-slate-700'
};

async function requestJson(path, options) {
  const response = await apiFetch(API_BASE_URL, path, options);
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'No se pudo completar la solicitud.');
  return data;
}

function AnyDeskLink({ id }) {
  return <a
    href={`anydesk://${encodeURIComponent(id)}`}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
  >
    Abrir AnyDesk
  </a>;
}

export default function RemoteAssistance({ currentUser }) {
  const isAdmin = currentUser.isAdmin;
  const [requests, setRequests] = useState([]);
  const [anydeskId, setAnydeskId] = useState('');
  const [description, setDescription] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let active = true;
    const endpoint = isAdmin ? '/api/asistencia-remota' : '/api/asistencia-remota/mias';
    const loadRequests = () => requestJson(endpoint)
      .then(data => { if (active) { setRequests(data.data); setError(''); } })
      .catch(loadError => { if (active) setError(loadError.message); });
    loadRequests();
    const refresh = window.setInterval(loadRequests, 5000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, [isAdmin, reloadCount]);

  const saveRequest = async event => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await requestJson('/api/asistencia-remota', {
        method: 'POST',
        body: JSON.stringify({ anydesk_id: anydeskId, descripcion: description })
      });
      setAnydeskId('');
      setDescription('');
      setReloadCount(value => value + 1);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateRequest = async (id, action) => {
    setBusyId(id);
    setError('');
    try {
      await requestJson(`/api/asistencia-remota/${id}/${action}`, { method: 'PATCH', body: JSON.stringify({}) });
      setReloadCount(value => value + 1);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId(null);
    }
  };

  const activeRequest = requests.find(request => ['pendiente', 'atendiendo'].includes(request.estado));
  const currentAssignment = requests.find(request =>
    request.estado === 'atendiendo' && Number(request.atendido_por_id) === Number(currentUser.id)
  );

  return (
    <section className="space-y-5 p-4 sm:p-6">
      <header className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Soporte remoto</p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">Asistencia mediante AnyDesk</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {isAdmin
            ? 'Las solicitudes se muestran en una cola compartida. Cada administrador puede atender una sola solicitud a la vez.'
            : 'Envíe su solicitud y el equipo de IT la atenderá por orden. AnyDesk solo iniciará la conexión cuando usted acepte el aviso en su dispositivo.'}
        </p>
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {!isAdmin && <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="font-bold text-slate-900">Solicitar asistencia remota</h4>
        {activeRequest
          ? <p className="mt-2 text-sm text-slate-600">Ya tiene una solicitud activa. Espere a que se complete antes de enviar otra.</p>
          : <form onSubmit={saveRequest} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              ID o alias de AnyDesk
              <input required minLength="3" maxLength="120" pattern="[\p{L}\p{N}][\p{L}\p{N}._@-]{2,119}" value={anydeskId} onChange={event => setAnydeskId(event.target.value)} placeholder="Ej. 123456789" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900" />
            </label>
            <label className="text-xs font-semibold text-slate-600 sm:row-span-2">
              ¿Qué ayuda necesita? (opcional)
              <textarea maxLength="1000" rows="3" value={description} onChange={event => setDescription(event.target.value)} placeholder="Describa brevemente el problema" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900" />
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={submitting} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
                {submitting ? 'Enviando solicitud…' : 'Solicitar asistencia'}
              </button>
            </div>
            <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
              Comparta su ID de AnyDesk solo para esta atención. El personal de IT no obtiene acceso automáticamente: deberá aceptar la conexión entrante en AnyDesk.
            </p>
          </form>}
      </section>}

      {isAdmin && currentAssignment && <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Su atención en curso</p>
        <h4 className="mt-1 font-bold text-slate-900">{currentAssignment.solicitante_nombre}</h4>
        <p className="text-sm text-slate-600">{currentAssignment.solicitante_email} · AnyDesk: <strong>{currentAssignment.anydesk_id}</strong></p>
        {currentAssignment.descripcion && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{currentAssignment.descripcion}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <AnyDeskLink id={currentAssignment.anydesk_id} />
          <button type="button" disabled={busyId === currentAssignment.id} onClick={() => updateRequest(currentAssignment.id, 'finalizar')} className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60">
            Finalizar asistencia
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">Confirme la autorización del usuario antes de iniciar o continuar el control remoto.</p>
      </section>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-bold text-slate-900">{isAdmin ? 'Cola de asistencia' : 'Mis solicitudes recientes'}</h4>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {isAdmin ? `${requests.filter(request => request.estado === 'pendiente').length} en espera` : `${requests.length} solicitudes`}
          </span>
        </div>

        <div className="space-y-3">
          {requests.map(request => {
            const isAssignedToMe = Number(request.atendido_por_id) === Number(currentUser.id);
            return <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="font-semibold text-slate-900">{isAdmin ? request.solicitante_nombre : `Solicitud #${request.id}`}</h5>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[request.estado] || statusStyle.cancelada}`}>{statusLabel[request.estado] || request.estado}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {isAdmin && <>{request.solicitante_email} · </>}AnyDesk: <strong className="text-slate-800">{request.anydesk_id}</strong>
                  </p>
                  {request.descripcion && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{request.descripcion}</p>}
                  <p className="mt-2 text-xs text-slate-500">
                    Solicitada: {formatDate(request.creada_en)}
                    {request.atendido_por_nombre && <> · Atendida por {request.atendido_por_nombre}</>}
                  </p>
                </div>
                {isAdmin && request.estado === 'pendiente' && <button
                  type="button"
                  disabled={Boolean(currentAssignment) || busyId === request.id}
                  onClick={() => updateRequest(request.id, 'tomar')}
                  className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyId === request.id ? 'Tomando…' : currentAssignment ? 'Finalice su atención actual' : 'Atender esta solicitud'}
                </button>}
                {!isAdmin && request.estado === 'pendiente' && <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => updateRequest(request.id, 'cancelar')}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>}
              </div>
            </article>;
          })}
          {!requests.length && <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            {isAdmin ? 'No hay solicitudes remotas pendientes.' : 'Todavía no ha enviado solicitudes de asistencia remota.'}
          </p>}
        </div>
      </section>
    </section>
  );
}
