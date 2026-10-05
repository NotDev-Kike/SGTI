const db = require('../config/db');

const adminRoles = new Set(['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo']);

const obtenerIdValido = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const responderError = (res, error, message) => {
  console.error(error);
  if (error.code === '42P01') {
    return res.status(503).json({ success: false, message: 'Aplique `npm run migrate:remote-assistance` desde backend para habilitar esta función.' });
  }
  return res.status(500).json({ success: false, message });
};

exports.listarPropias = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, anydesk_id, descripcion, estado, atendido_por_nombre,
             creada_en, iniciada_en, completada_en
      FROM solicitudes_asistencia_remota
      WHERE solicitante_id = $1
      ORDER BY creada_en DESC, id DESC
      LIMIT 20
    `, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    responderError(res, error, 'No se pudieron cargar sus solicitudes de asistencia.');
  }
};

exports.solicitar = async (req, res) => {
  if (adminRoles.has(req.user.rol)) {
    return res.status(403).json({ success: false, message: 'La solicitud de asistencia remota está disponible para usuarios finales.' });
  }
  const anydeskId = typeof req.body.anydesk_id === 'string' ? req.body.anydesk_id.trim() : '';
  const descripcion = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : '';
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._@-]{2,119}$/u.test(anydeskId)) {
    return res.status(400).json({ success: false, message: 'Ingrese un ID o alias válido de AnyDesk (3 a 120 caracteres, sin espacios).' });
  }
  if (descripcion.length > 1000) {
    return res.status(400).json({ success: false, message: 'La descripción no puede superar los 1,000 caracteres.' });
  }

  try {
    const { rows } = await db.query(`
      INSERT INTO solicitudes_asistencia_remota (solicitante_id, solicitante_nombre, solicitante_email, anydesk_id, descripcion)
      SELECT id, nombre, email, $2, $3
      FROM usuarios
      WHERE id = $1 AND activo = TRUE
      RETURNING id, anydesk_id, descripcion, estado, creada_en
    `, [req.user.id, anydeskId, descripcion]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'La cuenta ya no está activa.' });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ya tiene una solicitud activa; el equipo la atenderá antes de abrir otra.' });
    }
    responderError(res, error, 'No se pudo registrar la solicitud de asistencia.');
  }
};

exports.listarPendientes = async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, solicitante_nombre, solicitante_email, anydesk_id, descripcion,
             estado, atendido_por_id, atendido_por_nombre,
             creada_en, iniciada_en, completada_en
      FROM solicitudes_asistencia_remota
      WHERE estado IN ('pendiente', 'atendiendo')
      ORDER BY CASE WHEN estado = 'atendiendo' THEN 0 ELSE 1 END,
               CASE WHEN estado = 'pendiente' THEN creada_en END ASC,
               CASE WHEN estado = 'atendiendo' THEN iniciada_en END ASC,
               id ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    responderError(res, error, 'No se pudo cargar la cola de asistencia remota.');
  }
};

exports.tomar = async (req, res) => {
  const requestId = obtenerIdValido(req.params.id);
  if (!requestId) return res.status(400).json({ success: false, message: 'La solicitud seleccionada no es válida.' });
  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    const currentAdmin = await client.query('SELECT id, nombre FROM usuarios WHERE id = $1 FOR UPDATE', [req.user.id]);
    if (!currentAdmin.rowCount) {
      await client.query('ROLLBACK');
      return res.status(401).json({ success: false, message: 'La cuenta ya no está disponible.' });
    }
    const activeRequest = await client.query(`
      SELECT id FROM solicitudes_asistencia_remota
      WHERE atendido_por_id = $1 AND estado = 'atendiendo'
      LIMIT 1
    `, [req.user.id]);
    if (activeRequest.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Finalice la asistencia que ya tiene en curso antes de tomar otra solicitud.' });
    }
    const { rows } = await client.query(`
      UPDATE solicitudes_asistencia_remota
      SET estado = 'atendiendo', atendido_por_id = $2, atendido_por_nombre = $3,
          iniciada_en = CURRENT_TIMESTAMP, actualizada_en = CURRENT_TIMESTAMP
      WHERE id = $1 AND estado = 'pendiente'
      RETURNING id, solicitante_nombre, solicitante_email, anydesk_id, descripcion,
                estado, atendido_por_id, atendido_por_nombre, creada_en, iniciada_en
    `, [requestId, req.user.id, currentAdmin.rows[0].nombre]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      const existing = await db.query('SELECT estado FROM solicitudes_asistencia_remota WHERE id = $1', [requestId]);
      if (!existing.rowCount) return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
      return res.status(409).json({ success: false, message: 'La solicitud ya fue tomada, cancelada o finalizada.' });
    }
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    responderError(res, error, 'No se pudo tomar la solicitud.');
  } finally {
    client?.release();
  }
};

exports.finalizar = async (req, res) => {
  const requestId = obtenerIdValido(req.params.id);
  if (!requestId) return res.status(400).json({ success: false, message: 'La solicitud seleccionada no es válida.' });
  try {
    const { rows } = await db.query(`
      UPDATE solicitudes_asistencia_remota
      SET estado = 'completada', completada_en = CURRENT_TIMESTAMP, actualizada_en = CURRENT_TIMESTAMP
      WHERE id = $1 AND estado = 'atendiendo'
        AND (atendido_por_id = $2 OR $3 = 'gerente_it')
      RETURNING id, estado, completada_en
    `, [requestId, req.user.id, req.user.rol]);
    if (!rows.length) {
      const { rows: existing } = await db.query('SELECT estado FROM solicitudes_asistencia_remota WHERE id = $1', [requestId]);
      if (!existing.length) return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
      return res.status(409).json({ success: false, message: 'Solo quien atiende la solicitud o Gerencia de IT puede finalizarla.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    responderError(res, error, 'No se pudo finalizar la solicitud.');
  }
};

exports.cancelar = async (req, res) => {
  const requestId = obtenerIdValido(req.params.id);
  if (!requestId) return res.status(400).json({ success: false, message: 'La solicitud seleccionada no es válida.' });
  try {
    const { rows } = await db.query(`
      UPDATE solicitudes_asistencia_remota
      SET estado = 'cancelada', actualizada_en = CURRENT_TIMESTAMP
      WHERE id = $1 AND solicitante_id = $2 AND estado = 'pendiente'
      RETURNING id, estado
    `, [requestId, req.user.id]);
    if (!rows.length) return res.status(409).json({ success: false, message: 'Solo se pueden cancelar sus solicitudes que aún están pendientes.' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    responderError(res, error, 'No se pudo cancelar la solicitud.');
  }
};
