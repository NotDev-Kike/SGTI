import React, { useState, useEffect } from 'react';

export default function PanelGestionIT({ usuarioActual }) {
  const [tickets, setTickets] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/tickets/filtrar?rol=${usuarioActual.rol}&usuario_id=${usuarioActual.id}&departamento_id=${usuarioActual.departamento_id}`);
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Función visual del semáforo por tiempo
  const obtenerColorSemaforo = (fechaLimite, estado) => {
    if (estado === 'resuelto') return 'bg-gray-200 text-gray-700';
    const diff = new Date(fechaLimite) - new Date();
    const horasRestantes = diff / (1000 * 60 * 60);

    if (horasRestantes < 0) return 'bg-red-500 text-white animate-pulse'; // Crítico / Vencido
    if (horasRestantes <= 4) return 'bg-yellow-400 text-black'; // Precaución
    return 'bg-green-500 text-white'; // A tiempo
  };

  const exportarCSV = () => {
    window.open('http://localhost:5000/api/tickets/reportes/exportar', '_blank');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Panel de Control IT</h1>
        <button 
          onClick={exportarCSV}
          className="bg-emerald-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-emerald-700 transition"
        >
          Exportar Reportes (CSV)
        </button>
      </div>

      {/* Barra de búsqueda rápida */}
      <div className="mb-4">
        <input 
          type="text"
          placeholder="Buscar por título, categoría o usuario..."
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* Tabla de Tickets con Semáforo */}
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b text-slate-700 text-sm">
              <th className="p-3">ID</th>
              <th className="p-3">Título</th>
              <th className="p-3">Creador</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Estado / Semáforo</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tickets.filter(t => t.titulo.toLowerCase().includes(busqueda.toLowerCase())).map((ticket) => (
              <tr key={ticket.id} className="border-b hover:bg-slate-50 text-sm">
                <p className="p-3 font-semibold">#{ticket.id}</p>
                <td className="p-3">{ticket.titulo}</td>
                <td className="p-3">{ticket.creador_nombre}</td>
                <td className="p-3">{ticket.categoria}</td>
                <td className="p-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${obtenerColorSemaforo(ticket.fecha_limite, ticket.estado)}`}>
                    {ticket.estado.toUpperCase()}
                  </span>
                </td>
                <td className="p-3">
                  <button className="text-blue-600 hover:underline font-medium">Ver / Gestionar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}