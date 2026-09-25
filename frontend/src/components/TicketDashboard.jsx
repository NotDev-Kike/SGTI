import React, { useState } from 'react';

export default function TicketDashboard({ user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Estado de ejemplo para simular tickets con semáforo de tiempo
  const [tickets, setTickets] = useState([
    id: 1, 
    titulo: 'Fallo en conexión GPS - Ruta Norte', 
    solicitante: 'Carlos Pérez', 
    departamento: 'Logística',
    categoria: 'gps',
    asignado: 'Erick (GPS)',
    prioridad: 'critica',
    tiempoRestante: 'Vencido (2h)',
    estadoSemaforo: 'bg-red-500 animate-pulse' // Rojo crítico
  ]);

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-800">
      
      {/* SIDEBAR DESPLEGABLE / RESPONSIVO */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col shadow-xl`}>
        
        {/* Encabezado del Sidebar */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wider">SGTI</h2>
            <p className="text-xs text-slate-400">Gestión IT & Infraestructura</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {/* Menú de Navegación */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto text-sm">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            📊 Dashboard
          </button>
          <button 
            onClick={() => { setActiveTab('crear'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'crear' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            📝 Nuevo Ticket
          </button>
          <button 
            onClick={() => { setActiveTab('criticos'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'criticos' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            🚨 Tickets Críticos (Semáforo)
          </button>
          <button 
            onClick={() => { setActiveTab('historial'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'historial' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            📁 Historial Resueltos
          </button>
          {user.role.includes('Admin') && (
            <button 
              onClick={() => { setActiveTab('usuarios'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${activeTab === 'usuarios' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              👥 Gestión de Usuarios
            </button>
          )}
        </nav>

        {/* Perfil de Usuario en el Sidebar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="text-xs text-slate-400 mb-1">Conectado como:</div>
          <div className="font-bold text-white truncate text-sm">{user.email}</div>
          <div className="text-xs text-blue-400 font-semibold mb-3">{user.role}</div>
          <button 
            onClick={onLogout}
            className="w-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 text-xs font-semibold py-2 rounded-lg transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        
        {/* Barra Superior Móvil / Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-slate-600 hover:text-slate-900 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-sm font-semibold text-slate-700 capitalize">
            Sección: <span className="text-blue-600">{activeTab}</span>
          </div>
          <div className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium border border-slate-200">
            Área IT Activa
          </div>
        </header>

        {/* Cuerpo Dinámico según la pestaña activa */}
        <main className="p-6 flex-1 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-slate-900">Panel General de Control</h1>
              
              {/* Tarjetas de Métricas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500 font-semibold uppercase">Tickets Activos</div>
                  <div className="text-3xl font-extrabold text-blue-600 mt-2">12</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500 font-semibold uppercase">Críticos / Vencidos</div>
                  <div className="text-3xl font-extrabold text-red-600 mt-2">2</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500 font-semibold uppercase">Resueltos este Mes</div>
                  <div className="text-3xl font-extrabold text-emerald-600 mt-2">48</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'crear' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
              <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">Crear Nueva Solicitud o Incidencia</h2>
              <form className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Título del Problema</label>
                  <input type="text" placeholder="Ej. Falla en impresora piso 2" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                      <option>Hardware (Infraestructura)</option>
                      <option>Software</option>
                      <option>Redes y Conectividad</option>
                      <option>GPS / Rutas (Erick)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Asignar a Área / Técnico</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                      <option>Infraestructura General</option>
                      <option>Luis (Desarrollo)</option>
                      <option>Erick (GPS/Rutas)</option>
                      <option>Arnold (Gerencia IT)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción detallada</label>
                  <textarea rows="3" placeholder="Explique el inconveniente..." className="w-full px-3 py-2 border rounded-lg text-sm"></textarea>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Adjuntar Evidencia (Foto o Documento)</label>
                  <input type="file" className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </div>
                <button type="button" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm shadow-sm transition">
                  Enviar Ticket al Departamento IT
                </button>
              </form>
            </div>
          )}

          {activeTab === 'criticos' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>🚨 Monitor de Tickets Críticos (Sistema de Semáforo)</span>
              </h2>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-600 animate-ping"></span>
                    <h4 className="font-bold text-red-900">Fallo en servidor principal de Rutas GPS</h4>
                  </div>
                  <p className="text-xs text-red-700 mt-1">Asignado a: Erick | Tiempo transcurrido: 4h 30m (Superó límite)</p>
                </div>
                <button className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-700">Atender URGENTE</button>
              </div>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}