const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketAdvancedController');
const evidenceImageController = require('../controllers/evidenceImageController');
const { parseEvidenceImages, validarImagenes } = require('../middleware/uploadEvidenceImages');
const { authenticate, requireAdmin, requireManager } = require('../middleware/auth');

// Definición de Endpoints
router.use(authenticate);
router.get('/categorias', ticketController.listarCategorias);
router.get('/historial', requireAdmin, ticketController.listarHistorial);
router.get('/resueltos', ticketController.listarResueltosUsuario);
router.get('/', ticketController.listarTickets);
router.post('/', parseEvidenceImages, validarImagenes, ticketController.crearTicket);
router.get('/:ticket_id/imagenes', evidenceImageController.listarImagenesTicket);
router.get('/:id/historial', ticketController.listarHistorialTicket);
router.post('/:id/encuesta', ticketController.enviarEncuesta);
router.put('/:id/asignar', requireManager, ticketController.asignarTicket);
router.put('/:id/resolver', requireAdmin, ticketController.resolverTicket);
router.post('/:id/mensajes', parseEvidenceImages, validarImagenes, ticketController.enviarMensaje);

module.exports = router;
