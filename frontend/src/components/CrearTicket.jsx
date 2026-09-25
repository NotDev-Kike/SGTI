import React, { useState } from 'react';

export default function CrearTicket({ usuarioId }) {
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    departamento_destino_id: '1',
    categoria: 'Hardware',
    prioridad: 'media'
  });
  const [foto, setFoto] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append('titulo', formData.titulo);
    data.append('descripcion', formData.descripcion);
    data.append('usuario_creador_id', usuarioId);
    data.append('departamento_destino_id', formData.departamento_destino_id);
    data.append('categoria', formData.categoria);
    data.append('prioridad', formData.prioridad);
    if (foto) data.append('foto', foto);

    try {
      const response = await fetch('http://localhost:5000/api/tickets', {
        method: 'POST',
        body: data
      });
      if (response.ok) {
        alert('¡Ticket creado con éxito!');
      } else {
        alert('Error al crear el ticket');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 bg-white shadow-md rounded-lg mt-6">
      <h2 className="text-xl font-bold mb-4 text-slate-800">Crear Nuevo Ticket</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Título del problema</label>
          <input 
            type="text" 
            required
            className="w-full mt-1 p-2 border border-gray-300 rounded-md"
            onChange={(e) => setFormData({...formData, titulo: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Descripción detallada</label>
          <textarea 
            required
            rows="3"
            className="w-full mt-1 p-2 border border-gray-300 rounded-md"
            onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Categoría</label>
            <select 
              className="w-full mt-1 p-2 border border-gray-300 rounded-md"
              onChange={(e) => setFormData({...formData, categoria: e.target.value})}
            >
              <option value="Hardware">Hardware</option>
              <option value="Software">Software</option>
              <option value="Redes">Redes / Internet</option>
              <option value="GPS">GPS / Rutas</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Prioridad</label>
            <select 
              className="w-full mt-1 p-2 border border-gray-300 rounded-md"
              onChange={(e) => setFormData({...formData, prioridad: e.target.value})}
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Adjuntar Evidencia (Foto)</label>
          {/* capture="environment" permite abrir la cámara directamente en celulares */}
          <input 
            type="file" 
            accept="image/*" 
            capture="environment"
            className="w-full mt-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            onChange={(e) => setFoto(e.target.files[0])}
          />
        </div>

        <button 
          type="submit" 
          className="w-full bg-blue-600 text-white p-2 rounded-md font-semibold hover:bg-blue-700 transition"
        >
          Enviar Ticket
        </button>
      </form>
    </div>
  );
}