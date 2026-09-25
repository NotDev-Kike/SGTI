const pool = require('../config/db');

// 1. Obtener Tickets con Filtro estricto por Rol (RBAC) y Búsqueda
exports.obtenerTicketsAvanzado = async (req, res) => {
  try {
    const { usuario_id, rol, departamento_id, search, estado } = req.query;
    
    let query = `
      SELECT t.*, u.nombre as creador_nombre, d.nombre as departamento_nombre, tec.nombre as tecnico_nombre
      FROM tickets t
      JOIN usuarios u ON t.usuario_creador_id = u.id
      JOIN departamentos d ON t.departamento_destino_id = d.id
      LEFT JOIN usuarios tec ON t.asignado_a_id = tec.id
      WHERE 1=1
    `;
    let values = [];
    let paramIndex = 1;

    // Control de acceso por rol
    if (rol === 'usuario_final') {
      query += ` AND t.usuario_creador_id = $${paramIndex++}`;
      values.push(usuario_id);
    } else if (rol === 'tecnico') {
      // Los técnicos solo ven los tickets de su departamento o los asignados a ellos
      query += ` AND (t.departamento_destino_id = $${paramIndex++} OR t.asignado_a_id = $${paramIndex++})`;
      values.push(departamento_id, usuario_id);
    }
    // 'gerente_it' y 'admin_infra' ven todo sin restricciones

    // Filtros opcionales de búsqueda y estado
    if (estado) {
      query += ` AND t.estado = $${paramIndex++}`;
      values.push(estado);
    }

    if (search) {
      query += ` AND (t.titulo ILIKE $${paramIndex} OR t.categoria ILIKE $${paramIndex} OR u.nombre ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY t.created_at DESC`;
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al filtrar los tickets' });
  }
};

// 2. Reasignar Ticket a otro Departamento o Técnico
exports.reasignarTicket = async (req, res) => {
  try {
    const { ticket_id } = req.params;
    const { nuevo_departamento_id, nuevo_asignado_id, usuario_accion_id } = req.body;

    const queryUpdate = `
      UPDATE tickets 
      SET departamento_destino_id = COALESCE($1, departamento_destino_id),
          asignado_a_id = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const updated = await pool.query(queryUpdate, [nuevo_departamento_id, nuevo_asignado_id, ticket_id]);

    // Registrar en el historial
    await pool.query(
      `INSERT INTO ticket_historial (ticket_id, usuario_id, accion) VALUES ($1, $2, $3)`,
      [ticket_id, usuario_accion_id, `Ticket reasignado a nuevo departamento/técnico`]
    );

    res.json({ message: 'Ticket reasignado con éxito', ticket: updated.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al reasignar el ticket' });
  }
};

// 3. Exportar Reportes en formato CSV
exports.exportarReportesCSV = async (req, res) => {
  try {
    const query = `
      SELECT t.id, t.titulo, t.categoria, t.prioridad, t.estado, t.created_at, u.nombre as creador, d.nombre as departamento
      FROM tickets t
      JOIN usuarios u ON t.usuario_creador_id = u.id
      JOIN departamentos d ON t.departamento_destino_id = d.id
    `;
    const result = await pool.query(query);

    let csv = 'ID,Titulo,Categoria,Prioridad,Estado,FechaCreacion,Creador,Departamento\n';
    result.rows.forEach(row => {
      csv += `${row.id},"${row.titulo}",${row.categoria},${row.prioridad},${row.estado},${row.created_at},"${row.creador}",${row.departamento}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('reporte_tickets_sgti.csv');
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
};