import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'https://friendly-capybara-q74gqxwxr46xfx9vg-4000.app.github.dev';

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [form, setForm] = useState({
    nombre_solicitante: '', 
    departamento: '', 
    ubicacion: 'Presencial',
    titulo: '', 
    descripcion: '', 
    categoria: 'hardware',
    tipo_solicitud: 'incidente', 
    prioridad: 'media', 
    urgencia: 'media'
  });
  const [resolucionTextos, setResolucionTextos] = useState({});

  const cargarDatos = () => {
    fetch(`${API_BASE_URL}/api/tickets/listar`)
      .then(res => res.json())
      .then(data => { if (data.success) setTickets(data.data); })
      .catch(err => console.error("Error al listar tickets:", err));

    fetch(`${API_BASE_URL}/api/tickets/historial`)
      .then(res => res.json())
      .then(data => { if (data.success) setHistorial(data.data); })
      .catch(err => console.error("Error al cargar historial:", err));
  };

  useEffect(() => { 
    cargarDatos(); 
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetch(`${API_BASE_URL}/api/tickets/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Ticket creado y clasificado exitosamente');
        setForm({
          nombre_solicitante: '', 
          departamento: '', 
          ubicacion: 'Presencial',
          titulo: '', 
          descripcion: '', 
          categoria: 'hardware',
          tipo_solicitud: 'incidente', 
          prioridad: 'media', 
          urgencia: 'media'
        });
        cargarDatos();
      }
    })
    .catch(err => console.error("Error al crear ticket:", err));
  };

  const resolverTicket = (id) => {
    const textoResolucion = resolucionTextos[id] || 'Incidencia resuelta';
    
    fetch(`${API_BASE_URL}/api/tickets/resolver/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ detalles_resolucion: textoResolucion })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Ticket resuelto y movido al historial');
        cargarDatos();
      }
    })
    .catch(err => console.error("Error al resolver ticket:", err));
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Cabecera */}
        <header className="text-center">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">SGTI</h1>
          <p className="text-sm text-slate-500 mt-1">Sistema de Gestión de Tickets e Infraestructura IT</p>
        </header>

        {/* Formulario de Creación */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Registrar Nuevo Ticket</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input 
                type="text"
                placeholder="Nombre del solicitante" 
                value={form.nombre_solicitante}
                onChange={e => setForm({...form, nombre_solicitante: e.target.value})} 
                required 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
              />
              <input 
                type="text"
                placeholder="Departamento" 
                value={form.departamento}
                onChange={e => setForm({...form, departamento: e.target.value})} 
                required 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
              />
            </div>

            <input 
              type="text"
              placeholder="Título del problema" 
              value={form.titulo}
              onChange={e => setForm({...form, titulo: e.target.value})} 
              required 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
            />
            
            <textarea 
              placeholder="Descripción detallada del problema o incidencia" 
              value={form.descripcion}
              onChange={e => setForm({...form, descripcion: e.target.value})} 
              required 
              rows="3"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" 
            />
            
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
                <select 
                  value={form.categoria} 
                  onChange={e => setForm({...form, categoria: e.target.value})} 
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="hardware">Hardware</option>
                  <option value="software">Software</option>
                  <option value="redes">Redes</option>
                  <option value="gps">GPS / Rutas</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Prioridad</label>
                <select 
                  value={form.prioridad} 
                  onChange={e => setForm({...form, prioridad: e.target.value})} 
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta (Ingeniero)</option>
                  <option value="critica">Crítica (Ingeniero)</option>
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 text-sm shadow-sm"
            >
              Crear y Clasificar Ticket
            </button>
          </form>
        </section>

        {/* Tickets Activos */}
        <section>
          <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Tickets Activos</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
              {tickets.length}
            </span>
          </h3>

          {tickets.length === 0 ? (
            <p className="text-slate-500 italic bg-white p-6 rounded-xl border border-slate-200 text-center text-sm">
              No hay tickets activos en este momento.
            </p>
          ) : (
            <div className="space-y-4">
              {tickets.map(t => (
                <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow transition duration-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                    <h4 className="font-bold text-slate-900 text-base">{t.titulo}</h4>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      {t.prioridad}
                    </span>
                  </div>
                  
                  <p className="text-slate-600 text-sm mb-3">{t.descripcion}</p>
                  
                  <div className="text-xs text-slate-500 mb-4 bg-slate-50 p-2.5 rounded-lg flex flex-wrap gap-2">
                    <span>Solicitante: <strong className="text-slate-700">{t.nombre_solicitante}</strong> ({t.departamento})</span>
                    <span className="hidden sm:inline">|</span>
                    <span>Asignado a: <strong className="text-slate-700">{t.agente_asignado || 'Sin asignar'}</strong></span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                    <input 
                      type="text"
                      placeholder="Notas de resolución..." 
                      value={resolucionTextos[t.id] || ''}
                      onChange={e => setResolucionTextos({...resolucionTextos, [t.id]: e.target.value})} 
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" 
                    />
                    <button 
                      onClick={() => resolverTicket(t.id)} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition duration-200 shadow-sm whitespace-nowrap"
                    >
                      Resolver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Historial de Logs */}
        <section>
          <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Historial de Logs</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-semibold">
              {historial.length}
            </span>
          </h3>

          {historial.length === 0 ? (
            <p className="text-slate-500 italic bg-white p-6 rounded-xl border border-slate-200 text-center text-sm">
              El historial está vacío.
            </p>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              {historial.map(h => (
                <div key={h.log_id || h.id} className="text-xs sm:text-sm text-slate-600 p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-emerald-600 font-bold mr-2">[Resuelto]</span>
                    <strong className="text-slate-800">{h.titulo}</strong> 
                    <span className="text-slate-400 mx-2">|</span>
                    <span>Solicitante: {h.nombre_solicitante}</span>
                  </div>
                  <div className="text-slate-500 italic bg-white px-2 py-1 rounded border border-slate-200">
                    Solución: {h.detalles_resolucion}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}