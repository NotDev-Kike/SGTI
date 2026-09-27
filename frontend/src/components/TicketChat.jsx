import React, { useState } from 'react';

export default function TicketChat({ currentUser, chatMensajes, apiBaseUrl, onMessageSent }) {
  const [nuevoMensaje, setNuevoMensaje] = useState({ para: 'infra@sgti.com', texto: '' });

  const handleEnviarChat = () => {
    if (!nuevoMensaje.texto.trim()) return;

    fetch(`${apiBaseUrl}/api/chat/enviar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ de: currentUser.email, para: nuevoMensaje.para, mensaje: nuevoMensaje.texto })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        onMessageSent();
        setNuevoMensaje({ ...nuevoMensaje, texto: '' });
      }
    })
    .catch(err => {
      console.error("Error chat:", err);
      setNuevoMensaje({ ...nuevoMensaje, texto: '' });
    });
  };

  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Chat Directo con IT</h2>
      <div className="h-64 border rounded-xl p-4 bg-slate-50 overflow-y-auto space-y-3 text-sm">
        {chatMensajes.map(m => (
          <div key={m.id || Math.random()} className="p-3 bg-white border rounded-xl shadow-sm">
            <div className="text-xs text-blue-600 font-bold">{m.de} (Para: {m.para}):</div>
            <p className="text-slate-700 mt-1">{m.mensaje}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input 
          type="text"
          placeholder="Escriba su mensaje inmediato..."
          value={nuevoMensaje.texto}
          onChange={e => setNuevoMensaje({...nuevoMensaje, texto: e.target.value})}
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
        />
        <button 
          onClick={handleEnviarChat}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}