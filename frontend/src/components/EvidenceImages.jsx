import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const formatSize = bytes => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function EvidencePicker({ files, onChange, disabled = false }) {
  const [error, setError] = useState('');

  const addFiles = event => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    const available = MAX_FILES - files.length;
    if (selected.length > available) {
      setError(`Puede adjuntar hasta ${MAX_FILES} imágenes por envío.`);
      return;
    }
    const invalid = selected.find(file => !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE || file.size === 0);
    if (invalid) {
      setError('Use imágenes JPG, PNG, GIF o WebP de hasta 10 MB cada una.');
      return;
    }
    setError('');
    onChange([...files, ...selected]);
  };

  return (
    <div className="space-y-2">
      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
        Adjuntar evidencia (opcional)
        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple disabled={disabled || files.length >= MAX_FILES} onChange={addFiles} className="sr-only" />
      </label>
      <span className="ml-2 text-[11px] text-slate-500">JPG, PNG, GIF o WebP · hasta 10 MB por imagen · máximo 5.</span>
      {!!files.length && <ul className="flex flex-wrap gap-2">
        {files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex max-w-full items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
          <span className="max-w-48 truncate">{file.name} · {formatSize(file.size)}</span>
          <button type="button" disabled={disabled} aria-label={`Quitar ${file.name}`} onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))} className="font-bold text-slate-500 hover:text-red-700">×</button>
        </li>)}
      </ul>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

function EvidenceImage({ image, imagePathPrefix }) {
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    apiFetch(API_BASE_URL, `${imagePathPrefix}${image.id}`)
      .then(response => {
        if (!response.ok) throw new Error('No se pudo cargar esta imagen.');
        return response.blob();
      })
      .then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(loadError => { if (active) setError(loadError.message); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id, imagePathPrefix]);

  if (error) return <span role="alert" className="text-xs text-red-700">{error}</span>;
  if (!source) return <span className="text-xs text-slate-500">Cargando {image.nombre_archivo}…</span>;

  return <>
    <button type="button" onClick={() => setExpanded(true)} className="block overflow-hidden rounded-md border border-slate-200 bg-white text-left hover:border-blue-400">
      <img src={source} alt={image.nombre_archivo} className="h-28 max-w-48 object-contain" />
      <span className="block max-w-48 truncate px-2 py-1 text-[11px] text-slate-600">{image.nombre_archivo}</span>
    </button>
    {expanded && <div role="dialog" aria-modal="true" aria-label={image.nombre_archivo} className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setExpanded(false)}>
      <div className="max-h-full max-w-full rounded-lg bg-white p-2" onClick={event => event.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-3"><span className="max-w-[75vw] truncate text-sm font-semibold">{image.nombre_archivo}</span><button type="button" onClick={() => setExpanded(false)} className="rounded border px-3 py-1 text-sm">Cerrar</button></div>
        <img src={source} alt={image.nombre_archivo} className="max-h-[82vh] max-w-[88vw] object-contain" />
      </div>
    </div>}
  </>;
}

export function EvidenceGallery({ images = [], imagePathPrefix }) {
  if (!images.length) return null;
  return <div className="flex flex-wrap gap-2">
    {images.map(image => <EvidenceImage key={image.id} image={image} imagePathPrefix={imagePathPrefix} />)}
  </div>;
}
