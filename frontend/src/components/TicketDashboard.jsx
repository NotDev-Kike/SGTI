import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'https://friendly-capybara-q74gqxwxr46xfx9vg-4000.app.github.dev';

export default function TicketDashboard() {
  const [tickets, setTickets] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [form, setForm] = useState({
    nombre_solicitante: '', departamento: '', ubicacion: 'Presencial',
    titulo: '', descripcion: '', categoria: 'hardware',
    tipo_solicitud: 'incidente', prioridad: 'media', urgencia: 'media'
  });
  const [resolucionText, setResolucionText] = useState('');

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

  useEffect(() => { cargarDatos(); }, []);

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
        cargarDatos();
      }
    })
    .catch(err => console.error("Error al crear ticket:", err));
  };

  const resolverTicket = (id) => {
    fetch(`${API_BASE_URL}/api/tickets/resolver/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ detalles_resolucion: resolucionText || 'Incidencia resuelta' })
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
    <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '800px', margin: 'auto' }}>
      <h2>SGTI - Gestión de Tickets e Infraestructura</h2>

      <form onSubmit={handleSubmit} style={{ background: '#f9f9f9', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
        <h3>Registrar Nuevo Ticket</h3>
        <input placeholder="Nombre del solicitante" onChange={e => setForm({...form, nombre_solicitante: e.target.value})} required style={{display:'block', margin:'5px 0', width:'100%'}} />
        <input placeholder="Departamento" onChange={e => setForm({...form, departamento: e.target.value})} required style={{display:'block', margin:'5px 0', width:'100%'}} />
        <input placeholder="Título del problema" onChange={e => setForm({...form, titulo: e.target.value})} required style={{display:'block', margin:'5px 0', width:'100%'}} />
        <textarea placeholder="Descripción detallada" onChange={e => setForm({...form, descripcion: e.target.value})} required style={{display:'block', margin:'5px 0', width:'100%'}} />
        
        <label>Prioridad: </label>
        <select onChange={e => setForm({...form, prioridad: e.target.value})} style={{margin:'5px 0'}}>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta (Ingeniero)</option>
          <option value="critica">Crítica (Ingeniero)</option>
        </select>
        <br />
        <button type="submit" style={{background:'#007bff', color:'#fff', padding:'8px 15px', border:'none', cursor:'pointer'}}>Crear y Clasificar</button>
      </form>

      <h3>Tickets Activos</h3>
      <ul>
        {tickets.map(t => (
          <li key={t.id} style={{ background: '#fff', border: '1px solid #ddd', padding: '10px', marginBottom: '10px' }}>
            <strong>{t.titulo}</strong> - [Prioridad: <em>{t.prioridad}</em>] - Asignado a: <strong>{t.agente_asignado}</strong>
            <p>{t.descripcion}</p>
            <input placeholder="Notas de resolución..." onChange={e => setResolucionText(e.target.value)} style={{marginRight:'10px'}} />
            <button onClick={() => resolverTicket(t.id)} style={{background:'#28a745', color:'#fff', border:'none', padding:'5px 10px'}}>Resolver</button>
          </li>
        ))}
      </ul>

      <h3>Historial de Logs</h3>
      <ul>
        {historial.map(h => (
          <li key={h.log_id} style={{ color: '#666', fontSize: '14px' }}>
            [Cerrado] <strong>{h.titulo}</strong> - Solicitante: {h.nombre_solicitante} | Solución: {h.detalles_resolucion}
          </li>
        ))}
      </ul>
    </div>
  );
}