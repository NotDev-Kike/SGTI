import React, { useState, useEffect, useRef } from 'react';

export default function TicketChat({ ticketId, usuarioActual }) {
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const chatEndRef = useRef(null);

  // Cargar mensajes al abrir y hacer polling cada 4 segundos (para simular tiempo real de forma sencilla)
  useEffect(() => {
    cargarMensajes();
    const intervalo = setInterval(cargarMensajes, 4000);
    return () => clearInterval(intervalo);
  }, [ticketId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const cargarMensajes = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/chat/${ticketId}/mensajes`);
      const data = await res.json();
      setMensajes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const enviarMensaje = async (e) => {
    e.preventDefault();
    if (!nuevoMensaje.trim()) return;

    try {
      const res = await fetch(`http://localhost:5000/api/chat/${ticketId}/mensajes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remitente_id: usuarioActual.id,
          mensaje: nuevoMensaje
        })
      });

      if (res.ok) {
        setNuevoMensaje('');
        cargarMensajes();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white border border-gray-200 rounded-lg shadow-md max-w-2xl mx-auto">
      {/* Cabecera del Chat */}
      <div className="bg-slate-900 text-white p-4 rounded-t-lg font-semibold flex justify-between items-center">
        <span>Chat de Soporte - Ticket #{ticketId}</span>
        <span className="text-xs bg-blue-600 px-2 py-1 rounded">Activo</span>
      </div>

      {/* Cuerpo de Mensajes */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
        {mensajes.map((m) => {
          const esMio = m.remitente_id === usuarioActual.id;
          return (
            <div key={m.id} className={`flex flex-col ${esMio ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-gray-500 mb-1">
                {m.remitente_nombre} ({m.remitente_rol})
              </span>
              <div className={`p-3 rounded-lg max-w-[80%] text-sm shadow-sm ${
                esMio ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-gray-200 rounded-bl-none'
              }`}>
                {m.mensaje}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input para Enviar Mensaje */}
      <form onSubmit={enviarMensaje} className="p-3 bg-white border-t border-gray-200 flex gap-2">
        <input 
          type="text"
          value={nuevoMensaje}
          onChange={(e) => setNuevoMensaje(e.target.value)}
          placeholder="Escribe un mensaje para IT o el usuario..."
          className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <button 
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 transition text-sm"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}