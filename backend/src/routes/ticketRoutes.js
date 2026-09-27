const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketAdvancedController');

// Definición de Endpoints
router.get('/', ticketController.listarTickets);
router.post('/', ticketController.crearTicket);
router.put('/:id/asignar', ticketController.asignarTicket);
router.put('/:id/resolver', ticketController.resolverTicket);
router.post('/:id/mensajes', ticketController.enviarMensaje);

module.exports = router;