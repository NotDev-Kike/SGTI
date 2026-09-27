import React, { useState } from 'react';

export default function PanelGestionIT({ tickets, historial, apiBaseUrl, onUpdate }) {
  const [resolucionTextos, setResolucionTextos] = useState({});

  const resolverTicket = (id) => {
    const textoResolucion = resolucionTextos[id] || 'Incidencia resuelta satisfactoriamente';
    
    fetch(`${apiBaseUrl}/api/tickets/resolver/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ detalles_resolucion: textoResolucion })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Ticket resuelto y movido al historial');
        onUpdate();
      }
    })
    .catch(err => {
      console.error("Error al resolver:", err);
      onUpdate();
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Panel de Gestión IT (Todos los Tickets)</h2>
      {tickets.length === 0 ? (
        <p className="text-slate-500 italic bg-white p-6 rounded-xl border text-center text-sm">No hay tickets activos.</p>
      ) : (
        <div className="space-y-4">
          {tickets.map(t => (
            <div key={t.id} className="bg-white border rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-900">{t.titulo}</h3>
                <span className="text-xs px-3 py-1 rounded-full font-bold uppercase bg-amber-100 text-amber-800">
                  {t.prioridad || 'media'}
                </span>
              </div>
              <p className="text-slate-600 text-sm">{t.descripcion}</p>
              <div className="text-xs text-slate-500">Solicitante: <strong>{t.nombre_solicitante}</strong></div>
              
              <div className="flex gap-2 pt-2 border-t">
                <input 
                  type="text"
                  placeholder="Notas de resolución..." 
                  value={resolucionTextos[t.id] || ''}
                  onChange={e => setResolucionTextos({...resolucionTextos, [t.id]: e.target.value})} 
                  className="flex-1 px-3 py-2 border rounded-lg text-sm" 
                />
                <button 
                  onClick={() => resolverTicket(t.id)} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm"
                >
                  Resolver
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}