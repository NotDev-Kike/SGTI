const db = require('../config/db');

const adminRoles = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];

exports.listarAdmins = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.nombre, u.rol, d.nombre AS area
      FROM usuarios u
      LEFT JOIN departamentos d ON d.id = u.departamento_id
      WHERE u.activo = TRUE AND u.rol = ANY($1::text[])
      ORDER BY u.nombre;
    `, [adminRoles]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listarConversaciones = async (req, res) => {
  const isAdmin = adminRoles.includes(req.user.rol);
  const otherUserId = Number(isAdmin ? req.query.usuario_id : req.query.admin_id);
  try {
    if (isAdmin && !otherUserId) {
      const { rows } = await db.query(`
        SELECT c.id, c.solicitante_id AS usuario_id, u.nombre AS usuario_nombre,
               ultimo.mensaje AS ultimo_mensaje, ultimo.created_at,
               (SELECT COUNT(*)::int FROM mensajes_directos pendientes
                WHERE pendientes.conversacion_id = c.id
                  AND pendientes.leido = FALSE AND pendientes.remitente_id <> $1) AS pendientes
        FROM conversaciones_directas c
        JOIN usuarios u ON u.id = c.solicitante_id
        LEFT JOIN LATERAL (
          SELECT mensaje, created_at FROM mensajes_directos
          WHERE conversacion_id = c.id ORDER BY created_at DESC LIMIT 1
        ) ultimo ON TRUE
        WHERE c.admin_id = $1
        ORDER BY ultimo.created_at DESC NULLS LAST;
      `, [req.user.id]);
      return res.json({ success: true, data: rows });
    }

    if (!Number.isInteger(otherUserId) || otherUserId <= 0) {
      return res.status(400).json({ success: false, message: isAdmin ? 'Seleccione un usuario.' : 'Seleccione un administrador.' });
    }

    const pair = isAdmin
      ? [otherUserId, req.user.id]
      : [req.user.id, otherUserId];
    const conversationResult = await db.query(
      'SELECT id FROM conversaciones_directas WHERE solicitante_id = $1 AND admin_id = $2', pair
    );
    if (!conversationResult.rows.length) return res.json({ success: true, data: [] });

    const conversationId = conversationResult.rows[0].id;
    await db.query('UPDATE mensajes_directos SET leido = TRUE WHERE conversacion_id = $1 AND remitente_id <> $2', [conversationId, req.user.id]);
    const { rows } = await db.query(`
      SELECT m.*, u.nombre AS remitente_nombre
      FROM mensajes_directos m
      JOIN usuarios u ON u.id = m.remitente_id
      WHERE m.conversacion_id = $1
      ORDER BY m.created_at ASC;
    `, [conversationId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.enviarMensaje = async (req, res) => {
  const isAdmin = adminRoles.includes(req.user.rol);
  const recipientId = Number(isAdmin ? req.body.usuario_id : req.body.admin_id);
  const message = typeof req.body.mensaje === 'string' ? req.body.mensaje.trim() : '';
  if (!Number.isInteger(recipientId) || recipientId <= 0 || !message) {
    return res.status(400).json({ success: false, message: 'Destinatario y mensaje son obligatorios.' });
  }

  const requesterId = isAdmin ? recipientId : req.user.id;
  const adminId = isAdmin ? req.user.id : recipientId;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const recipient = await client.query('SELECT id, rol FROM usuarios WHERE id = $1 AND activo = TRUE', [recipientId]);
    if (!recipient.rowCount || (isAdmin ? adminRoles.includes(recipient.rows[0].rol) : !adminRoles.includes(recipient.rows[0].rol))) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Destinatario no encontrado.' });
    }

    const conversation = await client.query(`
      INSERT INTO conversaciones_directas (solicitante_id, admin_id) VALUES ($1, $2)
      ON CONFLICT (solicitante_id, admin_id) DO UPDATE SET admin_id = EXCLUDED.admin_id
      RETURNING id;
    `, [requesterId, adminId]);
    const { rows } = await client.query(`
      INSERT INTO mensajes_directos (conversacion_id, remitente_id, mensaje)
      VALUES ($1, $2, $3) RETURNING *;
    `, [conversation.rows[0].id, req.user.id, message]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};