import React from 'react';

const groups = [
  {
    title: 'Tickets y atención',
    items: [
      ['GET', '/api/admin/tickets/todos', 'Consulta tickets activos'],
      ['PUT', '/api/admin/tickets/:id/modificar', 'Actualiza estado, área o responsable'],
      ['PUT', '/api/admin/tickets/:id/seguimiento', 'Registra seguimiento o resolución'],
      ['GET', '/api/tickets/:id/historial', 'Consulta la historia del ticket']
    ]
  },
  {
    title: 'Administración',
    items: [
      ['GET', '/api/admin/auditoria', 'Consulta actividad registrada'],
      ['GET', '/api/admin/sesiones', 'Consulta usuarios conectados'],
      ['GET/POST', '/api/admin/sla', 'Consulta o guarda políticas de tiempo'],
      ['GET/POST', '/api/admin/archivos', 'Comparte archivos entre administradores']
    ]
  },
  {
    title: 'Infraestructura',
    items: [
      ['GET/POST', '/api/admin/activos', 'Gestiona activos y ciclo de vida'],
      ['GET', '/api/admin/activos/:id/historial', 'Consulta movimientos del activo'],
      ['POST', '/api/admin/activos/:id/transferir', 'Registra una transferencia'],
      ['POST', '/api/admin/activos/:id/fotografias', 'Agrega fotografías del activo'],
      ['POST', '/api/admin/activos/:id/garantia', 'Adjunta garantía']
    ]
  },
  {
    title: 'Microsoft 365',
    items: [
      ['GET/POST', '/api/admin/microsoft/eventos', 'Consulta o crea eventos'],
      ['POST', '/api/admin/microsoft/solicitudes', 'Solicita una cuenta Microsoft']
    ]
  }
];

export default function AdminApiReference() {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Administración</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Referencia de API</h1>
        <p className="mt-1 text-sm text-slate-500">Consulta rápida de las operaciones disponibles para el equipo administrador.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map(group => (
          <section key={group.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 border-b border-slate-200 pb-3 text-base font-bold text-slate-900">{group.title}</h2>
            <div className="space-y-2">
              {group.items.map(([method, path, description]) => (
                <div key={`${method}-${path}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">{method}</span>
                    <code className="text-xs font-semibold text-slate-700">{path}</code>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{description}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
