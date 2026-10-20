const db = require('../config/db');
const { guardarImagenesEvidencia } = require('../services/evidenceImageService');
const { assignTicket } = require('./enterpriseController');
const microsoft = require('../services/microsoftService');
const { enviarAvisoTicket } = require('../services/emailService');

exports.listarCategorias = async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT id, nombre FROM categorias_ticket WHERE activo = TRUE ORDER BY nombre');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const historialPublicoSql = `
  COALESCE((
    SELECT json_agg(json_build_object(
      'tipo', CASE
        WHEN h.accion LIKE 'Resolución: %' THEN 'Resolución'
        WHEN h.accion LIKE 'Bloqueo externo: %' THEN 'Bloqueo externo'
        ELSE 'Actualización'
      END,
      'mensaje', SUBSTRING(h.accion FROM '^[^:]+: (.*)$'),
      'fecha_hora', to_char(h.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ) ORDER BY h.created_at ASC)
    FROM ticket_historial h
    WHERE h.ticket_id = t.id
      AND (h.accion LIKE 'Seguimiento: %' OR h.accion LIKE 'Bloqueo externo: %' OR h.accion LIKE 'Resolución: %')
  ), '[]'::json) AS actualizaciones
`;

// 1. Listar todos los tickets con información relacional (Nombres de creador y departamento)
exports.listarTickets = async (req, res) => {
  try {
    const query = `
      SELECT 
        t.*, 
        to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at_local,
        to_char(t.fecha_resolucion AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS fecha_resolucion_local,
        ${historialPublicoSql},
        u.nombre AS creador_nombre, 
        u.email AS creador_email,
        d.nombre AS departamento_destino_nombre,
        u_asig.nombre AS asignado_nombre
      FROM tickets t
      JOIN usuarios u ON t.usuario_creador_id = u.id
      JOIN departamentos d ON t.departamento_destino_id = d.id
      LEFT JOIN usuarios u_asig ON t.asignado_a_id = u_asig.id
      WHERE t.estado <> 'resuelto'
        AND ($1::boolean OR t.usuario_creador_id = $2)
      ORDER BY t.created_at DESC;
    `;
    const adminRoles = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];
    const { rows } = await db.query(query, [adminRoles.includes(req.user.rol), req.user.id]);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al listar los tickets', error: error.message });
  }
};

// 2. Crear un Ticket y registrar el evento en el historial
exports.crearTicket = async (req, res) => {
  const { titulo, descripcion, departamento_destino_id, categoria, tipo_solicitud, prioridad, fecha_limite } = req.body;
  const usuario_creador_id = req.user.id;

  if (!titulo?.trim() || !descripcion?.trim() || !departamento_destino_id) {
    return res.status(400).json({ success: false, message: 'Título, descripción y área destino son obligatorios.' });
  }
  
  try {
    const adminRoles = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];
    if (!adminRoles.includes(req.user.rol)) {
      const setting = await db.query("SELECT valor FROM configuraciones WHERE clave = 'modo_mantenimiento'");
      if (setting.rows[0]?.valor === 'true') {
        return res.status(503).json({ success: false, message: 'El sistema está en mantenimiento; la creación de tickets está temporalmente pausada.' });
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
    const insertTicketQuery = `
      INSERT INTO tickets (titulo, descripcion, usuario_creador_id, departamento_destino_id, categoria, tipo_solicitud, prioridad, estado, fecha_limite)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'nuevo', $8)
      RETURNING *;
    `;
    const fechaLimite = fecha_limite || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const ticketValues = [titulo.trim(), descripcion.trim(), usuario_creador_id, departamento_destino_id, categoria || 'hardware', tipo_solicitud || 'incidencia', prioridad || 'media', fechaLimite];
    const newTicketResult = await client.query(insertTicketQuery, ticketValues);
    const ticketCreado = newTicketResult.rows[0];

    // SLA y enrutamiento automático por categoría/área. El responsable queda persistido desde la creación.
    const slaResult = await client.query(`SELECT id, horas_respuesta, horas_resolucion FROM sla_politicas
      WHERE activo=TRUE AND prioridad=$1 AND (categoria IS NULL OR LOWER(categoria)=LOWER($2))
      ORDER BY categoria NULLS LAST LIMIT 1`, [ticketCreado.prioridad, ticketCreado.categoria]);
    const sla = slaResult.rows[0];
    const fechaLimiteSla = sla ? new Date(Date.now() + Number(sla.horas_resolucion) * 3600000) : fechaLimite;
    const fechaRespuestaSla = sla ? new Date(Date.now() + Number(sla.horas_respuesta) * 3600000) : null;
    const responsable = await assignTicket(client, ticketCreado.id, ticketCreado.categoria, departamento_destino_id);
    await client.query(`UPDATE tickets SET fecha_limite=$1, fecha_limite_respuesta=$2, sla_politica_id=$3 WHERE id=$4`, [fechaLimiteSla, fechaRespuestaSla, sla?.id || null, ticketCreado.id]);
    ticketCreado.asignado_a_id = responsable;
    ticketCreado.fecha_limite = fechaLimiteSla;
    if (responsable) {
      const responsableResult = await client.query('SELECT nombre AS asignado_nombre FROM usuarios WHERE id=$1', [responsable]);
      ticketCreado.asignado_nombre = responsableResult.rows[0]?.asignado_nombre || null;
    }

    // Registrar en la tabla de historial (auditoría)
    const insertHistorialQuery = `
      INSERT INTO ticket_historial (ticket_id, usuario_id, accion)
      VALUES ($1, $2, $3);
    `;
    await client.query(insertHistorialQuery, [ticketCreado.id, usuario_creador_id, 'Creación del ticket']);
    await guardarImagenesEvidencia(client, {
      ticketId: ticketCreado.id,
      uploadedById: usuario_creador_id,
      files: req.files || []
    });
    await client.query('COMMIT');

    // Microsoft 365 es el primer aviso; un fallo de correo nunca cancela el ticket.
    const aviso = `Se creó el ticket #${ticketCreado.id}: ${ticketCreado.titulo}. Responsable: ${ticketCreado.asignado_nombre || 'Gerencia de IT'}.`;
    const destinatarios = await db.query(`SELECT email FROM usuarios WHERE rol='gerente_it' AND activo=TRUE OR id=$1`, [responsable]);
    destinatarios.rows.forEach(destinatario => microsoft.notifyTicket(ticketCreado, destinatario.email, `Nuevo ticket SGTI #${ticketCreado.id}`, `<p>${aviso}</p>`).catch(error => console.error('Aviso Microsoft:', error.message)));
    enviarAvisoTicket({ ticketId: ticketCreado.id, titulo: ticketCreado.titulo, descripcion: ticketCreado.descripcion, categoria: ticketCreado.categoria, prioridad: ticketCreado.prioridad, solicitante: req.user.email }).catch(error => console.error('Aviso al correo general de IT:', error.message));

    res.status(201).json({ 
      success: true, 
      message: 'Ticket creado exitosamente', 
      data: ticketCreado 
    });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al crear el ticket', error: error.message });
  }
};

exports.listarHistorial = async (req, res) => {
  try {
    const query = `
            SELECT t.*,
              to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at_local,
              u.nombre AS creador_nombre, u.email AS creador_email,
              d.nombre AS departamento_destino_nombre,
              (SELECT h.accion FROM ticket_historial h
          WHERE h.ticket_id = t.id AND h.accion LIKE 'Resolución: %'
          ORDER BY h.created_at DESC LIMIT 1) AS detalles_resolucion
      FROM tickets t
      JOIN usuarios u ON t.usuario_creador_id = u.id
      JOIN departamentos d ON t.departamento_destino_id = d.id
      WHERE t.estado = 'resuelto'
      ORDER BY t.fecha_resolucion DESC NULLS LAST;
    `;
    const { rows } = await db.query(query);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al cargar el historial', error: error.message });
  }
};

exports.listarHistorialTicket = async (req, res) => {
  try {
    const ticket = await db.query(`SELECT usuario_creador_id, asignado_a_id FROM tickets WHERE id=$1`, [req.params.id]);
    if (!ticket.rows.length) return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });
    const t = ticket.rows[0];
    const esAdmin = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'].includes(req.user.rol);
    if (!esAdmin && Number(t.usuario_creador_id) !== Number(req.user.id) && Number(t.asignado_a_id) !== Number(req.user.id)) return res.status(403).json({ success: false, message: 'No tiene acceso al historial.' });
    const { rows } = await db.query(`SELECT h.*, u.nombre AS usuario_nombre, u.rol AS usuario_rol FROM ticket_historial h LEFT JOIN usuarios u ON u.id=h.usuario_id WHERE h.ticket_id=$1 ORDER BY h.created_at ASC`, [req.params.id]);
    res.json({ success: true, data: rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.listarResueltosUsuario = async (req, res) => {
  try {
    const { rows } = await db.query(`
            SELECT t.*,
              to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at_local,
              to_char(t.fecha_resolucion AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS fecha_resolucion_local,
              ${historialPublicoSql},
              d.nombre AS departamento_destino_nombre,
             (SELECT SUBSTRING(h.accion FROM '^Resolución: (.*)$')
              FROM ticket_historial h
              WHERE h.ticket_id = t.id AND h.accion LIKE 'Resolución: %'
              ORDER BY h.created_at DESC LIMIT 1) AS detalles_resolucion,
             EXISTS (SELECT 1 FROM encuestas_satisfaccion e WHERE e.ticket_id = t.id) AS encuesta_enviada
      FROM tickets t
      JOIN departamentos d ON d.id = t.departamento_destino_id
      WHERE t.usuario_creador_id = $1 AND t.estado = 'resuelto'
      ORDER BY t.created_at DESC;
    `, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.enviarEncuesta = async (req, res) => {
  const calificacion = Number(req.body.calificacion);
  const comentario = typeof req.body.comentario === 'string' ? req.body.comentario.trim() : '';
  if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
    return res.status(400).json({ success: false, message: 'La calificación debe estar entre 1 y 5.' });
  }
  try {
    const result = await db.query(`
      INSERT INTO encuestas_satisfaccion (ticket_id, calificacion, comentario)
      SELECT t.id, $3, $4 FROM tickets t
      WHERE t.id = $1 AND t.usuario_creador_id = $2 AND t.estado = 'resuelto'
        AND NOT EXISTS (SELECT 1 FROM encuestas_satisfaccion e WHERE e.ticket_id = t.id)
      RETURNING *;
    `, [req.params.id, req.user.id, calificacion, comentario || null]);
    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado, no está resuelto o ya fue calificado.' });
    }
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Asignar Ticket a un Técnico (por Gerente IT o Admin)
exports.asignarTicket = async (req, res) => {
  const { id } = req.params; // ID del ticket
  const { asignado_a_id } = req.body;

  try {
    const updateQuery = `
      UPDATE tickets 
      SET asignado_a_id = $1, estado = 'en_proceso', updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING *;
    `;
    const { rows } = await db.query(updateQuery, [asignado_a_id, id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    }

    // Registrar en el historial
    await db.query(
      `INSERT INTO ticket_historial (ticket_id, usuario_id, accion) VALUES ($1, $2, $3)`,
      [id, req.user.id, `Asignó el ticket al técnico ID: ${asignado_a_id}`]
    );

    res.status(200).json({ success: true, message: 'Ticket asignado correctamente', data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al asignar el ticket', error: error.message });
  }
};

// 4. Resolver Ticket
exports.resolverTicket = async (req, res) => {
  const { id } = req.params;
  const { detalles_resolucion } = req.body;
  const usuario_id = req.user.id;

  try {
    const updateQuery = `
      UPDATE tickets 
      SET estado = 'resuelto', fecha_resolucion = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING *;
    `;
    const { rows } = await db.query(updateQuery, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    }

    // Registrar en historial
    await db.query(
      `INSERT INTO ticket_historial (ticket_id, usuario_id, accion) VALUES ($1, $2, $3)`,
      [id, usuario_id, `Resolución: ${detalles_resolucion || 'Resuelto por personal autorizado'}`]
    );

    res.status(200).json({ success: true, message: 'Ticket resuelto correctamente', data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al resolver el ticket', error: error.message });
  }
};

// 5. Enviar mensaje de chat interno en el ticket
exports.enviarMensaje = async (req, res) => {
  const { id } = req.params; // ticket_id
  const { mensaje } = req.body;

  try {
    const ticket = await db.query('SELECT usuario_creador_id, asignado_a_id FROM tickets WHERE id = $1', [id]);
    const adminRoles = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];
    if (!ticket.rowCount) return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });
    const esSolicitante = Number(ticket.rows[0].usuario_creador_id) === Number(req.user.id);
    const esResponsable = Number(ticket.rows[0].asignado_a_id) === Number(req.user.id);
    if (!esSolicitante && req.user.rol !== 'gerente_it' && (!adminRoles.includes(req.user.rol) || !esResponsable)) {
      return res.status(403).json({ success: false, message: 'No tiene acceso a esta conversación.' });
    }
    const messageText = typeof mensaje === 'string' ? mensaje.trim() : '';
    if (!messageText && !(req.files || []).length) return res.status(400).json({ success: false, message: 'Escriba un mensaje o adjunte una imagen.' });
    const client = await db.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const { rows } = await client.query(`
        INSERT INTO mensajes_ticket (ticket_id, remitente_id, mensaje)
        VALUES ($1, $2, $3)
        RETURNING *;
      `, [id, req.user.id, messageText || 'Adjuntó una imagen como evidencia.']);
      await guardarImagenesEvidencia(client, {
        ticketId: id,
        mensajeTicketId: rows[0].id,
        uploadedById: req.user.id,
        files: req.files || []
      });
      await client.query('COMMIT');
      transactionStarted = false;
      res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al enviar mensaje', error: error.message });
  }
};
