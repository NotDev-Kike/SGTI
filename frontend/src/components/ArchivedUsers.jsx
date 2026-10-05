import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { EvidenceGallery } from './EvidenceImages';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

const sections = [
  ['usuario', 'Datos originales de la cuenta'],
  ['tickets_solicitados', 'Tickets solicitados'],
  ['tickets_asignados', 'Tickets asignados'],
  ['historial_tickets', 'Historial de tickets'],
  ['mensajes_tickets', 'Mensajes en tickets'],
  ['adjuntos', 'Referencias a archivos adjuntos'],
  ['encuestas', 'Encuestas de satisfacción'],
  ['tareas', 'Tareas'],
  ['proyectos', 'Proyectos'],
  ['conversaciones_directas', 'Conversaciones directas'],
  ['entregas', 'Entregas'],
  ['inventario_actualizado', 'Inventario actualizado'],
  ['solicitudes_asistencia_remota', 'Solicitudes de asistencia remota'],
  ['imagenes_evidencia', 'Imágenes de evidencia']
];

const prettyLabel = value => value
  .replace(/_/g, ' ')
  .replace(/\b\w/g, letter => letter.toLocaleUpperCase());

function Record({ value }) {
  if (value == null || typeof value !== 'object') {
    return <span>{String(value ?? '—')}</span>;
  }
  const fields = Object.entries(value).filter(([key, item]) =>
    !['password', 'token', 'secret'].includes(key.toLowerCase()) && item != null && typeof item !== 'object'
  );
  const nested = Object.entries(value).filter(([, item]) => item && typeof item === 'object');
  return (
    <div className="space-y-2">
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {fields.map(([key, item]) => <div key={key} className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{prettyLabel(key)}</dt>
          <dd className="break-words text-xs text-slate-800">{String(item)}</dd>
        </div>)}
      </dl>
      {nested.map(([key, item]) => <details key={key} className="rounded border border-slate-200 bg-white p-2">
        <summary className="cursor-pointer text-xs font-semibold text-slate-700">{prettyLabel(key)}</summary>
        {Array.isArray(item)
          ? <div className="mt-2 space-y-2">{item.map((entry, index) => <div key={entry?.id || index} className="rounded border border-slate-100 p-2"><Record value={entry} /></div>)}</div>
          : <div className="mt-2"><Record value={item} /></div>}
      </details>)}
    </div>
  );
}

export default function ArchivedUsers() {
  const [archives, setArchives] = useState([]);
  const [selectedArchiveId, setSelectedArchiveId] = useState('');
  const [archive, setArchive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch(API_BASE_URL, '/api/admin/usuarios/archivo')
      .then(response => response.json())
      .then(data => {
        if (!data.success) throw new Error(data.message || 'No se pudo cargar el archivo.');
        if (!active) return;
        setArchives(data.data);
        setSelectedArchiveId(current => current || String(data.data[0]?.id || ''));
        setError('');
      })
      .catch(requestError => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedArchiveId) {
      setArchive(null);
      return undefined;
    }
    setArchive(null);
    setError('');
    let active = true;
    apiFetch(API_BASE_URL, `/api/admin/usuarios/archivo/${encodeURIComponent(selectedArchiveId)}`)
      .then(response => response.json())
      .then(data => {
        if (!data.success) throw new Error(data.message || 'No se pudo cargar el historial archivado.');
        if (active) setArchive(data.data);
      })
      .catch(requestError => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [selectedArchiveId]);

  return (
    <section className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Archivo histórico · Gerencia de IT</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Usuarios eliminados</h1>
        <p className="mt-1 text-sm text-slate-600">Perfiles e información relacionada conservados al eliminar cuentas. Las contraseñas y credenciales no se archivan.</p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading ? <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando archivo…</p>
        : !archives.length ? <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Todavía no hay usuarios eliminados.</p>
          : <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <nav aria-label="Usuarios archivados" className="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {archives.map(item => <button key={item.id} type="button" aria-pressed={String(item.id) === selectedArchiveId} onClick={() => setSelectedArchiveId(String(item.id))} className={`block w-full border-b border-slate-100 px-4 py-3 text-left ${String(item.id) === selectedArchiveId ? 'border-l-4 border-l-emerald-700 bg-emerald-50' : 'border-l-4 border-l-transparent hover:bg-slate-50'}`}>
                <strong className="block truncate text-sm text-slate-900">{item.nombre}</strong>
                <span className="block truncate text-xs text-slate-500">{item.email}</span>
                <span className="mt-1 block text-[11px] text-slate-500">{new Date(item.eliminado_en).toLocaleString()}</span>
                  <span className="mt-1 block text-[10px] text-slate-500">{Object.entries(item.resumen || {}).reduce((sum, [, count]) => sum + Number(count), 0)} registros relacionados</span>
                </button>)}
              </nav>
              {archive ? <article className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <header className="border-b border-slate-200 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="text-lg font-bold text-slate-900">{archive.nombre}</h2><p className="text-sm text-slate-600">{archive.email}</p></div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{archive.rol}</span>
                </div>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div><dt className="font-semibold text-slate-500">Área al eliminar</dt><dd>{archive.departamento_nombre || 'Sin área'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Eliminado por</dt><dd>{archive.eliminado_por_nombre || 'Gerencia de IT'}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Fecha de eliminación</dt><dd>{new Date(archive.eliminado_en).toLocaleString()}</dd></div>
                  <div><dt className="font-semibold text-slate-500">ID original</dt><dd>{archive.usuario_id_original}</dd></div>
                </dl>
              </header>
              {sections.map(([key, title]) => {
                const sectionValue = key === 'imagenes_evidencia'
                  ? archive.imagenes_archivadas
                  : archive.actividad?.[key];
                const records = Array.isArray(sectionValue) ? sectionValue : sectionValue ? [sectionValue] : [];
                return <details key={key} className="overflow-hidden rounded-lg border border-slate-200" open={['tickets_solicitados', 'tickets_asignados'].includes(key) && records.length > 0}>
                  <summary className="cursor-pointer bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">{title}<span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">{records.length}</span></summary>
                  <div className="space-y-3 border-t border-slate-200 p-3">
                    {key === 'imagenes_evidencia' && <EvidenceGallery images={records} imagePathPrefix={`/api/admin/usuarios/archivo/${archive.id}/imagenes/`} />}
                    {records.map((record, index) => <div key={record.id || index} className="rounded-md border border-slate-100 p-3"><Record value={record} /></div>)}
                    {!records.length && <p className="text-xs text-slate-500">No hay registros en esta sección.</p>}
                  </div>
                </details>;
              })}
            </article> : <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando el historial seleccionado…</p>}
          </div>}
    </section>
  );
}
