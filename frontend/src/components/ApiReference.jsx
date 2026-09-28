import React, { useState } from 'react';

const endpoints = [
  { method: 'POST', path: '/api/auth/login', access: 'Público', purpose: 'Iniciar sesión', usedBy: 'Pantalla de acceso' },
  { method: 'POST', path: '/api/auth/registro', access: 'Gerente de IT', purpose: 'Registrar una cuenta', usedBy: 'Flujo administrativo de alta' },
  { method: 'GET', path: '/api/auth/departamentos', access: 'Público', purpose: 'Consultar áreas', usedBy: 'Formularios de tickets y usuarios' },
  { method: 'GET', path: '/api/tickets', access: 'Sesión', purpose: 'Listar tickets propios o activos', usedBy: 'Mis tickets y tickets de todos' },
  { method: 'POST', path: '/api/tickets', access: 'Sesión', purpose: 'Crear un ticket', usedBy: 'Formulario Crear ticket' },
  { method: 'GET', path: '/api/tickets/resueltos', access: 'Sesión', purpose: 'Listar tickets resueltos propios', usedBy: 'Mis tickets y encuesta' },
  { method: 'GET', path: '/api/tickets/historial', access: 'Administrador de IT', purpose: 'Consultar tickets resueltos', usedBy: 'Historial' },
  { method: 'PUT', path: '/api/tickets/:id/asignar', access: 'Gerente de IT', purpose: 'Asignar responsable', usedBy: 'Gestión de tickets' },
  { method: 'PUT', path: '/api/tickets/:id/resolver', access: 'Administrador de IT', purpose: 'Resolver un ticket', usedBy: 'Gestión de tickets' },
  { method: 'POST', path: '/api/tickets/:id/encuesta', access: 'Sesión', purpose: 'Enviar satisfacción', usedBy: 'Encuesta de satisfacción' },
  { method: 'GET', path: '/api/chat/:ticket_id/mensajes', access: 'Sesión y acceso al ticket', purpose: 'Consultar conversación del ticket', usedBy: 'Ventana de detalle del ticket' },
  { method: 'POST', path: '/api/chat/:ticket_id/mensajes', access: 'Sesión y acceso al ticket', purpose: 'Enviar una aclaración o respuesta', usedBy: 'Ventana de detalle del ticket' },
  { method: 'POST', path: '/api/tickets/:id/mensajes', access: 'Sesión y acceso al ticket', purpose: 'Enviar un mensaje al ticket', usedBy: 'Ruta compatible; la interfaz usa /api/chat/:id/mensajes' },
  { method: 'GET', path: '/api/admin/tickets/todos', access: 'Administrador de IT', purpose: 'Consultar tickets activos', usedBy: 'Tickets de todos y panel principal' },
  { method: 'GET', path: '/api/admin/tickets/eficiencia', access: 'Administrador de IT', purpose: 'Consultar métricas de atención', usedBy: 'Panel principal' },
  { method: 'PUT', path: '/api/admin/tickets/:id/modificar', access: 'Administrador; reasignar solo gerente', purpose: 'Actualizar estado y datos del ticket', usedBy: 'Detalle y asignación de tickets' },
  { method: 'PUT', path: '/api/admin/tickets/:id/seguimiento', access: 'Responsable asignado o gerente', purpose: 'Enviar avance o resolver', usedBy: 'Ventana de detalle del ticket' },
  { method: 'GET', path: '/api/admin/usuarios', access: 'Gerente de IT', purpose: 'Consultar cuentas', usedBy: 'Gestión de usuarios' },
  { method: 'POST', path: '/api/admin/usuarios', access: 'Gerente de IT', purpose: 'Crear o editar una cuenta', usedBy: 'Gestión de usuarios' },
  { method: 'DELETE', path: '/api/admin/usuarios/:id', access: 'Gerente de IT', purpose: 'Desactivar una cuenta', usedBy: 'Gestión de usuarios' },
  { method: 'GET', path: '/api/admin/calendario', access: 'Administrador de IT', purpose: 'Consultar fechas límite', usedBy: 'Calendario' },
  { method: 'GET', path: '/api/admin/tareas', access: 'Administrador de IT', purpose: 'Consultar tareas internas', usedBy: 'Tareas' },
  { method: 'POST', path: '/api/admin/tareas', access: 'Administrador de IT', purpose: 'Crear o editar tarea', usedBy: 'Tareas' },
  { method: 'DELETE', path: '/api/admin/tareas/:id', access: 'Administrador de IT', purpose: 'Eliminar tarea', usedBy: 'Tareas' },
  { method: 'GET', path: '/api/admin/proyectos-ti', access: 'Administrador de IT', purpose: 'Consultar proyectos', usedBy: 'Proyectos de IT' },
  { method: 'POST', path: '/api/admin/proyectos-ti', access: 'Administrador de IT', purpose: 'Crear o editar proyecto', usedBy: 'Proyectos de IT' },
  { method: 'DELETE', path: '/api/admin/proyectos-ti/:id', access: 'Administrador de IT', purpose: 'Eliminar proyecto', usedBy: 'Proyectos de IT' },
  { method: 'GET', path: '/api/admin/configuraciones', access: 'Administrador de IT', purpose: 'Consultar configuración', usedBy: 'Configuración' },
  { method: 'PUT', path: '/api/admin/configuraciones', access: 'Administrador de IT', purpose: 'Guardar configuración', usedBy: 'Configuración' },
  { method: 'GET', path: '/api/chat/directo/admins', access: 'Sesión', purpose: 'Consultar personal de soporte', usedBy: 'Mensajes con IT' },
  { method: 'GET', path: '/api/chat/directo', access: 'Sesión', purpose: 'Consultar mensajes directos', usedBy: 'Mensajes con IT' },
  { method: 'POST', path: '/api/chat/directo', access: 'Sesión', purpose: 'Enviar un mensaje directo', usedBy: 'Mensajes con IT' }
];

export default function ApiReference() {
  const [busqueda, setBusqueda] = useState('');
  const termino = busqueda.trim().toLocaleLowerCase();
  const resultados = endpoints.filter(endpoint =>
    [endpoint.method, endpoint.path, endpoint.access, endpoint.purpose, endpoint.usedBy]
      .some(value => value.toLocaleLowerCase().includes(termino))
  );

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Referencia de API</h1>
        <p className="mt-1 text-sm text-slate-600">Rutas disponibles y módulos de la aplicación que las utilizan.</p>
      </div>
      <label className="block max-w-lg">
        <span className="sr-only">Buscar rutas o funciones</span>
        <input type="search" value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Buscar por ruta, función o módulo" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
      </label>
      <div className="overflow-x-auto bg-white border border-slate-200 rounded">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Método</th><th className="px-4 py-3">Ruta</th><th className="px-4 py-3">Acceso</th><th className="px-4 py-3">Función</th><th className="px-4 py-3">Se usa en</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {resultados.map(endpoint => <tr key={`${endpoint.method}-${endpoint.path}`}>
              <td className="px-4 py-3 font-semibold text-slate-700">{endpoint.method}</td>
              <td className="px-4 py-3 font-mono text-xs text-blue-800">{endpoint.path}</td>
              <td className="px-4 py-3 text-slate-600">{endpoint.access}</td>
              <td className="px-4 py-3 text-slate-700">{endpoint.purpose}</td>
              <td className="px-4 py-3 text-slate-600">{endpoint.usedBy}</td>
            </tr>)}
            {!resultados.length && <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">No se encontraron rutas.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}