import React from 'react';

export default function TicketDashboard({ currentUser, tickets, historial, setActiveTab }) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Bienvenido, {currentUser.email}</h1>
          <p className="text-sm text-slate-500 mt-1">Panel de control y métricas del sistema.</p>
        </div>
        {!currentUser.isAdmin && (
          <button 
            onClick={() => setActiveTab('crear_ticket')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow transition"
          >
            + Nuevo Ticket
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-bold uppercase">Tickets Activos</div>
          <div className="text-3xl font-extrabold text-blue-600 mt-2">{tickets.length}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-bold uppercase">Tickets Críticos</div>
          <div className="text-3xl font-extrabold text-red-600 mt-2">
            {tickets.filter(t => t.prioridad === 'critica').length}
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-bold uppercase">Historial Resueltos</div>
          <div className="text-3xl font-extrabold text-emerald-600 mt-2">{historial.length}</div>
        </div>
      </div>
    </div>
  );
}