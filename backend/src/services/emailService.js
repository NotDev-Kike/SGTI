const db = require('../config/db');
const nodemailer = require('nodemailer');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseRecipients = value => Array.from(new Set(
  String(value || '').split(/[\s,;]+/).map(email => email.trim().toLowerCase()).filter(Boolean)
));

const isSmtpConfigured = () => Boolean(
  process.env.SMTP_HOST &&
  (process.env.SMTP_FROM || process.env.SMTP_USER) &&
  (!process.env.SMTP_USER || process.env.SMTP_PASS)
);

const getReminderHour = () => {
  const hour = Number(process.env.EMAIL_REMINDER_HOUR || 8);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 8;
};

const createTransporter = () => {
  if (!isSmtpConfigured()) throw new Error('Falta configurar SMTP_HOST, SMTP_FROM y las credenciales SMTP del servidor.');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });
};

const leerAjustesCorreo = async () => {
  const { rows } = await db.query(
    "SELECT clave, valor FROM configuraciones WHERE clave IN ('alertas_email', 'alertas_destinatarios', 'alertas_ultimo_resumen')"
  );
  return Object.fromEntries(rows.map(({ clave, valor }) => [clave, valor]));
};

const guardarUltimoResumen = async fecha => {
  await db.query(`
    INSERT INTO configuraciones (clave, valor) VALUES ('alertas_ultimo_resumen', $1)
    ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = CURRENT_TIMESTAMP
  `, [fecha]);
};

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const enviarCorreoPrueba = async () => {
  const settings = await leerAjustesCorreo();
  const recipients = parseRecipients(settings.alertas_destinatarios);
  if (!recipients.length) throw new Error('Agregue y guarde al menos un correo destinatario antes de enviar la prueba.');
  if (recipients.some(email => !EMAIL_PATTERN.test(email))) throw new Error('La lista contiene un correo no válido.');

  const transporter = createTransporter();
  await transporter.verify();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject: 'Prueba de correo de SGTI',
    text: 'La configuración SMTP de SGTI funciona. Este es un correo de prueba para los avisos de soporte.',
    html: '<p>La configuración SMTP de SGTI funciona.</p><p>Este es un correo de prueba para los avisos de soporte.</p>'
  });
  return recipients.length;
};

const enviarAvisoTicket = async ({ ticketId, titulo, descripcion, categoria, prioridad, solicitante, destinatario }) => {
  const recipients = parseRecipients(destinatario || process.env.IT_GENERAL_EMAIL);
  if (!recipients.length || !isSmtpConfigured()) return { sent: false, reason: 'not-configured' };
  const transporter = createTransporter();
  const safe = value => escapeHtml(value || '—');
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject: `Nuevo ticket SGTI #${ticketId}: ${titulo}`,
    text: `Nuevo ticket #${ticketId}\n\nTítulo: ${titulo}\nCategoría: ${categoria}\nPrioridad: ${prioridad}\nSolicitante: ${solicitante}\n\n${descripcion}`,
    html: `<h2>Nuevo ticket SGTI #${ticketId}</h2><p><strong>${safe(titulo)}</strong></p><p>Categoría: ${safe(categoria)} · Prioridad: ${safe(prioridad)} · Solicitante: ${safe(solicitante)}</p><p>${safe(descripcion).replace(/\n/g, '<br>')}</p><p>Ingrese al helpdesk para atenderlo.</p>`
  });
  return { sent: true, recipients: recipients.length };
};

const fechaLocal = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const enviarResumenDiario = async () => {
  const settings = await leerAjustesCorreo();
  if (settings.alertas_email !== 'true') return { sent: false, reason: 'disabled' };
  const recipients = parseRecipients(settings.alertas_destinatarios);
  if (!recipients.length || !isSmtpConfigured()) return { sent: false, reason: 'not-configured' };

  const today = fechaLocal(new Date());
  if (settings.alertas_ultimo_resumen === today) return { sent: false, reason: 'already-sent' };

  const [ticketsResult, tareasResult] = await Promise.all([
    db.query(`
      SELECT id, titulo, estado, fecha_limite
      FROM tickets
      WHERE estado <> 'resuelto'
      ORDER BY fecha_limite ASC NULLS LAST, created_at ASC
      LIMIT 30
    `),
    db.query(`
      SELECT t.id, t.titulo, t.estado, t.fecha_limite, u.nombre AS asignado_nombre
      FROM tareas_it t
      LEFT JOIN usuarios u ON u.id = t.asignado_a_id
      WHERE t.estado NOT IN ('completada', 'cancelada')
        AND t.fecha_limite <= CURRENT_DATE + INTERVAL '1 day'
      ORDER BY t.fecha_limite ASC
      LIMIT 30
    `)
  ]);
  const tickets = ticketsResult.rows;
  const tareas = tareasResult.rows;
  if (!tickets.length && !tareas.length) return { sent: false, reason: 'empty' };

  const formatDate = value => value ? new Date(value).toLocaleDateString('es') : 'Sin fecha límite';
  const ticketText = tickets.map(ticket => `#${ticket.id} ${ticket.titulo} · ${ticket.estado} · ${formatDate(ticket.fecha_limite)}`);
  const taskText = tareas.map(task => `${task.titulo} · ${task.asignado_nombre || 'Sin responsable'} · ${formatDate(task.fecha_limite)}`);
  const sections = [
    `<h2>Tickets activos (${tickets.length})</h2><ul>${tickets.map(ticket => `<li>#${ticket.id} ${escapeHtml(ticket.titulo)} · ${escapeHtml(ticket.estado)} · ${escapeHtml(formatDate(ticket.fecha_limite))}</li>`).join('')}</ul>`,
    `<h2>Tareas próximas o vencidas (${tareas.length})</h2><ul>${tareas.map(task => `<li>${escapeHtml(task.titulo)} · ${escapeHtml(task.asignado_nombre || 'Sin responsable')} · ${escapeHtml(formatDate(task.fecha_limite))}</li>`).join('')}</ul>`
  ];
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject: `Recordatorio SGTI: ${tickets.length} tickets activos y ${tareas.length} tareas próximas`,
    text: `Resumen diario de SGTI\n\nTickets activos (${tickets.length}):\n${ticketText.join('\n') || 'Ninguno'}\n\nTareas próximas o vencidas (${tareas.length}):\n${taskText.join('\n') || 'Ninguna'}`,
    html: `<h1>Resumen diario de SGTI</h1>${sections.join('')}`
  });
  await guardarUltimoResumen(today);
  return { sent: true, recipients: recipients.length };
};

const getEmailStatus = async () => {
  const settings = await leerAjustesCorreo();
  const recipients = parseRecipients(settings.alertas_destinatarios);
  return {
    smtp_configurado: isSmtpConfigured(),
    alertas_habilitadas: settings.alertas_email === 'true',
    destinatarios: recipients.length,
    hora_resumen: getReminderHour()
  };
};

const iniciarRecordatoriosCorreo = () => {
  const hour = getReminderHour();
  let lastAttemptDate = '';
  let running = false;
  const check = async () => {
    const now = new Date();
    const today = fechaLocal(now);
    if (now.getHours() !== hour || lastAttemptDate === today || running) return;
    running = true;
    try {
      await enviarResumenDiario();
      lastAttemptDate = today;
    } catch (error) {
      console.error('No se pudo enviar el resumen diario de SGTI:', error.message);
    } finally {
      running = false;
    }
  };
  check();
  const timer = setInterval(check, 60 * 1000);
  timer.unref();
};

module.exports = {
  EMAIL_PATTERN,
  getEmailStatus,
  iniciarRecordatoriosCorreo,
  parseRecipients,
  enviarCorreoPrueba,
  enviarAvisoTicket
};
