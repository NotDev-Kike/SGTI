import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function TicketChat({ currentUser, chatMensajes = [], apiBaseUrl, onMessageSent, conversaciones = [] }) {
  const [admins, setAdmins] = useState([]);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (currentUser.isAdmin) return;
    apiFetch(apiBaseUrl, '/api/chat/directo/admins').then(res => res.json()).then(data => {
      if (data.success) {
        setAdmins(data.data);
        if (data.data.length) setDestinatarioId(current => current || String(data.data[0].id));
      }
    }).catch(() => {});
  }, [apiBaseUrl, currentUser.isAdmin]);

  const handleEnviarChat = () => {
    if (!mensaje.trim() || !destinatarioId) return;

    const recipient = Number(destinatarioId);
    const payload = currentUser.isAdmin ? { usuario_id: recipient, mensaje } : { admin_id: recipient, mensaje };
    apiFetch(apiBaseUrl, '/api/chat/directo', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        onMessageSent?.();
        setMensaje('');
      }
    })
    .catch(err => console.error('Error chat:', err));
  };

  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Chat Directo con IT</h2>
      <select value={destinatarioId} onChange={e => setDestinatarioId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
        <option value="">Seleccione {currentUser.isAdmin ? 'usuario' : 'administrador'}</option>
        {currentUser.isAdmin
          ? conversaciones.map(item => <option key={item.usuario_id} value={item.usuario_id}>{item.usuario_nombre}</option>)
          : admins.map(admin => <option key={admin.id} value={admin.id}>{admin.area || admin.rol} · {admin.nombre}</option>)}
      </select>
      <div className="h-64 border rounded-xl p-4 bg-slate-50 overflow-y-auto space-y-3 text-sm">
        {chatMensajes.map((m, index) => (
          <div key={m.id || index} className="p-3 bg-white border rounded-xl shadow-sm">
            <div className="text-xs text-blue-600 font-bold">{m.remitente_nombre || m.remitente_id}:</div>
            <p className="text-slate-700 mt-1">{m.mensaje}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input 
          type="text"
          placeholder="Escriba su mensaje inmediato..."
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
        />
        <button 
          onClick={handleEnviarChat}
          disabled={!destinatarioId || !mensaje.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}