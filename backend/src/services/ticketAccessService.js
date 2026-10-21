const adminRoles = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];

const roleByCategory = {
  hardware: 'admin_infra',
  infraestructura: 'admin_infra',
  redes: 'admin_infra',
  software: 'admin_desarrollo',
  desarrollo: 'admin_desarrollo',
  gps: 'admin_gps',
  'gps / rutas': 'admin_gps'
};

const rolesByDepartment = {
  'gerencia de it': ['gerente_it'],
  infraestructura: ['admin_infra'],
  desarrollo: ['admin_desarrollo'],
  'gps/rutas': ['admin_gps'],
  'gps / rutas': ['admin_gps']
};

const normalizarNombre = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const rolesParaDepartamento = nombre => {
  const departamento = normalizarNombre(nombre);
  if (rolesByDepartment[departamento]) return rolesByDepartment[departamento];
  if (departamento.includes('infraestructura')) return ['admin_infra'];
  if (departamento.includes('gps') || departamento.includes('ruta')) return ['admin_gps'];
  if (departamento.includes('desarrollo') || departamento.includes('software')) return ['admin_desarrollo'];
  if (departamento.includes('gerencia') || departamento.includes('it')) return ['gerente_it'];
  return [];
};

const puedeAccederTicket = (user, ticket) => {
  const userId = Number(user?.id);
  const isRequester = Number(ticket.usuario_creador_id) === userId;
  if (isRequester || user?.rol === 'gerente_it') return true;
  if (!adminRoles.includes(user?.rol)) return false;

  const categoria = String(ticket.categoria || '').trim().toLowerCase();
  return Number(ticket.asignado_a_id) === userId || roleByCategory[categoria] === user.rol;
};

module.exports = { puedeAccederTicket, rolesParaDepartamento };
