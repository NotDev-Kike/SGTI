const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketAdvancedController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Definición de Endpoints
router.use(authenticate);
router.get('/historial', requireAdmin, ticketController.listarHistorial);
router.get('/resueltos', ticketController.listarResueltosUsuario);
router.get('/', ticketController.listarTickets);
router.post('/', ticketController.crearTicket);
router.post('/:id/encuesta', ticketController.enviarEncuesta);
router.put('/:id/asignar', requireAdmin, ticketController.asignarTicket);
router.put('/:id/resolver', requireAdmin, ticketController.resolverTicket);
router.post('/:id/mensajes', ticketController.enviarMensaje);

module.exports = router;