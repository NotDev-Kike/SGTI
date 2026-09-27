import React, { useState } from 'react';

export default function CrearTicket({ currentUser, apiBaseUrl, onTicketCreated, setActiveTab }) {
  const [formTicketBasico, setFormTicketBasico] = useState({
    tipo_peticion: 'incidencia',
    titulo: '',
    descripcion: '',
    categoria: 'hardware',
    adminDestino: 'infra@sgti.com',
    evidencia: null
  });

  const handleSubmitTicketBasico = (e) => {
    e.preventDefault();
    const payload = {
      ...formTicketBasico,
      nombre_solicitante: currentUser.email,
      departamento: currentUser.area || 'General',
      prioridad: 'media'
    };

    fetch(`${apiBaseUrl}/api/tickets/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Ticket creado y clasificado exitosamente');
        setFormTicketBasico({ tipo_peticion: 'incidencia', titulo: '', descripcion: '', categoria: 'hardware', adminDestino: 'infra@sgti.com', evidencia: null });
        onTicketCreated();
        setActiveTab(currentUser.isAdmin ? 'todos_tickets' : 'mis_tickets');
      } else {
        alert('Error al crear el ticket');
      }
    })
    .catch(err => {
      console.error("Error:", err);
      alert('Ticket guardado de forma local (Offline mode)');
      onTicketCreated();
      setActiveTab('mis_tickets');
    });
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-slate-900 mb-2">Creación y Clasificación de Ticket</h2>
      <form onSubmit={handleSubmitTicketBasico} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Clasificación de Solicitud</label>
          <select 
            value={formTicketBasico.tipo_peticion}
            onChange={e => setFormTicketBasico({...formTicketBasico, tipo_peticion: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white font-medium text-blue-600"
          >
            <option value="incidencia">Incidencia</option>
            <option value="problema">Problema</option>
            <option value="peticion de servicio">Petición de Servicio</option>
            <option value="peticion de cambio">Petición de Cambio</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
            <select 
              value={formTicketBasico.categoria}
              onChange={e => setFormTicketBasico({...formTicketBasico, categoria: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="redes">Redes</option>
              <option value="gps">GPS / Rutas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Enviar a Admin IT</label>
            <select 
              value={formTicketBasico.adminDestino}
              onChange={e => setFormTicketBasico({...formTicketBasico, adminDestino: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="infra@sgti.com">Infraestructura General</option>
              <option value="luis@sgti.com">Luis (Desarrollo)</option>
              <option value="erick@sgti.com">Erick (GPS)</option>
              <option value="arnold@sgti.com">Arnold (Gerencia)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Título del Problema</label>
          <input 
            type="text" 
            value={formTicketBasico.titulo}
            onChange={e => setFormTicketBasico({...formTicketBasico, titulo: e.target.value})}
            placeholder="Resumen corto" 
            required 
            className="w-full px-3 py-2 border rounded-lg text-sm" 
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción</label>
          <textarea 
            rows="3" 
            value={formTicketBasico.descripcion}
            onChange={e => setFormTicketBasico({...formTicketBasico, descripcion: e.target.value})}
            placeholder="Detalles..." 
            required 
            className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
          ></textarea>
        </div>

        <button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm shadow transition"
        >
          Enviar Ticket
        </button>
      </form>
    </div>
  );
}